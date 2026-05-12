/**
 * MFAPI India batch NAV history fetcher.
 * Fetches 10 funds concurrently, 100ms gap between batches.
 * Supports pause/resume via shouldPauseFn callback.
 */

import { putNavHistory, putFunds, getFund, getFunds, getNavHistory } from '../db/db.js';
import { computeReturns, computeRisk } from './compute.js';

const MFAPI_BASE = import.meta.env.DEV
  ? '/mfapi-proxy/mf'
  : 'https://api.mfapi.in/mf';
const BATCH_SIZE   = 25;
const BATCH_DELAY  = 50; // ms between batches
const RETRY_DELAY  = 1000; // ms before single retry

// MFAPI returns dates as DD-MM-YYYY (numeric month, e.g. "11-05-2026").
// The MONTH_MAP fallback handles any future format change to DD-Mon-YYYY.
const MONTH_MAP = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

function normaliseDate(rawDate) {
  const parts = (rawDate || '').split('-');
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  if (!dd || !mm || !yyyy) return null;
  // Primary: numeric month — MFAPI format "DD-MM-YYYY"
  const n = parseInt(mm, 10);
  if (n >= 1 && n <= 12) {
    return `${yyyy}-${String(n).padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  // Fallback: three-letter abbreviation — "DD-Mon-YYYY"
  const month = MONTH_MAP[mm];
  return month ? `${yyyy}-${month}-${dd.padStart(2, '0')}` : null;
}

function normaliseSchemeType(raw) {
  if (!raw) return 'Unknown';
  const r = raw.toLowerCase();
  if (r.includes('open'))     return 'Open Ended';
  if (r.includes('close'))    return 'Close Ended';
  if (r.includes('interval')) return 'Interval';
  return raw;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch a single fund's NAV history from MFAPI with one retry on failure.
 * Returns null on 404 or after failed retry (caller continues with next fund).
 */
async function fetchOneFund(schemeCode) {
  const url = `${MFAPI_BASE}/${schemeCode}`;
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  } catch {
    // Network error — retry once
    await delay(RETRY_DELAY);
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    } catch {
      return null;
    }
  }

  if (res.status === 404) return null;

  if (!res.ok) {
    // 5xx — retry once
    await delay(RETRY_DELAY);
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) return null;
    } catch {
      return null;
    }
  }

  try {
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Process one fund: fetch, trim to 5Y, compute metrics, write to IndexedDB.
 * Returns { updated: bool } — false means fund was skipped (404 / bad data).
 */
async function processOneFund(schemeCode) {
  const data = await fetchOneFund(schemeCode);
  if (!data || !data.meta) return { updated: false };

  const { meta, data: rawHistory = [] } = data;

  // Extract and normalise metadata
  const amcName    = meta.fund_house    || 'Unknown';
  const schemeType = normaliseSchemeType(meta.scheme_type);

  if (!rawHistory.length) {
    // No history — update metadata only, preserving existing fields
    const existing = (await getFund(schemeCode)) || {};
    await putFunds([{ ...existing, schemeCode, amcName, schemeType, hasNavHistory: false }]);
    return { updated: false };
  }

  // Reverse to ascending order (MFAPI returns newest-first)
  const ascending = [...rawHistory].reverse();

  // Normalise dates and navs; skip bad/missing/N.A. entries
  const normalised = ascending
    .map(row => {
      const dateRaw = row.date;
      const navRaw  = row.nav;
      if (!dateRaw || dateRaw === 'N.A.' || !navRaw || navRaw === 'N.A.') return null;
      const nav = parseFloat(navRaw);
      if (!isFinite(nav) || nav <= 0) return null;
      try {
        const date = normaliseDate(dateRaw);
        if (!date || isNaN(new Date(date).getTime())) return null;
        return { date, nav };
      } catch {
        console.warn(`[mfapi] Bad date "${dateRaw}" for scheme ${schemeCode} — skipped`);
        return null;
      }
    })
    .filter(Boolean);

  if (!normalised.length) {
    const existing = (await getFund(schemeCode)) || {};
    await putFunds([{ ...existing, schemeCode, amcName, schemeType, hasNavHistory: false }]);
    return { updated: false };
  }

  // Trim to 5Y window from the most recent date
  const navDate  = normalised[normalised.length - 1].date;
  const cutoff   = new Date(navDate);
  cutoff.setFullYear(cutoff.getFullYear() - 5);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const trimmed   = normalised.filter(d => d.date >= cutoffStr);

  // Compute metrics
  const returns = computeReturns(trimmed);
  const risk    = computeRisk(trimmed);

  // Write NAV history records to IndexedDB
  const navRecords = trimmed.map(({ date, nav }) => ({ schemeCode, date, nav }));
  await putNavHistory(navRecords);
  console.log(`[mfapi] Saved ${navRecords.length} NAV records for fund ${schemeCode}`);

  // Merge metadata + metrics into the existing fund record (preserves Quick Sync fields)
  const existing = (await getFund(schemeCode)) || {};
  await putFunds([{
    ...existing,
    schemeCode,
    amcName,
    schemeType,
    hasNavHistory: true,
    ...(returns && { returns }),
    ...(risk    && { risk }),
  }]);

  return { updated: true };
}

/**
 * Compute and persist returns + risk for every fund that has NAV history in
 * IndexedDB but is missing computed metrics (e.g. from a previous sync run).
 * Safe to call at any time; skips funds that are already fully computed.
 *
 * @returns {Promise<number>} number of fund records updated
 */
export async function computeAllMetrics() {
  const funds     = await getFunds();
  const toCompute = funds.filter(f => f.hasNavHistory && (!f.returns || !f.risk));

  console.log(`[compute] ${toCompute.length} / ${funds.length} funds need metrics (DB: navigator-db)`);

  if (toCompute.length === 0) return 0;

  // Diagnostic sample: log nav_history row count for the first eligible fund
  // so the user can verify history is present before compute runs.
  const sample        = toCompute[0];
  const sampleHistory = await getNavHistory(sample.schemeCode);
  console.log(`[compute] Sample fund ${sample.schemeCode} ("${sample.schemeNameShort ?? sample.schemeName}"): `
    + `${sampleHistory.length} nav_history records in DB`);

  let updatedCount = 0;
  for (const fund of toCompute) {
    const navHistory = await getNavHistory(fund.schemeCode);
    if (!navHistory || navHistory.length < 2) continue;

    const returns = computeReturns(navHistory);
    const risk    = computeRisk(navHistory);

    // Write back even if some metric values are null — the fund record must
    // carry the `returns`/`risk` keys so the table stops showing N/A once
    // history is present, even if only short-term windows have data.
    if (!returns && !risk) continue;

    await putFunds([{
      ...fund,
      ...(returns ? { returns } : {}),
      ...(risk    ? { risk }    : {}),
    }]);
    updatedCount++;
  }

  console.log(`[compute] Metrics written for ${updatedCount} / ${funds.length} funds`);
  return updatedCount;
}

/**
 * Batch-fetch NAV history for an array of scheme codes, supporting pause/resume.
 *
 * @param {number[]}  schemeCodes   - all fund codes to process
 * @param {number}    resumeIndex   - start offset (0 for fresh run)
 * @param {Function}  onProgress    - (completed, total) → void
 * @param {Function}  shouldPauseFn - () → boolean; checked between batches
 * @returns {Promise<{ paused: boolean, resumeIndex: number }>}
 */
export async function fetchNavHistoryBatch(schemeCodes, resumeIndex, onProgress, shouldPauseFn) {
  const total = schemeCodes.length;

  for (let i = resumeIndex; i < total; i += BATCH_SIZE) {
    if (shouldPauseFn()) {
      return { paused: true, resumeIndex: i };
    }

    const batch = schemeCodes.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(code => processOneFund(code)));

    const completed = Math.min(i + BATCH_SIZE, total);
    onProgress(completed, total);

    // Gap between batches — skip delay on the final batch
    if (completed < total) {
      await delay(BATCH_DELAY);
    }
  }

  return { paused: false, resumeIndex: total };
}
