# PLAN
## MutualLens — Implementation Plan v1.0

---

## Overview

The project is broken into **5 phases**. Each phase produces a working, committable increment. Phases 1–3 are the core product. Phases 4–5 are enhancements.

**Estimated total effort**: ~25–35 hours of Claude Code sessions  
**Recommended session size**: One task group per session (keep context tight)

---

## Phase 1 — Project Skeleton & Data Foundation
*Goal: Running app that can sync and store fund data locally*

### Task 1.1 — Initialise Project
```
- [ ] Run: npm create vite@latest mutual-lens -- --template vanilla
- [ ] Install dependencies:
        npm install idb gh-pages
- [ ] Configure vite.config.js:
        base: '/mutual-lens/'   (update to actual repo name)
        build.outDir: 'dist'
- [ ] Add npm scripts to package.json:
        "dev": "vite"
        "build": "vite build"
        "deploy": "npm run build && gh-pages -d dist"
- [ ] Create folder structure per SPEC §2
- [ ] Add .gitignore (node_modules, dist)
- [ ] Commit: "chore: project scaffold"
```

### Task 1.2 — Database Layer (`src/data/db.js`)
```
- [ ] Open IndexedDB with version 1
- [ ] Define object stores:
        funds         — keyPath: schemeCode
        nav_history   — keyPath: [schemeCode, date]
        sync_meta     — keyPath: key
        user_data     — keyPath: schemeCode  (stars, notes)
- [ ] Export helper functions:
        upsertFunds(records[])
        getFunds(filters?)
        upsertNavHistory(records[])
        getNavHistory(schemeCode)
        getSyncMeta(key)
        setSyncMeta(key, data)
        getUserData(schemeCode)
        setUserData(schemeCode, data)
- [ ] Batch write in transactions of 500 records
- [ ] Commit: "feat(db): IndexedDB schema and helpers"
```

### Task 1.3 — AMFI Adapter (`src/data/amfi.js`)
```
- [ ] Fetch: https://www.amfiindia.com/spages/NAVAll.txt
- [ ] Parse pipe-delimited text format:
        Scheme Code | ISIN Div Payout/IDCW | ISIN Div Reinvestment | Scheme Name | Net Asset Value | Date
- [ ] Extract: schemeCode, schemeName, navCurrent, navDate, amcName (from section headers)
- [ ] Normalise: planType (Direct/Regular from name), optionType (Growth/IDCW from name)
- [ ] Return: array of fund objects matching SPEC §3.1 (partial — no history fields yet)
- [ ] Error handling: network failure → throw with clear message
- [ ] Commit: "feat(data): AMFI NAVAll.txt parser"
```

### Task 1.4 — MFAPI Adapter (`src/data/mfapi.js`)
```
- [ ] fetchFundList(): GET https://api.mfapi.in/mf
        Returns [{schemeCode, schemeName}]
- [ ] fetchFundMeta(schemeCode): GET https://api.mfapi.in/mf/{code}
        Returns metadata + full NAV history array
- [ ] fetchNavHistoryBatch(schemeCodes[], onProgress):
        Process in batches of 10 with 100ms delay between batches
        Call onProgress(completed, total) each batch
- [ ] Commit: "feat(data): MFAPI adapter with batched history fetch"
```

### Task 1.5 — Sync Orchestrator (`src/data/sync.js`)
```
- [ ] quickSync():
        1. fetchAMFIData()       → upsert funds (NAV + metadata)
        2. setSyncMeta('nav_current', { lastSyncAt, totalRecords })
        3. Dispatch custom event: 'sync:complete'
- [ ] fullSync(onProgress):
        1. quickSync()
        2. fetchNavHistoryBatch(allSchemeCodes, onProgress)
        3. computeAllMetrics()
        4. setSyncMeta('nav_history', { lastSyncAt, totalRecords })
        5. Dispatch: 'sync:complete'
- [ ] selectiveSync(schemeCodes[]):
        Same as fullSync but only for provided codes
- [ ] getSyncStatus(): returns sync_meta records for display
- [ ] Commit: "feat(sync): orchestrator with quick/full/selective modes"
```

