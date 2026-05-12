# Contract: AMFI NAVAll.txt

**Consumer**: `src/sync/amfi.js`
**Source**: AMFI India (Association of Mutual Funds in India)

---

## Endpoint

```
GET https://www.amfiindia.com/spages/NAVAll.txt
```

No authentication. No API key. Returns plain text (charset: UTF-8).

---

## Response Format

The file is a **semicolon-delimited flat text** file with category section headers interspersed.

### Structure

```
{Category Header}
{blank line}
Scheme Code;ISIN Div Payout/ IDCW;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date
{data row}
{data row}
{blank line}
{Category Header}
...
```

### Category Header Lines

A line containing no semicolons and starting with a scheme type keyword identifies the
start of a new category section. All data rows following this header belong to this category
until the next header is encountered.

```
Open Ended Schemes(Equity Scheme - Large Cap Fund)
Open Ended Schemes(Debt Scheme - Banking and PSU Fund)
Open Ended Schemes(Hybrid Scheme - Aggressive Hybrid Fund)
Open Ended Schemes(Other Scheme - Index Funds)
Open Ended Schemes(Solution Oriented Scheme - Retirement Fund)
Close Ended Schemes(...)
Interval Schemes(...)
```

**Parsing rule**: If a line does not contain a semicolon AND is non-empty AND is not the
column header line, treat it as a category header. Extract the text inside the last pair
of parentheses as the full category string.

### Column Header Lines

```
Scheme Code;ISIN Div Payout/ IDCW;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date
```

This line appears once after each category header. Skip it.

### Data Row Format

```
119598;INF846K01DP8;-;Axis Bluechip Fund - Direct Plan - Growth;52.3421;09-May-2025
```

| Field index | Name | Type | Notes |
|-------------|------|------|-------|
| 0 | `schemeCode` | number | AMFI scheme code; cast from string |
| 1 | `isinDivPayout` | string | ISIN or `-`; not used |
| 2 | `isinDivReinvestment` | string | ISIN or `-`; not used |
| 3 | `schemeName` | string | Full scheme name; used for Direct+Growth filter |
| 4 | `nav` | number | Cast from string; may be `N.A.` if trading halted |
| 5 | `date` | string | Format: `DD-Mon-YYYY` → normalise to `YYYY-MM-DD` |

### Date Normalisation

```js
// Input:  "09-May-2025"
// Output: "2025-05-09"

const MONTH_MAP = {
  Jan:'01', Feb:'02', Mar:'03', Apr:'04', May:'05', Jun:'06',
  Jul:'07', Aug:'08', Sep:'09', Oct:'10', Nov:'11', Dec:'12'
};
function normaliseDate(amfiDate) {
  const [dd, mon, yyyy] = amfiDate.split('-');
  return `${yyyy}-${MONTH_MAP[mon]}-${dd.padStart(2, '0')}`;
}
```

### NAV Validation

- If `nav` field is `"N.A."`, `"-"`, `""`, or non-numeric: skip this row (fund not actively trading).
- If `nav <= 0`: skip this row.

---

## Direct+Growth Filter (Applied During Parse)

```js
function isDirectGrowth(schemeName) {
  const n = schemeName.toLowerCase();
  return n.includes('direct')
    && n.includes('growth')
    && !n.includes('idcw')
    && !n.includes('dividend');
}
```

Apply this filter to every data row. Only rows that pass are stored.
Rows that fail (Regular plans, IDCW options, ambiguous names) are discarded silently.

**Why the negative checks are required**: Some fund names contain "Growth" as part of the
fund's marketing name (e.g., "HDFC Growth Opportunities Fund") rather than as the option
type. Such funds also exist as IDCW variants, producing names like
"HDFC Growth Opportunities Fund - Direct Plan - IDCW" — which would pass a naïve
`includes('direct') && includes('growth')` test. The explicit `!includes('idcw')` and
`!includes('dividend')` guards eliminate these false positives. When in doubt, exclude.

---

## Error Handling

| Failure mode | Behaviour |
|-------------|-----------|
| Network timeout / HTTP error | Abort sync; post `ERROR` message to main thread; preserve existing data |
| File not found (non-200) | Abort sync; user-visible error message |
| Malformed row (wrong field count) | Skip row silently; continue parsing |
| NAV is `N.A.` | Skip row silently |
| Category header not recognised | Default to category `"Other"` |

---

## Known Limitations

- **No AUM or expense ratio**: These fields are not in NAVAll.txt.
- **No min SIP amount**: Not in NAVAll.txt.
- **AMC name not present**: Must be approximated from scheme name or fetched from MFAPI.
- **No scheme metadata** (fund_house, scheme_type): Only available from MFAPI individual endpoint.
- **Update frequency**: AMFI updates this file on each business day after 11pm IST. Data is
  current-day NAV from market close at approximately 3pm IST.
