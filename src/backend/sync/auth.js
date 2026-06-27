// Shared-secret authentication for the 1C sync endpoints.
// 1C sends `x-sync-token: <secret>`; we compare against the value stored in
// Wix Secrets Manager under key `sync_token_1c`. Fail closed on any error.
//
// NOTE: implemented in phase 1 but not yet enforced on any endpoint.
// Wiring into the route handlers happens in phase 2 (refactor doc §4 security).

import { getSecret } from 'wix-secrets-backend';

export const TOKEN_HEADER = 'x-sync-token';
const TOKEN_SECRET_KEY = 'sync_token_1c';

/**
 * @param {object} request Wix http-functions request
 * @returns {Promise<boolean>} true only if the request carries the correct token
 */
export async function isAuthorized(request) {
    try {
        const provided = getHeader(request, TOKEN_HEADER);
        if (!provided) return false;
        const expected = await getSecret(TOKEN_SECRET_KEY);
        if (!expected) return false;
        return timingSafeEqual(provided, expected);
    } catch (e) {
        // Missing secret config, transient secrets-backend error, etc. -> deny.
        console.error('AUTH: помилка перевірки токена', e);
        return false;
    }
}

// Wix http-functions lowercases header keys; guard for both just in case.
function getHeader(request, name) {
    const headers = (request && request.headers) || {};
    return headers[name] || headers[name.toLowerCase()] || null;
}

// Constant-time-ish comparison to avoid leaking length/prefix via timing.
function timingSafeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
        return false;
    }
    let mismatch = 0;
    for (let i = 0; i < a.length; i++) {
        mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return mismatch === 0;
}
