/**
 * FILTER DEFINITIONS — NAVigator
 * ─────────────────────────────────────────────────────────────────────────────
 * Each object in this array defines one filter control in the sidebar panel.
 * FilterPanel (src/ui/filters/FilterPanel.js) reads this array at startup and
 * builds the controls dynamically — you never need to touch FilterPanel to
 * add, remove, or reorder filters.
 *
 * FIELDS
 *   key      – unique identifier (used as a React-less reconciliation key)
 *   label    – plain-language label shown above the control
 *   type     – control type:
 *                'toggle'     → single checkbox (e.g. "Starred Only")
 *                'multicheck' → list of checkboxes with Select-All toggle
 *                'range'      → dual-handle range slider
 *   stateKey – key in state.filters this control maps to:
 *                toggle/multicheck → direct key (e.g. 'starredOnly', 'category')
 *                range             → prefix; FilterPanel appends 'Min'/'Max'
 *                                   (e.g. 'return1y' → return1yMin + return1yMax)
 *   options  – (multicheck only) string[] of checkbox labels.
 *                Empty array [] means FilterPanel populates values dynamically
 *                from the unique values present in state.allFunds after sync.
 *   min, max, step – (range only) numeric bounds for the slider handles.
 *                    Choose bounds wider than the realistic data range so the
 *                    handles always start at the extremes (= filter inactive).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HOW TO ADD A FILTER
 *   1. Add an entry below with a unique `key`.
 *   2. Add the matching state key(s) to state.filters in src/store/state.js
 *      (e.g. for a range: fooMin: null, fooMax: null).
 *   3. Add the filter logic to FilterEngine in src/ui/filters/FilterEngine.js.
 *
 * HOW TO REMOVE A FILTER
 *   Delete the entry. The orphaned state key in state.js is harmless (just
 *   unused), but you can remove it there too for tidiness.
 *
 * INTENTIONAL OMISSIONS
 *   • Search box  — lives in the Toolbar, not the filter panel (always visible).
 *   • Plan Type   — every stored fund is already "Direct"; filter is redundant.
 *   • Option      — every stored fund is already "Growth"; filter is redundant.
 *   (Constitution Principle VI: Clarity Over Completeness)
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const FILTERS = [
  {
    // Show only funds the investor has personally starred (☆ → ★).
    // Useful for building a personal watchlist without exporting.
    key:      'starredOnly',
    label:    'Starred Only',
    type:     'toggle',
    stateKey: 'starredOnly',
  },
  {
    // Broad SEBI asset class. Static list — these are the only categories
    // AMFI uses in the NAVAll.txt section headers.
    key:      'category',
    label:    'Category',
    type:     'multicheck',
    stateKey: 'category',
    options:  ['Equity', 'Debt', 'Hybrid', 'Index/ETF', 'Solution-Oriented', 'Other'],
  },
  {
    // Granular SEBI sub-category (e.g. "Large Cap Fund", "Liquid Fund").
    // options: [] → FilterPanel populates from unique fund values after sync.
    // There are ~40 sub-categories; a static list would go stale as SEBI revises them.
    key:      'subCategory',
    label:    'Sub-Category',
    type:     'multicheck',
    stateKey: 'subCategory',
    options:  [],
  },
  {
    // Fund house / AMC. Hundreds of AMCs exist; dynamic population avoids
    // maintaining a list that changes as new AMCs register with SEBI.
    key:      'amcName',
    label:    'Fund House',
    type:     'multicheck',
    stateKey: 'amcName',
    options:  [],
  },
  {
    // 1-year absolute return. Available after Quick Sync.
    // Range: −50% to +100% covers virtually all historical Indian MF returns.
    key:      'return1y',
    label:    '1Y Return (%)',
    type:     'range',
    stateKey: 'return1y',
    min:      -50,
    max:      100,
    step:     0.5,
  },
  {
    // 3-year CAGR. Requires Full Sync. Funds < 3 years old return null → fail filter.
    key:      'return3y',
    label:    '3Y CAGR (%)',
    type:     'range',
    stateKey: 'return3y',
    min:      -30,
    max:      60,
    step:     0.5,
  },
  {
    // 5-year CAGR. Requires Full Sync. Funds < 5 years old return null → fail filter.
    key:      'return5y',
    label:    '5Y CAGR (%)',
    type:     'range',
    stateKey: 'return5y',
    min:      -20,
    max:      50,
    step:     0.5,
  },
  {
    // Annualised volatility — lower means steadier NAV. Requires Full Sync.
    // Typical range: equity ~10–30%, debt ~1–8%, liquid ~0–1%.
    key:      'stdDev1y',
    label:    'Std Dev 1Y (%)',
    type:     'range',
    stateKey: 'stdDev1y',
    min:      0,
    max:      50,
    step:     0.1,
  },
  {
    // Risk-adjusted return: (1Y return − 6.5% risk-free) / Std Dev.
    // Higher = more return per unit of volatility. Requires Full Sync.
    key:      'sharpe1y',
    label:    'Sharpe Ratio (1Y)',
    type:     'range',
    stateKey: 'sharpe1y',
    min:      -5,
    max:      5,
    step:     0.05,
  },
  {
    // Worst peak-to-trough decline over full available history. Always ≤ 0.
    // e.g. −18.2 means the fund fell 18.2% from its all-time high at worst.
    // Requires Full Sync.
    key:      'maxDrawdown',
    label:    'Max Drawdown (%)',
    type:     'range',
    stateKey: 'maxDrawdown',
    min:      -80,
    max:      0,
    step:     0.5,
  },
];
