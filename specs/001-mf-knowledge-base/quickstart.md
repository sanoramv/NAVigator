# Quickstart: MutualLens

A local-first Indian mutual fund knowledge base. Runs entirely in your browser.
No server. No login. No cost.

---

## Prerequisites

- **Node.js** 18 or newer ([nodejs.org](https://nodejs.org))
- **npm** (comes with Node.js)
- A modern browser: Chrome, Firefox, Safari, or Edge (2022 or newer)
- Internet connection for the first sync (offline after that)

---

## 1. Clone and Start (< 60 seconds)

```bash
git clone https://github.com/<your-username>/mutual-lens.git
cd mutual-lens
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 2. Get Your Fund Data

You'll see an empty table on first load. Click one of the Sync buttons in the toolbar:

| Button | What it does | Time |
|--------|-------------|------|
| **Quick Sync** | Downloads current NAV for all ~2,500 Direct+Growth schemes | ~10 seconds |
| **Full Sync** | Also downloads 5 years of daily NAV history (needed for return/risk metrics) | 10–30 minutes |

**Start with Quick Sync** to get the fund list and browse immediately.
Run **Full Sync** when you want 1Y/3Y/5Y returns and risk metrics (Sharpe, drawdown).

Full Sync can be **paused and resumed** — if you close the browser, it picks up where it left off.

---

## 3. Using the App

### Browse and Filter
- **Filter panel** (left sidebar): narrow by category, sub-category, fund house, return range, risk metrics
- **Search bar** (toolbar): type any part of a fund name or scheme code
- **Column headers**: click to sort ascending/descending
- **Column picker** (⚙ icon in toolbar): show or hide any column

### Fund Detail
Click any row to open the fund detail panel on the right:
- NAV history chart (toggle 1Y / 3Y / 5Y)
- Full returns table with formulas
- Risk metrics with formula explanations
- Notes field (auto-saved, persists offline)
- ★ Star to add to your shortlist

### Export
- **Export CSV** — exports the currently filtered fund list (opens in Excel/Sheets)
- **Export JSON** — exports the same data as structured JSON

---

## 4. Deploy to GitHub Pages

**One-time setup**: Set the `VITE_BASE_PATH` env var to match your GitHub repo name, or edit the fallback directly in `vite.config.js`:

```bash
# Option A — env var (no file edit needed)
VITE_BASE_PATH=/my-repo-name/ npm run deploy

# Option B — edit the fallback in vite.config.js
# Change '/mutual-lens/' to '/<your-repo-name>/'
```

Then deploy:

```bash
npm run deploy
```

Your site will be live at: `https://<your-username>.github.io/<repo-name>/`

---

## 5. Customise Columns and Filters

The following files are designed to be edited without touching application logic:

- **`src/config/columns.js`** — add, remove, or reorder table columns; change labels and number formats
- **`src/config/filters.js`** — add custom filters, change default ranges, hide filters you don't use

Both files are richly commented with examples.

---

## 6. Data Sources

| Source | What it provides | URL |
|--------|----------------|-----|
| AMFI India | Current NAV, scheme names, categories | `https://www.amfiindia.com/spages/NAVAll.txt` |
| MFAPI India | 5-year NAV history, accurate fund house name | `https://api.mfapi.in/mf` |

Both sources are free and require no authentication. If either is unreachable,
the app will show a warning and continue working with locally stored data.

---

## 7. Limitations (v1)

- **AUM and expense ratio**: Not available from the free APIs used. These fields show N/A.
- **Fund house filter**: Shows approximate values after Quick Sync; accurate after Full Sync.
- **Regular plans and IDCW options**: Not stored — only Direct+Growth schemes are indexed.
- **Portfolio tracking**: Not supported (by design — see CONSTITUTION.md).
