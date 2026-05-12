# SPEC
## MutualLens — Technical Specification v1.0

---

## 1. Technology Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Build Tool | **Vite** | Zero-config, fast HMR, static build out-of-the-box |
| Language | **Vanilla JavaScript (ES2022+)** | No framework to learn; readable by anyone; no build-time magic |
| Styling | **Plain CSS with CSS Variables** | No Tailwind/SASS dependency; easily themeable |
| Data Storage | **IndexedDB** (via `idb` wrapper library) | Stores 5,000+ fund rows locally; survives page refresh |
| HTTP Client | **Native `fetch`** | Built into every modern browser |
| Deployment | **GitHub Pages** via `gh-pages` npm package | Single command deploy |
| Package Manager | **npm** | Universal; no Yarn/pnpm dependency |

**Why no React/Vue?** A single-page data table with filters does not need a component framework. Vanilla JS + DOM APIs are faster, easier to fork, and have zero dependency risk.

---

## 2. Project Structure

```
mutual-lens/
├── index.html                  # Single entry point
├── package.json
├── vite.config.js
├── README.md
├── CONSTITUTION.md
├── SPEC.md
├── PLAN.md
│
├── src/
│   ├── main.js                 # App bootstrap
│   ├── style.css               # Global styles & CSS variables
│   │
│   ├── data/
│   │   ├── sync.js             # Orchestrates all sync operations
│   │   ├── mfapi.js            # MFAPI India adapter
│   │   ├── amfi.js             # AMFI NAVAll.txt adapter
│   │   ├── db.js               # IndexedDB read/write helpers (uses idb)
│   │   └── compute.js          # Derived metrics: returns, ratios
│   │
│   ├── ui/
│   │   ├── table.js            # Virtual-scrolled fund table renderer
│   │   ├── filters.js          # Filter panel: build, bind, evaluate
│   │   ├── toolbar.js          # Sync button, export, column picker
│   │   ├── modal.js            # Fund detail drawer/modal
│   │   ├── toast.js            # Notifications (sync progress, errors)
│   │   └── theme.js            # Light/dark toggle
│   │
│   └── config/
│       ├── columns.js          # Column definitions (label, key, format, width)
│       └── filters.js          # Filter definitions (type, options, default)
│
└── public/
    └── favicon.svg
```

---

## 3. Data Model

### 3.1 Fund Record (stored in IndexedDB, `funds` store)

```js
{
  schemeCode: 119598,               // AMFI scheme code (primary key)
  schemeName: "Axis Bluechip Fund - Direct Plan - Growth",
  schemeNameShort: "Axis Bluechip - Direct - Growth",  // computed
  amcName: "Axis Mutual Fund",
  category: "Equity",               // top-level AMFI category
  subCategory: "Large Cap",         // AMFI sub-category
  schemeType: "Open Ended",
  planType: "Direct",               // Direct | Regular
  optionType: "Growth",             // Growth | IDCW | Bonus
  navCurrent: 52.34,               // latest NAV (₹)
  navDate: "2025-05-09",           // date of latest NAV
  aum: 28450.67,                   // AUM in ₹ crores (from AMFI)
  expenseRatio: 0.51,              // % p.a. (from AMFI, when available)
  minInvestmentLumpsum: 5000,
  minInvestmentSIP: 1000,
  returns: {
    1w:  0.32,                     // % (computed from NAV history)
    1m:  1.45,
    3m:  4.12,
    6m:  7.80,
    1y: 14.23,
    3y: 18.90,                     // CAGR
    5y: 16.44,                     // CAGR
  },
  risk: {
    stdDev1y:  12.4,               // annualised standard deviation
    sharpe1y:   0.91,              // Sharpe ratio (risk-free = 6.5%)
    beta1y:     0.87,              // vs Nifty 50 TRI
    alpha1y:    2.30,              // Jensen's alpha
    maxDrawdown: -18.2,            // max peak-to-trough %
  },
  syncedAt: "2025-05-09T10:23:00Z",  // when this record was last synced
  hasNavHistory: true,               // whether NAV history was downloaded
}
```

### 3.2 NAV History (stored in IndexedDB, `nav_history` store)

```js
{
  schemeCode: 119598,   // foreign key
  date: "2025-05-09",   // ISO date string
  nav: 52.34
}
```
Index: `[schemeCode, date]` composite key for fast range queries.

### 3.3 Sync Metadata (stored in IndexedDB, `sync_meta` store)

```js
{
  key: "funds_list",          // "funds_list" | "nav_current" | "nav_history"
  lastSyncAt: "2025-05-09T10:23:00Z",
  totalRecords: 5421,
  status: "success"           // "success" | "partial" | "failed"
}
```