### Task 1.6 — Compute Engine (`src/data/compute.js`)
```
- [ ] computeReturns(navHistory):
        1W, 1M, 3M, 6M returns (simple)
        1Y, 3Y, 5Y CAGR
        Return null for periods with insufficient data
- [ ] computeRisk(navHistory):
        stdDev1y (annualised daily log returns × √252)
        sharpe1y (use 6.5% risk-free rate)
        maxDrawdown (over full available history)
- [ ] computeAllMetrics():
        For each fund in IndexedDB with hasNavHistory=true:
          history = getNavHistory(schemeCode)
          metrics = { ...computeReturns(history), ...computeRisk(history) }
          updateFund(schemeCode, metrics)
- [ ] Commit: "feat(compute): returns and risk metric calculations"
```

**Phase 1 Deliverable**: `npm run dev` shows a blank page that, on clicking "Sync", downloads all fund data, stores it locally, and logs fund count to console.

---

## Phase 2 — Core UI: Table & Filters
*Goal: Browsable, filterable fund table with all data visible*

### Task 2.1 — Base HTML & CSS (`index.html`, `src/style.css`)
```
- [ ] Semantic HTML layout: toolbar, filter sidebar, main table area
- [ ] CSS Variables (light theme defaults):
        --color-bg, --color-surface, --color-border
        --color-text-primary, --color-text-secondary
        --color-accent, --color-positive, --color-negative
        --font-body, --font-mono
        --radius-sm, --radius-md
        --shadow-sm, --shadow-md
- [ ] Responsive grid: sidebar + main content
- [ ] CSS for table: sticky header, alternating row colors, hover state
- [ ] Commit: "feat(ui): base layout and design tokens"
```

### Task 2.2 — Fund Table (`src/ui/table.js`)
```
- [ ] Virtual scroll implementation:
        Calculate visible rows from scrollTop and rowHeight (48px)
        Render only visible rows + 10 buffer rows above/below
        Update on scroll (requestAnimationFrame throttled)
- [ ] Column rendering from src/config/columns.js:
        Each column def: { key, label, format, width, defaultVisible, sortable }
        formatters: currency(₹), percent(%, colored), date, text-truncate
- [ ] Sortable column headers (click to sort, second click reverses):
        Current sort: { key, direction } stored in module state
        Re-render on sort change
- [ ] Row click → open fund detail modal
- [ ] Status bar: "Showing {filtered} of {total} funds | Last synced: {time}"
- [ ] Commit: "feat(ui): virtual-scroll fund table with sorting"
```

### Task 2.3 — Column Configuration (`src/config/columns.js`)
```
- [ ] Define all columns per SPEC §5.3
- [ ] Each column entry:
        { key, label, width, defaultVisible, sortable, format }
- [ ] format functions: currencyINR, percentColored, dateShort, textTruncate
- [ ] Export: DEFAULT_COLUMNS, ALL_COLUMNS
- [ ] Commit: "config: column definitions"
```

### Task 2.4 — Filter Panel (`src/ui/filters.js`, `src/config/filters.js`)
```
- [ ] Filter config (src/config/filters.js):
        Per SPEC §5.2 — all filter definitions
        Each: { id, label, type, field, options?, min?, max?, default }
- [ ] Filter panel renderer:
        Multi-checkbox: checkboxes with "Select All / Clear" shortcuts
        Range slider: dual-handle HTML input[range] pair with numeric display
        Toggle: styled button group
        Searchable select: input + filtered dropdown
- [ ] Filter state: object { filterId: value } stored in module
- [ ] evaluateFilters(fund, filterState): returns boolean
- [ ] On any filter change:
        Re-run evaluateFilters across all funds
        Update table with filtered results
        Update status bar count
- [ ] "Reset All Filters" button
- [ ] Commit: "feat(ui): filter panel with all filter types"
```

