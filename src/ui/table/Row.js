import { COLUMNS } from '../../config/columns.js';

export const ROW_HEIGHT = 48;

// Return columns — green/red colouring applied via CSS class
const RETURN_KEYS = new Set([
  'return1w', 'return1m', 'return3m', 'return6m',
  'return1y', 'return3y', 'return5y', 'maxDrawdown',
]);

/**
 * Create a blank row element with the correct child structure.
 * Callers must append the returned element to the scroll container.
 */
export function createRow() {
  const row = document.createElement('div');
  row.className = 'fund-row';
  row.setAttribute('role', 'row');

  // Star column — always first, not driven by COLUMNS
  const star = document.createElement('span');
  star.className = 'fund-row__star';
  star.style.width = '36px';
  star.style.textAlign = 'center';
  star.setAttribute('aria-label', 'Starred');
  row.appendChild(star);

  // One span per COLUMNS entry (visibility toggled in updateRow)
  for (const col of COLUMNS) {
    const cell = document.createElement('span');
    cell.dataset.col = col.key;
    cell.style.width = col.width;
    row.appendChild(cell);
  }

  return row;
}

/**
 * Update an existing row element to display a specific fund.
 *
 * @param {HTMLElement} rowEl           - element returned by createRow()
 * @param {Object}      fund            - fund record from state.filtered
 * @param {number}      index           - absolute index in state.filtered (for positioning)
 * @param {Object}      columnVisibility - state.columnVisibility map
 */
export function updateRow(rowEl, fund, index, columnVisibility) {
  rowEl.style.transform = `translateY(${index * ROW_HEIGHT}px)`;
  rowEl.dataset.idx     = index;

  // Star
  const starEl = rowEl.querySelector('.fund-row__star');
  starEl.textContent    = fund.starred ? '★' : '☆';
  starEl.style.color    = fund.starred ? 'var(--accent)' : 'var(--text-muted)';

  // Data columns
  for (const col of COLUMNS) {
    const cell = rowEl.querySelector(`[data-col="${col.key}"]`);
    if (!cell) continue;

    const visible = columnVisibility[col.key] !== false;
    cell.style.display = visible ? '' : 'none';

    if (!visible) continue;

    const raw  = col.getValue ? col.getValue(fund) : (fund[col.key] ?? null);
    const text = col.format(raw);
    cell.textContent = text;

    // Apply colour class for return/drawdown columns
    if (RETURN_KEYS.has(col.key)) {
      cell.classList.remove('return--positive', 'return--negative');
      if (raw != null) {
        cell.classList.add(raw >= 0 ? 'return--positive' : 'return--negative');
      }
    }
  }
}
