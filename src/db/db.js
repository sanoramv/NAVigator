import { openDB as idbOpen } from 'idb';
import { DB_NAME, DB_VERSION, upgrade } from './schema.js';

// Single shared connection promise — opened lazily on first use.
let _db = null;

export function openDB() {
  if (!_db) {
    _db = idbOpen(DB_NAME, DB_VERSION, { upgrade });
  }
  return _db;
}

export async function getFunds() {
  return (await openDB()).getAll('funds');
}

export async function putFunds(records) {
  const db = await openDB();
  const tx = db.transaction('funds', 'readwrite');
  records.forEach(r => tx.store.put(r));
  await tx.done;
}

export async function getFund(schemeCode) {
  return (await openDB()).get('funds', schemeCode);
}

// Returns records sorted ascending by date (compound key: [schemeCode, date]).
export async function getNavHistory(schemeCode) {
  return (await openDB()).getAllFromIndex('nav_history', 'by_scheme', schemeCode);
}

export async function putNavHistory(records) {
  const db = await openDB();
  const tx = db.transaction('nav_history', 'readwrite');
  records.forEach(r => tx.store.put(r));
  await tx.done;
}

export async function getSyncMeta(key) {
  return (await openDB()).get('sync_meta', key);
}

export async function putSyncMeta(record) {
  return (await openDB()).put('sync_meta', record);
}

export async function getUserData(schemeCode) {
  return (await openDB()).get('user_data', schemeCode);
}

export async function putUserData(record) {
  return (await openDB()).put('user_data', record);
}

export async function getAllUserData() {
  return (await openDB()).getAll('user_data');
}
