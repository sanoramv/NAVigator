---
description: "Task list for MutualLens — Indian Mutual Fund Knowledge Base"
---

# Tasks: MutualLens — Indian Mutual Fund Knowledge Base

**Input**: Design documents from `specs/001-mf-knowledge-base/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

**Tests**: No automated tests — manual validation against spec acceptance scenarios (no test framework in tech stack).

**Organization**: Tasks grouped by user story (P1→P4) for independent implementation and delivery. Each phase produces a working, independently testable increment.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no shared state writes)
- **[Story]**: Which user story this task belongs to (US1–US4)
- File paths are relative to repository root

---

## Phase 1: Setup

**Purpose**: Project scaffolding — creates the runnable skeleton in under 60 seconds from clone.

- [X] T001 Initialise `package.json` with name `mutual-lens`, version `0.1.0`, scripts `dev`/`build`/`preview`/`deploy`, and dependencies: prod `idb@^8`, dev `vite@^5` and `gh-pages@^6`
- [X] T002 Create `vite.config.js` with `base: '/mutual-lens/'` (user changes this to match repo name), `build.outDir: 'dist'`, and ES2022 target
- [X] T003 Create `index.html` — semantic shell with `<header id="toolbar">`, `<aside id="filter-panel">`, `<main id="table-area">`, `<div id="detail-drawer">`, `<div id="toast-area">`; `<script type="module" src="/src/main.js">`
- [X] T004 Create `public/favicon.svg` — simple ₹ rupee symbol SVG icon
- [X] T005 [P] Create all empty module files in `src/` per the plan source tree so Vite resolves imports without errors: `src/main.js`, `src/style.css`, `src/db/schema.js`, `src/db/db.js`, `src/sync/worker.js`, `src/sync/amfi.js`, `src/sync/mfapi.js`, `src/sync/compute.js`, `src/store/state.js`, `src/ui/table/VirtualTable.js`, `src/ui/table/Row.js`, `src/ui/table/sort.js`, `src/ui/filters/FilterPanel.js`, `src/ui/filters/FilterEngine.js`, `src/ui/filters/controls/RangeSlider.js`, `src/ui/filters/controls/MultiCheck.js`, `src/ui/filters/controls/SearchBox.js`, `src/ui/toolbar/Toolbar.js`, `src/ui/toolbar/SyncButton.js`, `src/ui/detail/DetailDrawer.js`, `src/ui/detail/NavChart.js`, `src/ui/detail/MetricTable.js`, `src/ui/toast.js`, `src/ui/theme.js`, `src/config/columns.js`, `src/config/filters.js`

---

## Phase 2: Foundational

**Purpose**: Shared infrastructure that MUST be complete before any user story begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T006 Implement `src/db/schema.js` — export DB_NAME `'mutual-lens-db'`, DB_VERSION `1`, and `upgrade(db)` function that creates all 4 stores: `funds` (keyPath `'schemeCode'`, indexes: `by_category` on `'category'`, `by_amc` on `'amcName'`, `by_subcategory` on `'subCategory'`); `nav_history` (keyPath `['schemeCode','date']`, index `by_scheme` on `'schemeCode'`); `sync_meta` (keyPath `'key'`); `user_data` (keyPath `'schemeCode'`)
- [ ] T007 Implement `src/db/db.js` — export `openDB()` that calls idb's `openDB` with schema from T006; export typed helpers: `getFunds()`, `putFunds(records[])`, `getFund(schemeCode)`, `getNavHistory(schemeCode)`, `putNavHistory(records[])`, `getSyncMeta(key)`, `putSyncMeta(record)`, `getUserData(schemeCode)`, `putUserData(record)`, `getAllUserData()`; all helpers open the DB lazily via a module-level promise
- [ ] T008 [P] Implement `src/store/state.js` — export mutable `state` object with fields: `allFunds[]`, `filtered[]`, `filters{}` (all filter keys from data-model.md defaulting to null/empty/false), `sort{column:'schemeName',direction:'asc'}`, `selectedSchemeCode:null`, `columnVisibility{}`, `syncStatus{quickSync:null,fullSync:null}`; export `setFilters(patch)`, `setSort(col,dir)`, `setColumnVisibility(patch)` mutation helpers that update state in place (no return value)
- [ ] T009 [P] Implement `src/config/columns.js` — export `COLUMNS` array of 17 column definition objects, each with fields `key`, `label`, `defaultVisible` (bool), `sortable` (bool), `format` (function: value → display string), `width` (px string); include all columns from plan data-model: schemeCode, schemeName, amcName, category, subCategory, navCurrent, navDate, return1w, return1m, return3m, return6m, return1y, return3y, return5y, stdDev1y, sharpe1y, maxDrawdown; add rich JSDoc comments explaining how to add/remove/reorder columns
- [ ] T010 [P] Implement `src/config/filters.js` — export `FILTERS` array of filter definition objects; include all filters from spec FR-002–FR-005 with these fields: `key` (matches state.filters key), `label`, `type` (`'multicheck'|'range'|'search'|'toggle'`), `options` (for multicheck: string[]), `min`/`max`/`step` (for range), `stateKey` (maps to state.filters); omit Plan Type and Option filters (all stored funds are Direct+Growth — redundant); add rich JSDoc comments for user customisation
- [ ] T011 [P] Implement `src/style.css` — CSS custom properties for light/dark theme (`--bg`, `--surface`, `--border`, `--text`, `--text-muted`, `--accent`, `--green`, `--red`); base reset and typography; layout grid: `header` fixed top, `#filter-panel` fixed left sidebar (280px, collapsible), `#table-area` fills remaining space, `#detail-drawer` fixed right panel (420px, off-screen by default); scrollbar styling; responsive breakpoint to hide filter panel below 900px
- [ ] T012 [P] Implement `src/ui/toast.js` — export `showToast(message, type='info', durationMs=4000)`; appends a `<div class="toast toast--{type}">` to `#toast-area`, auto-removes after duration; supports types: `info`, `success`, `error`, `progress` (progress toast stays until explicitly dismissed via returned `dismiss()` function)
- [ ] T013 [P] Implement `src/ui/theme.js` — export `initTheme()` that reads `prefers-color-scheme` and any saved preference from localStorage; export `toggleTheme()` that flips `data-theme` attribute on `<html>` and saves to localStorage
- [ ] T014 Implement `src/main.js` bootstrap — `import` openDB, state, Toolbar, FilterPanel, VirtualTable, DetailDrawer, initTheme; on DOMContentLoaded: (1) `initTheme()`, (2) `await openDB()`, (3) load `columnVisibility` from sync_meta into state, (4) load all funds from DB into `state.allFunds`, (5) load all user_data and merge starred/notes into funds, (6) apply filters to populate `state.filtered`, (7) mount `Toolbar`, `FilterPanel`, `VirtualTable`; show empty-state CTA if `allFunds.length === 0`

