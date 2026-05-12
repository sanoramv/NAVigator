import { state, setSort as setStateSort } from '../../store/state.js';
import { COLUMNS }                         from '../../config/columns.js';

// Late-bound refresh callback set by main.js to avoid circular imports.
let _refresh = () => {};
export function setRefreshFn(fn) { _refresh = fn; }

// ── Comparators ───────────────────────────────────────────────────────────────
// One entry per column key. Each returns a signed number like Array.sort expects.
// Nulls always sort last regardless of direction (direction inversion is applied
// by applySortToFiltered, not here).

function nullLast(a, b, compareFn) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return compareFn(a, b);
}

function numCmp(a, b)  { return nullLast(a, b, (x, y) => x - y); }
function strCmp(a, b)  { return nullLast(a, b, (x, y) => x.localeCompare(y, 'en', { sensitivity: 'base' })); }

// Build the comparators map from COLUMNS so there is one source of truth.
export const COMPARATORS = Object.fromEntries(
  COLUMNS.map(col => [
    col.key,
    (a, b) => {
      const av = col.getValue ? col.getValue(a) : (a[col.key] ?? null);
      const bv = col.getValue ? col.getValue(b) : (b[col.key] ?? null);
      // Strings use locale compare; numbers and everything else use numeric compare.
      return typeof av === 'string' || typeof bv === 'string'
        ? strCmp(av, bv)
        : numCmp(av, bv);
    },
  ])
);

// ── Sort application ──────────────────────────────────────────────────────────

/** Mutates state.filtered in place according to state.sort. */
export function applySortToFiltered() {
  const { column, direction } = state.sort;
  const cmp = COMPARATORS[column];
  if (!cmp) return;
  const sign = direction === 'asc' ? 1 : -1;
  state.filtered.sort((a, b) => sign * cmp(a, b));
}

/**
 * Toggle sort direction if same column, else sort new column ascending.
 * Calls applySortToFiltered() then the registered refresh function.
 */
export function setSort(columnKey) {
  if (state.sort.column === columnKey) {
    setStateSort(columnKey, state.sort.direction === 'asc' ? 'desc' : 'asc');
  } else {
    setStateSort(columnKey, 'asc');
  }
  applySortToFiltered();
  _refresh();
}
