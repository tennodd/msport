// M_Code_Index access layer — the single join surface between 1C and Wix Stores.
// Every availability flow resolves through here; never query Stores by Артикул
// or by size string. The mCode key carries the Cyrillic М (U+041C) prefix —
// preserve it byte-for-byte, never normalize to Latin M (U+004D).

import wixData from 'wix-data';

const COLLECTION = 'M_Code_Index';

/**
 * Look up a single mapping row by its M-code.
 * @param {string} mCode e.g. "М0049909" (Cyrillic М)
 * @returns {Promise<object|null>} the M_Code_Index row, or null if unmapped
 */
export async function findByMCode(mCode) {
    if (!mCode) return null;
    const res = await wixData.query(COLLECTION)
        .eq('mCode', mCode)
        .limit(1)
        .find({ suppressAuth: true });
    return res.items.length ? res.items[0] : null;
}

/**
 * Stamp lastSynced on a mapping row. Best-effort — never throws.
 * @param {object} row a full M_Code_Index row (must include _id)
 */
export async function touchLastSynced(row) {
    try {
        await wixData.update(COLLECTION, { ...row, lastSynced: new Date() }, { suppressAuth: true });
    } catch (e) {
        console.error('MAPPING: не вдалось оновити lastSynced', e);
    }
}

/**
 * Cursor-based iterator over the whole index, for reconciliation export.
 * Robust past the ~1000-item ceiling that skip-based paging hits.
 * @param {number} pageSize
 */
export async function* iterateMappings(pageSize = 100) {
    let page = await wixData.query(COLLECTION).limit(pageSize).find({ suppressAuth: true });
    while (true) {
        for (const item of page.items) yield item;
        if (!page.hasNext()) break;
        page = await page.next();
    }
}