**Checkpoint**: `npm run dev` shows a blank page with correct layout regions, no console errors.

---

## Phase 3: User Story 1 — Browse and Filter (Priority: P1) 🎯 MVP

**Goal**: A filterable, sortable, virtual-scrolled table of all Direct+Growth funds.
**Independent Test**: After Quick Sync (Phase 4), apply any filter combination → table updates in <200ms showing correct fund subset; sort by any column → correct ordering; search → correct name/code matches.

- [ ] T015 [US1] Implement `src/ui/filters/FilterEngine.js` — export pure function `applyFilters(funds, filters)` that returns a new filtered array; apply checks in cheapest-first order per data-model.md: starredOnly → category → subCategory → amcName → search (substring on schemeName + schemeCode) → return1y/3y/5y min/max → stdDev1y min/max → sharpe1y min/max → maxDrawdown min/max; null filter values are skipped; funds with null metric values fail any active range filter for that metric
- [ ] T016 [P] [US1] Implement `src/ui/filters/controls/RangeSlider.js` — export `RangeSlider({container, min, max, step, onChange})` factory; renders two `<input type="range">` elements with a fill track between thumbs; exports `setValue(min,max)` and `reset()` methods; emits `onchange` with `{min,max}` after 16ms debounce (one animation frame)
- [ ] T017 [P] [US1] Implement `src/ui/filters/controls/MultiCheck.js` — export `MultiCheck({container, options, onchange})` factory; renders labelled checkboxes with a "Select All / Clear" toggle; exports `setValue(string[])` and `reset()` methods; emits `onchange` with selected string array immediately on change
- [ ] T018 [P] [US1] Implement `src/ui/filters/controls/SearchBox.js` — export `SearchBox({input, onchange})` factory wrapping an existing `<input>` element; debounces `input` events by 200ms; emits `onchange` with trimmed lowercase string; exports `reset()` method
- [ ] T019 [US1] Implement `src/ui/filters/FilterPanel.js` — export `FilterPanel({container})` factory; builds all filter controls dynamically from `src/config/filters.js`; on any control change: update `state.filters` via `setFilters()`, re-run `applyFilters`, update `state.filtered`, call `VirtualTable.refresh()`; include "Reset All Filters" button; include collapsed/expanded toggle
- [ ] T020 [US1] Implement `src/ui/table/sort.js` — export `COMPARATORS` map keyed by column key; each comparator handles null values (nulls sort last regardless of direction); export `applySortToFiltered()` that mutates `state.filtered` in place using `state.sort`; export `setSort(columnKey)` that toggles direction if same column or resets to 'asc' if new column, then calls `applySortToFiltered()` and `VirtualTable.refresh()`
- [ ] T021 [US1] Implement `src/ui/table/Row.js` — export `createRow()` that returns a positioned `<div class="fund-row">` with one `<span>` child per visible column; export `updateRow(rowEl, fund, index, columnVisibility)` that updates each span's textContent using the column's `format()` function from config/columns.js; marks green/red for return columns; renders ★/☆ for star column; sets `rowEl.style.transform = translateY(${index * ROW_HEIGHT}px)`
- [ ] T022 [US1] Implement `src/ui/table/VirtualTable.js` — export `VirtualTable({container})` factory; `ROW_HEIGHT = 48`; maintains a DOM pool of `viewportRowCount + 10` Row elements; on scroll: compute `firstVisible = Math.floor(scrollTop / ROW_HEIGHT)`, iterate pool indices, call `updateRow` for each visible slot, set spacer height to `filtered.length * ROW_HEIGHT`; export `refresh()` (call after filter/sort change), `scrollToTop()`, `getViewportRowCount()`; attach `click` listener on container — find clicked fund by y-position, emit `onFundClick(fund)` callback
- [ ] T023 [US1] Implement `src/ui/toolbar/Toolbar.js` — export `Toolbar({container, onSyncClick, onExportCSV, onExportJSON, onColumnPickerToggle})` factory; renders: app name "MutualLens", search input (delegates to SearchBox), sync button area (placeholder for SyncButton), result count `<span id="result-count">`, column picker button, export CSV/JSON buttons, theme toggle button; wires search box to update `state.filters.search` → `applyFilters` → `VirtualTable.refresh()`; updates result count after each refresh; sync and export callbacks are provided by main.js
- [ ] T024 [US1] Wire US1 in `src/main.js` — instantiate `FilterPanel`, `VirtualTable`, `Toolbar`; connect `VirtualTable.onFundClick` to `DetailDrawer.open(fund)` (stub for now); measure filter response time with `performance.now()` around `applyFilters` call — log warning if >200ms

