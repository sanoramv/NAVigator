/**
 * Pure filter function — no DOM access, no side effects.
 *
 * Checks are applied cheapest-first so common, narrow filters short-circuit
 * early before the costlier substring and range checks run.
 *
 * @param {Object[]} funds   - state.allFunds (may be empty)
 * @param {Object}   filters - state.filters snapshot
 * @returns {Object[]} new array — never mutates the input
 */
export function applyFilters(funds, filters) {
  return funds.filter(fund => {
    // 1. starredOnly — O(1) boolean check
    if (filters.starredOnly && !fund.starred) return false;

    // 2. category — array includes (typically small set)
    if (filters.category.length > 0 && !filters.category.includes(fund.category)) return false;

    // 3. subCategory
    if (filters.subCategory.length > 0 && !filters.subCategory.includes(fund.subCategory)) return false;

    // 4. amcName
    if (filters.amcName.length > 0 && !filters.amcName.includes(fund.amcName)) return false;

    // 5. search — substring on schemeName, amcName, and schemeCode
    //    SearchBox delivers the query already trimmed and lowercased.
    if (filters.search) {
      const q    = filters.search;
      const name = (fund.schemeName ?? '').toLowerCase();
      const amc  = (fund.amcName   ?? '').toLowerCase();
      const code = String(fund.schemeCode);
      if (!name.includes(q) && !amc.includes(q) && !code.includes(q)) return false;
    }

    // Helper: range check. Returns false if the value is null (not yet synced)
    // or falls outside [min, max] when either bound is active.
    function inRange(v, min, max) {
      if (min == null && max == null) return true;
      if (v == null) return false;
      if (min != null && v < min) return false;
      if (max != null && v > max) return false;
      return true;
    }

    // 6. 1Y return range
    if (!inRange(fund.returns?.['1y'] ?? null, filters.return1yMin, filters.return1yMax)) return false;

    // 7. 3Y CAGR range
    if (!inRange(fund.returns?.['3y'] ?? null, filters.return3yMin, filters.return3yMax)) return false;

    // 8. 5Y CAGR range
    if (!inRange(fund.returns?.['5y'] ?? null, filters.return5yMin, filters.return5yMax)) return false;

    // 9. Std Dev 1Y range
    if (!inRange(fund.risk?.stdDev1y    ?? null, filters.stdDev1yMin,    filters.stdDev1yMax))    return false;

    // 10. Sharpe 1Y range
    if (!inRange(fund.risk?.sharpe1y    ?? null, filters.sharpe1yMin,    filters.sharpe1yMax))    return false;

    // 11. Max Drawdown range
    if (!inRange(fund.risk?.maxDrawdown ?? null, filters.maxDrawdownMin, filters.maxDrawdownMax)) return false;

    return true;
  });
}
