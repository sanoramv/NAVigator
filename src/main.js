import './style.css';

import { openDB, getFunds, getSyncMeta, getAllUserData } from './db/db.js';
import { state, setColumnVisibility }                   from './store/state.js';
import { COLUMNS }                                       from './config/columns.js';
import { initTheme }                                     from './ui/theme.js';
import { applyFilters }                                  from './ui/filters/FilterEngine.js';
import { applySortToFiltered, setRefreshFn }             from './ui/table/sort.js';
import { Toolbar }                                       from './ui/toolbar/Toolbar.js';
import { FilterPanel }                                   from './ui/filters/FilterPanel.js';
import { VirtualTable }                                  from './ui/table/VirtualTable.js';
import { DetailDrawer }                                  from './ui/detail/DetailDrawer.js';

async function boot() {
  // 1. Apply theme before first paint (avoids flash of wrong theme)
  initTheme();

  // 2. Open (or upgrade) the IndexedDB database
  await openDB();

  // 3. Load column visibility; fall back to per-column defaults
  const savedVis = await getSyncMeta('column_visibility');
  if (savedVis?.value) {
    setColumnVisibility(savedVis.value);
  } else {
    setColumnVisibility(Object.fromEntries(COLUMNS.map(c => [c.key, c.defaultVisible])));
  }

  // 4. Load all funds from the DB
  state.allFunds = await getFunds();

  // 5. Merge starred / notes from user_data into fund objects in-place
  const allUserData = await getAllUserData();
  const userMap     = new Map(allUserData.map(u => [u.schemeCode, u]));
  for (const fund of state.allFunds) {
    const u      = userMap.get(fund.schemeCode);
    fund.starred = u?.starred ?? false;
    fund.notes   = u?.notes   ?? '';
  }

  // 6. Initial filter + sort pass (all filters inactive → filtered = allFunds sorted by name)
  state.filtered = applyFilters(state.allFunds, state.filters);
  applySortToFiltered();

  // 7. Mount UI components
  const detailDrawer = DetailDrawer({
    container: document.getElementById('detail-drawer'),
  });

  const virtualTable = VirtualTable({
    container: document.getElementById('table-area'),
  });

  // Central apply-and-refresh — shared by Toolbar search and FilterPanel controls.
  // Measures filter latency and warns if it exceeds the 200ms constitution target.
  function applyAndRefresh() {
    const t0           = performance.now();
    state.filtered     = applyFilters(state.allFunds, state.filters);
    const filterMs     = performance.now() - t0;
    applySortToFiltered();
    virtualTable.refresh();
    toolbar.updateResultCount(state.filtered.length);
    if (filterMs > 200) {
      console.warn(`[MutualLens] Filter took ${filterMs.toFixed(1)}ms — exceeds 200ms target`);
    }
  }

  // Give sort.js a handle to refresh the table (avoids a circular import)
  setRefreshFn(() => {
    virtualTable.refresh();
    toolbar.updateResultCount(state.filtered.length);
  });

  const toolbar = Toolbar({
    container:            document.getElementById('toolbar'),
    onFiltersChange:      applyAndRefresh,
    onSyncClick:          () => {},      // wired in Phase 4
    onExportCSV:          () => {},
    onExportJSON:         () => {},
    onColumnPickerToggle: () => {},
  });

  const filterPanel = FilterPanel({
    container:       document.getElementById('filter-panel'),
    onFiltersChange: applyAndRefresh,
  });

  // Expose reset to VirtualTable's "Clear all filters" button without circular import
  window.__mutualLensResetFilters = () => {
    filterPanel.resetAll();
    toolbar.resetSearch?.();
  };

  virtualTable.onFundClick = fund => detailDrawer.open(fund);

  // 8. Initial render
  virtualTable.refresh();
  toolbar.updateResultCount(state.filtered.length);

  // Repopulate dynamic MultiCheck options now that funds are loaded
  filterPanel.repopulateDynamic();
}

document.addEventListener('DOMContentLoaded', boot);
