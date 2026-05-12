<!--
SYNC IMPACT REPORT
==================
Version change: [template/unpopulated] → 1.0.0
Modified principles: n/a (first population from template)
Added sections:
  - Core Principles (7 principles)
  - Scope Boundaries
  - Data Sources & Technology Philosophy
  - Governance
Removed sections: n/a
Templates reviewed:
  ✅ .specify/templates/plan-template.md — Constitution Check placeholder retained; gates now derivable from the 7 principles below
  ✅ .specify/templates/spec-template.md — no principle-specific constraints; generic requirement structure remains valid
  ✅ .specify/templates/tasks-template.md — task phases and parallelism guidance unchanged; no principle-driven task types were added or removed
  ✅ CONSTITUTION.md (project root) — authoritative narrative document; this file is the machine-readable complement; no conflicts
Deferred items: none
-->

# MutualLens — Indian Mutual Fund Knowledge Base Constitution

> *"The investor's job is not to predict the market, but to understand what they own."*

## Core Principles

### I. Investor-First Decision Making

Every feature, filter, column, label, and default view MUST answer the question:
*"Does this help the investor make a better decision?"*

- Data points that do not directly serve investor decision-making MUST NOT appear in the UI.
- Features that add visual complexity without proportional decision value are prohibited by default.
- Opinionated defaults are preferred over neutral dumps; the tool takes the investor's side, not the data vendor's.

**Rationale**: The primary failure mode of financial tools is information overload that masquerades as helpfulness. Every addition must justify itself against investor utility, not feature completeness.

### II. Local-Only Data Storage

The application MUST run entirely in the browser with zero server-side components.

- No backend server, no database, no login, no account of any kind.
- All persisted data MUST reside on the user's own machine (IndexedDB / localStorage).
- The user controls when data is fetched and updated; no background sync runs without explicit user action.
- The application MUST function fully offline once data has been downloaded at least once.

**Rationale**: Requiring a server or account creates friction, privacy risk, and a single point of failure. Local-first removes all three barriers while preserving full functionality.

### III. Zero Lock-In

The project MUST remain fully open and replaceable at all times.

- Source code MUST be published under the MIT License.
- All data MUST come from free, unauthenticated, public APIs — no paid tiers, no vendor accounts.
- Users MUST be able to export all their data (filters, notes, snapshots) as portable JSON at any time.
- If any upstream API becomes unavailable, the application MUST degrade gracefully using cached data and display a clear warning rather than failing silently.

**Rationale**: Lock-in via proprietary APIs or closed formats is incompatible with a tool designed for individual investors with no budget. Zero lock-in is a first-class constraint, not a nice-to-have.

### IV. Simple GitHub Distribution

The onboarding path from zero to productive MUST complete in under 60 seconds.

- `git clone <repo> && npm install && npm run dev` MUST be the complete setup sequence — no additional steps.
- No environment variables, no API keys, no external accounts, and no system-level dependencies beyond Node.js are required.
- GitHub Pages deployment MUST work out of the box via a single command (`npm run deploy`).
- Breaking changes to the setup sequence MUST be treated as major version changes and documented prominently.

**Rationale**: The target user may not be a developer. If the tool cannot be running in under 60 seconds of cloning, it will not be used. Simplicity of distribution is a reliability constraint.

### V. Honest About Data

The application MUST never present data in a way that obscures its freshness, origin, or derivation.

- Every data panel MUST display a last-sync timestamp, per data source.
- Every computed metric (rolling returns, Sharpe ratio, standard deviation, etc.) MUST display its formula and the data window used, inline or via a stable tooltip — not buried in documentation.
- Missing or incomplete data MUST be labelled explicitly (e.g., "N/A — data unavailable") and MUST NOT be silently omitted, zeroed, or interpolated.
- Data source URLs MUST be surfaced in the UI so users can verify independently.

**Rationale**: Financial data without provenance is misleading. Displaying freshness and formulas is not optional transparency — it is a prerequisite for the investor to trust and act on the output.

### VI. Clarity Over Completeness

Fewer well-labelled fields MUST be preferred over many confusing ones.

