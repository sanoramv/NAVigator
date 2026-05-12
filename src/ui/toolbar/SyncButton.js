import { showToast } from '../toast.js';
import { state }     from '../../store/state.js';
import { putSyncMeta } from '../../db/db.js';

/**
 * Sync controls: Quick Sync, Full Sync, progress bar, pause/resume.
 * Renders into the provided container element (replaces the placeholder button).
 *
 * @param {Object}   opts
 * @param {Element}  opts.container      - element to render into (replaces inner HTML)
 * @param {Worker}   opts.worker         - the sync Web Worker instance
 * @param {Function} opts.onSyncComplete - called after any sync COMPLETE event
 * @returns {{ attachWorkerListeners(): void, showResumeIfPending(): void }}
 */
export function SyncButton({ container, worker, onSyncComplete }) {
  // ── Render ────────────────────────────────────────────────────────────────
  container.innerHTML = '';
  container.style.cssText = 'display:flex;align-items:center;gap:6px;';

  const quickBtn = document.createElement('button');
  quickBtn.textContent = 'Quick Sync';
  quickBtn.className   = 'toolbar__btn';
  quickBtn.setAttribute('aria-label', 'Quick Sync — download latest NAV data');
  container.appendChild(quickBtn);

  const fullBtn = document.createElement('button');
  fullBtn.textContent = 'Full Sync';
  fullBtn.className   = 'toolbar__btn';
  fullBtn.setAttribute('aria-label', 'Full Sync — download 5-year NAV history and compute metrics');
  container.appendChild(fullBtn);

  const pauseBtn = document.createElement('button');
  pauseBtn.className = 'toolbar__btn';
  pauseBtn.style.display = 'none';
  pauseBtn.setAttribute('aria-label', 'Pause Full Sync');
  container.appendChild(pauseBtn);

  const progress = document.createElement('progress');
  progress.className    = 'sync-progress';
  progress.style.display = 'none';
  progress.max          = 100;
  progress.value        = 0;
  progress.setAttribute('aria-label', 'Sync progress');
  container.appendChild(progress);

  const statusText = document.createElement('span');
  statusText.className = 'sync-status';
  container.appendChild(statusText);

  // ── State ─────────────────────────────────────────────────────────────────
  let _syncing     = false;
  let _paused      = false;
  let _resumeIndex = 0;
  let _progressToast = null;

  function _setSyncing(on) {
    _syncing          = on;
    quickBtn.disabled = on;
    fullBtn.disabled  = on;
    progress.style.display  = on ? 'inline-block' : 'none';
    statusText.classList.toggle('sync-status--active', on);
  }

  function _showPause(show) {
    pauseBtn.style.display = show ? '' : 'none';
  }

  // ── Quick Sync ────────────────────────────────────────────────────────────
  quickBtn.addEventListener('click', () => {
    if (_syncing) return;
    _setSyncing(true);
    _showPause(false);
    statusText.textContent = 'Fetching fund list…';
    progress.value = 0;
    worker.postMessage({ type: 'QUICK_SYNC' });
  });

  // ── Full Sync / Resume ────────────────────────────────────────────────────
  fullBtn.addEventListener('click', () => {
    if (_syncing) return;
    _setSyncing(true);
    _showPause(true);
    _paused = false;
    pauseBtn.textContent = 'Pause';
    statusText.textContent = 'Starting Full Sync…';
    progress.value = 0;
    worker.postMessage({ type: 'FULL_SYNC', resumeIndex: _resumeIndex });
  });

  // ── Pause / Resume toggle ─────────────────────────────────────────────────
  pauseBtn.addEventListener('click', () => {
    if (!_paused) {
      // Request pause
      worker.postMessage({ type: 'PAUSE' });
      pauseBtn.textContent   = 'Pausing…';
      pauseBtn.disabled      = true;
      statusText.textContent = 'Pausing after current batch…';
    } else {
      // Resume
      _paused      = false;
      pauseBtn.textContent = 'Pause';
      pauseBtn.disabled    = false;
      _setSyncing(true);
      statusText.textContent = 'Resuming Full Sync…';
      worker.postMessage({ type: 'FULL_SYNC', resumeIndex: _resumeIndex });
    }
  });

  // ── Worker message handler ────────────────────────────────────────────────
  function attachWorkerListeners() {
    worker.addEventListener('message', ({ data }) => {
      switch (data.type) {

        case 'PROGRESS': {
          const pct = data.total > 0 ? Math.round((data.current / data.total) * 100) : 0;
          progress.value        = pct;
          statusText.textContent = data.message || `${data.current} / ${data.total}`;
          break;
        }

        case 'HISTORY_SAVED':
          // Individual fund saved — already handled via PROGRESS
          break;

        case 'FUNDS_LOADED':
          statusText.textContent = `Loaded ${data.funds.length.toLocaleString()} funds`;
          break;

        case 'PAUSED':
          _paused      = true;
          _resumeIndex = data.resumeIndex;
          _setSyncing(false);
          pauseBtn.textContent   = 'Resume Full Sync';
          pauseBtn.setAttribute('aria-label', 'Resume Full Sync from where it was paused');
          pauseBtn.disabled      = false;
          pauseBtn.style.display = '';
          statusText.textContent = `Paused at fund ${data.resumeIndex}`;

          // Persist so a page reload can resume
          putSyncMeta({
            key:         'full_sync_progress',
            resumeIndex: data.resumeIndex,
            pausedAt:    new Date().toISOString(),
          });
          showToast('Full Sync paused. Click "Resume Full Sync" to continue.', 'info');
          break;

        case 'COMPLETE':
          _setSyncing(false);
          _showPause(false);
          _paused      = false;
          _resumeIndex = 0;
          state.syncStatus[data.syncType === 'quick' ? 'quickSync' : 'fullSync'] = {
            syncedAt:   new Date().toISOString(),
            totalFunds: data.totalFunds,
          };
          statusText.textContent = `${data.syncType === 'quick' ? 'Quick' : 'Full'} Sync complete — ${data.totalFunds?.toLocaleString() ?? ''} funds`;
          showToast(
            `${data.syncType === 'quick' ? 'Quick' : 'Full'} Sync complete in ${(data.durationMs / 1000).toFixed(1)}s`,
            'success'
          );
          onSyncComplete?.();
          break;

        case 'ERROR':
          _setSyncing(false);
          _showPause(false);
          if (data.resumeIndex != null) {
            _resumeIndex = data.resumeIndex;
            _paused = true;
            pauseBtn.textContent  = 'Resume Full Sync';
            pauseBtn.style.display = '';
          }
          statusText.textContent = 'Sync failed';
          showToast(data.message || 'Sync failed — check your connection.', 'error', 8000);
          break;
      }
    });
  }

  /**
   * Check sync_meta for a paused Full Sync on startup; show resume button if found.
   * Reads from state.syncStatus (populated by main.js before SyncButton is created).
   */
  function showResumeIfPending() {
    const saved = state.syncStatus.fullSync;
    if (saved?.resumeIndex != null) {
      _resumeIndex           = saved.resumeIndex;
      _paused                = true;
      pauseBtn.textContent   = 'Resume Full Sync';
      pauseBtn.setAttribute('aria-label', 'Resume Full Sync from where it was paused');
      pauseBtn.style.display = '';
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return { attachWorkerListeners, showResumeIfPending };
}
