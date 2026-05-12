import './style.css';

import { openDB, getFunds, getSyncMeta, getAllUserData } from './db/db.js';
import { state, setColumnVisibility }                   from './store/state.js';
import { COLUMNS }                                       from './config/columns.js';
import { initTheme }                                     from './ui/theme.js';
import { Toolbar }                                       from './ui/toolbar/Toolbar.js';
import { FilterPanel }                                   from './ui/filters/FilterPanel.js';
import { VirtualTable }                                  from './ui/table/VirtualTable.js';
import { DetailDrawer }                                  from './ui/detail/DetailDrawer.js';

async function boot() {
  // 1. Apply theme before first paint to avoid flash
  initTheme();

  // 2. Open (or upgrade) the IndexedDB database
  await openDB();

  // 3. Load column visibility from sync_meta; fall back to COLUMNS defaults
  const savedVis = await getSyncMeta('column_visibility');
  if (savedVis?.value) {
    setColumnVisibility(savedVis.value);
  } else {
    const defaults = Object.fromEntries(COLUMNS.map(c => [c.key, c.defaultVisible]));
    setColumnVisibility(defaults);
  }

  // 4. Load all funds from the DB
  state.allFunds = await getFunds();

  // 5. Merge starred / notes from user_data into fund objects
  const allUserData = await getAllUserData();
  const userMap     = new Map(allUserData.map(u => [u.schemeCode, u]));
  for (const fund of state.allFunds) {
    const u       = userMap.get(fund.schemeCode);
    fund.starred  = u?.starred ?? false;
    fund.notes    = u?.notes   ?? '';
  }

  // 6. Apply filters (no active filters yet — filtered = all funds)
  //    FilterEngine (Phase 3) will replace this with a full applyFilters() call.
  state.filtered = [...state.allFunds];

  // 7. Mount UI components
  const toolbar = Toolbar({
    container:             document.getElementById('toolbar'),
    onSyncClick:           () => {},
    onExportCSV:           () => {},
    onExportJSON:          () => {},
    onColumnPickerToggle:  () => {},
  });

  const filterPanel = FilterPanel({
    container: document.getElementById('filter-panel'),
  });

  const virtualTable = VirtualTable({
    container: document.getElementById('table-area'),
  });

  const detailDrawer = DetailDrawer({
    container: document.getElementById('detail-drawer'),
  });

  // Wire fund-click → detail drawer (Phase 3 will call DetailDrawer.open(fund))
  virtualTable.onFundClick = fund => detailDrawer.open(fund);

  // 8. Show empty-state CTA when there is no fund data yet
  if (state.allFunds.length === 0) {
    document.getElementById('table-area').innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon" aria-hidden="true">₹</div>
        <h2 class="empty-state__heading">No fund data yet</h2>
        <p class="empty-state__body">
          Click <strong>Quick Sync</strong> in the toolbar to download
          ~2,500 Direct&thinsp;+&thinsp;Growth funds from AMFI.
        </p>
      </div>`;
  }
}

document.addEventListener('DOMContentLoaded', boot);
