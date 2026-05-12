import { state, setFilters }  from '../../store/state.js';
import { COLUMNS }            from '../../config/columns.js';
import { toggleTheme }        from '../../ui/theme.js';
import { SearchBox }          from '../../ui/filters/controls/SearchBox.js';
import { putSyncMeta }        from '../../db/db.js';

/**
 * Application toolbar — renders the top bar with all global controls.
 *
 * @param {Object}   opts
 * @param {Element}  opts.container            - #toolbar element
 * @param {Function} opts.onSyncClick          - called when sync area is clicked (Phase 4 wires this)
 * @param {Function} opts.onExportCSV          - called by export CSV button
 * @param {Function} opts.onExportJSON         - called by export JSON button
 * @param {Function} opts.onColumnPickerToggle - called when column picker button is clicked
 * @param {Function} opts.onFiltersChange      - called after search changes (caller runs applyFilters + refresh)
 * @returns {{ updateResultCount(n): void, exportCSV(): void, exportJSON(): void }}
 */
export function Toolbar({
  container,
  onSyncClick,
  onExportCSV,
  onExportJSON,
  onColumnPickerToggle,
  onFiltersChange,
}) {
  // ── Brand ─────────────────────────────────────────────────────────────────
  const brand = document.createElement('span');
  brand.className   = 'toolbar__brand';
  brand.textContent = 'MutualLens';
  container.appendChild(brand);

  // ── Search input ──────────────────────────────────────────────────────────
  const searchInput = document.createElement('input');
  searchInput.type        = 'search';
  searchInput.placeholder = 'Search funds…';
  searchInput.className   = 'toolbar__search';
  searchInput.setAttribute('aria-label', 'Search funds by name, AMC, or code');
  container.appendChild(searchInput);

  const _searchBox = SearchBox({
    input:    searchInput,
    onchange: q => {
      setFilters({ search: q });
      onFiltersChange?.();
    },
  });

  // ── Sync area (placeholder — replaced by SyncButton in Phase 4) ───────────
  const syncArea = document.createElement('div');
  syncArea.id = 'sync-area';
  syncArea.style.cssText = 'display:flex;align-items:center;gap:4px;';
  const syncPlaceholder = document.createElement('button');
  syncPlaceholder.textContent = 'Quick Sync';
  syncPlaceholder.className   = 'toolbar__btn';
  syncPlaceholder.setAttribute('aria-label', 'Quick Sync — download latest NAV data');
  syncPlaceholder.addEventListener('click', () => onSyncClick?.());
  syncArea.appendChild(syncPlaceholder);
  container.appendChild(syncArea);

  // ── Spacer ────────────────────────────────────────────────────────────────
  const spacer = document.createElement('div');
  spacer.className = 'toolbar__spacer';
  container.appendChild(spacer);

  // ── Result count ──────────────────────────────────────────────────────────
  const resultCount = document.createElement('span');
  resultCount.id        = 'result-count';
  resultCount.className = 'toolbar__result-count';
  container.appendChild(resultCount);

  // ── Column picker button ──────────────────────────────────────────────────
  const colPickerBtn = document.createElement('button');
  colPickerBtn.textContent = '⚙';
  colPickerBtn.className   = 'toolbar__btn--icon';
  colPickerBtn.setAttribute('aria-label', 'Show / hide columns');
  colPickerBtn.setAttribute('aria-haspopup', 'true');
  colPickerBtn.setAttribute('aria-expanded', 'false');
  container.appendChild(colPickerBtn);

  // Column picker popover
  const colPicker = document.createElement('div');
  colPicker.className = 'col-picker';
  const pickerTitle = document.createElement('div');
  pickerTitle.className   = 'col-picker__title';
  pickerTitle.textContent = 'Columns';
  colPicker.appendChild(pickerTitle);

  COLUMNS.forEach(col => {
    const item = document.createElement('label');
    item.className = 'col-picker__item';
    const cb = document.createElement('input');
    cb.type    = 'checkbox';
    cb.checked = state.columnVisibility[col.key] !== false;
    cb.addEventListener('change', async () => {
      state.columnVisibility[col.key] = cb.checked;
      // Persist choice to IndexedDB so it survives reload
      await putSyncMeta({ key: 'column_visibility', value: { ...state.columnVisibility } });
      onFiltersChange?.(); // triggers VirtualTable.refresh() via caller
    });
    item.appendChild(cb);
    item.appendChild(document.createTextNode(' ' + col.label));
    colPicker.appendChild(item);
  });
  document.body.appendChild(colPicker);

  colPickerBtn.addEventListener('click', () => {
    colPicker.classList.toggle('open');
    colPickerBtn.setAttribute('aria-expanded', colPicker.classList.contains('open'));
    onColumnPickerToggle?.();
  });
  document.addEventListener('click', e => {
    if (!colPicker.contains(e.target) && e.target !== colPickerBtn) {
      colPicker.classList.remove('open');
      colPickerBtn.setAttribute('aria-expanded', 'false');
    }
  }, { capture: true });

  // ── Export buttons ────────────────────────────────────────────────────────
  const csvBtn = document.createElement('button');
  csvBtn.textContent = 'CSV';
  csvBtn.className   = 'toolbar__btn';
  csvBtn.setAttribute('aria-label', 'Export filtered funds as CSV');
  csvBtn.addEventListener('click', () => _exportCSV());
  container.appendChild(csvBtn);

  const jsonBtn = document.createElement('button');
  jsonBtn.textContent = 'JSON';
  jsonBtn.className   = 'toolbar__btn';
  jsonBtn.setAttribute('aria-label', 'Export filtered funds as JSON');
  jsonBtn.addEventListener('click', () => _exportJSON());
  container.appendChild(jsonBtn);

  // ── Theme toggle ──────────────────────────────────────────────────────────
  const themeBtn = document.createElement('button');
  themeBtn.textContent = '◑';
  themeBtn.className   = 'toolbar__btn--icon';
  themeBtn.setAttribute('aria-label', 'Toggle light / dark theme');
  themeBtn.addEventListener('click', () => toggleTheme());
  container.appendChild(themeBtn);

  // ── Export helpers ────────────────────────────────────────────────────────
  const _visibleCols = () =>
    COLUMNS.filter(c => state.columnVisibility[c.key] !== false);

  function _triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function _dateTag() {
    return new Date().toISOString().slice(0, 10);
  }

  function _exportCSV() {
    const cols = _visibleCols();
    const BOM  = '﻿'; // UTF-8 BOM for Excel compatibility
    const rows = [
      cols.map(c => `"${c.label}"`).join(','),
      ...state.filtered.map(fund =>
        cols.map(c => {
          const raw = c.getValue ? c.getValue(fund) : (fund[c.key] ?? null);
          const str = c.format(raw).replace(/"/g, '""');
          return `"${str}"`;
        }).join(',')
      ),
    ];
    const csv  = BOM + rows.join('\r\n');
    _triggerDownload(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
      `mutual-lens-${_dateTag()}.csv`
    );
    onExportCSV?.();
  }

  function _exportJSON() {
    const cols = _visibleCols();
    const data = state.filtered.map(fund =>
      Object.fromEntries(
        cols.map(c => {
          const raw = c.getValue ? c.getValue(fund) : (fund[c.key] ?? null);
          return [c.key, raw];
        })
      )
    );
    _triggerDownload(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      `mutual-lens-${_dateTag()}.json`
    );
    onExportJSON?.();
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    updateResultCount(n) {
      resultCount.textContent = `${n.toLocaleString()} fund${n === 1 ? '' : 's'}`;
    },
    exportCSV:  _exportCSV,
    exportJSON: _exportJSON,
    /** Expose the search reset so FilterPanel's "Reset All" can clear the search input too. */
    resetSearch: () => _searchBox.reset(),
  };
}
