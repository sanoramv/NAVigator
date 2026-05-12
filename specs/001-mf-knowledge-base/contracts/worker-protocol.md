# Contract: Web Worker Message Protocol

**Worker file**: `src/sync/worker.js`
**Consumer**: `src/ui/toolbar/SyncButton.js` (via main thread)

The sync worker runs all network fetching, parsing, computing, and IndexedDB writes off
the main thread. Communication is via `postMessage` / `onmessage` with typed message objects.

---

## Main Thread → Worker (Commands)

### QUICK_SYNC

Initiates a Quick Sync: fetch AMFI NAVAll.txt, filter Direct+Growth schemes, update
`funds` store with current NAV and category data, update `sync_meta`.

```js
worker.postMessage({ type: 'QUICK_SYNC' })
```

### FULL_SYNC

Initiates a Full Sync: fetch NAV history from MFAPI for all Direct+Growth funds,
compute return/risk metrics, update `funds` and `nav_history` stores.

```js
worker.postMessage({
  type: 'FULL_SYNC',
  resumeIndex: 0,   // number — index into fundList to start from (0 = start fresh)
})
```

`resumeIndex` is read from `sync_meta['full_sync_progress'].resumeIndex` on startup
to support pause and resume.

### PAUSE

Signals the worker to stop after completing the current in-flight batch. Worker will
post a `PAUSED` message with the current resume index before terminating.

```js
worker.postMessage({ type: 'PAUSE' })
```

---

## Worker → Main Thread (Events)

### FUNDS_LOADED

Posted after Quick Sync completes parsing AMFI data. Payload is the parsed + normalised
fund array (only Direct+Growth schemes). Main thread writes these to IndexedDB and
refreshes the in-memory state.

```js
// Posted by worker
self.postMessage({
  type: 'FUNDS_LOADED',
  funds: [
    {
      schemeCode: 119598,
      schemeName: "Axis Bluechip Fund - Direct Plan - Growth",
      schemeNameShort: "Axis Bluechip Fund",
      category: "Equity",
      subCategory: "Large Cap Fund",
      navCurrent: 52.3421,
      navDate: "2025-05-09",
      syncedAt: "2025-05-09T10:23:00Z",
      hasNavHistory: false,
      // amcName, schemeType: approximated from name or "Unknown"
    },
    // ...
  ],
})
```

### HISTORY_SAVED

Posted after each fund's NAV history has been fetched, computed, and written to IndexedDB.
Main thread uses this to update the progress indicator.

```js
self.postMessage({
  type: 'HISTORY_SAVED',
  schemeCode: 119598,
  fundIndex:  342,      // 0-based position in the full fund list
  totalFunds: 2487,     // total funds to process in this Full Sync
})
```

### PROGRESS

Posted periodically during Quick Sync (after each AMFI parse batch) and as a heartbeat
during Full Sync. Used to update the progress bar.

```js
self.postMessage({
  type: 'PROGRESS',
  phase:   'quick',     // 'quick' | 'history'
  current: 342,
  total:   2487,
  message: "Downloading NAV history: 342 / 2487 funds",
})
```

### COMPLETE

Posted when the sync has fully finished without being paused.

```js
self.postMessage({
  type:      'COMPLETE',
  syncType:  'quick',   // 'quick' | 'full'
  totalFunds: 2487,
  durationMs: 8430,
})
```

### PAUSED

Posted when the worker has stopped due to a PAUSE command or recoverable mid-sync error.
The `resumeIndex` value should be persisted to `sync_meta['full_sync_progress']` immediately.

```js
self.postMessage({
  type:        'PAUSED',
  resumeIndex: 342,     // next Full Sync call should pass this as resumeIndex
  reason:      'user',  // 'user' | 'error'
})
```

### ERROR

Posted when a non-recoverable error occurs (or when a recoverable error threshold is exceeded).

```js
self.postMessage({
  type:        'ERROR',
  syncType:    'full',       // 'quick' | 'full'
  message:     "Failed to reach api.mfapi.in after 2 retries. Check your connection.",
  recoverable: true,         // true = can retry; false = data may be corrupt
  resumeIndex: 342,          // only present for full sync errors; allows resume
})
```

---

## Worker Lifecycle Rules

1. **One sync at a time**: The main thread MUST NOT send `QUICK_SYNC` or `FULL_SYNC` while
   one is already running. `SyncButton.js` enforces this by disabling sync controls during sync.
2. **PAUSE is advisory**: The worker finishes its current batch before stopping. The main
   thread should expect up to `BATCH_SIZE × request_latency` delay after sending PAUSE.
3. **Worker is stateless between page loads**: On page load, main thread reads
   `sync_meta['full_sync_progress']` and passes `resumeIndex` if a Full Sync was interrupted.
4. **DB writes happen in the worker**: The worker imports `src/db/db.js` directly. The main
   thread does NOT write to IndexedDB during sync — it only reads after `COMPLETE` or `FUNDS_LOADED`.
5. **IndexedDB access**: Both the worker and main thread may read IndexedDB concurrently.
   Writes are serialised per-store (IDB's default behaviour). The worker is the sole writer
   during sync; the main thread is read-only during sync.

---

## Message Sequence Diagrams

### Quick Sync (happy path)

```
Main                        Worker
 │                             │
 │── QUICK_SYNC ──────────────▶│
 │                             │ fetch AMFI NAVAll.txt
 │                             │ parse + filter
 │◀── FUNDS_LOADED ────────────│
 │                             │ write to IndexedDB
 │◀── COMPLETE (quick) ────────│
 │  refresh table              │
```

### Full Sync with pause and resume

```
Main                        Worker
 │                             │
 │── FULL_SYNC (resumeIndex=0) ▶│
 │◀── PROGRESS (0/2487) ───────│
 │◀── HISTORY_SAVED (1) ───────│
 │◀── HISTORY_SAVED (2) ───────│
 │  ... (user clicks Pause)    │
 │── PAUSE ───────────────────▶│
 │◀── PAUSED (resumeIndex=342) │
 │  save resumeIndex to DB     │
 │                             │
 │  (later — user clicks Resume)
 │── FULL_SYNC (resumeIndex=342)▶│
 │◀── HISTORY_SAVED (343) ─────│
 │◀── ... ─────────────────────│
 │◀── COMPLETE (full) ─────────│
```