**Checkpoint**: `npm run dev`, load page → blank table with filter panel visible; manually populate `state.allFunds` with 3,000 dummy fund objects from browser console, call `applyFilters()` + `VirtualTable.refresh()` → table renders and scrolls smoothly; apply category filter → correct subset shown in <200ms.

---

## Phase 4: User Story 2 — Sync Fund Data (Priority: P2)

**Goal**: Quick Sync fetches all Direct+Growth funds (NAV + category); Full Sync fetches 5Y history and computes all metrics; pause/resume works correctly.
**Independent Test**: Click Quick Sync → progress shown → table fills with ~2,500 funds; disconnect network, reload → all data still present; click Full Sync, pause mid-way, reload, resume → continues from correct fund with no data loss or re-fetching.

- [ ] T025 [P] [US2] Implement `src/sync/compute.js` — export pure functions: `computeReturns(navHistory)` → `{1w,1m,3m,6m,1y,3y,5y}` using closest-date binary search for each lookback window; `computeRisk(navHistory)` → `{stdDev1y, sharpe1y, maxDrawdown}` using the formulas from data-model.md (risk-free rate 6.5%); `findClosestDate(sortedDates, targetDate)` binary search helper; all functions return null for any metric where insufficient history exists; input array is sorted ascending by date
- [ ] T026 [P] [US2] Implement `src/sync/amfi.js` — export async `fetchAndParseFunds()`: fetch `https://www.amfiindia.com/spages/NAVAll.txt`; parse line by line tracking current category section header; for each data row with 5 semicolons: apply `isDirectGrowth(name)` (four-condition filter per contracts/amfi-api.md); if passes: create fund object with schemeCode (int), schemeName, schemeNameShort (first word-group before " - Direct"), category, subCategory (from section header via mapCategory/mapSubCategory), navCurrent (parseFloat), navDate (normalised to YYYY-MM-DD), amcName (first word-group of name as approximation), schemeType `'Open Ended'`, syncedAt (new Date().toISOString()), hasNavHistory false; skip rows where nav is 'N.A.' or non-numeric; return fund array
- [ ] T027 [US2] Implement `src/sync/mfapi.js` — export async `fetchNavHistoryBatch(schemeCodes, resumeIndex, onProgress, shouldPauseFn)`: iterate schemeCodes from resumeIndex in batches of 10; for each batch `Promise.all` fetch `https://api.mfapi.in/mf/{code}`; on success: extract meta (amcName from fund_house, schemeType from scheme_type), extract data array, reverse to ascending order, normalise dates to YYYY-MM-DD and nav to float, trim to 5Y window from latest navDate; call onProgress(completedCount, total); store results via db.putNavHistory and db.putFunds (update amcName, schemeType, hasNavHistory:true, compute metrics via compute.js); if shouldPauseFn() returns true: post PAUSED message and stop; add 100ms delay between batches; handle per-fund 404/timeout gracefully (skip, continue)
- [ ] T028 [US2] Implement `src/sync/worker.js` — Web Worker entry (type: module): maintain `shouldPause = false`; `self.onmessage` handler: on `QUICK_SYNC`: call amfi.fetchAndParseFunds(), open DB, upsert all funds, post FUNDS_LOADED with fund array, update sync_meta quick_sync record, post COMPLETE; on `FULL_SYNC {resumeIndex}`: load fund list from DB (sorted by schemeCode), call mfapi.fetchNavHistoryBatch passing shouldPauseFn and onProgress; on `PAUSE`: set shouldPause=true; post PROGRESS events from onProgress callback; post PAUSED with resumeIndex when interrupted; post COMPLETE when done; post ERROR on unrecoverable failure with human-readable message
- [ ] T029 [US2] Implement `src/ui/toolbar/SyncButton.js` — export `SyncButton({container, worker, onSyncComplete})` factory; renders: "Quick Sync" button, "Full Sync" button, progress bar `<progress>` element (hidden when not syncing), pause/resume button (visible during Full Sync), status text span; on Quick Sync click: disable both buttons, post QUICK_SYNC to worker; on Full Sync click: read resumeIndex from state.syncStatus.fullSync, post FULL_SYNC; on PROGRESS event: update progress bar and status text; on PAUSED event: show "Resume Full Sync" button; on COMPLETE event: re-enable buttons, show success toast, call onSyncComplete; on ERROR event: show error toast, re-enable buttons
- [ ] T030 [US2] Wire US2 in `src/main.js` — create Worker (`new Worker(new URL('./sync/worker.js', import.meta.url), {type:'module'})`); pass to SyncButton; on FUNDS_LOADED: call db.putFunds(funds), reload state.allFunds from DB, merge user_data, run applyFilters, VirtualTable.refresh(); on COMPLETE (quick): update state.syncStatus.quickSync from DB, show last-sync timestamp in Toolbar; load sync_meta full_sync_progress on startup to enable resume
- [ ] T031 [US2] Validate pause/resume: run Full Sync in dev, pause after ~50 funds, check IndexedDB in DevTools (Application → IndexedDB) to confirm progress record exists with correct resumeIndex; reload page, click Resume, confirm it continues from that index; run to completion, verify all funds have hasNavHistory:true and non-null returns/risk in funds store