---

## 4. Sync Architecture

### 4.1 Sync Modes

| Mode | What it does | Trigger |
|------|-------------|---------|
| **Quick Sync** | Downloads current NAV for all funds (~1 API call via AMFI NAVAll.txt) | Manual button or on app load if data > 1 day old |
| **Full Sync** | Downloads fund list + NAV history (3 years) for all funds | Manual button only — takes 10–30 min |
| **Selective Sync** | Downloads NAV history only for funds the user has starred/selected | Manual button |

### 4.2 Sync Flow

```
User clicks "Sync" 
  → sync.js: orchestrateSync(mode)
    → amfi.js: fetchSchemeList()      → parse AMFI NAVAll.txt
    → db.js: upsertFunds(records)     → write to IndexedDB
    → mfapi.js: fetchNavHistory(code) → for each fund (batched, 10 at a time)
    → compute.js: computeMetrics()    → returns, risk ratios
    → db.js: updateFunds(metrics)     → write computed fields
    → toast.js: notify("Sync complete")
```

### 4.3 Rate Limiting
- MFAPI is a public, free API. Requests are **batched at 10 concurrent** with a 100ms delay between batches.
- Full sync shows a progress bar (e.g., "Downloading NAV history: 342 / 5421 funds").
- Sync can be paused and resumed (state stored in IndexedDB).

---

## 5. UI Specification

### 5.1 Layout

```
┌─────────────────────────────────────────────────────────────┐
│  TOOLBAR: Logo | Search bar         | Sync btn | Theme | ⚙  │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│  FILTER      │   FUND TABLE (virtual scroll)               │
│  PANEL       │   [col headers + sort arrows]               │
│  (collapsible│   row row row row row row row row row row    │
│   sidebar)   │   row row row row row row row row row row    │
│              │   row row row row row row row row row row    │
│              │                                             │
│              │  [Status bar: showing X of Y funds]         │
└──────────────┴──────────────────────────────────────────────┘
```

Clicking any row opens a **Fund Detail Drawer** sliding in from the right.

### 5.2 Filter Panel — Full Specification

All filters are **AND-combined** (a fund must pass all active filters).

#### Category Filters
| Filter | Type | Options |
|--------|------|---------|
| Asset Class | Multi-checkbox | Equity, Debt, Hybrid, Index/ETF, Solution-Oriented, Other |
| Sub-Category | Multi-checkbox | Dynamic — populated from data |
| Plan Type | Toggle | All / Direct / Regular |
| Option | Toggle | All / Growth / IDCW |
| Fund House (AMC) | Searchable multi-select | All AMCs from data |

#### Performance Filters
| Filter | Type | Description |
|--------|------|-------------|
| 1Y Return | Range slider | % min–max |
| 3Y Return (CAGR) | Range slider | % min–max |
| 5Y Return (CAGR) | Range slider | % min–max |

#### Risk Filters
| Filter | Type | Description |
|--------|------|-------------|
| Risk Level | Multi-checkbox | Low / Moderate / High / Very High (SEBI riskometer) |
| Max Drawdown | Range slider | % (negative — worst loss from peak) |
| Sharpe Ratio | Range slider | Higher = better risk-adjusted return |
| Std Deviation (1Y) | Range slider | Lower = more stable |

#### Fund Characteristics
| Filter | Type | Description |
|--------|------|-------------|
| AUM (₹ Cr) | Range slider | Min–max assets under management |
| Expense Ratio | Range slider | % p.a. |
| Min SIP Amount | Dropdown | ≤ ₹500 / ≤ ₹1000 / ≤ ₹5000 / Any |
| Scheme Type | Toggle | Open Ended / Close Ended / Interval |
| Starred Only | Toggle | Show only user-starred funds |

#### Search
- Free-text search across: scheme name, AMC name, scheme code
- Fuzzy matching (simple substring, case-insensitive)
- Debounced 200ms

### 5.3 Table Columns

Default visible columns (user can show/hide via column picker):