### Task 2.5 — Toolbar (`src/ui/toolbar.js`)
```
- [ ] Logo / app name (left)
- [ ] Search bar (centre): debounced 200ms, filters by name/AMC/code
- [ ] Sync button group (right):
        "Quick Sync" → sync.quickSync()
        "Full Sync" (dropdown) → sync.fullSync()
        Shows spinner + progress during sync
- [ ] Column Picker: dropdown showing all columns with checkboxes
- [ ] Export dropdown: CSV, JSON (exports current filtered set)
- [ ] Theme toggle: light/dark
- [ ] "About" link: shows modal with data sources + last sync info
- [ ] Commit: "feat(ui): toolbar with sync, export, column picker"
```

### Task 2.6 — App Bootstrap (`src/main.js`)
```
- [ ] On load:
        1. Init DB
        2. Load filter state from localStorage (persisted preferences)
        3. Fetch all funds from IndexedDB
        4. Render toolbar, filters, table
        5. If no data: show "No data yet — click Quick Sync to start" empty state
        6. If data > 1 day old: show "Data may be stale" warning banner
- [ ] Wire up all event listeners:
        sync:complete → refresh table data
        filter:change → re-filter and re-render
        sort:change   → re-sort and re-render
        column:toggle → re-render table headers + rows
- [ ] Commit: "feat: app bootstrap and event wiring"
```

**Phase 2 Deliverable**: Full working single-page app — sync data, filter, sort, browse all funds in a table.

---

## Phase 3 — Fund Detail & Polish
*Goal: Rich per-fund information and production-ready UX*

### Task 3.1 — Fund Detail Drawer (`src/ui/modal.js`)
```
- [ ] Slide-in drawer from right (CSS transition)
- [ ] Close on: X button, Escape key, backdrop click
- [ ] Content sections:
        Header: full name, scheme code, plan/option badges, AMC
        NAV chart: line chart using Canvas API (no external charting lib)
          Toggle: 1Y / 3Y / 5Y / All
        Returns table: 1W, 1M, 3M, 6M, 1Y, 3Y, 5Y (coloured)
        Risk metrics table: Sharpe, Std Dev, Max Drawdown
        Fund details: Category, AUM, Expense Ratio, Min SIP, Scheme Type
        AMFI link: "View on AMFI website" (opens in new tab)
        Notes: <textarea> auto-saved to IndexedDB on blur
        Star toggle: ★ / ☆ button, saved to IndexedDB
- [ ] Commit: "feat(ui): fund detail drawer with NAV chart"
```

### Task 3.2 — Toast Notifications (`src/ui/toast.js`)
```
- [ ] Show toasts for: sync start, sync complete, sync error, export complete
- [ ] Sync progress toast: persistent, shows progress bar + "X / Y funds"
- [ ] Auto-dismiss success toasts after 4s
- [ ] Error toasts persistent (manual dismiss)
- [ ] Commit: "feat(ui): toast notification system"
```

### Task 3.3 — Theme System (`src/ui/theme.js`)
```
- [ ] Toggle applies class 'dark' to <html>
- [ ] Dark theme CSS variables in style.css:
        html.dark { --color-bg: #0f1117; --color-surface: #1a1d27; ... }
- [ ] Persist preference to localStorage
- [ ] Respect prefers-color-scheme on first load
- [ ] Commit: "feat(ui): dark mode theme"
```

### Task 3.4 — Export (`src/ui/toolbar.js` addition)
```
- [ ] exportCSV(funds):
        Headers from visible columns
        Format values (strip ₹/% symbols for spreadsheet compatibility)
        Trigger download via Blob + URL.createObjectURL
- [ ] exportJSON(funds):
        Full fund objects (all fields)
        Pretty-printed JSON
        Trigger download
- [ ] Commit: "feat: CSV and JSON export for filtered fund list"
```

### Task 3.5 — README & Documentation
```
- [ ] README.md:
        Project description + screenshot (take after UI complete)
        Quick Start (3 steps: clone, npm install, npm run dev)
        How to sync data (explain Quick vs Full Sync)
        Data dictionary (all fields and their sources)
        How to deploy to GitHub Pages
        How to customise columns and filters (link to config files)
        Data sources (AMFI, MFAPI) with attribution
        License (MIT)
- [ ] Commit: "docs: README with quickstart and data dictionary"
```

