# Data Model: MutualLens — Indian Mutual Fund Knowledge Base

**Branch**: `001-mf-knowledge-base` | **Date**: 2026-05-12

---

## 1. IndexedDB Schema

**Database name**: `mutual-lens-db`
**Database version**: `1`

### Store: `funds`

Persisted fund records. One row per Direct+Growth scheme.

```
keyPath:  'schemeCode'  (number — AMFI scheme code, unique across all schemes)
autoIncrement: false
```

| Index name | Key path | Unique | Purpose |
|------------|----------|--------|---------|
| `by_category` | `category` | No | Filter by asset class |
| `by_subcategory` | `subCategory` | No | Filter by sub-category |
| `by_amc` | `amcName` | No | Filter by fund house |

**Record shape**:

```js
{
  // Identity (from AMFI NAVAll.txt)
  schemeCode:      119598,           // number — primary key
  schemeName:      "Axis Bluechip Fund - Direct Plan - Growth",
  schemeNameShort: "Axis Bluechip Fund",  // first ~35 chars before " - Direct"

  // Classification (from AMFI section headers + MFAPI meta)
  amcName:         "Axis Mutual Fund",    // from MFAPI fund_house; approximated from name prefix until Full Sync
  category:        "Equity",             // mapped from AMFI section header
  subCategory:     "Large Cap Fund",     // parsed from AMFI section header
  schemeType:      "Open Ended",         // from MFAPI scheme_type; "Open Ended" until Full Sync

  // Current NAV (from AMFI NAVAll.txt, refreshed by Quick Sync)
  navCurrent: 52.3421,                   // number
  navDate:    "2025-05-09",              // ISO date string YYYY-MM-DD

  // Computed metrics (null until Full Sync + compute pass)
  returns: {
    '1w': 0.32,    // % — (NAV_today / NAV_7d_ago - 1) × 100
    '1m': 1.45,    // % — (NAV_today / NAV_30d_ago - 1) × 100
    '3m': 4.12,    // % — (NAV_today / NAV_90d_ago - 1) × 100
    '6m': 7.80,    // % — (NAV_today / NAV_180d_ago - 1) × 100
    '1y': 14.23,   // % — (NAV_today / NAV_365d_ago - 1) × 100
    '3y': 18.90,   // % CAGR — ((NAV_today / NAV_3y_ago) ^ (1/3) - 1) × 100
    '5y': 16.44,   // % CAGR — ((NAV_today / NAV_5y_ago) ^ (1/5) - 1) × 100
  },
  risk: {
    stdDev1y:    12.4,   // % — annualised: stdDev(daily log returns) × √252 × 100
    sharpe1y:    0.91,   // — (annualised_return_1y - 6.5) / stdDev1y
    maxDrawdown: -18.2,  // % — min over period of (NAV_i / max(NAV_0..NAV_i) - 1) × 100
  },

  // All null until computed; stays null if history unavailable
  // (null is stored, not omitted, so filters can distinguish "not synced" from "zero")

  // Sync bookkeeping
  syncedAt:      "2025-05-09T10:23:00Z",  // ISO datetime of last Quick or Full Sync for this record
  hasNavHistory: false,                    // true once Full Sync has downloaded history for this fund
}
```

**Validation rules**:
- `schemeCode`: positive integer, required
- `navCurrent`: positive number, required
- `navDate`: ISO date string YYYY-MM-DD, required
- All `returns.*` and `risk.*` fields: number or `null` (never `undefined`)
- `category`: one of `['Equity', 'Debt', 'Hybrid', 'Index/ETF', 'Solution-Oriented', 'Other']`

---

### Store: `nav_history`

Daily NAV price points. One row per (fund, date) pair.

```
keyPath:  ['schemeCode', 'date']  (compound — ensures uniqueness per fund per day)
autoIncrement: false
```

| Index name | Key path | Unique | Purpose |
|------------|----------|--------|---------|
| `by_scheme` | `schemeCode` | No | Retrieve all history for one fund |

**Record shape**:

```js
{
  schemeCode: 119598,         // number — foreign key to funds store
  date:       "2025-05-09",   // ISO date string YYYY-MM-DD (normalised from MFAPI "DD-Mon-YYYY")
  nav:        52.3421,        // number (normalised from MFAPI string)
}
```

**Volume estimate**:
- ~2,500 funds × ~1,300 trading days (5Y) ≈ 3.25 million rows
- IndexedDB handles this volume without issue; compound key provides fast range lookups

---

### Store: `sync_meta`

Key-value store for sync state and app-wide settings.

```
keyPath:  'key'  (string)
autoIncrement: false
```

**Records**:

```js
// Quick Sync state
{
  key:          "quick_sync",
  lastSyncAt:   "2025-05-09T10:23:00Z",  // ISO datetime or null
  totalFunds:   2487,                     // number of Direct+Growth funds found
  status:       "success",               // "success" | "partial" | "failed" | "in_progress"
  errorMessage: null,                    // string or null
}

// Full Sync state
{
  key:          "full_sync",
  lastSyncAt:   "2025-05-09T14:11:00Z",
  totalFunds:   2487,
  completedFunds: 2487,
  status:       "success",
  errorMessage: null,
}

// Full Sync resume checkpoint (separate key — updated after each fund)
{
  key:          "full_sync_progress",
  resumeIndex:  1243,    // index into the sorted funds list; next Full Sync starts here
  fundList:     [119598, 119099, ...],  // ordered list of scheme codes to process
}

// Column visibility preferences
{
  key:   "column_visibility",
  value: {
    star:          true,
    schemeName:    true,
    amcName:       true,
    category:      true,
    subCategory:   true,
    navCurrent:    true,
    navDate:       false,
    return1y:      true,
    return3y:      true,
    return5y:      true,
    stdDev1y:      false,
    sharpe1y:      false,
    maxDrawdown:   false,
    syncedAt:      false,
  }
}
```

