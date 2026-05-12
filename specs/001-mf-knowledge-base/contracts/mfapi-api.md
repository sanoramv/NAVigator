# Contract: MFAPI India

**Consumer**: `src/sync/mfapi.js`
**Source**: MFAPI India (community API, free and unauthenticated)

---

## Base URL

```
https://api.mfapi.in
```

No authentication. No API key. JSON responses (Content-Type: application/json).

---

## Endpoints Used

### 1. Fund List

Not used directly — AMFI NAVAll.txt is the authoritative fund list. MFAPI fund list is
supplemental and may not be relied upon as the primary source.

### 2. Individual Fund — Full History + Metadata

```
GET /mf/{schemeCode}
```

**Purpose**: Fetch fund metadata (AMC name, category, scheme type) and complete NAV history.
Called during Full Sync for each Direct+Growth scheme.

**Parameters**:
- `{schemeCode}`: integer — AMFI scheme code

**Response shape**:

```json
{
  "meta": {
    "fund_house":       "Axis Mutual Fund",
    "scheme_type":      "Open Ended Schemes",
    "scheme_category":  "Equity Scheme - Large Cap Fund",
    "scheme_code":      119598,
    "scheme_name":      "Axis Bluechip Fund - Direct Plan - Growth"
  },
  "data": [
    {"date": "09-May-2025", "nav": "52.3421"},
    {"date": "08-May-2025", "nav": "51.9876"},
    ...
  ]
}
```

**Data ordering**: The `data` array is returned in **descending date order** (newest first).
Reverse before storing or computing to get ascending order.

**NAV normalisation**:
```js
// date:  "09-May-2025" → "2025-05-09"  (use same normaliseDate() as amfi.js)
// nav:   "52.3421"     → 52.3421       (parseFloat)
```

**History depth**: MFAPI typically provides the full history since scheme inception. For
funds older than 5 years, only the last 5 years (from `navDate` backwards) need to be stored.
Trim to 5Y window before writing to IndexedDB to control storage size.

**5-year window calculation**:
```js
const cutoffDate = new Date(navDate);
cutoffDate.setFullYear(cutoffDate.getFullYear() - 5);
const cutoff = cutoffDate.toISOString().slice(0, 10); // YYYY-MM-DD
const trimmed = history.filter(d => d.date >= cutoff);
```

---

## Rate Limiting Strategy

MFAPI has no documented rate limit but is a volunteer-maintained community service.
Treat it respectfully to avoid causing disruption.

```
Concurrency:  10 simultaneous requests
Batch gap:    100ms delay between each batch of 10
```

```js
async function fetchAllHistory(schemeCodes, onProgress) {
  const BATCH_SIZE = 10;
  const BATCH_DELAY_MS = 100;

  for (let i = 0; i < schemeCodes.length; i += BATCH_SIZE) {
    if (shouldPause) break;

    const batch = schemeCodes.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(code => fetchAndStoreFund(code)));
    onProgress(i + batch.length, schemeCodes.length);

    if (i + BATCH_SIZE < schemeCodes.length) {
      await delay(BATCH_DELAY_MS);
    }
  }
}
```

---

## Error Handling

| Failure mode | Behaviour |
|-------------|-----------|
| HTTP 404 | Fund not found in MFAPI (scheme may have been merged or closed); store with `hasNavHistory: false` and continue |
| HTTP 5xx / timeout | Retry once after 1s; if still failing, skip fund; increment failed-fund count |
| `data` array empty | Store metadata only (`hasNavHistory: false`); no computed metrics |
| `data` contains non-numeric NAV | Skip that data point; continue parsing rest of history |
| Network offline mid-sync | Catch error; post `PAUSED` message with current resume index |

---

## Meta Field Normalisation

```js
function normaliseMeta(meta) {
  const [topCat] = (meta.scheme_category || '').split(' - ');
  return {
    amcName:    meta.fund_house || 'Unknown',
    schemeType: normaliseSchemeType(meta.scheme_type),
    category:   mapCategory(topCat),
    subCategory: mapSubCategory(meta.scheme_category),
  };
}

function normaliseSchemeType(raw) {
  if (!raw) return 'Unknown';
  if (raw.toLowerCase().includes('open')) return 'Open Ended';
  if (raw.toLowerCase().includes('close')) return 'Close Ended';
  if (raw.toLowerCase().includes('interval')) return 'Interval';
  return raw;
}
```

---

## Known Limitations and Risks

- **Unofficial API**: MFAPI is maintained by a community contributor, not AMFI or SEBI.
  It may be unavailable or change without notice. Always degrade gracefully using cached data.
- **NAV history gaps**: Some schemes have gaps in their history (weekends are expected;
  holidays produce gaps; scheme suspensions may cause multi-day gaps).
- **No AUM or expense ratio**: MFAPI does not expose these fields in any endpoint.
- **Scheme closure**: A scheme in local storage may no longer exist in MFAPI (merged,
  wound up). Handle 404s gracefully and do not delete the local record automatically.
- **Date of last NAV**: MFAPI may lag by 1 business day relative to AMFI NAVAll.txt.
  Treat AMFI's `navCurrent`/`navDate` as authoritative for the latest NAV; MFAPI `data[0]`
  is historical context only.
