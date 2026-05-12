# CONSTITUTION
## MutualLens — Indian Mutual Fund Knowledge Base

> *"The investor's job is not to predict the market, but to understand what they own."*

---

## 1. Purpose & Mission

MutualLens exists to solve a single, concrete problem: **an individual investor in India owns too many mutual fund schemes and cannot clearly evaluate, compare, or rationalise them.**

This tool is a **local-first, offline-capable, single-page knowledge base** that pulls live data from public APIs and presents it in a way that empowers confident decision-making — not paralysis.

---

## 2. Core Principles

### 2.1 Investor-First, Always
Every feature, filter, column, and label must answer the question *"does this help the investor make a better decision?"*. If a data point does not serve that purpose, it does not belong in the UI.

### 2.2 Local-First
- The site runs entirely in a browser — no server, no database, no login.
- All synced data is stored on the user's own machine (IndexedDB).
- The user controls when data is fetched and updated.
- Works offline once data has been downloaded.

### 2.3 Zero Lock-in
- Fully open-source (MIT License).
- All data comes from free, public APIs — no vendor dependency.
- Users can export their data and filters as JSON at any time.

### 2.4 Simple to Distribute
- Anyone can `git clone`, run one command (`npm install && npm run dev`), and be productive within 60 seconds.
- GitHub Pages deployment must work out of the box with a single command (`npm run deploy`).
- No environment variables, no API keys, no accounts required.

### 2.5 Honest About Data
- Data freshness is always displayed (last sync timestamp per source).
- Calculations (e.g., rolling returns, Sharpe ratio) always show their formula and data window.
- Missing or incomplete data is labelled explicitly — never silently omitted.

### 2.6 Clarity Over Completeness
- It is better to show 10 well-labelled, useful columns than 50 confusing ones.
- Filters should be opinionated and meaningful — not an exhaustive field dump.
- The default view must be immediately useful with zero configuration.

### 2.7 Respectful of Performance
- Initial load (cold, no data) must complete in under 2 seconds on an average laptop.
- Filtering 5,000+ fund rows must respond in under 200 ms.
- Sync operations run in the background and never block the UI.

---

## 3. Scope Boundaries

### In Scope
- Browsing, filtering, sorting, and comparing Indian mutual fund schemes
- Syncing NAV, fund metadata, and category data from public APIs
- Displaying computed metrics (returns, risk ratios) from downloaded data
- Exporting filtered lists and personal notes as CSV / JSON
- Running fully on GitHub Pages (static hosting)

### Out of Scope (by constitution — do not add without amending this document)
- Portfolio tracking (units held, purchase price, P&L)
- Transaction history or brokerage integration
- Any form of user authentication or cloud sync
- Financial advice, recommendations, or buy/sell signals
- Payment, subscription, or premium features
- Mobile app (web-responsive is sufficient)

---

## 4. Data Sources

| Source | Purpose | URL |
|--------|---------|-----|
| MFAPI India | Fund list, NAV history | `https://api.mfapi.in/mf` |
| AMFI India | Official scheme master, AUM | `https://www.amfiindia.com/spages/NAVAll.txt` |

All sources must be free and require no authentication. If a source becomes unavailable, the site must degrade gracefully using cached data and display a clear warning.

---

## 5. Technology Philosophy

- **No magic frameworks** that require understanding to maintain. Prefer tools that a moderately experienced developer can read and understand without documentation.
- **Vanilla-first**: use a framework only when it genuinely reduces complexity, not for its own sake.
- **Progressive Enhancement**: the data table must be readable even before JS enhancements load.
- **Accessibility matters**: all filters and table interactions must be keyboard-navigable.

---

## 6. Community Standards

Because this project is designed to be cloned and used by others in a similar situation:

- Every file that can be modified by a user (filters config, columns config) must be **richly commented**.
- The `README.md` must include a screenshot, a 3-step quickstart, and a data dictionary.
- Breaking changes to the data schema must be versioned with a migration note.
- Issues and PRs are welcome; all contributors must follow the Code of Conduct.

---

## 7. Amendments

This constitution may be amended by opening a GitHub Discussion with the label `constitution-amendment`. Changes require documented reasoning and must not violate Principles 2.1–2.7.

---

*Version 1.0 — Initial ratification*
