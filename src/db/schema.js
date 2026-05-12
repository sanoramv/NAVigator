export const DB_NAME = 'navigator-db';
export const DB_VERSION = 1;

export function upgrade(db) {
  const funds = db.createObjectStore('funds', { keyPath: 'schemeCode' });
  funds.createIndex('by_category',    'category');
  funds.createIndex('by_amc',         'amcName');
  funds.createIndex('by_subcategory', 'subCategory');

  const nav = db.createObjectStore('nav_history', { keyPath: ['schemeCode', 'date'] });
  nav.createIndex('by_scheme', 'schemeCode');

  db.createObjectStore('sync_meta', { keyPath: 'key' });
  db.createObjectStore('user_data', { keyPath: 'schemeCode' });
}
