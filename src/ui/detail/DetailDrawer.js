import { getNavHistory, getUserData, putUserData } from '../../db/db.js';
import { state }                                    from '../../store/state.js';
import { NavChart }                                  from './NavChart.js';
import { MetricTable }                               from './MetricTable.js';

const AMFI_NAV_URL = code => `https://www.amfiindia.com/nav-history?mfID=${code}`;

/**
 * Fund detail drawer — slides in from the right with chart, metrics, notes, star toggle.
 *
 * @param {Object}   opts
 * @param {Element}  opts.container      - #detail-drawer element
 * @param {Function} [opts.onStarToggle] - (schemeCode, starred) → void; called after star write
 * @returns {{ open(fund: Object): void, close(): void }}
 */
export function DetailDrawer({ container, onStarToggle }) {
  let _fund    = null;
  let _notesTm = null;  // debounce timer for notes autosave

  // ── Build inner structure (once) ─────────────────────────────────────────
  container.innerHTML = `
    <div class="drawer__header">
      <div class="drawer__title-row">
        <button class="drawer__star" aria-label="Toggle starred">☆</button>
        <div class="drawer__name-wrap">
          <a class="drawer__amfi-link" target="_blank" rel="noopener noreferrer"></a>
          <span class="drawer__code"></span>
        </div>
        <button class="drawer__close" aria-label="Close detail drawer">✕</button>
      </div>
      <div class="drawer__meta-row">
        <span class="drawer__nav-badge"></span>
        <span class="drawer__badges"></span>
      </div>
    </div>

    <div class="drawer__chart-wrap"></div>

    <div class="drawer__metrics"></div>

    <div class="drawer__notes-wrap">
      <label class="drawer__notes-label" for="drawer-notes">Notes</label>
      <textarea id="drawer-notes" class="drawer__notes" rows="4" placeholder="Add personal notes…"></textarea>
    </div>
  `;

  // ── Element references ────────────────────────────────────────────────────
  const starBtn    = container.querySelector('.drawer__star');
  const amfiLink   = container.querySelector('.drawer__amfi-link');
  const codeSpan   = container.querySelector('.drawer__code');
  const closeBtn   = container.querySelector('.drawer__close');
  const navBadge   = container.querySelector('.drawer__nav-badge');
  const badgesWrap = container.querySelector('.drawer__badges');
  const chartWrap  = container.querySelector('.drawer__chart-wrap');
  const metricsEl  = container.querySelector('.drawer__metrics');
  const notesTA    = container.querySelector('.drawer__notes');

  const chart  = NavChart({ container: chartWrap });
  const mTable = MetricTable({ container: metricsEl });

  // ── Close ─────────────────────────────────────────────────────────────────
  function _close() {
    container.classList.remove('open');
    _fund = null;
    clearTimeout(_notesTm);
  }

  closeBtn.addEventListener('click', _close);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && container.classList.contains('open')) _close();
  });

  // ── Star toggle ────────────────────────────────────────────────────────────
  starBtn.addEventListener('click', async () => {
    if (!_fund) return;
    const newStarred = !_fund.starred;
    _fund.starred = newStarred;
    starBtn.textContent = newStarred ? '★' : '☆';
    starBtn.classList.toggle('drawer__star--active', newStarred);

    // Update in state.allFunds so filter re-runs correctly
    const inState = state.allFunds.find(f => f.schemeCode === _fund.schemeCode);
    if (inState) inState.starred = newStarred;

    // Persist to IndexedDB (merge notes so we don't overwrite them)
    const existing = (await getUserData(_fund.schemeCode)) ?? {};
    await putUserData({ ...existing, schemeCode: _fund.schemeCode, starred: newStarred });

    onStarToggle?.(_fund.schemeCode, newStarred);
  });

  // ── Notes autosave (500ms debounce) ───────────────────────────────────────
  notesTA.addEventListener('input', () => {
    clearTimeout(_notesTm);
    _notesTm = setTimeout(async () => {
      if (!_fund) return;
      const notes = notesTA.value;
      _fund.notes = notes;
      const inState = state.allFunds.find(f => f.schemeCode === _fund.schemeCode);
      if (inState) inState.notes = notes;
      const existing = (await getUserData(_fund.schemeCode)) ?? {};
      await putUserData({ ...existing, schemeCode: _fund.schemeCode, notes });
    }, 500);
  });

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    async open(fund) {
      _fund = fund;
      clearTimeout(_notesTm);

      // ── Header ─────────────────────────────────────────────────────────
      amfiLink.textContent = fund.schemeName;
      amfiLink.href        = AMFI_NAV_URL(fund.schemeCode);
      codeSpan.textContent = `Code: ${fund.schemeCode}`;

      starBtn.textContent = fund.starred ? '★' : '☆';
      starBtn.classList.toggle('drawer__star--active', !!fund.starred);

      navBadge.textContent = fund.navCurrent != null
        ? `₹ ${fund.navCurrent.toLocaleString('en-IN', { minimumFractionDigits: 4 })}  (${fund.navDate ?? ''})`
        : '';

      // Category badges
      badgesWrap.innerHTML = '';
      for (const label of [fund.category, fund.subCategory].filter(Boolean)) {
        const badge = document.createElement('span');
        badge.className   = 'drawer__badge';
        badge.textContent = label;
        badgesWrap.appendChild(badge);
      }

      // ── Slide open ─────────────────────────────────────────────────────
      container.classList.add('open');

      // ── NAV chart (async DB load) ───────────────────────────────────────
      const history = await getNavHistory(fund.schemeCode);
      chart.render(history?.length ? history : null, '1y');

      // ── Metric tables ───────────────────────────────────────────────────
      mTable.render(fund);

      // ── Notes ────────────────────────────────────────────────────────────
      const userData = await getUserData(fund.schemeCode);
      notesTA.value  = userData?.notes ?? fund.notes ?? '';
    },

    close: _close,
  };
}
