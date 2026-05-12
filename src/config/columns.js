/**
 * COLUMN DEFINITIONS — NAVigator
 * ─────────────────────────────────────────────────────────────────────────────
 * Each object in this array defines one column in the fund table.
 *
 * FIELDS
 *   key            – property name on the fund object (drives sorting and data
 *                    access in Row.js via `fund[col.key]`)
 *   label          – plain-language header shown to the investor; no raw API names
 *   defaultVisible – true = shown in the default view; keep ≤ 15 true entries
 *                    (Constitution Principle VI: Clarity Over Completeness)
 *   sortable       – true = clicking the header sorts the table by this column
 *   format(value)  – converts the raw value to a display string;
 *                    receives `fund[col.key]` (may be null if not yet synced)
 *   width          – CSS column width (px string); used by Row.js and the header
 *   getValue(fund) – (optional) extracts the raw value from a fund object;
 *                    use when the value lives in a nested path (e.g. fund.returns['1y']).
 *                    Callers: `col.getValue ? col.getValue(fund) : fund[col.key]`
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HOW TO ADD A COLUMN
 *   1. Append an entry below with a unique `key`.
 *   2. Add the key to the defaultVisibility map in src/main.js (or it will be
 *      hidden until the user opens the column picker).
 *   3. Make sure the fund object (src/sync/amfi.js or src/sync/mfapi.js)
 *      sets the property — `null` is fine until Full Sync.
 *
 * HOW TO REMOVE A COLUMN
 *   Delete the entry. No other file needs to change.
 *
 * HOW TO REORDER COLUMNS
 *   Change the order of entries here. The table renders left-to-right in this
 *   order. Star (☆/★) is always first and is not in this array — it is
 *   special-cased in Row.js.
 *
 * HOW TO CHANGE A FORMAT
 *   Edit the `format` function inline. The `fmt` helpers below cover the common
 *   cases; write your own arrow function for anything exotic.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Shared formatting helpers. */
const fmt = {
  str:  v => v ?? '—',
  code: v => (v == null ? '—' : String(v)),
  date: v => v ?? 'N/A',
  nav:  v => (v == null ? 'N/A' : '₹' + v.toFixed(4)),
  // Percentage with mandatory +/- prefix. Green/red colouring is applied by Row.js
  // based on the sign of the raw value, not this string.
  pct:  v => (v == null ? 'N/A' : (v >= 0 ? '+' : '') + v.toFixed(2) + '%'),
  num:  v => (v == null ? 'N/A' : v.toFixed(2)),
};

export const COLUMNS = [
  {
    key:            'schemeCode',
    label:          'Code',
    defaultVisible: false,   // AMFI scheme code — useful for lookups, not default view
    sortable:       true,
    format:         fmt.code,
    width:          '120px',
  },
  {
    key:            'schemeName',
    label:          'Fund Name',
    defaultVisible: true,
    sortable:       true,
    format:         fmt.str,
    width:          '320px',
  },
  {
    key:            'amcName',
    label:          'AMC',
    defaultVisible: true,
    sortable:       true,
    format:         fmt.str,
    width:          '200px',
  },
  {
    key:            'category',
    label:          'Category',
    defaultVisible: true,
    sortable:       true,
    format:         fmt.str,
    width:          '120px',
  },
  {
    key:            'subCategory',
    label:          'Sub-Category',
    defaultVisible: true,
    sortable:       true,
    format:         fmt.str,
    width:          '120px',
  },
  {
    key:            'navCurrent',
    label:          'NAV',
    defaultVisible: true,
    sortable:       true,
    format:         fmt.nav,
    width:          '120px',
  },
  {
    key:            'navDate',
    label:          'NAV Date',
    defaultVisible: false,   // clutters the default view; available via column picker
    sortable:       true,
    format:         fmt.date,
    width:          '120px',
  },
  {
    // Short-term noise — useful for detecting sudden events; off by default
    key:            'return1w',
    label:          '1W Return',
    defaultVisible: false,
    sortable:       true,
    getValue:       f => f.returns?.['1w'] ?? null,
    format:         fmt.pct,
    width:          '120px',
  },
  {
    key:            'return1m',
    label:          '1M Return',
    defaultVisible: false,
    sortable:       true,
    getValue:       f => f.returns?.['1m'] ?? null,
    format:         fmt.pct,
    width:          '120px',
  },
  {
    key:            'return3m',
    label:          '3M Return',
    defaultVisible: false,
    sortable:       true,
    getValue:       f => f.returns?.['3m'] ?? null,
    format:         fmt.pct,
    width:          '120px',
  },
  {
    key:            'return6m',
    label:          '6M Return',
    defaultVisible: false,
    sortable:       true,
    getValue:       f => f.returns?.['6m'] ?? null,
    format:         fmt.pct,
    width:          '120px',
  },
  {
    key:            'return1y',
    label:          '1Y Return',
    defaultVisible: true,
    sortable:       true,
    getValue:       f => f.returns?.['1y'] ?? null,
    format:         fmt.pct,
    width:          '120px',
  },
  {
    // Compound Annual Growth Rate over 3 years — requires Full Sync
    key:            'return3y',
    label:          '3Y CAGR',
    defaultVisible: true,
    sortable:       true,
    getValue:       f => f.returns?.['3y'] ?? null,
    format:         fmt.pct,
    width:          '120px',
  },
  {
    // Compound Annual Growth Rate over 5 years — requires Full Sync
    key:            'return5y',
    label:          '5Y CAGR',
    defaultVisible: true,
    sortable:       true,
    getValue:       f => f.returns?.['5y'] ?? null,
    format:         fmt.pct,
    width:          '120px',
  },
  {
    // Annualised std dev of daily log returns over 252 trading days.
    // Lower = more stable. Requires Full Sync.
    key:            'stdDev1y',
    label:          'Std Dev (1Y)',
    defaultVisible: false,
    sortable:       true,
    getValue:       f => f.risk?.stdDev1y ?? null,
    format:         fmt.pct,
    width:          '120px',
  },
  {
    // Sharpe = (1Y return − 6.5% risk-free rate) / Std Dev 1Y.
    // Higher = better risk-adjusted return. Requires Full Sync.
    key:            'sharpe1y',
    label:          'Sharpe (1Y)',
    defaultVisible: false,
    sortable:       true,
    getValue:       f => f.risk?.sharpe1y ?? null,
    format:         fmt.num,
    width:          '120px',
  },
  {
    // Worst peak-to-trough decline over full available history.
    // Always negative (e.g. −18.2 means fell 18.2% from its peak).
    // Requires Full Sync.
    key:            'maxDrawdown',
    label:          'Max Drawdown',
    defaultVisible: false,
    sortable:       true,
    getValue:       f => f.risk?.maxDrawdown ?? null,
    format:         fmt.pct,
    width:          '120px',
  },
];
