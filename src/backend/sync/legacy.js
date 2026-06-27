// =================================================
// LEGACY SYNC — FROZEN. DO NOT CHANGE BEHAVIOR.
// =================================================
// Original 1C -> Wix sync: product-level SKU match, fuzzy size matching
// (Levenshtein), and DESTRUCTIVE removal of size choices from productOptions.
// Superseded by the M-code-keyed flow in backend/sync/availability.
// Kept operational only during the 1C cutover window; decommission afterwards.
//
// Known legacy quirks intentionally preserved (see refactor doc §2):
//   - the "Опцію 'Розмір' не знайдено" branch returns success:true on an error
//   - productOptions Object reconstruction collapses duplicate-name options
//   - get_export uses skip-based pagination (degrades past ~1000 items)

import { ok, badRequest } from 'wix-http-functions';
import wixData from 'wix-data';
import wixStoresBackend from 'wix-stores-backend';
import { logSyncActivity } from 'backend/sync/log';

// --- КОНФИГУРАЦИЯ ---
const FUZZY_MATCH_THRESHOLD = 1;

// --- "СУПЕР-НОРМАЛИЗАТОР" РАЗМЕРОВ ---
function normalizeSize(size) {
    if (!size) return '';
    let normalized = size.toString().trim().toLowerCase();
    normalized = normalized.replace(/xxxl/g, '3xl').replace(/xxl/g, '2xl').replace(/хххл/g, '3xl').replace(/ххл/g, '2xl').replace(/хл/g, 'xl');
    normalized = normalized.replace(/,/g, '.').replace(/ /g, '').replace(/1\/2/g, '.5');
    return normalized.replace(/[^a-z0-9.]/g, '');
}

// --- ФУНКЦИЯ: Расчет "похожести" строк (Расстояние Левенштейна) ---
function levenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
    for (let j = 1; j <= b.length; j++) {
        for (let i = 1; i <= a.length; i++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(matrix[j][i - 1] + 1, matrix[j - 1][i] + 1, matrix[j - 1][i - 1] + cost);
        }
    }
    return matrix[b.length][a.length];
}

// --- ГЛАВНЫЙ ЭНДПОИНТ (POST) ---
export async function handleSyncFrom1c(request) {
    console.log("INFO: Отримано запит на синхронізацію з 1С.");
    try {
        const outOfStockItems = await request.body.json();
        if (!Array.isArray(outOfStockItems)) {
            const responseBody = { success: false, error: 'Тіло запиту має бути JSON-масивом' };
            await logSyncActivity(null, null, "Помилка", "Тіло запиту - не масив");
            return badRequest({ body: JSON.stringify(responseBody) });
        }
        console.log(`INFO: Починаємо обробку ${outOfStockItems.length} позицій.`);
        const results = [];
        for (const item of outOfStockItems) {
            if (!item.sku || !item.size) {
                results.push({ ...item, success: false, error: 'Пропущено SKU або розмір' });
                await logSyncActivity(item.sku, item.size, "Помилка", "Пропущено SKU або розмір");
                continue;
            }
            const result = await removeSizeFromProduct(item.sku, item.size);
            results.push(result);
        }
        console.log("SUCCESS: Синхронизація завершена.");
        const responseBody = { success: true, message: 'Синхронізацію завершено', results };
        return ok({ body: JSON.stringify(responseBody) });
    } catch (error) {
        console.error("FATAL: Критична помилка функції syncFrom1c:", error);
        await logSyncActivity(null, null, "Критична помилка", error.message);
        const responseBody = { success: false, error: error.message };
        return badRequest({ body: JSON.stringify(responseBody) });
    }
}

