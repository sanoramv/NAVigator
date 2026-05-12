import './style.css';

import { openDB, getFunds, getSyncMeta, getAllUserData } from './db/db.js';
import { state, setColumnVisibility }                   from './store/state.js';
import { COLUMNS }                                       from './config/columns.js';
import { initTheme }                                     from './ui/theme.js';
import { applyFilters }                                  from './ui/filters/FilterEngine.js';
import { applySortToFiltered, setRefreshFn }             from './ui/table/sort.js';
import { Toolbar }                                       from './ui/toolbar/Toolbar.js';
import { SyncButton }                                    from './ui/toolbar/SyncButton.js';
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

  // 7. Load sync metadata — resume state for Full Sync and freshness check for toolbar
  const fullSyncProgress = await getSyncMeta('full_sync_progress');
  if (fullSyncProgress?.resumeIndex != null) {
    state.syncStatus.fullSync = { resumeIndex: fullSyncProgress.resumeIndex };
  }
  const quickSyncMeta = await getSyncMeta('quick_sync');

  // 8. Mount UI components
  const detailDrawer = DetailDrawer({
    container:     document.getElementById('detail-drawer'),
    // Re-run filters after star toggle in case starredOnly filter is active (T035)
    onStarToggle: () => {
      state.filtered = applyFilters(state.allFunds, state.filters);
      applySortToFiltered();
      virtualTable.refresh();
      toolbar.updateResultCount(state.filtered.length);
    },
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
      console.warn(`[NAVigator] Filter took ${filterMs.toFixed(1)}ms — exceeds 200ms target`);
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
    onSyncClick:          () => {},
    onExportCSV:          () => {},
    onExportJSON:         () => {},
    onColumnPickerToggle: () => {},
  });

  // Show freshness warning if quick_sync is older than 24 hours
  toolbar.showFreshnessWarning(quickSyncMeta?.syncedAt);

  const filterPanel = FilterPanel({
    container:       document.getElementById('filter-panel'),
    onFiltersChange: applyAndRefresh,
  });

  // Expose reset to VirtualTable's "Clear all filters" button without circular import
  window.__navigatorResetFilters = () => {
    filterPanel.resetAll();
    toolbar.resetSearch?.();
  };

  virtualTable.onFundClick = fund => detailDrawer.open(fund);

  // 9. Initial render
  virtualTable.refresh();
  toolbar.updateResultCount(state.filtered.length);

  // Repopulate dynamic MultiCheck options now that funds are loaded
  filterPanel.repopulateDynamic();

  // 10. Wire sync worker and SyncButton (US2)
  async function _reloadFunds() {
    state.allFunds = await getFunds();
    const userData = await getAllUserData();
    const uMap     = new Map(userData.map(u => [u.schemeCode, u]));
    for (const fund of state.allFunds) {
      const u      = uMap.get(fund.schemeCode);
      fund.starred = u?.starred ?? false;
      fund.notes   = u?.notes   ?? '';
    }
    state.filtered = applyFilters(state.allFunds, state.filters);
    applySortToFiltered();
    virtualTable.refresh();
    toolbar.updateResultCount(state.filtered.length);
    filterPanel.repopulateDynamic();
  }

  const worker = new Worker(
    new URL('./sync/worker.js', import.meta.url),
    { type: 'module' }
  );

  // Main thread listener: state updates driven by sync events
  worker.addEventListener('message', async ({ data }) => {
    if (data.type === 'FUNDS_LOADED') {
      // Optimistic in-memory update so the table fills immediately (before COMPLETE)
      const userData = await getAllUserData();
      const uMap     = new Map(userData.map(u => [u.schemeCode, u]));
      state.allFunds = data.funds.map(f => ({
        ...f,
        starred: uMap.get(f.schemeCode)?.starred ?? false,
        notes:   uMap.get(f.schemeCode)?.notes   ?? '',
      }));
      state.filtered = applyFilters(state.allFunds, state.filters);
      applySortToFiltered();
      virtualTable.refresh();
      toolbar.updateResultCount(state.filtered.length);
      filterPanel.repopulateDynamic();
    }

    if (data.type === 'COMPLETE') {
      // Worker has finished all DB writes — reload for the authoritative state
      await _reloadFunds();
    }
  });

  // Mount SyncButton inside the #sync-area placeholder created by Toolbar
  const syncAreaEl = document.getElementById('sync-area');
  const syncButton = SyncButton({ container: syncAreaEl, worker });
  syncButton.attachWorkerListeners();
  syncButton.showResumeIfPending();

  // Backfill metrics for any fund that has NAV history but no computed returns
  // (catches data from sync runs that ran before the compute phase was added)
  if (state.allFunds.some(f => f.hasNavHistory && !f.returns)) {
    worker.postMessage({ type: 'RECOMPUTE_METRICS' });
  }
}

document.addEventListener('DOMContentLoaded', boot);
