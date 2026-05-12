/**
 * Dual-handle range slider.
 *
 * @param {Object}   opts
 * @param {Element}  opts.container - element to render into
 * @param {number}   opts.min       - absolute minimum value
 * @param {number}   opts.max       - absolute maximum value
 * @param {number}   opts.step      - slider step
 * @param {Function} opts.onChange  - called with {min, max} after 1 animation frame debounce
 * @returns {{ setValue(min,max): void, reset(): void }}
 */
export function RangeSlider({ container, min, max, step, onChange }) {
  // ── DOM ────────────────────────────────────────────────────────────────
  const wrapper = document.createElement('div');
  wrapper.className = 'range-slider';

  const inputsWrap = document.createElement('div');
  inputsWrap.className = 'range-slider__inputs';

  const track = document.createElement('div');
  track.className = 'range-slider__track';

  const fill = document.createElement('div');
  fill.className = 'range-slider__fill';
  track.appendChild(fill);

  const inputMin = _makeInput(min, max, step, min);
  const inputMax = _makeInput(min, max, step, max);

  inputsWrap.appendChild(track);
  inputsWrap.appendChild(inputMin);
  inputsWrap.appendChild(inputMax);

  const labels = document.createElement('div');
  labels.className = 'range-slider__labels';
  const lblMin = document.createElement('span');
  const lblMax = document.createElement('span');
  labels.appendChild(lblMin);
  labels.appendChild(lblMax);

  wrapper.appendChild(inputsWrap);
  wrapper.appendChild(labels);
  container.appendChild(wrapper);

  // ── State ──────────────────────────────────────────────────────────────
  let _min = min;
  let _max = max;
  let _raf = null;

  _updateFill();

  // ── Listeners ──────────────────────────────────────────────────────────
  inputMin.addEventListener('input', () => {
    _min = Math.min(Number(inputMin.value), _max - step);
    inputMin.value = _min;
    _updateFill();
    _scheduleChange();
  });

  inputMax.addEventListener('input', () => {
    _max = Math.max(Number(inputMax.value), _min + step);
    inputMax.value = _max;
    _updateFill();
    _scheduleChange();
  });

  // ── Private helpers ────────────────────────────────────────────────────
  function _updateFill() {
    const range = max - min;
    const pMin  = (((_min - min) / range) * 100).toFixed(1);
    const pMax  = (((_max - min) / range) * 100).toFixed(1);
    fill.style.left  = pMin + '%';
    fill.style.width = (pMax - pMin) + '%';
    lblMin.textContent = _min;
    lblMax.textContent = _max;
  }

  function _scheduleChange() {
    if (_raf) cancelAnimationFrame(_raf);
    _raf = requestAnimationFrame(() => {
      _raf = null;
      onChange?.({ min: _min, max: _max });
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────
  return {
    setValue(newMin, newMax) {
      _min = newMin;
      _max = newMax;
      inputMin.value = newMin;
      inputMax.value = newMax;
      _updateFill();
    },
    reset() {
      this.setValue(min, max);
      onChange?.({ min, max });
    },
  };
}

function _makeInput(min, max, step, value) {
  const el   = document.createElement('input');
  el.type    = 'range';
  el.min     = min;
  el.max     = max;
  el.step    = step;
  el.value   = value;
  return el;
}
