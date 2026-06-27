# Data collections — M-code sync

These collections back the 1C ↔ Wix sync. Wix collections **cannot be created from
code** — create each one in the Wix dashboard (CMS / Content Manager), then the
backend modules read/write them by the names below.

> **Encoding warning:** every `mCode` value uses the **Cyrillic М (U+041C)**, not
> Latin M (U+004D). They are visually identical. Never normalize M-codes to Latin M
> anywhere — lookups against 1C will silently return zero matches.

---

## `M_Code_Index` — the join surface (NEW)

One row per Wix variant, mapping it to its canonical 1C M-code. Every availability
flow resolves through this collection; nothing queries Stores by Артикул or size.

| Field | Type | Notes |
|---|---|---|
| `mCode` | Text | Primary lookup key. **Indexed, unique.** Cyrillic М prefix. |
| `productId` | Text | Wix Stores product `_id`. |
| `variantId` | Text | Wix internal variant GUID. |
| `parentArtikul` | Text | From 1C Артикул. Debugging/reconciliation aid. |
| `sizeLabel` | Text | The Размер value captured at bootstrap time. |
| `currentInStock` | Boolean | Last-known availability, denormalized on each sync so `exportMapping` stays O(1)/row. Empty until first synced. |
| `lastSynced` | Date | Updated on every availability event. |
| `notes` | Text | `ambiguous_bootstrap`, `manual_review`, etc. |

**Permissions:** Read = Admin only · Write = Admin only. Never exposed to anonymous.
**Index:** add a unique index on `mCode` (Dashboard → CMS → collection → Manage indexes).

---

## `SyncLogs` — audit trail (EXISTING, extend)

Already used by the legacy endpoint. The new flow logs M-code-keyed events here too,
so two columns need adding if they don't exist yet.

| Field | Type | Used by | Notes |
|---|---|---|---|
| `timestamp` | Date | both | Stamped by `writeLog`. |
| `sku` | Text | legacy | Артикул on the legacy path. |
| `size1c` | Text | legacy | Size string from the legacy payload. |
| `mCode` | Text | **new** | **Add this column.** M-code on the new path. |
| `status` | Text | both | e.g. `updated`, `unmapped`, `Помилка`. |
| `message` | Text | both | Free text, truncated to 1000 chars. |

---

## `BootstrapReview` — ambiguity log (NEW, phase 3)

~529 (Артикул, Размер) pairs map to multiple M-codes. Bootstrap picks the highest
sequence number and records the decision here for Eli to review.

| Field | Type | Notes |
|---|---|---|
| `mCodeChosen` | Text | The M-code the bootstrap selected (highest sequence). |
| `mCodeAlternatives` | Text | The rejected candidates (JSON array or `;`-joined). |
| `parentArtikul` | Text | |
| `sizeLabel` | Text | |
| `productId` | Text | |
| `variantId` | Text | |
| `reason` | Text | e.g. `ambiguous_bootstrap`. |

---

## `BootstrapUnmapped` — no-match log (NEW, phase 3)

Wix variants with zero 1C candidates (drifted Артикул, manually-added products,
deleted 1C items). Don't block rollout; triaged manually.

| Field | Type | Notes |
|---|---|---|
| `parentArtikul` | Text | |
| `sizeLabel` | Text | |
| `productId` | Text | |
| `variantId` | Text | |
| `reason` | Text | e.g. `no_1c_match`. |

---

## Manual dashboard steps (cannot be done from code)

- [ ] Create `M_Code_Index` with the schema above (incl. `currentInStock` Boolean); add unique index on `mCode`; Admin-only perms.
- [ ] Add `mCode` column to `SyncLogs`.
- [ ] Create `BootstrapReview` (phase 3).
- [ ] Create `BootstrapUnmapped` (phase 3).
- [ ] Wix Secrets Manager → add key `sync_token_1c` = a strong random token (phase 2 / security).
