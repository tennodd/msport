// =================================================
// PHASE 3 BOOTSTRAP — populate M_Code_Index.
// =================================================
// One row per existing Wix variant, mapped to its canonical 1C M-code.
// Run MANUALLY, in batches (see `skip`), starting with dryRun. Idempotency is
// NOT guaranteed — don't run the same batch twice against the live collection
// without clearing it first.
//
// Decoupled from xlsx parsing: the caller passes already-parsed 1C rows. Each
// row is expected as:
//   { kod, artikul, razmer, naim, vid }
// mapping the 1C columns Код / Артикул / Размер / Наименование / "Вид номенклатури".
// `kod` MUST preserve the Cyrillic М (U+041C) prefix exactly.
//
// Matching (refactor doc §5): for each Wix variant, find 1C rows where
// Артикул == product.sku AND normalize(Размер) == normalize(variant size).
//   0 candidates -> BootstrapUnmapped
//   1 candidate  -> M_Code_Index row
//   >1 candidates -> pick highest M-code sequence (newest), log BootstrapReview

import wixData from 'wix-data';
import wixStoresBackend from 'wix-stores-backend';

// Size normalization for the bootstrap JOIN ONLY. After bootstrap, M-codes carry
// through and this is never used again. Ported from the legacy normalizeSize plus
// the catalog-specific generic labels from the doc. NOTE: this intentionally
// strips Cyrillic letters from SIZE strings — never apply it to M-codes.
function normalizeSize(size) {
    if (size === null || size === undefined) return '';
    let s = size.toString().trim().toLowerCase();
    s = s.replace(/xxxl/g, '3xl').replace(/xxl/g, '2xl')
         .replace(/хххл/g, '3xl').replace(/ххл/g, '2xl').replace(/хл/g, 'xl');
    s = s.replace(/,/g, '.').replace(/1\/2/g, '.5').replace(/½/g, '.5');
    s = s.replace(/дорослий|дор\.?|adult/g, 'adult').replace(/один|one|tu/g, 'tu');
    s = s.replace(/\s+/g, '');
    return s.replace(/[^a-z0-9.]/g, '');
}

// "М0049909" -> 49909. Used only to pick the newest among duplicates.
function mCodeSequence(kod) {
    const digits = (kod || '').replace(/\D/g, '');
    return digits ? parseInt(digits, 10) : -1;
}

// Pull the size label from a Wix variant's choices, tolerant of the option being
// named Розмір / Размер / Size. Falls back to the sole value for single-option products.
function variantSizeLabel(choices) {
    if (!choices) return '';
    for (const key of Object.keys(choices)) {
        const k = key.toLowerCase();
        if (k === 'розмір' || k === 'размер' || k === 'size') return choices[key];
    }
    const vals = Object.values(choices);
    return vals.length === 1 ? vals[0] : '';
}

// artikul -> normalizedSize -> [rows]. Товар only, must have an Артикул.
function build1cIndex(rows1c) {
    const index = {};
    for (const r of rows1c) {
        if (r.vid && r.vid.trim() !== 'Товар') continue;
        const art = (r.artikul || '').trim();
        if (!art) continue;
        const nsize = normalizeSize(r.razmer);
        const byArt = index[art] || (index[art] = {});
        (byArt[nsize] || (byArt[nsize] = [])).push(r);
    }
    return index;
}

/**
 * Process one batch of products.
 * @param {Array<{kod,artikul,razmer,naim,vid}>} rows1c full parsed 1C export
 * @param {{dryRun?:boolean, skip?:number, pageSize?:number}} options
 * @returns {Promise<object>} summary + nextSkip (null when done)
 */
export async function bootstrapMcodeIndex(rows1c, options = {}) {
    const { dryRun = true, skip = 0, pageSize = 50 } = options;
    const index = build1cIndex(rows1c);

    const summary = { dryRun, skip, pageSize, products: 0, variants: 0, mapped: 0, ambiguous: 0, unmapped: 0, samples: [] };

    const res = await wixData.query('Stores/Products')
        .limit(pageSize)
        .skip(skip)
        .find({ suppressAuth: true });

    for (const product of res.items) {
        summary.products++;
        const parentArtikul = (product.sku || '').trim();
        const variants = await wixStoresBackend.getProductVariants(product._id);

        for (const v of variants) {
            summary.variants++;
            const variantId = v._id;
            const sizeLabel = variantSizeLabel(v.choices);
            const candidates = ((index[parentArtikul] || {})[normalizeSize(sizeLabel)]) || [];

            if (candidates.length === 0) {
                summary.unmapped++;
                if (!dryRun) {
                    await wixData.insert('BootstrapUnmapped',
                        { parentArtikul, sizeLabel, productId: product._id, variantId, reason: 'no_1c_match' },
                        { suppressAuth: true });
                }
                continue;
            }

            const sorted = [...candidates].sort((a, b) => mCodeSequence(b.kod) - mCodeSequence(a.kod));
            const chosen = sorted[0];
            const ambiguous = candidates.length > 1;

            if (!dryRun) {
                await wixData.insert('M_Code_Index', {
                    mCode: chosen.kod,
                    productId: product._id,
                    variantId,
                    parentArtikul,
                    sizeLabel,
                    notes: ambiguous ? 'ambiguous_bootstrap' : ''
                }, { suppressAuth: true });

                if (ambiguous) {
                    await wixData.insert('BootstrapReview', {
                        mCodeChosen: chosen.kod,
                        mCodeAlternatives: sorted.slice(1).map(r => r.kod).join(';'),
                        parentArtikul, sizeLabel, productId: product._id, variantId,
                        reason: 'ambiguous_bootstrap'
                    }, { suppressAuth: true });
                }
            }

            summary.mapped++;
            if (ambiguous) summary.ambiguous++;
            if (summary.samples.length < 10) {
                summary.samples.push({ parentArtikul, sizeLabel, mCode: chosen.kod, ambiguous });
            }
        }
    }

    summary.nextSkip = res.items.length === pageSize ? skip + pageSize : null;
    summary.totalProducts = res.totalCount;
    return summary;
}
