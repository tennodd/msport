// M-code-keyed availability sync (1C -> Wix). Non-destructive: variants are
// permanent; out-of-stock flips `inStock` to false, never removes a choice.
//
// PHASE 1: skeleton only — contract is fixed, logic lands in phase 2.
// PHASE 2 plan (refactor doc §4):
//   for each { mCode, available }:
//     row = findByMCode(mCode)
//     if !row -> result "unmapped" (logged, does NOT fail the batch)
//     else    -> wixStoresBackend.updateInventoryVariantFieldsByProductId(
//                   row.productId, [{ variantId: row.variantId, inStock: available }])
//                touchLastSynced(row); result "updated"
//   return { processed, results }

// import wixStoresBackend from 'wix-stores-backend';
// import { findByMCode, touchLastSynced } from 'backend/sync/mapping';
// import { writeLog } from 'backend/sync/log';

/**
 * @param {Array<{mCode:string, available:boolean}>} items
 * @returns {Promise<{processed:number, results:Array}>}
 */
export async function syncAvailability(items) { // eslint-disable-line no-unused-vars
    throw new Error('syncAvailability not implemented yet (phase 2)');
}