---

### Store: `user_data`

Per-fund user preferences (starred, notes). Separate from `funds` to avoid overwriting sync data.

```
keyPath:  'schemeCode'  (number)
autoIncrement: false
```

**Record shape**:

```js
{
  schemeCode: 119598,
  starred:    true,             // boolean
  notes:      "Holding since 2020. Consider trimming if AUM > 50k Cr.",  // string, may be empty
}
```

---

## 2. In-Memory State (`src/store/state.js`)

The in-memory representation is a plain JS object, not a framework-managed reactive store.
UI components read from it directly and call `applyFilters()` to refresh the `filtered` array,
then call `rerenderTable()` to update the virtual scroll.

```js
const state = {
  // Source of truth after DB load — never mutated after initial hydration
  allFunds: [],          // Fund[] — all stored funds, sorted by schemeName ascending

  // Derived — rebuilt by FilterEngine on every filter change
  filtered: [],          // Fund[] — subset of allFunds matching active filters, current sort applied

  // Active filter values (mirrors src/config/filters.js structure)
  filters: {
    search:       '',
    category:     [],         // string[] — selected asset classes; empty = all
    subCategory:  [],
    amcName:      [],
    return1yMin:  null,       // number | null
    return1yMax:  null,
    return3yMin:  null,
    return3yMax:  null,
    return5yMin:  null,
    return5yMax:  null,
    stdDev1yMin:  null,
    stdDev1yMax:  null,
    sharpe1yMin:  null,
    sharpe1yMax:  null,
    maxDrawdownMin: null,
    maxDrawdownMax: null,
    starredOnly:  false,
  },

  // Sort state
  sort: {
    column: 'schemeName',   // column key from config/columns.js
    direction: 'asc',       // 'asc' | 'desc'
  },

  // UI state
  selectedSchemeCode: null,  // fund open in detail drawer; null = drawer closed
  columnVisibility: {},      // loaded from sync_meta at startup

  // Sync state (mirrored from IndexedDB for display)
  syncStatus: {
    quickSync: null,         // SyncMeta record or null
    fullSync:  null,
  },
}
```

---

## 3. Computed Metric Formulas

All computations in `src/sync/compute.js`. Inputs are sorted ascending by date.

| Metric | Formula | Data window |
|--------|---------|-------------|
| 1W return | `(nav[last] / nav[last-7d] - 1) × 100` | 7 calendar days back |
| 1M return | `(nav[last] / nav[last-30d] - 1) × 100` | 30 calendar days back |
| 3M return | `(nav[last] / nav[last-90d] - 1) × 100` | 90 calendar days back |
| 6M return | `(nav[last] / nav[last-180d] - 1) × 100` | 180 calendar days back |
| 1Y return | `(nav[last] / nav[last-365d] - 1) × 100` | 365 calendar days back |
| 3Y CAGR | `((nav[last] / nav[last-3y]) ^ (1/3) - 1) × 100` | 3 years back |
| 5Y CAGR | `((nav[last] / nav[last-5y]) ^ (1/5) - 1) × 100` | 5 years back |
| Std Dev (1Y) | `stdDev(log(nav[i]/nav[i-1])) × √252 × 100` | Last 252 trading days |
| Sharpe (1Y) | `(return1y - 6.5) / stdDev1y` | Risk-free rate: 6.5% p.a. |
| Max Drawdown | `min(nav[i] / max(nav[0..i]) - 1) × 100` | Full available history |

**Lookup strategy**: For "last N days ago", find the closest available trading date using a
binary search on the sorted date array. Mutual funds do not trade on weekends/holidays, so
exact calendar-day lookups will often miss — always find the nearest available date.

**Null handling**: If fewer than the required data points exist (e.g., fund < 5 years old),
the corresponding metric is stored as `null`. Never interpolate missing data.

---

## 4. Filter Engine Logic (`src/ui/filters/FilterEngine.js`)

```
FilterEngine.apply(allFunds, filters) → funds[]

Execution order (cheapest checks first for short-circuit performance):
  1. starredOnly: if true, keep only funds where userStarred === true
  2. category: if non-empty, fund.category must be in selected set
  3. subCategory: if non-empty, fund.subCategory must be in selected set
  4. amcName: if non-empty, fund.amcName must be in selected set
  5. search: fund.schemeName or fund.amcName or schemeCode.toString() contains query
  6. return1y/3y/5y: if min/max set, fund.returns.Ny must be in range (null fails filter)
  7. stdDev1y: range check on fund.risk.stdDev1y
  8. sharpe1y: range check on fund.risk.sharpe1y
  9. maxDrawdown: range check on fund.risk.maxDrawdown

After filtering: apply sort (see sort.js comparators)
```

All filter logic is a pure function — no DOM access, no side effects. This enables deterministic
unit testing and ensures the <200ms performance target is met with straightforward JS array ops.
