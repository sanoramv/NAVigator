/**
 * AMFI NAVAll.txt fetch and parse.
 * Filters for Direct+Growth open-ended schemes only (~2,500 of ~15,000 rows).
 */

// amfiindia.com does not send CORS headers so a browser fetch is blocked by CORS.
// Strategy:
//  - Dev  : Vite dev-server proxies /amfi-proxy → amfiindia.com server-side (no CORS).
//  - Prod : Set VITE_AMFI_PROXY_URL to your own CORS-capable endpoint (e.g. a
//           Cloudflare Worker), or leave blank to try the public fallback chain.
const AMFI_URL = 'https://portal.amfiindia.com/spages/NAVAll.txt';

function buildProxyList() {
  // Dev: relative path handled by vite.config.js server.proxy
  if (import.meta.env.DEV) return ['/amfi-proxy'];

  // Production: user-supplied proxy takes priority
  const custom = import.meta.env.VITE_AMFI_PROXY_URL;
  const fallbacks = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(AMFI_URL)}`,
    `https://thingproxy.freeboard.io/fetch/${AMFI_URL}`,
    `https://api.codetabs.com/v1/proxy?quest=${AMFI_URL}`,
  ];
  return custom ? [custom, ...fallbacks] : fallbacks;
}

async function fetchAMFIText() {
  for (const url of buildProxyList()) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.text();
    } catch (e) {
      continue;
    }
  }
  throw new Error('All CORS proxies failed for AMFI NAVAll.txt');
}

const MONTH_MAP = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

function normaliseDate(amfiDate) {
  const [dd, mon, yyyy] = amfiDate.split('-');
  return `${yyyy}-${MONTH_MAP[mon]}-${dd.padStart(2, '0')}`;
}

function isDirectGrowth(schemeName) {
  const n = schemeName.toLowerCase();
  return n.includes('direct')
    && n.includes('growth')
    && !n.includes('idcw')
    && !n.includes('dividend');
}

/**
 * Map the scheme-type string (e.g. "Equity Scheme") to a canonical category.
 * The subCategory string is used to refine "Other Scheme" → "Index/ETF" when applicable.
 */
function mapCategory(schemeType, subCategory) {
  const t = (schemeType || '').toLowerCase();
  if (t.startsWith('equity'))   return 'Equity';
  if (t.startsWith('debt'))     return 'Debt';
  if (t.startsWith('hybrid'))   return 'Hybrid';
  if (t.startsWith('solution')) return 'Solution-Oriented';
  // Legacy AMFI section names that map to Debt
  if (t === 'gilt' || t === 'money market') return 'Debt';
  if (t.startsWith('other')) {
    const s = (subCategory || '').toLowerCase();
    // "FoF" appears as both "Fund of Fund" and "FoF" in different file versions
    if (s.includes('index') || s.includes('etf')
        || s.includes('fund of fund') || s.includes('fof')) {
      return 'Index/ETF';
    }
    return 'Other';
  }
  return 'Other';
}

/**
 * Extract AMC name approximation from schemeName.
 * Takes the first word — good enough for Quick Sync; Full Sync overwrites with MFAPI data.
 */
function approximateAmcName(schemeName) {
  return schemeName.split(' ')[0] || 'Unknown';
}

/**
 * Parse a category section header line and return { category, subCategory },
 * or null if the line is not a category header.
 *
 * Two formats are handled:
 *   Parentheses (actual AMFI file):
 *     "Open Ended Schemes(Equity Scheme - Large Cap Fund)"
 *   Dash-separated (some proxy responses / older format):
 *     "Open Ended Schemes - Equity Scheme - Large Cap Fund"
 *
 * AMC name lines ("Aditya Birla Sun Life Mutual Fund", "IL&FS Mutual Fund (IDF)")
 * are excluded by requiring the line to start with Open/Close/Interval.
 */
function parseSectionHeader(line) {
  // Only category headers start with these words — guards against AMC names
  // that happen to contain parentheses (e.g. "IL&FS Mutual Fund (IDF)").
  if (!/^(Open|Close|Interval)/i.test(line)) return null;

  // ── Format 1: "Open Ended Schemes(Equity Scheme - Large Cap Fund)" ─────────
  const m = line.match(/\(([^)]+)\)\s*$/);
  if (m) {
    const inside  = m[1]; // e.g. "Equity Scheme - Large Cap Fund"
    const dashIdx = inside.indexOf(' - ');
    if (dashIdx === -1) {
      return { category: mapCategory(inside, ''), subCategory: inside };
    }
    const schemeType  = inside.slice(0, dashIdx);   // "Equity Scheme"
    const subCategory = inside.slice(dashIdx + 3);  // "Large Cap Fund"
    return { category: mapCategory(schemeType, subCategory), subCategory };
  }

  // ── Format 2: "Open Ended Schemes - Equity Scheme - Large Cap Fund" ────────
  const parts = line.split(' - ');
  if (parts.length >= 2) {
    const schemeType  = (parts[1] || '').trim();
    const subCategory = parts.slice(2).join(' - ').trim() || schemeType;
    if (schemeType) {
      return { category: mapCategory(schemeType, subCategory), subCategory: subCategory || 'Other' };
    }
  }

  return null;
}

/**
 * Fetch and parse AMFI NAVAll.txt, returning an array of Direct+Growth fund objects.
 *
 * @returns {Promise<Array>} Array of fund objects ready for IndexedDB storage.
 * @throws {Error} If the network request fails (caller should post ERROR to main thread).
 */
export async function fetchAndParseFunds() {
  const text  = await fetchAMFIText();
  const lines = text.split('\n');
  const funds = [];
  const syncedAt = new Date().toISOString();

  let currentCategory    = 'Other';
  let currentSubCategory = 'Other';

  const COLUMN_HEADER = 'Scheme Code;ISIN';

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Column header row — skip
    if (line.startsWith(COLUMN_HEADER)) continue;

    // Category section header — no semicolons, non-empty.
    // AMC name lines (e.g. "Aditya Birla Sun Life Mutual Fund") also have no
    // semicolons; parseSectionHeader returns null for them so we skip quietly.
    if (!line.includes(';')) {
      const parsed = parseSectionHeader(line);
      if (parsed) {
        currentCategory    = parsed.category;
        currentSubCategory = parsed.subCategory;
      }
      continue;
    }

    // Data row: split on semicolon, must have exactly 6 fields
    const fields = line.split(';');
    if (fields.length !== 6) continue;

    const [codeStr, , , schemeName, navStr, dateStr] = fields;
    if (!isDirectGrowth(schemeName)) continue;

    // NAV validation
    const nav = parseFloat(navStr);
    if (!isFinite(nav) || nav <= 0) continue;

    // Short name: everything before " - Direct"
    const directIdx     = schemeName.indexOf(' - Direct');
    const schemeNameShort = directIdx > -1
      ? schemeName.slice(0, directIdx)
      : schemeName;

    funds.push({
      schemeCode:     parseInt(codeStr, 10),
      schemeName,
      schemeNameShort,
      amcName:        approximateAmcName(schemeName),
      category:       currentCategory,
      subCategory:    currentSubCategory,
      navCurrent:     nav,
      navDate:        normaliseDate(dateStr.trim()),
      schemeType:     'Open Ended',
      syncedAt,
      hasNavHistory:  false,
    });
  }

  return funds;
}