// --- ОСНОВНАЯ ЛОГИКА ---
async function removeSizeFromProduct(sku, sizeToRemove) {
    let logMessage = null;

    try {
        const normalizedSizeToRemove = normalizeSize(sizeToRemove);
        if (!normalizedSizeToRemove) {
            await logSyncActivity(sku, sizeToRemove, "Помилка", "Передано порожній або некоректний розмір");
            return { sku, size: sizeToRemove, success: false, error: 'Передано порожній або некоректний розмір' };
        }
        const queryResult = await wixData.query("Stores/Products").eq("sku", sku).find();
        if (queryResult.items.length === 0) {
            await logSyncActivity(sku, sizeToRemove, "Не знайдено", "Товар з таким SKU не знайдено на сайті");
            return { sku, size: sizeToRemove, success: false, error: 'Товар не знайдено' };
        }
        const product = queryResult.items[0];
        const productId = product._id;

        let productOptionsToUpdate, originalOptions = product.productOptions;
        if (Array.isArray(originalOptions)) {
            productOptionsToUpdate = originalOptions;
        } else if (typeof originalOptions === 'object' && originalOptions !== null) {
            const sizeOptionKey = Object.keys(originalOptions).find(key => key.toLowerCase() === 'розмір' || key.toLowerCase() === 'размер' || key.toLowerCase() === 'size');
            if (sizeOptionKey) {
                productOptionsToUpdate = Object.values(originalOptions);
            } else {
                await logSyncActivity(sku, sizeToRemove, "Помилка", 'Опцію "Розмір" не знайдено в товарі');
                return { sku, size: sizeToRemove, success: true, message: 'Опцію "Розмір" не знайдено' };
            }
        } else {
            await logSyncActivity(sku, sizeToRemove, "Успіх", "У товару немає опцій для видалення");
            return { sku, size: sizeToRemove, success: true, message: 'У товару немає опцій для видалення' };
        }

        let sizeFound = false;
        let choiceToRemove = null;

        for (const option of productOptionsToUpdate) {
            for (const choice of option.choices) {
                if (normalizeSize(choice.description) === normalizedSizeToRemove) {
                    choiceToRemove = choice.description;
                    sizeFound = true;
                    break;
                }
            }
            if (sizeFound) break;
        }

        if (!sizeFound) {
            let bestMatch = { description: null, distance: Infinity };
            for (const option of productOptionsToUpdate) {
                for (const choice of option.choices) {
                    const distance = levenshteinDistance(normalizeSize(choice.description), normalizedSizeToRemove);
                    if (distance < bestMatch.distance) {
                        bestMatch = { description: choice.description, distance: distance };
                    }
                }
            }
            if (bestMatch.distance <= FUZZY_MATCH_THRESHOLD) {
                choiceToRemove = bestMatch.description;
                sizeFound = true;
                logMessage = `Нечіткий збіг: розмір від 1С "${sizeToRemove}" видалив розмір на сайті "${choiceToRemove}" (відстань: ${bestMatch.distance})`;
                await logSyncActivity(sku, sizeToRemove, "Нечіткий збіг", logMessage);
            }
        }

        if (!sizeFound) {
            await logSyncActivity(sku, sizeToRemove, "Не знайдено", "Розмір не знайдено у товарі, найближчий збіг не підійшов");
            return { sku, size: sizeToRemove, success: false, error: 'Вказаний розмір не знайдено у товарі' };
        }

        let updatedProductOptions = productOptionsToUpdate.map(option => {
            const remainingChoices = option.choices.filter(choice => choice.description !== choiceToRemove);
            return { ...option, choices: remainingChoices };
        }).filter(option => option.choices && option.choices.length > 0);

        let updateFields = {};
        const totalRemainingChoices = updatedProductOptions.reduce((total, option) => total + (option.choices?.length || 0), 0);
        if (totalRemainingChoices === 0) {
            updateFields = { visible: false, productOptions: [], manageVariants: false };
        } else {
            if (Array.isArray(originalOptions)) {
                updateFields = { productOptions: updatedProductOptions };
            } else {
                const updatedOptionsObject = {};
                updatedProductOptions.forEach(opt => { updatedOptionsObject[opt.name] = opt; });
                updateFields = { productOptions: updatedOptionsObject };
            }
        }

        await wixStoresBackend.updateProductFields(productId, updateFields);

        if (!logMessage) {
             const successMessage = `Розмір "${choiceToRemove}" успішно видалено.`;
             await logSyncActivity(sku, sizeToRemove, "Успіх", successMessage + (totalRemainingChoices === 0 ? " Товар приховано." : ""));
        }

        return { sku, size: sizeToRemove, success: true, message: totalRemainingChoices === 0 ? 'Товар приховано' : 'Розмір видалено' };

    } catch (error) {
        console.error(`ERROR: Помилка при обробці артикул [${sku}], розмір [${sizeToRemove}]:`, error);
        await logSyncActivity(sku, sizeToRemove, "Критична помилка", error.message);
        return { sku, size: sizeToRemove, success: false, error: error.message };
    }
}

// =================================================
// LEGACY EXPORT (Wix -> 1C CSV dump)
// =================================================

export async function handleExport(request) {
    const response = {
        "headers": {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": "attachment; filename=sku_size_dump.csv"
        }
    };

    try {
        // Fetch all products
        const allProducts = await getAllProducts();

        let csvContent = "﻿Артикул;Размер\n";

        allProducts.forEach(product => {
            const sku = product.sku ? product.sku.trim() : "";
            if (!sku) return;

            // --- ROBUST OPTION PARSING ---
            let optionsList = [];

            // Handle both Array and Object formats
            if (Array.isArray(product.productOptions)) {
                optionsList = product.productOptions;
            } else if (product.productOptions && typeof product.productOptions === 'object') {
                optionsList = Object.values(product.productOptions);
            }

            // Find the size option
            const sizeOption = optionsList.find(opt =>
                opt.name === "Розмір" || opt.name === "Size" || opt.name === "Sizes"
            );

            if (sizeOption && sizeOption.choices && sizeOption.choices.length > 0) {
                sizeOption.choices.forEach(choice => {
                    csvContent += `${sku};${choice.description}\n`;
                });
            } else {
                csvContent += `${sku};Нет размера\n`;
            }
        });

        response.body = csvContent;
        return ok(response);

    } catch (error) {
        response.body = "Ошибка создания CSV: " + error.message;
        return ok(response);
    }
}

// Optimized Helper (Limit fixed to 100)
async function getAllProducts() {
    let allItems = [];
    let hasNext = true;
    let skip = 0;
    const limit = 100;

    while (hasNext) {
        const results = await wixData.query("Stores/Products")
            .limit(limit)
            .skip(skip)
            .fields("sku", "productOptions")
            .find({ suppressAuth: true });

        if (results.items.length > 0) {
            allItems = allItems.concat(results.items);
            skip += limit;
        } else {
            hasNext = false;
        }
    }
    return allItems;
}
