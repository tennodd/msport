// Thin HTTP route handlers. All integration logic lives in backend/sync/*.
// Architecture: M-code-keyed, non-destructive 1C -> Wix availability sync.
// See the M-code refactor doc for the full design.

import { ok, badRequest, serverError, response } from 'wix-http-functions';
import { handleSyncFrom1c, handleExport } from 'backend/sync/legacy';
import { isAuthorized } from 'backend/sync/auth';
import { syncAvailability } from 'backend/sync/availability';
import { iterateMappings } from 'backend/sync/mapping';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// ---------------------------------------------------------------------------
// LEGACY endpoints — DEPRECATED. Kept operational during the 1C cutover only.
// Behavior is frozen in backend/sync/legacy. Do not modify.
//
// NOT auth-gated yet: 1C does not send x-sync-token until the Phase 4 cutover.
// Gating these now would break the live sync. To enable at cutover, uncomment
// the isAuthorized guard below (matching the new endpoints).
// ---------------------------------------------------------------------------

// DEPRECATED: product-level SKU match + fuzzy size + destructive choice removal.
// Superseded by post_syncAvailabilityFrom1c. Decommission after 1C confirms cutover.
export async function post_syncFrom1c(request) {
    // TODO(phase-4): if (!(await isAuthorized(request))) return unauthorized();
    return handleSyncFrom1c(request);
}

// DEPRECATED: skip-based full-catalog CSV dump. Superseded by get_exportMapping.
export async function get_export(request) {
    // TODO(phase-4): if (!(await isAuthorized(request))) return unauthorized();
    return handleExport(request);
}

// ---------------------------------------------------------------------------
// NEW endpoints — M-code keyed. Shared-secret gated.
// ---------------------------------------------------------------------------

// POST { items: [{ mCode, available }, ...] }  (a bare array is also accepted)
// Header: x-sync-token: <sync_token_1c>
export async function post_syncAvailabilityFrom1c(request) {
    if (!(await isAuthorized(request))) return unauthorized();
    try {
        const body = await request.body.json();
        const items = Array.isArray(body) ? body : (body && body.items);
        if (!Array.isArray(items)) {
            return badRequest({
                headers: JSON_HEADERS,
                body: JSON.stringify({ success: false, error: 'Expected { items: [{ mCode, available }] }' })
            });
        }
        const { processed, results } = await syncAvailability(items);
        return ok({ headers: JSON_HEADERS, body: JSON.stringify({ success: true, processed, results }) });
    } catch (e) {
        return serverError({ headers: JSON_HEADERS, body: JSON.stringify({ success: false, error: e.message }) });
    }
}

// GET — dumps M_Code_Index as CSV for 1C reconciliation. Cursor-paged (robust
// past the ~1000-item ceiling). Header: x-sync-token: <sync_token_1c>
export async function get_exportMapping(request) {
    if (!(await isAuthorized(request))) return unauthorized();
    try {
        let csv = '﻿mCode;productId;variantId;parentArtikul;sizeLabel;currentInStock\n';
        for await (const row of iterateMappings()) {
            csv += [
                row.mCode, row.productId, row.variantId,
                row.parentArtikul, row.sizeLabel, row.currentInStock
            ].map(csvCell).join(';') + '\n';
        }
        return ok({
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': 'attachment; filename=m_code_index.csv'
            },
            body: csv
        });
    } catch (e) {
        return serverError({ headers: JSON_HEADERS, body: JSON.stringify({ success: false, error: e.message }) });
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// 401 with no payload echo — probes shouldn't be able to spam the logs.
function unauthorized() {
    return response({
        status: 401,
        headers: JSON_HEADERS,
        body: JSON.stringify({ success: false, error: 'Unauthorized' })
    });
}

// Quote a CSV cell only when it contains the delimiter, quotes, or newlines.
function csvCell(value) {
    if (value === undefined || value === null) return '';
    const s = String(value);
    return /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
