# NAVigator — Indian Mutual Fund Browser

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Built with Vite](https://img.shields.io/badge/Built%20with-Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Vanilla JS](https://img.shields.io/badge/Vanilla-JavaScript-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![GitHub Pages](https://img.shields.io/badge/Deployed-GitHub%20Pages-222?logo=github&logoColor=white)](https://sanoramv.github.io/NAVigator/)

> Browse, filter, and compare ~2,500 Indian Direct+Growth mutual funds — fully offline, zero server, one dependency.

**[Live Demo →](https://sanoramv.github.io/NAVigator/)**

---

## The Problem

An individual investor in India who has accumulated funds over several years faces a surprisingly hard problem: **there is no free, fast, offline-capable tool to view all ~2,500 Direct+Growth mutual funds side by side** — with returns, risk metrics, categories, and a NAV history chart — without signing up, handing over a phone number, or waiting for a slow server.

Every existing platform is either:
- A broker app locked behind login / KYC
- A financial data site that is slow, ad-heavy, and paywalls historical data
- A spreadsheet that goes stale the day you build it

NAVigator solves this by pulling data directly from AMFI and MFAPI India into your browser's IndexedDB — no server, no account, no subscription.

---

## Features

| Feature | Detail |
|---|---|
| **Quick Sync** | Downloads ~2,500 Direct+Growth fund records (name, AMC, category, latest NAV) in ~5 seconds |
| **Full Sync** | Downloads 5-year NAV history for every fund, computes CAGR and risk metrics client-side. Takes 15–30 minutes; pause/resume across sessions |
| **Virtual scroll** | Renders only visible rows — 2,500 funds at 60 fps with zero jank |
| **Filter sidebar** | Filter by category, AMC, sub-category, return range, and text search |
| **Fund detail drawer** | NAV history chart, full metrics table, direct AMFI link, star/notes |
| **Export** | Download the current filtered view as CSV or JSON |
| **Dark / light theme** | Respects system preference, toggleable |
| **Offline-first** | After syncing, works with no internet connection |

---

## Live Demo

**[https://sanoramv.github.io/NAVigator/](https://sanoramv.github.io/NAVigator/)**

Start with **Quick Sync** to load the fund list (~5 s), then use **Full Sync** to load historical data and unlock CAGR/risk columns (long-running, can be paused).

---

## Quick Start

```bash
git clone https://github.com/sanoramv/NAVigator.git
cd NAVigator
npm install
npm run dev
```

Open **http://localhost:5173/NAVigator/** and click **Quick Sync** in the toolbar.

### Deploy to GitHub Pages

```bash
# In vite.config.js, VITE_BASE_PATH defaults to '/NAVigator/' — change if your repo name differs
npm run deploy
```

---

## How to Use

### Quick Sync vs Full Sync

| | Quick Sync | Full Sync |
|---|---|---|
| **What it fetches** | Fund list + latest NAV from AMFI | 5-year daily NAV history per fund from MFAPI |
| **Time** | ~5 seconds | 15–30 minutes |
| **Unlocks** | Name, AMC, Category, NAV columns | 1W/1M/3M/6M/1Y/3Y/5Y returns, Std Dev, Sharpe, Max Drawdown |
| **Can pause?** | No | Yes — saves progress, resumes after page reload |

### Filters

The left sidebar lets you filter by:
- **Category** — Equity, Debt, Hybrid, Index/ETF, Solution-Oriented, Other
- **AMC** — any fund house
- **Sub-category** — e.g. Large Cap, Mid Cap, Liquid
- **Return range** — 1Y / 3Y / 5Y sliders
- **Text search** — fund name, AMC name, or AMFI scheme code

### Fund Detail Drawer

Click any row to open the detail drawer:
- NAV history chart (zoomable by period)
- Full metrics table (returns + risk)
- Star the fund for quick access
- Add personal notes
- Direct link to the fund on AMFI

### Export

Click **CSV** or **JSON** in the toolbar to download the currently filtered and sorted fund list. The export respects visible columns, so hide columns you don't need before exporting.

---

## How It Was Built

This project was built using **Spec-Driven Development** — a structured methodology that produces a living specification before a single line of code is written. The tooling stack was:

- **[GitHub Spec Kit](https://github.com/specify-io/speckit)** — generates and manages the spec artefacts (Constitution → Spec → Plan → Tasks)
- **[Claude Code](https://claude.ai/code)** — implements tasks against the spec, respects architectural constraints

### Development Phases

| Phase | Focus | Tasks |
|---|---|---|
| 1 | Project scaffold — Vite, package.json, directory structure | T001–T005 |
| 2 | Database schema, state store, config (columns, filters), global styles | T006–T016 |
| 3 | Virtual table, filter panel, toolbar, sync button UI | T017–T030 |
| 4 | AMFI + MFAPI sync pipeline, Web Worker, IndexedDB writes | T031–T038 |
| 5 | Computed metrics — CAGR, Std Dev, Sharpe, Max Drawdown | T039–T041 |
| 6 | Fund detail drawer — NAV chart, metric table, star/notes | T042–T043 |
| 7 | Polish — column resize, dark/light theme, export, GitHub Pages | T044 |

**44 tasks total, driven by a single [Constitution](./CONSTITUTION.md) document** that encodes architectural decisions (e.g. "zero backend", "one production dependency", "200ms filter target").

### The Spec Artefacts

```
CONSTITUTION.md   — architectural principles that cannot be violated
SPEC.md           — functional requirements, data model, UI contract
PLAN.md           — phase-by-phase implementation strategy
specs/
  001-mf-knowledge-base/
    tasks.md      — 44 numbered tasks, each tied to a spec requirement
    data-model.md — IndexedDB schema with index definitions
    plan.md       — detailed implementation plan
```

Every implementation decision traces back to a spec requirement. Every deviation is a deliberate, documented trade-off.

---

## Technical Architecture

```
Browser
├── src/main.js               — boot, wires all modules
├── src/store/state.js        — single mutable state object
├── src/config/
│   ├── columns.js            — column definitions (label, format, width, getValue)
│   └── filters.js            — filter control definitions
├── src/db/
│   ├── schema.js             — IndexedDB schema (DB_NAME, upgrade fn)
│   └── db.js                 — typed CRUD helpers via idb
├── src/sync/
│   ├── worker.js             — Web Worker: handles QUICK_SYNC / FULL_SYNC messages
│   ├── amfi.js               — fetch + parse AMFI NAVAll.txt
│   ├── mfapi.js              — batch fetch NAV history, compute metrics
│   └── compute.js            — CAGR, Std Dev, Sharpe, Max Drawdown
└── src/ui/
    ├── toolbar/              — top bar: search, sync button, export, theme toggle
    ├── filters/              — sidebar filter panel + FilterEngine
    ├── table/                — virtual-scrolled fund table + sort
    └── detail/               — fund detail drawer, NAV chart, metric table
```

**Stack:**
- **Vite 5** — dev server + build (ES2022, tree-shaken, ~40 KB gzipped)
- **Vanilla JS** (ES modules, no framework)
- **[idb](https://github.com/jakearchibald/idb)** — the only production dependency; typed IndexedDB wrapper
- **IndexedDB** — stores `funds`, `nav_history`, `sync_meta`, `user_data`; `nav_history` has a compound key `[schemeCode, date]`
- **Web Worker** — sync runs off the main thread; main thread stays responsive during 30-minute Full Sync
- **GitHub Pages** — static hosting; `gh-pages` package deploys `dist/`

---

## Real Engineering Challenges Solved

### 1 — CORS
AMFI does not send CORS headers. In dev, Vite's proxy intercepts `/amfi-proxy` and forwards to `amfiindia.com` server-side. In production, a configurable proxy chain (allorigins.win → thingproxy → codetabs) is tried in order.

### 2 — Date format mismatch
MFAPI India returns NAV history as `DD-MM-YYYY` (numeric month). The initial implementation used a three-letter month map (`Jan`, `Feb`…), so every date returned `null`, `normalised` was always empty, and `putNavHistory` was never called — **zero records written despite 30 minutes of fetching**. Fixed by detecting numeric months with `parseInt` first, falling back to the abbreviation map.

### 3 — Virtual scroll at 2,500 rows
Rendering 2,500 DOM rows causes layout thrashing. The virtual table maintains a pool of ~30 row elements, absolutely positions them via `translateY`, and swaps in fund data as the user scrolls — constant DOM size regardless of dataset.

### 4 — Column width sync (header ↔ body)
Individual `width: var(--w-col)` per cell caused header/body misalignment because the sticky header and absolutely-positioned rows have different flex contexts. Fixed by switching to a single `--grid-cols` CSS custom property on the scroll container; both header and body rows use `display: grid; grid-template-columns: var(--grid-cols)`, so the browser layout engine guarantees alignment.

### 5 — Client-side CAGR and risk metrics
No API provides precomputed CAGR for arbitrary date windows. NAVigator fetches raw daily NAV history and computes:
- **CAGR** — `(NAV_end / NAV_start)^(1/years) - 1`
- **Std Dev (1Y)** — annualised standard deviation of daily log returns over 252 trading days
- **Sharpe (1Y)** — `(1Y return - 6.5% risk-free rate) / Std Dev 1Y`
- **Max Drawdown** — worst peak-to-trough decline over full history

All computed in a Web Worker, written to IndexedDB, and survive page reloads.

### 6 — AMFI file parsing
The NAVAll.txt file (~1.5 MB) has no formal schema. Section headers appear in two formats (`Open Ended Schemes(Equity Scheme - Large Cap Fund)` and `Open Ended Schemes - Equity Scheme - Large Cap Fund`). AMC name lines (`IL&FS Mutual Fund (IDF)`) were misidentified as section headers, causing 99% of funds to land in category "Other". Fixed with a regex guard requiring headers to start with `Open`, `Close`, or `Interval`.

---

## Data Sources

| Source | URL | Used for |
|---|---|---|
| AMFI NAVAll.txt | [amfiindia.com/spages/NAVAll.txt](https://www.amfiindia.com/spages/NAVAll.txt) | Fund list, latest NAV, category, sub-category |
| MFAPI India | [api.mfapi.in/mf/{schemeCode}](https://api.mfapi.in/mf/) | 5-year daily NAV history, fund metadata |

Both sources are free, public, and require no API key. MFAPI is an unofficial community API; NAVigator retries once on failure and degrades gracefully if a fund is unavailable.

---

## Limitations

| Limitation | Reason |
|---|---|
| AUM not available | Neither AMFI nor MFAPI exposes Assets Under Management in machine-readable form |
| Expense ratio not available | Same — not available from free public APIs |
| Full Sync takes 15–30 minutes | ~2,500 sequential HTTP requests to MFAPI (batched at 25 concurrent with 50ms gaps to avoid rate-limiting) |
| NAV history capped at 5 years | Trimmed to reduce IndexedDB storage from ~500 MB to ~80 MB |
| Direct+Growth only | IDCW/Dividend variants are filtered out; ~12,500 schemes excluded |

---

## License

[MIT](./LICENSE) — free to use, fork, and deploy.

---

## Built by

**Santhosh Ram V** — [github.com/sanoramv](https://github.com/sanoramv)
