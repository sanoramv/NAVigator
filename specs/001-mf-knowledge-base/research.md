# Research: MutualLens — Indian Mutual Fund Knowledge Base

**Branch**: `001-mf-knowledge-base` | **Date**: 2026-05-12

---

## 1. AMFI NAVAll.txt — Format and Parsing

### Decision
Parse AMFI NAVAll.txt as the primary data source for current NAV, scheme name, and category.
Extract AMC name from scheme name prefix as an approximation during Quick Sync; overwrite with
accurate `fund_house` from MFAPI during Full Sync.

### File Format

```
Open Ended Schemes(Equity Scheme - Large Cap Fund)

Scheme Code;ISIN Div Payout/ IDCW;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date
119598;INF846K01DP8;-;Axis Bluechip Fund - Direct Plan - Growth;52.3421;09-May-2025
119099;INF200K01RO2;-;HDFC Top 100 Fund - Direct Plan - Growth;1012.456;09-May-2025

Open Ended Schemes(Equity Scheme - Mid Cap Fund)

Scheme Code;ISIN Div Payout/ IDCW;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date
120843;INF903B01BN7;-;HDFC Mid-Cap Opportunities Fund - Direct Plan - Growth;143.729;09-May-2025
```

**Key observations:**
- Semicolon-delimited, not CSV
- Category section headers: `Open Ended Schemes(...)` with the SEBI category name inside parens
- Column header line appears once per section (redundant — ignore after first parse)
- NAV is a decimal string (not integer)
- Date format: `DD-Mon-YYYY` (e.g., `09-May-2025`) → normalise to `YYYY-MM-DD`
- ISIN fields may be `-` for unavailable; these are unused
- File is fetched via: `https://www.amfiindia.com/spages/NAVAll.txt`

### Parsing Algorithm

```
lines = response.text().split('\n')
currentCategory = null
currentSubCategory = null

for each line:
  if line matches /^Open Ended Schemes\((.+)\)/:
    full = match[1]   // e.g., "Equity Scheme - Large Cap Fund"
    currentCategory = mapCategory(full)       // "Equity"
    currentSubCategory = mapSubCategory(full) // "Large Cap Fund"
    continue

  if line contains exactly 5 semicolons:
    [code, isin1, isin2, name, nav, date] = line.split(';')
    if isDirectGrowth(name):
      store fund record
```

### Direct+Growth Filter (CRITICAL)

```js
function isDirectGrowth(schemeName) {
  const n = schemeName.toLowerCase();
  return n.includes('direct')
    && n.includes('growth')
    && !n.includes('idcw')
    && !n.includes('dividend');
}
```

**Why the negative checks are required**: Some funds use "Growth" as part of their marketing name
(e.g., "HDFC Growth Opportunities Fund"). These exist as both Growth and IDCW variants; the IDCW
variant ("HDFC Growth Opportunities Fund - Direct Plan - IDCW") contains both "direct" and "growth"
and would be a false positive without the exclusion guards. The spec mandates: ambiguous or
unclassifiable → exclude. False negatives are acceptable; false positives (storing IDCW schemes
as if they were Growth) are not.

**Expected dataset size**: ~2,000–3,000 schemes after filtering from ~15,000 total.

### Category Mapping

```js
const CATEGORY_MAP = {
  'Equity Scheme':               'Equity',
  'Debt Scheme':                 'Debt',
  'Hybrid Scheme':               'Hybrid',
  'Other Scheme - Index Funds':  'Index/ETF',
  'Other Scheme - ETFs':         'Index/ETF',
  'Other Scheme - FoFs':         'Other',
  'Solution Oriented Scheme':    'Solution-Oriented',
  'Other Scheme':                'Other',
};

function mapCategory(fullCategory) {
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (fullCategory.startsWith(key)) return val;
  }
  return 'Other';
}

function mapSubCategory(fullCategory) {
  const parts = fullCategory.split(' - ');
  return parts.length > 1 ? parts.slice(1).join(' - ') : fullCategory;
}
```

---

## 2. MFAPI India — API Capabilities and Limitations

### Decision
Use MFAPI for: (a) accurate AMC name (`fund_house`) and (b) 5-year daily NAV history.
Do NOT use MFAPI for current NAV (AMFI is authoritative and faster — single request vs. 2,000+).

