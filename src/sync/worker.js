/**
 * Web Worker — all sync operations run here, off the main thread.
 * Communicates with the main thread via typed postMessage events.
 * See contracts/worker-protocol.md for the full message schema.
 */

import { openDB, getFunds, putFunds, putSyncMeta } from '../db/db.js';
import { fetchAndParseFunds }                       from './amfi.js';
import { fetchNavHistoryBatch, computeAllMetrics }  from './mfapi.js';

let shouldPause = false;

async function handleQuickSync() {
  const t0 = Date.now();
  try {
    await openDB();
    const funds = await fetchAndParseFunds();

    self.postMessage({ type: 'FUNDS_LOADED', funds });

    // Worker writes funds to DB (per lifecycle rule 4 in worker-protocol)
    await putFunds(funds);

    // Record sync timestamp
    await putSyncMeta({
      key:        'quick_sync',
      syncedAt:   new Date().toISOString(),
      totalFunds: funds.length,
    });

    self.postMessage({
      type:       'COMPLETE',
      syncType:   'quick',
      totalFunds: funds.length,
      durationMs: Date.now() - t0,
    });
  } catch (err) {
    self.postMessage({
      type:        'ERROR',
      syncType:    'quick',
      message:     err.message || 'Quick Sync failed — check your network connection.',
      recoverable: true,
    });
  }
}

async function handleFullSync(resumeIndex) {
  const t0 = Date.now();
  try {
    await openDB();

    // Load all fund codes, sorted by schemeCode for stable resumption
    const allFunds    = await getFunds();
    const schemeCodes = allFunds
      .map(f => f.schemeCode)
      .sort((a, b) => a - b);

    if (!schemeCodes.length) {
      self.postMessage({
        type:    'ERROR',
        syncType: 'full',
        message: 'No funds found in local database. Run Quick Sync first.',
        recoverable: true,
      });
      return;
    }

    // Initial progress event so the UI shows 0%
    self.postMessage({
      type:    'PROGRESS',
      phase:   'history',
      current: resumeIndex,
      total:   schemeCodes.length,
      message: `Downloading NAV history: ${resumeIndex} / ${schemeCodes.length} funds`,
    });

    let lastCompleted = resumeIndex;

    const result = await fetchNavHistoryBatch(
      schemeCodes,
      resumeIndex,
      (completed, total) => {
        lastCompleted = completed;
        self.postMessage({
          type:    'PROGRESS',
          phase:   'history',
          current: completed,
          total,
          message: `Downloading NAV history: ${completed} / ${total} funds`,
        });
        self.postMessage({
          type:       'HISTORY_SAVED',
          schemeCode: schemeCodes[completed - 1],
          fundIndex:  completed - 1,
          totalFunds: total,
        });
      },
      () => shouldPause,
    );

    if (result.paused) {
      // Persist progress so the main thread can resume later
      await putSyncMeta({
        key:         'full_sync_progress',
        resumeIndex: result.resumeIndex,
        pausedAt:    new Date().toISOString(),
      });
      self.postMessage({
        type:        'PAUSED',
        resumeIndex: result.resumeIndex,
        reason:      shouldPause ? 'user' : 'error',
      });
    } else {
      await putSyncMeta({
        key:        'full_sync',
        syncedAt:   new Date().toISOString(),
        totalFunds: schemeCodes.length,
      });
      // Clear the progress record so Resume is not shown after completion
      await putSyncMeta({ key: 'full_sync_progress', resumeIndex: null });

      // Compute phase: persist returns + risk for every fund with NAV history
      self.postMessage({
        type:    'PROGRESS',
        phase:   'compute',
        current: 0,
        total:   schemeCodes.length,
        message: 'Computing returns and risk metrics…',
      });
      await computeAllMetrics();

      self.postMessage({
        type:       'COMPLETE',
        syncType:   'full',
        totalFunds: schemeCodes.length,
        durationMs: Date.now() - t0,
      });
    }
  } catch (err) {
    self.postMessage({
      type:        'ERROR',
      syncType:    'full',
      message:     err.message || 'Full Sync failed — check your network connection.',
      recoverable: true,
      resumeIndex,
    });
  }
}

async function handleRecomputeMetrics() {
  try {
    await openDB();
    await computeAllMetrics();
    self.postMessage({ type: 'COMPLETE', syncType: 'recompute' });
  } catch (err) {
    console.error('[Worker] Recompute metrics failed:', err);
  }
}

self.onmessage = ({ data }) => {
  switch (data.type) {
    case 'QUICK_SYNC':
      shouldPause = false;
      handleQuickSync();
      break;

    case 'FULL_SYNC':
      shouldPause = false;
      handleFullSync(data.resumeIndex ?? 0);
      break;

    case 'RECOMPUTE_METRICS':
      handleRecomputeMetrics();
      break;

    case 'PAUSE':
      shouldPause = true;
      break;

    default:
      console.warn('[Worker] Unknown message type:', data.type);
  }
};
