/**
 * Checkbox group with a "Select All / Clear" toggle.
 *
 * @param {Object}   opts
 * @param {Element}  opts.container - element to render into
 * @param {string[]} opts.options   - checkbox labels (may be empty for dynamic population)
 * @param {Function} opts.onchange  - called immediately with selected string[]
 * @returns {{ setValue(string[]): void, reset(): void, setOptions(string[]): void }}
 */
export function MultiCheck({ container, options, onchange, listMaxHeight }) {
  let _options  = options ?? [];
  let _selected = new Set();

  // ── DOM ────────────────────────────────────────────────────────────────
  const wrapper = document.createElement('div');
  wrapper.className = 'multicheck';

  const selectAllBtn = document.createElement('button');
  selectAllBtn.className = 'multicheck__select-all';
  selectAllBtn.type = 'button';
  wrapper.appendChild(selectAllBtn);

  const listEl = document.createElement('div');
  if (listMaxHeight) {
    listEl.style.maxHeight = listMaxHeight;
    listEl.style.overflowY = 'auto';
  }
  wrapper.appendChild(listEl);
  container.appendChild(wrapper);

  // ── Build ──────────────────────────────────────────────────────────────
  function _build() {
    listEl.innerHTML = '';
    _options.forEach(opt => {
      const item  = document.createElement('label');
      item.className = 'multicheck__item';

      const cb    = document.createElement('input');
      cb.type     = 'checkbox';
      cb.value    = opt;
      cb.checked  = _selected.has(opt);
      cb.addEventListener('change', () => {
        if (cb.checked) _selected.add(opt);
        else            _selected.delete(opt);
        _updateSelectAll();
        onchange?.([..._selected]);
      });

      item.appendChild(cb);
      item.appendChild(document.createTextNode(opt));
      listEl.appendChild(item);
    });
    _updateSelectAll();
  }

  function _updateSelectAll() {
    const allOn = _options.length > 0 && _options.every(o => _selected.has(o));
    selectAllBtn.textContent = allOn ? 'Clear all' : 'Select all';
  }

  selectAllBtn.addEventListener('click', () => {
    const allOn = _options.every(o => _selected.has(o));
    if (allOn) {
      _selected.clear();
    } else {
      _options.forEach(o => _selected.add(o));
    }
    _build();
    onchange?.([..._selected]);
  });

  _build();

  // ── Public API ─────────────────────────────────────────────────────────
  return {
    setValue(arr) {
      _selected = new Set(arr);
      _build();
    },
    reset() {
      _selected.clear();
      _build();
      onchange?.([]);
    },
    /** Replace the option list (called when fund data loads). */
    setOptions(newOptions) {
      _options = newOptions;
      _selected = new Set([..._selected].filter(s => _options.includes(s)));
      _build();
    },
  };
}