### Endpoints

| Endpoint | Purpose | Response shape |
|----------|---------|---------------|
| `GET /mf` | Full scheme list | `[{schemeCode, schemeName}]` |
| `GET /mf/{code}` | Metadata + full NAV history | `{meta: {...}, data: [{date, nav}]}` |
| `GET /mf/{code}/latest` | Metadata + latest NAV only | Same shape, data has 1 entry |

**Base URL**: `https://api.mfapi.in`

**`meta` object fields** (from individual fund endpoint):
```json
{
  "fund_house": "Axis Mutual Fund",
  "scheme_type": "Open Ended Schemes",
  "scheme_category": "Equity Scheme - Large Cap Fund",
  "scheme_code": 119598,
  "scheme_name": "Axis Bluechip Fund - Direct Plan - Growth"
}
```

**`data` array entry**:
```json
{"date": "09-May-2025", "nav": "52.3421"}
```
Note: date is `DD-Mon-YYYY` string; nav is a string, not number. Both must be normalised.

### Rate Limiting Strategy

MFAPI is a free community API with no documented rate limit. To be respectful:
- Batch requests at **10 concurrent** with a **100ms delay between batches**
- Full Sync over 2,500 funds ≈ 250 batches × 100ms = ~25 seconds minimum wait time
- Total Full Sync time estimate: **10–30 minutes** depending on network latency
- Pause/resume checkpointing saves progress if interrupted

### Alternatives Considered
- **Screener.in API**: Requires authentication. Rejected — violates Zero Lock-In principle.
- **NSE/BSE data**: Not a clean API; scraping is fragile and legally ambiguous. Rejected.
- **AMFI data files**: Only current NAV, no history. Already used for Quick Sync.

---

## 3. Data Availability Gaps

### AUM (Assets Under Management)
**Decision**: Not shown; AUM filter hidden in v1.
**Rationale**: AUM is NOT in AMFI NAVAll.txt. MFAPI does not expose AUM in any endpoint.
AMFI publishes monthly AUM data as a separate disclosure — parsing it requires a different
pipeline and is deferred to v2. Showing "N/A" for AUM would violate the Clarity principle.
Hiding the filter entirely is honest and less confusing than a disabled slider.

### Expense Ratio
**Decision**: Not shown; expense ratio filter hidden in v1.
**Rationale**: Expense ratios are published by AMCs in their scheme documents but are not
available via AMFI NAVAll.txt or MFAPI. Deferred to v2 with a dedicated parser.

### Minimum SIP Amount
**Decision**: Not stored or shown.
**Rationale**: Not available from either data source. Deferred to v2.

### AMC Name During Quick Sync
**Decision**: Approximate from scheme name prefix during Quick Sync; overwrite with
accurate `fund_house` from MFAPI during Full Sync.
**Approximation logic**: Most AMFI scheme names begin with the AMC name. Parse the prefix
up to the first fund-type keyword (e.g., "Fund", "Scheme", "ETF"). This covers 80%+ of cases.
The AMC filter will note "Data may be approximate — run Full Sync for accuracy."

---

## 4. Virtual Scroll Architecture

### Decision
Implement a fixed-row-height virtual scroller from scratch — no library, ~100 lines of JS.

### Rationale
3,000 DOM rows at ~50px height = 150,000px of scroll space. Browsers degrade at >10,000 DOM nodes.
Virtual scroll renders only visible rows + a small buffer (±5 rows). At 60fps, the render budget
per frame is ~16ms; updating 20-30 row elements is well within that budget.

### Algorithm
```
ROW_HEIGHT = 48px  (fixed — enables O(1) scroll position → visible range)

onScroll(scrollTop):
  firstVisible = Math.floor(scrollTop / ROW_HEIGHT)
  lastVisible = firstVisible + viewportRowCount + BUFFER

  for i in [firstVisible, lastVisible]:
    rowEl = rowPool[i % poolSize]
    updateRowInPlace(rowEl, filteredFunds[i], i)
    rowEl.style.transform = `translateY(${i * ROW_HEIGHT}px)`

  spacer.style.height = `${filteredFunds.length * ROW_HEIGHT}px`
```

