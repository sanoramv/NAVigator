import { state }                  from '../../store/state.js';
import { COLUMNS }                from '../../config/columns.js';
import { setSort }                from './sort.js';
import { createRow, updateRow, ROW_HEIGHT } from './Row.js';

/**
 * Virtual-scrolled table — only renders the rows visible in the viewport.
 *
 * @param {Object}  opts
 * @param {Element} opts.container - element to render into (typically #table-area)
 * @returns {{ refresh(): void, scrollToTop(): void, getViewportRowCount(): number,
 *             get onFundClick(): Function|null, set onFundClick(fn): void }}
 */
export function VirtualTable({ container }) {
  // ── DOM structure ────────────────────────────────────────────────────────
  const scroller = document.createElement('div');
  scroller.className = 'virtual-table';

  const header = document.createElement('div');
  header.className = 'virtual-table__header';
  header.setAttribute('role', 'rowgroup');

  // Invisible div whose height equals total content height — gives the
  // scrollbar the correct proportions without rendering all rows.
  const spacer = document.createElement('div');
  spacer.className = 'virtual-table__spacer';

  scroller.appendChild(header);
  scroller.appendChild(spacer);
  container.appendChild(scroller);

  // ── Row pool ──────────────────────────────────────────────────────────────
  const _pool = [];   // reusable row elements
  let _onFundClick = null;

  function _ensurePool(needed) {
    while (_pool.length < needed) {
      const row = createRow();
      scroller.appendChild(row);
      _pool.push(row);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function _render() {
    const { filtered, columnVisibility } = state;
    const scrollTop    = scroller.scrollTop;
    const headerH      = header.offsetHeight;
    const viewportH    = scroller.clientHeight - headerH;
    const visibleCount = Math.ceil(viewportH / ROW_HEIGHT) + 1;
    const poolSize     = visibleCount + 10;

    // Size the spacer so the scrollbar is correct
    spacer.style.height = (filtered.length * ROW_HEIGHT) + 'px';

    _ensurePool(poolSize);

    const firstIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT));

    for (let i = 0; i < _pool.length; i++) {
      const fundIdx = firstIdx + i;
      const row     = _pool[i];

      if (i >= poolSize || fundIdx >= filtered.length) {
        row.style.display = 'none';
      } else {
        row.style.display = '';
        updateRow(row, filtered[fundIdx], fundIdx, columnVisibility);
      }
    }
  }

  // ── Header ────────────────────────────────────────────────────────────────
  function _buildHeader() {
    header.innerHTML = '';

    // Star column header
    const starH = document.createElement('span');
    starH.textContent  = '★';
    starH.style.width  = '36px';
    starH.style.textAlign = 'center';
    header.appendChild(starH);

    for (const col of COLUMNS) {
      if (state.columnVisibility[col.key] === false) continue;

      const cell = document.createElement('span');
      cell.textContent = col.label;
      cell.style.width = col.width;

      if (col.sortable) {
        cell.setAttribute('data-sortable', 'true');
        cell.setAttribute('tabindex', '0');
        cell.setAttribute('role', 'columnheader');
        cell.setAttribute('aria-sort', _ariaSortValue(col.key));
        cell.style.cursor = 'pointer';

        const _click = () => setSort(col.key);
        cell.addEventListener('click', _click);
        cell.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); _click(); }
        });
      }

      header.appendChild(cell);
    }
  }

  function _ariaSortValue(key) {
    if (state.sort.column !== key) return 'none';
    return state.sort.direction === 'asc' ? 'ascending' : 'descending';
  }

  // ── Events ────────────────────────────────────────────────────────────────
  scroller.addEventListener('scroll', _render, { passive: true });

  scroller.addEventListener('click', e => {
    if (!_onFundClick) return;
    const row = e.target.closest('.fund-row');
    if (!row) return;
    const idx = parseInt(row.dataset.idx, 10);
    if (!isNaN(idx) && idx < state.filtered.length) {
      _onFundClick(state.filtered[idx]);
    }
  });

  // ── Empty-state messages ───────────────────────────────────────────────────
  let _emptyEl = null;

  function _updateEmptyState() {
    if (_emptyEl) { _emptyEl.remove(); _emptyEl = null; }

    if (state.allFunds.length === 0) {
      _emptyEl = _makeEmpty(
        '₹', 'No fund data yet',
        'Click Quick Sync in the toolbar to download ~2,500 Direct+Growth funds.'
      );
      container.appendChild(_emptyEl);
    } else if (state.filtered.length === 0) {
      _emptyEl = _makeEmpty(
        '🔍', 'No funds match your filters',
        null,
        /* clearButton */ true
      );
      container.appendChild(_emptyEl);
    }
  }

  function _makeEmpty(icon, heading, body, withClear = false) {
    const el = document.createElement('div');
    el.className = 'empty-state';
    el.innerHTML = `
      <div class="empty-state__icon" aria-hidden="true">${icon}</div>
      <h2 class="empty-state__heading">${heading}</h2>
      ${body ? `<p class="empty-state__body">${body}</p>` : ''}
    `;
    if (withClear) {
      const btn = document.createElement('button');
      btn.textContent = 'Clear all filters';
      btn.className   = 'toolbar__btn';
      btn.onclick     = () => {
        // Imported lazily to avoid circular dep; FilterPanel exposes resetAll globally
        window.__mutualLensResetFilters?.();
      };
      el.appendChild(btn);
    }
    return el;
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    get onFundClick()   { return _onFundClick; },
    set onFundClick(fn) { _onFundClick = fn; },

    refresh() {
      _buildHeader();
      _updateEmptyState();
      if (state.filtered.length > 0) {
        scroller.style.display = '';
        _render();
      } else {
        // Hide the scroller (empty-state card shows instead)
        _pool.forEach(r => (r.style.display = 'none'));
      }
    },

    scrollToTop() {
      scroller.scrollTop = 0;
    },

    getViewportRowCount() {
      return Math.ceil(scroller.clientHeight / ROW_HEIGHT);
    },
  };
}