- The default table view MUST show ≤15 columns, each with a plain-language label (no raw API field names).
- Filters MUST be opinionated and meaningful — not an exhaustive dump of every available field.
- The default view MUST be immediately useful with zero configuration by a first-time user.
- Adding a new column or filter requires explicit justification against Principle I (Investor-First).

**Rationale**: Completeness for its own sake is a common failure mode in data tools. An investor facing 50 unlabelled columns will use none of them. Ten well-chosen, clearly labelled fields will be used every time.

### VII. Respectful of Performance

The application MUST meet quantitative performance targets at all times, not just at launch.

- **Filter latency**: Filtering 5,000+ fund rows MUST respond in under 200 ms on an average modern laptop (mid-range CPU, no GPU acceleration assumed).
- **Cold load**: Initial page load (no cached data) MUST complete in under 2 seconds on a standard broadband connection.
- **Sync non-blocking**: All data sync operations MUST run in the background (Web Worker or equivalent) and MUST NOT block or jank the UI thread.
- Performance regressions that breach these thresholds MUST be treated as bugs, not backlog items.

**Rationale**: A slow filter on a 5,000-row table destroys the exploration workflow that is the core use case. Performance targets are constitutionally binding so they cannot be traded away under delivery pressure.

## Scope Boundaries

### In Scope

- Browsing, filtering, sorting, and comparing Indian mutual fund schemes
- Syncing NAV, fund metadata, and category data from public, unauthenticated APIs
- Displaying computed metrics (returns, risk ratios) derived from downloaded data
- Exporting filtered fund lists and personal notes as CSV or JSON
- Running entirely as a static site on GitHub Pages

### Out of Scope (by constitution — do not implement without formally amending this document)

- Portfolio tracking (units held, purchase price, P&L calculations)
- Transaction history or brokerage/demat integration
- Any form of user authentication, accounts, or cloud sync
- Financial advice, buy/sell recommendations, or signals of any kind
- Payment, subscription, or premium feature tiers
- Native mobile app (web-responsive browser experience is sufficient)

Any feature touching an out-of-scope area MUST be blocked at spec review and MUST trigger a constitution amendment proposal before work begins.

## Data Sources & Technology Philosophy

### Approved Data Sources

| Source | Purpose | Endpoint |
|--------|---------|----------|
| MFAPI India | Fund list, NAV history | `https://api.mfapi.in/mf` |
| AMFI India | Official scheme master, AUM | `https://www.amfiindia.com/spages/NAVAll.txt` |

All data sources MUST be free and require no authentication. New sources require a constitution amendment to be added. If a source changes its terms or goes offline, the application MUST degrade gracefully.

### Technology Philosophy

- **No magic frameworks**: Prefer tools a moderately experienced developer can read without consulting documentation.
- **Vanilla-first**: Use a framework only when it genuinely reduces complexity, not for familiarity or ecosystem reasons.
- **Progressive enhancement**: The fund table MUST be readable and useful before JS enhancements load.
- **Accessibility**: All filters and table interactions MUST be keyboard-navigable and screen-reader compatible.
- **Rich comments**: Every user-configurable file (filter config, column config) MUST be richly commented so a non-developer can modify it safely.

## Governance

This constitution is the highest-authority document in the project. It supersedes all other practices, conventions, and feature requests.

**Amendment procedure**:
1. Open a GitHub Discussion with the label `constitution-amendment`.
2. State the principle being amended, the proposed change, and the rationale.
3. Changes that remove or fundamentally redefine a principle require a MAJOR version bump.
4. Changes that add a new principle or materially expand guidance require a MINOR version bump.
5. Clarifications, wording, and non-semantic refinements require a PATCH bump.
6. No amendment may violate Principles I–VII without explicit community consensus.

**Compliance review**:
- Every feature specification MUST include a Constitution Check section in its plan, citing which principles the feature satisfies or is exempted from (with justification).
- Any PR introducing a feature that conflicts with a principle without a matching amendment MUST be rejected at review.
- Performance benchmarks (Principle VII) MUST be validated in CI on every merge to main.

**Version**: 1.0.0 | **Ratified**: 2026-05-12 | **Last Amended**: 2026-05-12