**Checkpoint**: Quick Sync completes → table fills with ~2,500 Direct+Growth funds; filters work on real data; Full Sync populates returns and risk metrics visible in table columns; pause/resume verified per T031.

---

## Phase 5: User Story 3 — Fund Detail View (Priority: P3)

**Goal**: Clicking any fund row opens a slide-in drawer with NAV chart, full returns/risk table with formula tooltips, and editable notes.
**Independent Test**: Click any fund row → drawer opens instantly with fund data; if Full Sync complete: chart renders 1Y/3Y/5Y data; star a fund → survives page reload; type a note → survives page reload; open drawer for fund with no history → chart hidden, N/A shown for metrics.

- [ ] T032 [P] [US3] Implement `src/ui/detail/NavChart.js` — export `NavChart({container})` factory; `render(navHistory, window)` method where window is `'1y'|'3y'|'5y'`; build an SVG (100% width, fixed height 200px) with responsive viewBox; filter history to window (last N years from most recent date); map dates to X axis (linear time scale), navs to Y axis (min/max with 10% padding); draw `<polyline>` for the NAV line; draw Y-axis gridlines (5 lines) with ₹ labels; draw X-axis with year markers; implement hover: `mousemove` on SVG → find nearest data point by X position → show vertical crosshair line and `<title>`-based tooltip with date and ₹ NAV; draw toggle buttons (1Y / 3Y / 5Y) above chart that call `render()` with new window; hide chart container entirely if navHistory is empty or null
- [ ] T033 [P] [US3] Implement `src/ui/detail/MetricTable.js` — export `MetricTable({container})` factory; `render(fund)` method; renders two HTML tables: (1) Returns table with rows for 1W/1M/3M/6M/1Y/3Y/5Y showing value formatted as % with green/red colour, plus a `<abbr title="{formula}">` tooltip per row showing the formula from data-model.md; (2) Risk table with rows for Std Dev 1Y, Sharpe 1Y, Max Drawdown each with formula tooltip; any null value renders as `N/A — Full Sync required`
- [ ] T034 [US3] Implement `src/ui/detail/DetailDrawer.js` — export `DetailDrawer({container})` factory; `open(fund)` method: (1) populate header (full name, scheme code, AMFI URL `https://www.amfiindia.com/nav-history?mfID={schemeCode}`), current NAV + date, category badges; (2) load nav_history from DB via db.getNavHistory(schemeCode), call NavChart.render(); (3) call MetricTable.render(fund); (4) populate notes textarea with user_data.notes, attach debounced (500ms) `input` listener that calls db.putUserData({schemeCode, notes}); (5) render ★/☆ star toggle that calls db.putUserData({schemeCode, starred}), updates state, calls VirtualTable.refresh(); (6) CSS slide-in animation from right; `close()` method slides out; wire Escape key to close
- [ ] T035 [US3] Wire US3 in `src/main.js` — instantiate DetailDrawer; pass `onFundClick` to VirtualTable that calls `DetailDrawer.open(fund)`; on star toggle in drawer: re-merge user_data into state.allFunds, re-run applyFilters (in case starredOnly filter is active)

