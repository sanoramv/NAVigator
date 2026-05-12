/**
 * Returns and risk metric tables for the fund detail drawer.
 * Each metric label has an <abbr title="formula"> tooltip from data-model.md.
 */

const RETURN_ROWS = [
  { key: '1w', label: '1 Week',   formula: '(NAVₙ / NAVₙ₋₇ − 1) × 100' },
  { key: '1m', label: '1 Month',  formula: '(NAVₙ / NAVₙ₋₃₀ − 1) × 100' },
  { key: '3m', label: '3 Months', formula: '(NAVₙ / NAVₙ₋₉₀ − 1) × 100' },
  { key: '6m', label: '6 Months', formula: '(NAVₙ / NAVₙ₋₁₈₀ − 1) × 100' },
  { key: '1y', label: '1 Year',   formula: '(NAVₙ / NAVₙ₋₃₆₅ − 1) × 100' },
  { key: '3y', label: '3 Year (CAGR)', formula: '((NAVₙ / NAVₙ₋₃Y)^(1/3) − 1) × 100' },
  { key: '5y', label: '5 Year (CAGR)', formula: '((NAVₙ / NAVₙ₋₅Y)^(1/5) − 1) × 100' },
];

const RISK_ROWS = [
  {
    key:     'stdDev1y',
    label:   'Std Dev (1Y)',
    formula: 'stdDev(ln(NAVᵢ/NAVᵢ₋₁)) × √252 × 100 — last 252 trading days',
    unit:    '%',
  },
  {
    key:     'sharpe1y',
    label:   'Sharpe Ratio (1Y)',
    formula: '(Return₁Y − 6.5%) / StdDev₁Y — risk-free rate 6.5% p.a.',
    unit:    '',
  },
  {
    key:     'maxDrawdown',
    label:   'Max Drawdown',
    formula: 'min(NAVᵢ / max(NAV₀…ᵢ) − 1) × 100 — full history',
    unit:    '%',
  },
];

const NULL_TEXT = 'N/A — Full Sync required';

function _pct(v) {
  if (v == null) return NULL_TEXT;
  const sign = v >= 0 ? '+' : '';
  return sign + v.toFixed(2) + '%';
}

function _pctClass(v) {
  if (v == null) return 'metric--null';
  return v >= 0 ? 'metric--pos' : 'metric--neg';
}

function _abbr(text, formula) {
  const el = document.createElement('abbr');
  el.textContent = text;
  el.title = formula;
  el.style.textDecoration = 'dotted underline';
  el.style.cursor = 'help';
  return el;
}

function _makeTable(rows, getVal, getClass) {
  const table = document.createElement('table');
  table.className = 'metric-table';
  for (const row of rows) {
    const tr  = document.createElement('tr');
    const th  = document.createElement('th');
    const td  = document.createElement('td');
    th.appendChild(_abbr(row.label, row.formula));
    const val = getVal(row);
    td.textContent = val;
    td.className   = getClass(row, val);
    tr.appendChild(th);
    tr.appendChild(td);
    table.appendChild(tr);
  }
  return table;
}

/**
 * @param {Object}  opts
 * @param {Element} opts.container - element to render tables into
 * @returns {{ render(fund: Object): void }}
 */
export function MetricTable({ container }) {
  container.innerHTML = '';

  const returnSection = document.createElement('div');
  const riskSection   = document.createElement('div');
  returnSection.className = 'metric-section';
  riskSection.className   = 'metric-section';
  container.appendChild(returnSection);
  container.appendChild(riskSection);

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    /**
     * Render both tables for the given fund object.
     * @param {{ returns?: Object, risk?: Object }} fund
     */
    render(fund) {
      returnSection.innerHTML = '';
      riskSection.innerHTML   = '';

      // Section headings
      const retH = document.createElement('h4');
      retH.className   = 'metric-section__title';
      retH.textContent = 'Returns';
      returnSection.appendChild(retH);

      returnSection.appendChild(
        _makeTable(
          RETURN_ROWS,
          row => {
            const v = fund?.returns?.[row.key] ?? null;
            return v == null ? NULL_TEXT : _pct(v);
          },
          (row, val) => {
            const v = fund?.returns?.[row.key] ?? null;
            return _pctClass(v);
          },
        )
      );

      const riskH = document.createElement('h4');
      riskH.className   = 'metric-section__title';
      riskH.textContent = 'Risk';
      riskSection.appendChild(riskH);

      riskSection.appendChild(
        _makeTable(
          RISK_ROWS,
          row => {
            const v = fund?.risk?.[row.key] ?? null;
            if (v == null) return NULL_TEXT;
            if (row.unit === '%') return _pct(v);
            return v.toFixed(2);
          },
          (row, val) => {
            if (val === NULL_TEXT) return 'metric--null';
            const v = fund?.risk?.[row.key] ?? null;
            if (row.key === 'maxDrawdown') return v != null ? 'metric--neg' : 'metric--null';
            if (row.key === 'sharpe1y')    return v != null && v >= 1 ? 'metric--pos' : '';
            return '';
          },
        )
      );
    },
  };
}
