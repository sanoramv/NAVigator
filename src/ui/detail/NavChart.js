/**
 * SVG NAV line chart with 1Y / 3Y / 5Y time window toggles and hover crosshair.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const VB_W   = 800;
const VB_H   = 200;
const MARGIN = { top: 12, right: 16, bottom: 28, left: 58 };
const CHART_W = VB_W - MARGIN.left - MARGIN.right;
const CHART_H = VB_H - MARGIN.top  - MARGIN.bottom;

const YEAR_MS  = { '1y': 1, '3y': 3, '5y': 5 };
const WINDOWS  = ['1y', '3y', '5y'];

function _svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

/**
 * @param {Object}  opts
 * @param {Element} opts.container - element to render the chart into
 * @returns {{ render(navHistory: Array, window: string): void }}
 */
export function NavChart({ container }) {
  let _history = null;
  let _window  = '1y';

  // ── Outer wrapper ─────────────────────────────────────────────────────────
  container.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'nav-chart';
  container.appendChild(wrap);

  // ── Time window buttons ────────────────────────────────────────────────────
  const btnRow = document.createElement('div');
  btnRow.className = 'nav-chart__btns';
  wrap.appendChild(btnRow);

  const _btns = {};
  for (const win of WINDOWS) {
    const btn = document.createElement('button');
    btn.textContent = win.toUpperCase();
    btn.className   = 'nav-chart__btn';
    btn.addEventListener('click', () => { _window = win; _updateBtns(); _draw(); });
    btnRow.appendChild(btn);
    _btns[win] = btn;
  }

  // ── SVG ────────────────────────────────────────────────────────────────────
  const svg = _svgEl('svg', {
    width:  '100%',
    height: VB_H,
    viewBox: `0 0 ${VB_W} ${VB_H}`,
    preserveAspectRatio: 'none',
  });
  wrap.appendChild(svg);

  // Grid + axes
  const gGrid  = _svgEl('g');
  const gXAxis = _svgEl('g');

  // NAV polyline
  const line = _svgEl('polyline', {
    fill:           'none',
    stroke:         'var(--accent)',
    'stroke-width': '1.5',
    'stroke-linejoin': 'round',
  });

  // Crosshair vertical line
  const crosshair = _svgEl('line', {
    y1:                String(MARGIN.top),
    y2:                String(MARGIN.top + CHART_H),
    stroke:            'var(--text-muted)',
    'stroke-width':    '1',
    'stroke-dasharray': '3 3',
  });
  crosshair.style.display = 'none';

  // Tooltip group
  const ttG    = _svgEl('g');
  const ttBg   = _svgEl('rect', { rx: '3', fill: 'var(--surface)', stroke: 'var(--border)', 'stroke-width': '0.5' });
  const ttDate = _svgEl('text', { 'font-size': '10', fill: 'var(--text)' });
  const ttNav  = _svgEl('text', { 'font-size': '10', fill: 'var(--accent)', 'font-weight': '600' });
  ttG.appendChild(ttBg);
  ttG.appendChild(ttDate);
  ttG.appendChild(ttNav);
  ttG.style.display = 'none';

  // Transparent overlay for mouse events (must be last = on top)
  const overlay = _svgEl('rect', {
    x:      String(MARGIN.left),
    y:      String(MARGIN.top),
    width:  String(CHART_W),
    height: String(CHART_H),
    fill:   'transparent',
  });
  overlay.style.cursor = 'crosshair';

  svg.appendChild(gGrid);
  svg.appendChild(gXAxis);
  svg.appendChild(line);
  svg.appendChild(crosshair);
  svg.appendChild(ttG);
  svg.appendChild(overlay);

  // ── Private helpers ───────────────────────────────────────────────────────
  function _updateBtns() {
    for (const [w, btn] of Object.entries(_btns)) {
      btn.classList.toggle('nav-chart__btn--active', w === _window);
      // Enable/disable based on available history depth
      if (_history) {
        const years     = YEAR_MS[w];
        const lastDate  = new Date(_history[_history.length - 1].date);
        const cutoff    = new Date(lastDate);
        cutoff.setFullYear(cutoff.getFullYear() - years);
        const cutoffStr = cutoff.toISOString().slice(0, 10);
        const hasData   = _history.some(h => h.date <= cutoffStr);
        btn.disabled    = !hasData;
      }
    }
  }

  function _filterWindow(win) {
    if (!_history || !_history.length) return [];
    const lastDate = new Date(_history[_history.length - 1].date);
    const cutoff   = new Date(lastDate);
    cutoff.setFullYear(cutoff.getFullYear() - YEAR_MS[win]);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return _history.filter(h => h.date >= cutoffStr);
  }

  function _draw() {
    const data = _filterWindow(_window);
    gGrid.innerHTML  = '';
    gXAxis.innerHTML = '';
    line.setAttribute('points', '');
    crosshair.style.display = 'none';
    ttG.style.display = 'none';
    if (!data.length) return;

    const times  = data.map(h => new Date(h.date).getTime());
    const navs   = data.map(h => h.nav);
    const tMin   = times[0];
    const tMax   = times[times.length - 1];
    const navMin = Math.min(...navs);
    const navMax = Math.max(...navs);
    const tRange = tMax - tMin || 1;
    const pad    = (navMax - navMin) * 0.1 || navMax * 0.05 || 1;
    const navLo  = navMin - pad;
    const navHi  = navMax + pad;
    const navRange = navHi - navLo;

    const xOf = t   => MARGIN.left + ((t - tMin) / tRange)   * CHART_W;
    const yOf = nav => MARGIN.top  + (1 - (nav - navLo) / navRange) * CHART_H;

    // ── Polyline ────────────────────────────────────────────────────────────
    const pts = data.map(h => `${xOf(new Date(h.date).getTime()).toFixed(1)},${yOf(h.nav).toFixed(1)}`);
    line.setAttribute('points', pts.join(' '));

    // ── Y-axis gridlines + labels (5 levels) ────────────────────────────────
    for (let i = 0; i <= 4; i++) {
      const navVal = navLo + (navRange / 4) * i;
      const y      = yOf(navVal);
      gGrid.appendChild(_svgEl('line', {
        x1: MARGIN.left, y1: y, x2: MARGIN.left + CHART_W, y2: y,
        stroke: 'var(--border)', 'stroke-width': '0.5',
      }));
      const lbl = _svgEl('text', {
        x: MARGIN.left - 4, y: y + 3.5,
        'font-size': '9', 'text-anchor': 'end', fill: 'var(--text-muted)',
      });
      lbl.textContent = '₹' + navVal.toFixed(navVal < 100 ? 2 : 0);
      gGrid.appendChild(lbl);
    }

    // ── X-axis year markers ─────────────────────────────────────────────────
    const startYr = new Date(tMin).getFullYear();
    const endYr   = new Date(tMax).getFullYear();
    for (let yr = startYr; yr <= endYr; yr++) {
      const t = new Date(yr, 0, 1).getTime();
      if (t < tMin || t > tMax) continue;
      const x = xOf(t);
      const lbl = _svgEl('text', {
        x, y: VB_H - MARGIN.bottom + 14,
        'font-size': '9', 'text-anchor': 'middle', fill: 'var(--text-muted)',
      });
      lbl.textContent = yr;
      gXAxis.appendChild(lbl);
    }

    // ── Mouse hover: crosshair + tooltip ────────────────────────────────────
    overlay.onmousemove = evt => {
      const rect   = svg.getBoundingClientRect();
      const scaleX = VB_W / rect.width;
      const svgX   = Math.max(MARGIN.left, Math.min(MARGIN.left + CHART_W, (evt.clientX - rect.left) * scaleX));
      const tAtX   = tMin + ((svgX - MARGIN.left) / CHART_W) * tRange;

      // Nearest data point by time
      let nearest = data[0], minD = Infinity;
      for (const h of data) {
        const d = Math.abs(new Date(h.date).getTime() - tAtX);
        if (d < minD) { minD = d; nearest = h; }
      }
      const cx = xOf(new Date(nearest.date).getTime());

      crosshair.setAttribute('x1', cx);
      crosshair.setAttribute('x2', cx);
      crosshair.style.display = '';

      // Tooltip — flip to left side near right edge
      const TT_W = 90, TT_H = 28;
      const ttX = cx > MARGIN.left + CHART_W - TT_W - 8 ? cx - TT_W - 6 : cx + 6;
      const ttY = MARGIN.top + 8;
      ttBg.setAttribute('x', ttX);
      ttBg.setAttribute('y', ttY);
      ttBg.setAttribute('width', TT_W);
      ttBg.setAttribute('height', TT_H);
      ttDate.setAttribute('x', ttX + 4); ttDate.setAttribute('y', ttY + 11);
      ttDate.textContent = nearest.date;
      ttNav.setAttribute('x', ttX + 4);  ttNav.setAttribute('y', ttY + 23);
      ttNav.textContent  = '₹ ' + nearest.nav.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
      ttG.style.display = '';
    };

    overlay.onmouseleave = () => {
      crosshair.style.display = 'none';
      ttG.style.display       = 'none';
    };
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    /**
     * Render the chart for the given NAV history array and initial window.
     * Pass null / empty array to hide the chart.
     *
     * @param {{ date: string, nav: number }[]} navHistory - ascending by date
     * @param {'1y'|'3y'|'5y'} [win]
     */
    render(navHistory, win = '1y') {
      if (!navHistory || !navHistory.length) {
        container.style.display = 'none';
        return;
      }
      container.style.display = '';
      _history = navHistory;
      _window  = win;
      _updateBtns();
      _draw();
    },
  };
}