**Phase 3 Deliverable**: Complete, polished application ready for public GitHub release.

---

## Phase 4 — Advanced Features (Post-MVP)
*Goal: Power-user features for deeper analysis*

### Task 4.1 — Fund Comparison Mode
```
- [ ] Multi-select funds (checkbox column)
- [ ] "Compare Selected" button appears when 2–5 funds selected
- [ ] Comparison modal: side-by-side returns, risk metrics, NAV chart overlay
```

### Task 4.2 — Starred Watchlist
```
- [ ] "Starred" tab at top of table: shows only starred funds
- [ ] Persistent star state (IndexedDB user_data)
- [ ] Export starred funds as CSV/JSON
```

### Task 4.3 — Saved Filter Presets
```
- [ ] "Save current filters as preset" button
- [ ] Named presets stored in localStorage
- [ ] One-click load preset
- [ ] Example built-in presets:
        "Best Direct Equity (5Y CAGR > 12%, Expense < 0.5%)"
        "Low-Risk Debt Funds (Sharpe > 0.5)"
        "All Index Funds"
```

### Task 4.4 — Rolling Returns View
```
- [ ] Fund detail drawer: additional tab "Rolling Returns"
- [ ] Shows distribution of 1Y / 3Y returns across all start dates
- [ ] Helps visualise consistency of returns vs point-to-point
```

---

## Phase 5 — GitHub Pages & Distribution
*Goal: Published, discoverable, easy to fork*

### Task 5.1 — GitHub Pages Deployment
```
- [ ] Verify vite.config.js base path matches GitHub repo name
- [ ] npm run deploy → confirm live at https://<username>.github.io/mutual-lens/
- [ ] Add GitHub Actions workflow (.github/workflows/deploy.yml):
        Trigger: push to main
        Steps: npm ci → npm run build → gh-pages deploy
```

### Task 5.2 — GitHub Repository Setup
```
- [ ] Repository description + topics: mutual-funds, india, investing, finance, tool
- [ ] Add screenshot to README (link from GitHub Pages live URL)
- [ ] Create GitHub Issue templates: Bug Report, Feature Request
- [ ] Add MIT LICENSE file
- [ ] Pin CONSTITUTION.md and SPEC.md as project documentation
```

### Task 5.3 — First Release
```
- [ ] Tag v1.0.0 in git
- [ ] GitHub Release with:
        Release notes (what's included, what's not)
        Link to live demo (GitHub Pages)
        Known limitations (e.g., Beta/Alpha requires Nifty TRI data)
```

---

## Appendix A — Claude Code Session Guide

Each Claude Code session should start with a scoped prompt like:

```
Working on MutualLens (see CONSTITUTION.md, SPEC.md, PLAN.md).
Currently implementing: Task 2.2 — Fund Table (src/ui/table.js)
Requirements: virtual scroll, column rendering from config, sortable headers.
Existing code: src/data/db.js is complete (getFunds() returns fund array).
```

Keep sessions focused on **one task at a time**. Claude Code performs best with a clear, bounded scope.

---

## Appendix B — Data Source Testing Commands

Before starting Task 1.3 / 1.4, verify APIs are reachable:

```bash
# Test AMFI
curl -I https://www.amfiindia.com/spages/NAVAll.txt

# Test MFAPI — fund list
curl https://api.mfapi.in/mf | head -c 500

# Test MFAPI — single fund (Axis Bluechip Direct Growth)
curl https://api.mfapi.in/mf/119598 | head -c 500
```

---

## Appendix C — Dependency List

```json
{
  "dependencies": {
    "idb": "^8.0.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "gh-pages": "^6.0.0"
  }
}
```

Total production dependencies: **1** (`idb` — lightweight IndexedDB wrapper).  
No UI framework. No CSS framework. No charting library. Intentionally minimal.
