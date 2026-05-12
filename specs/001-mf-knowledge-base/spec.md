# Feature Specification: Indian Mutual Fund Knowledge Base

**Feature Branch**: `001-mf-knowledge-base`
**Created**: 2026-05-12
**Status**: Draft

## Clarifications

### Session 2026-05-12

- Q: Should Beta and Alpha (vs Nifty 50 TRI) be included as risk metrics, or is Sharpe ratio + standard deviation + max drawdown sufficient? → A: Sharpe, StdDev, and Max Drawdown only — no Beta or Alpha, no index data dependency.
- Q: How many years of NAV history should Full Sync download? → A: 5 years — enables accurate 5Y CAGR computation and full risk metric coverage, with the trade-off of longer sync time accepted.
- Q: Should there be a Selective Sync mode that downloads NAV history only for starred funds? → A: No — Quick Sync and Full Sync only; Selective Sync is out of scope to keep the architecture simple.
- Q: Should the fund detail view show IDCW (dividend) payout history alongside the NAV price chart? → A: NAV price chart only — IDCW payout history is out of scope for v1.
- Q: Should Full Sync support pause and resume, or run to completion / fail entirely? → A: Pause and resume — progress is checkpointed per fund so a restart continues from where it stopped.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse and Filter the Full Fund Universe (Priority: P1)

An investor who holds too many mutual fund schemes opens the site and sees the complete list of Indian
mutual fund schemes in a table. They use the filter panel to narrow thousands of schemes down to a
meaningful shortlist — by asset class, plan type, return performance, risk level, and expense ratio
— so they can compare funds side-by-side and make confident rationalisation decisions.

**Why this priority**: This is the entire reason the tool exists. Every other feature supports this
core workflow. Without a filterable fund table, nothing else delivers value.

**Independent Test**: Can be tested by opening the site after a data sync, applying any combination
of filters, and confirming the table updates to show only matching funds with correct data.

**Acceptance Scenarios**:

1. **Given** the site is open with synced data, **When** the user selects "Equity" under Asset Class and "Large Cap" under Sub-Category, **Then** the table updates immediately to show only matching funds, and the status bar displays the count of filtered results.
2. **Given** 5,000+ fund rows are loaded, **When** the user moves any filter slider or toggles any checkbox, **Then** the table responds in under 200 milliseconds with no perceptible lag.
3. **Given** multiple filters are active, **When** the user resets all filters, **Then** the full fund list is restored instantly.
4. **Given** the user types text into the search bar, **When** they type at least 2 characters, **Then** the table shows only funds whose name or fund house contains the search text (case-insensitive).
5. **Given** the fund table is visible, **When** the user clicks any column header, **Then** the table sorts by that column in ascending order; clicking again reverses to descending.

---

### User Story 2 - Sync Latest Fund Data from Public Sources (Priority: P2)

A user opens the site for the first time (or after a period of no use) and triggers a sync to
download the current NAV and fund metadata from free public Indian APIs. The site shows progress
during download and notifies the user when data is ready. After the sync completes, the user can
close the browser and continue using the site offline with the downloaded data.

**Why this priority**: Without at least one successful sync, there is no data to browse. The sync
is the prerequisite that unlocks every other user story. A failed or confusing sync blocks all value.

**Independent Test**: Can be tested by clicking the Sync button, waiting for completion, then
turning off network access and confirming all filter and browse functionality still works correctly.

**Acceptance Scenarios**:

1. **Given** the site has no data, **When** the user clicks "Quick Sync", **Then** the site downloads current NAV data for all funds, shows a progress indicator, and displays a completion notification.
2. **Given** a sync is in progress, **When** the user views the toolbar, **Then** they see a progress indicator (e.g., "Syncing 342 / 5421 funds") that updates continuously.
3. **Given** a sync completes successfully, **When** the user disconnects from the internet and reloads the page, **Then** all previously downloaded fund data is still fully accessible.
4. **Given** a Full Sync is in progress and the user pauses it (or the browser closes unexpectedly), **When** the user resumes or restarts the sync, **Then** the download continues from the last successfully completed fund — already-downloaded history is not re-fetched and no data is corrupted.
5. **Given** data was synced more than 1 day ago, **When** the user opens the site, **Then** a visible data-freshness warning is shown indicating when the last sync occurred.

---

### User Story 3 - View Full Fund Detail (Priority: P3)

An investor clicks on any fund row to open a detail view showing the fund's NAV history as a
chart, a complete returns table (1 week through 5 years), and all risk metrics. The user can also
add a personal note to any fund and star it for quick access later.

**Why this priority**: The table gives breadth; the detail view gives depth. Once a user has
filtered to a shortlist, they need rich information about each fund to make the final comparison.

