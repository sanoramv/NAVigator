import { FILTERS }               from '../../config/filters.js';
import { state, setFilters }     from '../../store/state.js';
import { RangeSlider }           from './controls/RangeSlider.js';
import { MultiCheck }            from './controls/MultiCheck.js';

/**
 * Collapsible filter sidebar.
 *
 * @param {Object}   opts
 * @param {Element}  opts.container       - #filter-panel element
 * @param {Function} opts.onFiltersChange - called after any filter change; caller
 *                                          runs applyFilters + VirtualTable.refresh()
 * @returns {{ resetAll(): void, repopulateDynamic(): void }}
 */
export function FilterPanel({ container, onFiltersChange }) {
  // ── Controls registry ────────────────────────────────────────────────────
  // Maps filter key → control object (for reset and dynamic repopulation)
  const _controls = {};

  // ── Header ───────────────────────────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'filter-panel__header';

  const title = document.createElement('span');
  title.className   = 'filter-panel__title';
  title.textContent = 'Filters';

  const collapseBtn = document.createElement('button');
  collapseBtn.className = 'filter-panel__toggle toolbar__btn--icon';
  collapseBtn.textContent = '‹';
  collapseBtn.setAttribute('aria-label', 'Collapse filter panel');
  collapseBtn.addEventListener('click', () => {
    const collapsed = container.classList.toggle('collapsed');
    collapseBtn.textContent = collapsed ? '›' : '‹';
    collapseBtn.setAttribute('aria-label', collapsed ? 'Expand filter panel' : 'Collapse filter panel');
  });

  header.appendChild(title);
  header.appendChild(collapseBtn);
  container.appendChild(header);

  // ── Build one section per filter definition ───────────────────────────────
  for (const filterDef of FILTERS) {
    const section = document.createElement('div');
    section.className = 'filter-section';

    const label = document.createElement('span');
    label.className   = 'filter-section__label';
    label.textContent = filterDef.label;
    section.appendChild(label);

    const ctrlWrap = document.createElement('div');
    section.appendChild(ctrlWrap);

    if (filterDef.type === 'toggle') {
      // ── Toggle (starredOnly) ──────────────────────────────────────────
      const lbl = document.createElement('label');
      lbl.className = 'filter-toggle';

      const cb  = document.createElement('input');
      cb.type   = 'checkbox';
      cb.checked = state.filters[filterDef.stateKey] === true;
      cb.addEventListener('change', () => {
        setFilters({ [filterDef.stateKey]: cb.checked });
        onFiltersChange?.();
      });

      lbl.appendChild(cb);
      lbl.appendChild(document.createTextNode(' ' + filterDef.label));
      ctrlWrap.appendChild(lbl);

      _controls[filterDef.key] = {
        reset() { cb.checked = false; },
      };

    } else if (filterDef.type === 'multicheck') {
      // ── MultiCheck ───────────────────────────────────────────────────
      const opts = filterDef.options.length > 0
        ? filterDef.options
        : _dynamicOptions(filterDef.stateKey);

      const ctrl = MultiCheck({
        container:     ctrlWrap,
        options:       opts,
        listMaxHeight: filterDef.options.length === 0 ? '200px' : undefined,
        onchange:      selected => {
          setFilters({ [filterDef.stateKey]: selected });
          onFiltersChange?.();
        },
      });
      _controls[filterDef.key] = ctrl;

    } else if (filterDef.type === 'range') {
      // ── RangeSlider ──────────────────────────────────────────────────
      const ctrl = RangeSlider({
        container: ctrlWrap,
        min:       filterDef.min,
        max:       filterDef.max,
        step:      filterDef.step,
        onChange:  ({ min, max }) => {
          // Only activate the filter if handles have moved off extremes
          const minActive = min > filterDef.min;
          const maxActive = max < filterDef.max;
          setFilters({
            [filterDef.stateKey + 'Min']: minActive ? min : null,
            [filterDef.stateKey + 'Max']: maxActive ? max : null,
          });
          onFiltersChange?.();
        },
      });
      _controls[filterDef.key] = ctrl;
    }

    container.appendChild(section);
  }

  // ── Reset All button ──────────────────────────────────────────────────────
  const resetBtn = document.createElement('button');
  resetBtn.textContent = 'Reset all filters';
  resetBtn.className   = 'btn-reset-all';
  resetBtn.addEventListener('click', () => _resetAll());
  container.appendChild(resetBtn);

  // ── Private helpers ───────────────────────────────────────────────────────
  function _dynamicOptions(stateKey) {
    const vals = new Set();
    state.allFunds.forEach(f => { if (f[stateKey]) vals.add(f[stateKey]); });
    return [...vals].sort();
  }

  function _resetAll() {
    for (const ctrl of Object.values(_controls)) ctrl.reset?.();
    setFilters({
      search:         '',
      category:       [],
      subCategory:    [],
      amcName:        [],
      return1yMin:    null, return1yMax:    null,
      return3yMin:    null, return3yMax:    null,
      return5yMin:    null, return5yMax:    null,
      stdDev1yMin:    null, stdDev1yMax:    null,
      sharpe1yMin:    null, sharpe1yMax:    null,
      maxDrawdownMin: null, maxDrawdownMax: null,
      starredOnly:    false,
    });
    onFiltersChange?.();
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    resetAll: _resetAll,

    /** Re-populate dynamic MultiCheck options after a sync loads new fund data. */
    repopulateDynamic() {
      for (const filterDef of FILTERS) {
        if (filterDef.type === 'multicheck' && filterDef.options.length === 0) {
          _controls[filterDef.key]?.setOptions?.(_dynamicOptions(filterDef.stateKey));
        }
      }
    },
  };
}
