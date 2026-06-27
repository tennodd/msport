// M-code-keyed availability sync (1C -> Wix). Non-destructive: variants are
// permanent; out-of-stock flips `inStock` to false, never removes a choice.
// 1C is the sole source of stock truth — we store a boolean, never quantities.

import wixStoresBackend from 'wix-stores-backend';
import { findByMCode, markSynced } from 'backend/sync/mapping';
import { writeLog } from 'backend/sync/log';

/**
 * Process a batch of availability events.
 * Unknown M-codes are reported (status "unmapped") but never fail the batch.
 * @param {Array<{mCode:string, available:boolean}>} items
 * @returns {Promise<{processed:number, results:Array}>}
 */
export async function syncAvailability(items) {
    const results = [];
    for (const item of items) {
        const mCode = item && item.mCode;
        const available = !!(item && item.available);
        results.push(await applyOne(mCode, available));
    }
    return { processed: results.length, results };
}

async function applyOne(mCode, available) {
    if (!mCode) {
        await writeLog({ mCode: null, status: 'invalid', message: 'Пропущено mCode' });
        return { mCode: null, status: 'invalid', error: 'mCode is required' };
    }
    try {
        const row = await findByMCode(mCode);
        if (!row) {
            await writeLog({ mCode, status: 'unmapped', message: 'M-code not in index' });
            return { mCode, status: 'unmapped', error: 'M-code not in index' };
        }
        await setVariantInStock(row.productId, row.variantId, available);
        await markSynced(row, available);
        await writeLog({ mCode, status: 'updated', message: `inStock=${available} variant=${row.variantId}` });
        return { mCode, status: 'updated', variantId: row.variantId, available };
    } catch (e) {
        await writeLog({ mCode, status: 'error', message: e.message });
        return { mCode, status: 'error', error: e.message };
    }
}

// Catalog V1 inventory update. We set the per-variant `inStock` boolean and
// never touch quantity. The mapping row already carries productId + variantId,
// so no lookup against Stores by Артикул/size is needed.
//
// NOTE: confirm this payload shape against the Wix runtime during cutover
// testing — `updateInventoryVariantFieldsByProductId(productId, inventoryItem)`
// where inventoryItem carries a `variants` array.
async function setVariantInStock(productId, variantId, inStock) {
    await wixStoresBackend.updateInventoryVariantFieldsByProductId(productId, {
        variants: [{ variantId, inStock }]
    });
}