**Independent Test**: Can be tested by clicking any fund row after a sync and verifying that all
data sections render correctly with accurate values.

**Acceptance Scenarios**:

1. **Given** the fund table is visible, **When** the user clicks any row, **Then** a detail panel slides open immediately (no network request required) showing the fund's name, NAV, returns table, and risk metrics.
2. **Given** the fund detail panel is open and NAV history has been downloaded, **When** the user views the chart, **Then** they can toggle between 1-year, 3-year, and 5-year views of the NAV price history.
3. **Given** all return and risk values are derived from downloaded data, **When** the user views any computed metric (e.g., Sharpe ratio), **Then** the formula and data window used for the calculation are displayed inline or via tooltip.
4. **Given** the detail panel is open, **When** the user types in the notes field, **Then** the note is saved automatically and persists across browser sessions.
5. **Given** the user clicks the star icon on any fund, **When** they activate the "Starred Only" filter, **Then** the table shows only their starred funds.

---

### User Story 4 - Export Filtered Fund List (Priority: P4)

After narrowing the table to a meaningful shortlist using filters, the user exports the visible
results as a CSV file (for use in a spreadsheet) or as a JSON file (for further programmatic
analysis), so they can share or continue the comparison outside the browser.

**Why this priority**: Export enables the investor to take action outside the tool — share with
a financial advisor, compare in a spreadsheet, or archive a point-in-time snapshot.

**Independent Test**: Can be tested by applying filters, clicking Export CSV, and opening the
downloaded file in a spreadsheet application to verify all filtered funds and columns are present.

**Acceptance Scenarios**:

1. **Given** filters are active and the table shows a subset of funds, **When** the user clicks "Export CSV", **Then** a CSV file downloads containing only the currently visible (filtered) funds, with one row per fund and headers matching the column labels.
2. **Given** the user clicks "Export JSON", **Then** a well-formed JSON file downloads containing the same filtered fund data.
3. **Given** the export file is opened in a spreadsheet application, **When** the user inspects the data, **Then** all numeric values (returns, AUM, expense ratio) are formatted correctly and no data is truncated.
4. **Given** no filters are active (all funds visible), **When** the user exports, **Then** the exported file contains all synced funds.

---

### Edge Cases

- What happens when the user opens the site for the first time before any sync? → A clear empty-state message with a prominent "Sync Now" call-to-action is shown.
- What happens when a fund has incomplete data (e.g., no NAV history, no expense ratio)? → Missing values are shown as "N/A" and the fund still appears in the table (never silently excluded).
- What happens when a filter produces zero results? → The table shows an empty state with a message and a "Clear Filters" button; no confusing blank state.
- What happens when the user applies a return filter but NAV history has not been downloaded? → Return fields are shown as "N/A"; a notice explains that a Full Sync (5 years of history) is needed for computed metrics.
- What happens when the public APIs are unreachable during sync? → The sync fails gracefully with a human-readable error message; existing locally stored data is preserved.
- What happens when the user tries to sync while a sync is already in progress? → The Sync button is disabled during an active sync to prevent duplicate requests.

---

## Requirements *(mandatory)*

### Functional Requirements

**Fund Table & Filtering**
- **FR-001**: The site MUST display all available Indian mutual fund schemes in a scrollable, sortable table after a data sync.
- **FR-002**: The table MUST support filtering by: Asset Class (Equity, Debt, Hybrid, Index/ETF, Solution-Oriented), Sub-Category, AMC (fund house), Plan Type (Direct/Regular), and Option (Growth/IDCW).
- **FR-003**: The table MUST support performance filters: minimum/maximum 1-year, 3-year, and 5-year returns as range sliders.
- **FR-004**: The table MUST support risk filters: Sharpe ratio, standard deviation, and maximum drawdown as range sliders.
- **FR-005**: The table MUST support AUM range and expense ratio range filters.
- **FR-006**: All active filters MUST be combined with AND logic (a fund must satisfy every active filter to appear).
- **FR-007**: The table MUST display a result count (e.g., "Showing 142 of 5,421 funds") that updates in real time as filters change.
- **FR-008**: Users MUST be able to show, hide, and reorder table columns via a column picker control.
- **FR-009**: The table MUST respond to any filter change in under 200 milliseconds regardless of total fund count.
- **FR-010**: Users MUST be able to search funds by name, fund house, or scheme code with case-insensitive matching.