| Column | Default | Format | Sortable |
|--------|---------|--------|---------|
| ★ Star | ✅ | Icon | No |
| Scheme Name | ✅ | Text (truncated) | Yes |
| AMC | ✅ | Text | Yes |
| Category | ✅ | Badge | Yes |
| Sub-Category | ✅ | Text | Yes |
| Plan | ✅ | Direct/Regular badge | Yes |
| NAV (₹) | ✅ | ₹ 00.00 | Yes |
| NAV Date | ❌ | DD MMM YYYY | Yes |
| 1Y Return | ✅ | % (colour: green/red) | Yes |
| 3Y CAGR | ✅ | % (colour) | Yes |
| 5Y CAGR | ✅ | % (colour) | Yes |
| AUM (₹ Cr) | ✅ | ₹ 00,000 Cr | Yes |
| Expense Ratio | ✅ | 0.00% | Yes |
| Sharpe (1Y) | ❌ | 0.00 | Yes |
| Std Dev (1Y) | ❌ | 0.00% | Yes |
| Max Drawdown | ❌ | -00.00% | Yes |
| Min SIP (₹) | ❌ | ₹ 000 | Yes |
| Synced At | ❌ | Relative time | No |

### 5.4 Fund Detail Drawer

Clicking a fund row opens a right-side drawer with:
- Full scheme name + scheme code + AMFI link
- NAV history chart (line chart, last 1/3/5 years — toggle)
- Full returns table (1W, 1M, 3M, 6M, 1Y, 3Y, 5Y)
- Risk metrics table
- Category & AMC info
- User notes field (saved to IndexedDB)
- Star/unstar toggle

### 5.5 Toolbar Actions

| Action | Description |
|--------|-------------|
| 🔄 Quick Sync | Fetch latest NAV for all funds |
| 📥 Full Sync | Download 3Y NAV history for all funds |
| 📤 Export CSV | Export currently filtered fund list as CSV |
| 📤 Export JSON | Export currently filtered fund list as JSON |
| 🔧 Column Picker | Show/hide table columns |
| 🌙 Theme | Toggle light/dark mode |
| ℹ️ About | Shows data source info, last sync time, version |

---

## 6. Computed Metrics — Formulas

All computations happen in `src/data/compute.js` using locally stored NAV history.

| Metric | Formula |
|--------|---------|
| N-period return | `(NAV_end / NAV_start - 1) × 100` |
| CAGR (n years) | `((NAV_end / NAV_start) ^ (1/n) - 1) × 100` |
| Std Deviation (1Y) | Annualised daily log-return std dev: `σ_daily × √252` |
| Sharpe Ratio (1Y) | `(R_fund - R_f) / σ` where R_f = 6.5% p.a. |
| Beta (1Y) | `Cov(fund, Nifty50TRI) / Var(Nifty50TRI)` |
| Max Drawdown | `min((NAV_i / max(NAV_0..NAV_i)) - 1)` over period |

> **Note**: Beta and Alpha require Nifty 50 TRI index data. This will be fetched separately and stored in an `index_nav` store. If unavailable, these fields show "N/A".

---

## 7. Performance Requirements

| Requirement | Target |
|-------------|--------|
| Initial page load (cold) | < 2s |
| Filter response time | < 200ms for 5,000 rows |
| Table scroll (60fps) | Virtual scroll — only render visible rows |
| Full Sync (5,421 funds, 3Y history) | < 30 min with progress indicator |
| IndexedDB write throughput | Batch writes in transactions of 500 records |

---

## 8. Accessibility

- All interactive elements reachable via keyboard (Tab, Enter, Space, Arrow keys)
- ARIA labels on all icon-only buttons
- Colour is never the sole indicator (returns show + / - prefix)
- Respects `prefers-reduced-motion`
- Minimum contrast ratio 4.5:1 in both light and dark themes

---

## 9. Configuration Files (User-Editable)

### `src/config/columns.js`
Defines which columns exist, their labels, formatters, and default visibility. Users can edit this file to permanently add/remove/reorder columns without touching application logic.

### `src/config/filters.js`
Defines which filters appear in the filter panel, their type (range, multicheck, toggle), and default values. Users can add custom numeric filters against any fund field.

---

## 10. Deployment

```bash
# Install dependencies
npm install

# Run locally
npm run dev           # → http://localhost:5173

# Build for production
npm run build         # → ./dist/

# Deploy to GitHub Pages
npm run deploy        # uses gh-pages to push dist/ to gh-pages branch
```

`vite.config.js` must set `base: '/repo-name/'` for GitHub Pages sub-path routing.

---

## 11. Open Questions (to resolve before Plan Phase 2)

1. **Nifty 50 TRI data source**: Which free API provides daily index values? (NSE website scraping vs. a third-party source)
2. **Expense Ratio availability**: AMFI NAVAll.txt does not include expense ratios. Is MFAPI's metadata endpoint reliable enough?
3. **IDCW history**: Should dividend/IDCW payout history be tracked? (adds complexity)
4. **Full Sync time estimate**: Need to benchmark MFAPI rate limits before committing to the 30-min estimate.
