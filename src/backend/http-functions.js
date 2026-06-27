// Thin HTTP route handlers. All integration logic lives in backend/sync/*.
// Architecture: M-code-keyed, non-destructive 1C -> Wix availability sync.
// See the M-code refactor doc for the full design.

import { response } from 'wix-http-functions';
import { handleSyncFrom1c, handleExport } from 'backend/sync/legacy';

// ---------------------------------------------------------------------------
// LEGACY endpoints — DEPRECATED. Kept operational during the 1C cutover only.
// Behavior is frozen in backend/sync/legacy. Do not modify.
// ---------------------------------------------------------------------------

// DEPRECATED: product-level SKU match + fuzzy size + destructive choice removal.
// Superseded by post_syncAvailabilityFrom1c. Decommission after 1C confirms cutover.
export function post_syncFrom1c(request) {
    return handleSyncFrom1c(request);
}

// DEPRECATED: skip-based full-catalog CSV dump. Superseded by get_exportMapping.
export function get_export(request) {
    return handleExport(request);
}

// ---------------------------------------------------------------------------
// NEW endpoints — M-code keyed. Stubbed in phase 1; logic lands in phase 2.
// ---------------------------------------------------------------------------

// TODO(phase-2): verify shared secret -> syncAvailability(items) -> log per item.
export function post_syncAvailabilityFrom1c() {
    return notImplemented();
}

// TODO(phase-2): verify shared secret -> stream M_Code_Index as CSV (cursor-paged).
export function get_exportMapping() {
    return notImplemented();
}

function notImplemented() {
    return response({
        status: 501,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Not implemented yet (phase 2)' })
    });
}