**Checkpoint**: Click any fund row → drawer slides in immediately; all fund data visible; for a fund with Full Sync history: chart renders with all three time windows; star/unstar persists after reload; notes persist after reload; fund with no history shows N/A correctly with formula tooltips.

---

## Phase 6: User Story 4 — Export (Priority: P4)

**Goal**: Export filtered fund list as CSV or JSON with correctly formatted values.
**Independent Test**: Apply filters, export CSV → file downloads → opens in Excel with correct headers and data for filtered funds only; same for JSON; with no filters, export contains all funds.

- [ ] T036 [US4] Implement CSV export function in `src/ui/toolbar/Toolbar.js` — `exportCSV()` method: get visible columns from state.columnVisibility + config/columns.js; build header row from column labels; for each fund in state.filtered: build row using column format() functions; escape values with commas or quotes; join with CRLF; create Blob with `text/csv;charset=utf-8` and UTF-8 BOM; trigger download via temporary `<a download="mutual-lens-{date}.csv">` click
- [ ] T037 [US4] Implement JSON export function in `src/ui/toolbar/Toolbar.js` — `exportJSON()` method: map state.filtered to plain objects containing only the visible column keys (raw values, not formatted strings); JSON.stringify with 2-space indent; create Blob with `application/json`; trigger download via temporary `<a download="mutual-lens-{date}.json">` click
- [ ] T038 [US4] Wire US4 in `src/main.js` — pass `onExportCSV: () => toolbar.exportCSV()` and `onExportJSON: () => toolbar.exportJSON()` to Toolbar; validate exports open correctly in browser (DevTools network → verify download headers and file content)

**Checkpoint**: Apply 2–3 filters → click Export CSV → download opens in spreadsheet with correct filtered rows and formatted numbers; Export JSON produces valid parseable output with same data.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: UI completeness, honesty requirements (constitution Principle V), accessibility, and deployment.