**Data Sync**
- **FR-011**: The site MUST provide a Quick Sync that downloads current NAV and fund metadata for all schemes from free, unauthenticated public APIs.
- **FR-012**: The site MUST provide a Full Sync that additionally downloads 5 years of daily NAV history for all schemes, with a visible progress indicator showing count of funds processed. These are the only two sync modes; selective or partial syncing is out of scope.
- **FR-012a**: Full Sync MUST support pause and resume — download progress is checkpointed per fund so that if the sync is interrupted (user action or browser close), a subsequent sync continues from the last completed fund rather than restarting from scratch.
- **FR-013**: All downloaded data MUST be stored locally in the user's browser and persist across sessions with no server or account required.
- **FR-014**: The site MUST display a last-sync timestamp for each data source so the user always knows how fresh the data is.
- **FR-015**: The site MUST remain fully functional offline after at least one successful sync.
- **FR-016**: The site MUST NOT require any API key, login, account creation, or server-side component.

**Fund Detail**
- **FR-017**: Clicking any fund row MUST open a detail view showing: full fund name, scheme code, current NAV and date, full returns table (1W/1M/3M/6M/1Y/3Y/5Y), and risk metrics comprising Sharpe ratio, annualised standard deviation, and maximum drawdown. Beta and Alpha are excluded from scope.
- **FR-018**: The detail view MUST display a NAV price history chart when 5-year history data has been downloaded, with toggleable time windows (1Y, 3Y, 5Y). IDCW payout history is out of scope.
- **FR-019**: Every computed metric in the detail view MUST display its calculation formula and data window, inline or via tooltip.
- **FR-020**: Users MUST be able to add and edit personal notes on any fund, persisted across sessions.
- **FR-021**: Users MUST be able to star/favourite any fund for quick filtering later.

**Export**
- **FR-022**: Users MUST be able to export the currently filtered (visible) fund list as a CSV file.
- **FR-023**: Users MUST be able to export the currently filtered fund list as a JSON file.
- **FR-024**: Exported files MUST include all currently visible columns and correctly formatted values.

**Distribution**
- **FR-025**: The site MUST be deployable on GitHub Pages (static hosting) with no server-side dependencies.
- **FR-026**: The setup sequence from cloning the repository to a running local instance MUST complete in under 60 seconds.

### Key Entities

- **Fund Scheme**: Represents one mutual fund scheme. Attributes include: unique scheme code, full name, AMC name, asset class, sub-category, plan type, option type, current NAV, NAV date, AUM, expense ratio, minimum SIP amount, computed return metrics (1W/1M/3M/6M/1Y/3Y/5Y), computed risk metrics (Sharpe ratio, annualised standard deviation, max drawdown), sync timestamp, personal star flag, and user notes. Beta and Alpha are excluded — they require an external index data source and are out of scope.
- **NAV History Entry**: A dated price point for a fund scheme. Attributes: scheme code (link to Fund Scheme), date, and NAV value. Used to compute all return and risk metrics.
- **Sync State**: Tracks the status of each data source and Full Sync progress. Attributes: source name, last successful sync timestamp, total records synced, sync status (success/partial/failed), and — for Full Sync — the index of the last successfully downloaded fund to enable pause and resume.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can go from cloning the repository to viewing live fund data in under 60 seconds on a standard broadband connection.
- **SC-002**: Applying or adjusting any filter on 5,000+ fund rows produces a visible table update in under 200 milliseconds.
- **SC-003**: After one successful sync, the site is fully usable (browsing, filtering, detail view) with the network connection disabled.
- **SC-004**: A first-time user can narrow 5,000+ funds to a shortlist of fewer than 20 using the filter panel in under 5 minutes, without consulting documentation.
- **SC-005**: Fund detail opens instantly on row click — no spinner, no delay — because all data is local.
- **SC-006**: Exported CSV and JSON files open correctly in standard spreadsheet and text-editor applications without data corruption or encoding errors.
- **SC-007**: Every computed metric displayed (returns, Sharpe ratio, drawdown) has its formula and data window visible without leaving the page.
- **SC-008**: The site is deployable to GitHub Pages by running a single command with no configuration changes required.

---

## Assumptions

- The target user is an individual retail investor, not a financial professional or developer.
- The site targets desktop and laptop browsers as the primary platform; mobile-responsive layout is a bonus but not required for the initial version.
- No authentication, login, or user account of any kind is needed; a single user per browser is assumed.
- The user has access to a modern browser (Chrome, Firefox, Safari, or Edge — 2022 or newer).
- Free, unauthenticated public APIs (AMFI NAVAll.txt and MFAPI India) provide sufficient fund data for the core use case.
- NAV history for risk metric computation will be downloaded on-demand via Full Sync; the table is still useful after Quick Sync alone.
- Portfolio tracking (units held, purchase price, P&L) is explicitly out of scope — this is a browsing and comparison tool only.
- Financial advice, buy/sell recommendations, and signals of any kind are out of scope.
- The tool does not need to support Internet Explorer or legacy browsers.
- Data exports are consumed by the user personally (spreadsheet, financial advisor sharing) — no formal data schema versioning is required for v1.
