export const state = {
  allFunds:  [],
  filtered:  [],

  filters: {
    search:         '',
    category:       [],   // string[] — selected asset classes; empty = all
    subCategory:    [],
    amcName:        [],
    return1yMin:    null,
    return1yMax:    null,
    return3yMin:    null,
    return3yMax:    null,
    return5yMin:    null,
    return5yMax:    null,
    stdDev1yMin:    null,
    stdDev1yMax:    null,
    sharpe1yMin:    null,
    sharpe1yMax:    null,
    maxDrawdownMin: null,
    maxDrawdownMax: null,
    starredOnly:    false,
  },

  sort: {
    column:    'schemeName',
    direction: 'asc',
  },

  selectedSchemeCode: null,
  columnVisibility:   {},

  syncStatus: {
    quickSync: null,
    fullSync:  null,
  },
};

export function setFilters(patch) {
  Object.assign(state.filters, patch);
}

export function setSort(column, direction) {
  state.sort.column    = column;
  state.sort.direction = direction;
}

export function setColumnVisibility(patch) {
  Object.assign(state.columnVisibility, patch);
}