- [ ] T039 [P] Add empty-state views in `src/ui/table/VirtualTable.js` — if `state.allFunds.length === 0`: show centred card "No fund data yet — click Quick Sync to download"; if `state.filtered.length === 0` but `state.allFunds.length > 0`: show "No funds match your filters" with a "Clear All Filters" button that calls FilterPanel.resetAll() + VirtualTable.refresh()
- [ ] T040 [P] Add data-freshness warning in `src/ui/toolbar/Toolbar.js` — after loading syncStatus from DB on startup: if quickSync.lastSyncAt is older than 24 hours, show a yellow banner "Data last updated {relative time} — consider Quick Sync"; use relative time formatting (e.g., "2 days ago")
- [ ] T041 [P] Add data source attribution in Toolbar's "About" popover — list AMFI URL and MFAPI URL as clickable links (constitution Principle V: data source URLs must be surfaced); show DB version and app version
- [ ] T042 [P] Update `vite.config.js` to read base path from env var `VITE_BASE_PATH` with fallback to `'/mutual-lens/'`; update `package.json` deploy script to `npm run build && gh-pages -d dist`; add comment in vite.config.js explaining how to change the base path for a different repo name
- [ ] T043 Keyboard navigation audit — tab through all interactive elements (filter controls, table column headers, toolbar buttons, drawer close); confirm each is reachable and activatable with Enter/Space; add `aria-label` to all icon-only buttons (sync, export, column picker, theme toggle, star); confirm colour is never the sole indicator (return values show +/- prefix in addition to green/red)
- [ ] T044 Validate `specs/001-mf-knowledge-base/quickstart.md` against live app — follow each step in quickstart.md exactly in a fresh terminal; confirm all commands work; confirm Quick Sync and Full Sync (partial) work as documented; confirm GitHub Pages deploy command produces a working deployment

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Requires Phase 1 complete — BLOCKS all user story phases
- **US1 Browse/Filter (Phase 3)**: Requires Phase 2; can begin before US2 Sync is complete (use console-injected test data for early validation)
- **US2 Sync (Phase 4)**: Requires Phase 2; does NOT depend on US1 — sync worker is independent of UI
- **US3 Detail (Phase 5)**: Requires Phase 2 complete, and Phases 3 + 4 (needs table click + synced fund data)
- **US4 Export (Phase 6)**: Requires Phase 3 complete (needs state.filtered and Toolbar); Phase 4 recommended for real data
- **Polish (Phase 7)**: Requires all story phases complete

### User Story Dependencies

| Story | Blocks | Required Before |
|-------|--------|----------------|
| US1 Browse/Filter | US3, US4 | US3 Detail (needs table click), US4 Export (needs state.filtered) |
| US2 Sync | US3 | US3 Detail (needs real NAV history in DB) |
| US3 Detail | — | — |
| US4 Export | — | — |

### Within Each Phase — Ordering

- T006 → T007 (DB must be open before state hydration)
- T014 (main.js) depends on T006 + T007 + T008
- T019 FilterPanel depends on T016 + T017 + T018 (controls must exist)
- T022 VirtualTable depends on T021 Row (Row factory must exist)
- T028 worker.js depends on T025 + T026 + T027 (compute + amfi + mfapi modules)
- T030 main.js US2 wiring depends on T028 + T029

### Parallel Opportunities

All `[P]`-marked tasks within the same phase can be run simultaneously (different files, no shared writes).

Within Phase 2: T008, T009, T010, T011, T012, T013 can all run in parallel after T006+T007.
Within Phase 3: T016, T017, T018 can run in parallel; T019 depends on all three.
Within Phase 4: T025, T026 can run in parallel; T027 depends on both; T028 depends on T027.

---

## Implementation Strategy

### MVP (User Story 1 + 2 only — demonstrable in one session)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: US1 Browse/Filter (validate with test data)
4. Complete Phase 4: US2 Sync (populates real data)
5. **STOP and VALIDATE**: confirm filter response <200ms on real data, confirm offline mode works
6. Deploy to GitHub Pages — share with others

### Full Delivery (all 4 user stories)

7. Complete Phase 5: US3 Detail (chart + metrics)
8. Complete Phase 6: US4 Export
9. Complete Phase 7: Polish
10. Final quickstart.md validation (T044)

---

## Notes

- `[P]` tasks touch different files — safe to run in parallel with an agent
- No automated test framework — validate each phase checkpoint manually in the browser
- The Web Worker imports DB helpers directly — Vite handles module bundling into worker correctly with `{type:'module'}`
- All computed metric functions in `src/sync/compute.js` are pure — easy to validate in browser console before wiring
- `src/config/columns.js` and `src/config/filters.js` MUST be richly commented (constitution Principle VI + Technology Philosophy)
