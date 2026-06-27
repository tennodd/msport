// SyncLogs helper — shared by every sync flow.
// Logging must never break a sync, so every writer swallows its own errors.

import wixData from 'wix-data';

const LOG_COLLECTION = 'SyncLogs';
const MAX_MESSAGE_LEN = 1000;

/**
 * Generic SyncLogs writer. Stamps `timestamp`, truncates `message`, never throws.
 * Known columns: timestamp, sku, size1c, mCode, status, message.
 * @param {object} entry partial log record
 */
export async function writeLog(entry) {
    try {
        const record = { timestamp: new Date(), ...entry };
        if (record.message != null) {
            record.message = String(record.message).substring(0, MAX_MESSAGE_LEN);
        }
        await wixData.insert(LOG_COLLECTION, record, { suppressAuth: true });
    } catch (e) {
        console.error('CRITICAL: НЕ ВДАЛОСЬ ЗАПИСАТИ ЛОГ!', e);
    }
}

/**
 * Backward-compatible logger used by the frozen legacy endpoint.
 * Preserves the exact field shape the original code wrote
 * (timestamp, sku, size1c, status, message) — do not extend.
 */
export async function logSyncActivity(sku, size1c, status, message) {
    await writeLog({ sku, size1c, status, message });
}