**Row pool size**: viewportRowCount + 2×BUFFER (typically 20–30 elements). DOM nodes are recycled,
not created/destroyed on scroll.

### Alternatives Considered
- **CSS `content-visibility: auto`**: Simpler but less predictable at 3,000 rows; skip-the-paint
  behaviour varies across browsers. Rejected for reliability.
- **tanstack-virtual**: A library — violates single-prod-dependency constraint. Rejected.

---

## 5. NAV Chart — Hand-Rolled SVG

### Decision
Render NAV history as an SVG `<polyline>` within a responsive `<svg viewBox>` element.
No external charting library.

### Rationale
The chart shows a single line (NAV over time) with axis labels and a hover crosshair.
This is achievable in ~150 lines of vanilla JS + SVG. Chart libraries add tens of KB for
features (bar charts, pie charts, animations) that are never used here.

### Implementation
```
data points → normalise to [minNAV, maxNAV] → map to SVG coordinate space
polyline points = data.map(d => `${xScale(d.date)},${yScale(d.nav)}`).join(' ')
```
- X axis: time (date range for selected window: 1Y / 3Y / 5Y)
- Y axis: NAV value (₹), with 4–5 gridlines and labels
- Hover: vertical crosshair line + tooltip showing date and NAV at nearest data point
- Toggle: clicking 1Y/3Y/5Y re-renders with the filtered data subset

---

## 6. Web Worker Sync Architecture

### Decision
All sync logic (fetching, parsing, computing, writing to IndexedDB) runs in a dedicated
Web Worker. The main thread only posts command messages and receives progress/completion events.

### Rationale
Full Sync involves 2,500+ network requests and heavy computation (NAV history → risk metrics).
Running this on the main thread would jank the UI completely. A Web Worker provides true
parallelism; postMessage for communication adds negligible overhead.

### Worker Lifecycle
```
main.js:
  worker = new Worker(new URL('./sync/worker.js', import.meta.url), {type: 'module'})
  worker.onmessage = handleWorkerMessage
  worker.postMessage({type: 'QUICK_SYNC'})

worker.js:
  self.onmessage = async ({data}) => {
    if (data.type === 'QUICK_SYNC') await runQuickSync()
    if (data.type === 'FULL_SYNC')  await runFullSync(data.resumeIndex ?? 0)
    if (data.type === 'PAUSE')      shouldPause = true
  }
```

---

## 7. IndexedDB — idb Library Usage

### Decision
Use `idb` 8.x for all IndexedDB access. `openDB()` for schema init; typed store wrappers
for reads and writes. No raw IDBRequest callbacks.

### Rationale
Raw IndexedDB API is callback-heavy and error-prone. `idb` wraps it in Promises with correct
error propagation. At ~5KB gzipped, it is the appropriate single production dependency.

### DB Version Strategy
Start at version 1. All schema changes in future versions go through `upgrade()` callback
with version-gated migration blocks. Schema definitions live in `src/db/schema.js` as the
single source of truth.

---

## 8. GitHub Pages Deployment

### Decision
Use `gh-pages` npm package. Set `base` in `vite.config.js` to `'/<repo-name>/'`.

### Vite Config
```js
// vite.config.js
import { defineConfig } from 'vite'
export default defineConfig({
  base: '/mutual-lens/',   // matches GitHub Pages URL path
  build: { outDir: 'dist' }
})
```

### package.json scripts
```json
{
  "scripts": {
    "dev":     "vite",
    "build":   "vite build",
    "preview": "vite preview",
    "deploy":  "npm run build && gh-pages -d dist"
  }
}
```

**Note**: User must set `base` to match their repo name. Document this clearly in quickstart.md
and README. The only required configuration step before `npm run deploy`.

---

## 9. Performance Validation Strategy

| Target | Approach |
|--------|----------|
| Filter <200ms / 3,000 rows | In-memory JS array filter — benchmark with `performance.now()` assertions in dev console |
| 60fps scroll | Chrome DevTools Performance panel — confirm no dropped frames while scrolling |
| Cold load <2s | Lighthouse audit — the initial HTML+CSS+JS bundle must be <200KB gzipped |
| Offline after sync | Chrome DevTools → Network → Offline mode — all features must work |
