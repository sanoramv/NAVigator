/**
 * Pure metric computation functions for fund NAV history.
 * All inputs are sorted ascending by date (YYYY-MM-DD).
 * Returns null for any metric where history is insufficient.
 */

/**
 * Binary search: find index of the last date string <= targetDate.
 * Returns -1 if all dates are after targetDate.
 *
 * @param {string[]} sortedDates - ascending YYYY-MM-DD date strings
 * @param {string}   targetDate  - YYYY-MM-DD
 * @returns {number}
 */
export function findClosestDate(sortedDates, targetDate) {
  let lo = 0, hi = sortedDates.length - 1, result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sortedDates[mid] <= targetDate) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return result;
}

/**
 * Compute simple and CAGR returns for standard lookback windows.
 *
 * @param {{ date: string, nav: number }[]} navHistory - ascending by date
 * @returns {{ '1w':number|null, '1m':number|null, '3m':number|null,
 *             '6m':number|null, '1y':number|null, '3y':number|null, '5y':number|null } | null}
 */
export function computeReturns(navHistory) {
  if (!navHistory || navHistory.length < 2) return null;

  const dates   = navHistory.map(h => h.date);
  const last    = navHistory.length - 1;
  const lastNav = navHistory[last].nav;
  const lastDate = dates[last];

  function _targetDate(daysBack) {
    const d = new Date(lastDate);
    d.setDate(d.getDate() - daysBack);
    return d.toISOString().slice(0, 10);
  }

  function _targetDateYears(years) {
    const d = new Date(lastDate);
    d.setFullYear(d.getFullYear() - years);
    return d.toISOString().slice(0, 10);
  }

  function _simpleReturn(daysBack) {
    const idx = findClosestDate(dates, _targetDate(daysBack));
    if (idx < 0) return null;
    return (lastNav / navHistory[idx].nav - 1) * 100;
  }

  function _cagr(years) {
    const idx = findClosestDate(dates, _targetDateYears(years));
    if (idx < 0) return null;
    return (Math.pow(lastNav / navHistory[idx].nav, 1 / years) - 1) * 100;
  }

  return {
    '1w': _simpleReturn(7),
    '1m': _simpleReturn(30),
    '3m': _simpleReturn(90),
    '6m': _simpleReturn(180),
    '1y': _simpleReturn(365),
    '3y': _cagr(3),
    '5y': _cagr(5),
  };
}

/**
 * Compute annualised risk metrics over the available history.
 *
 * @param {{ date: string, nav: number }[]} navHistory - ascending by date
 * @returns {{ stdDev1y: number|null, sharpe1y: number|null, maxDrawdown: number|null } | null}
 */
export function computeRisk(navHistory) {
  if (!navHistory || navHistory.length < 2) return null;

  const last    = navHistory.length - 1;
  const lastNav = navHistory[last].nav;
  const lastDate = navHistory[last].date;

  // ── Std Dev (1Y): last 252 trading-day data points ───────────────────────
  // Need 253 points to produce 252 log returns
  const window1y    = navHistory.slice(Math.max(0, last - 252));
  const logReturns  = [];
  for (let i = 1; i < window1y.length; i++) {
    const prev = window1y[i - 1].nav;
    const curr = window1y[i].nav;
    if (prev > 0 && curr > 0) logReturns.push(Math.log(curr / prev));
  }

  let stdDev1y = null;
  if (logReturns.length >= 2) {
    const mean     = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
    const variance = logReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (logReturns.length - 1);
    stdDev1y = Math.sqrt(variance) * Math.sqrt(252) * 100;
  }

  // ── Return 1Y (for Sharpe) ────────────────────────────────────────────────
  const target1y = new Date(lastDate);
  target1y.setFullYear(target1y.getFullYear() - 1);
  const target1yStr = target1y.toISOString().slice(0, 10);
  const dates       = navHistory.map(h => h.date);
  const idx1y       = findClosestDate(dates, target1yStr);
  const return1y    = idx1y >= 0 ? (lastNav / navHistory[idx1y].nav - 1) * 100 : null;

  const sharpe1y = (stdDev1y !== null && return1y !== null && stdDev1y !== 0)
    ? (return1y - 6.5) / stdDev1y
    : null;

  // ── Max Drawdown: full history ────────────────────────────────────────────
  let maxNav     = navHistory[0].nav;
  let maxDrawdown = null;
  for (const { nav } of navHistory) {
    maxNav = Math.max(maxNav, nav);
    const dd = (nav / maxNav - 1) * 100;
    if (maxDrawdown === null || dd < maxDrawdown) maxDrawdown = dd;
  }

  return {
    stdDev1y:    stdDev1y    !== null ? parseFloat(stdDev1y.toFixed(4))    : null,
    sharpe1y:    sharpe1y    !== null ? parseFloat(sharpe1y.toFixed(4))    : null,
    maxDrawdown: maxDrawdown !== null ? parseFloat(maxDrawdown.toFixed(4)) : null,
  };
}
