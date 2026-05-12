/**
 * Debounced text search control wrapping an existing <input> element.
 *
 * @param {Object}      opts
 * @param {HTMLInputElement} opts.input    - existing input element to wrap
 * @param {Function}    opts.onchange - called with trimmed lowercase string after 200ms
 * @returns {{ reset(): void }}
 */
export function SearchBox({ input, onchange }) {
  let _timer = null;

  input.addEventListener('input', () => {
    clearTimeout(_timer);
    _timer = setTimeout(() => {
      onchange?.(input.value.trim().toLowerCase());
    }, 200);
  });

  return {
    reset() {
      clearTimeout(_timer);
      input.value = '';
      onchange?.('');
    },
  };
}
