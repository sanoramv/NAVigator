const AREA_ID = 'toast-area';

/**
 * Display a toast notification.
 *
 * @param {string} message
 * @param {'info'|'success'|'error'|'progress'} type
 * @param {number} durationMs  - ignored for type 'progress'; call the returned
 *                               dismiss() to remove it manually
 * @returns {() => void} dismiss — call to remove the toast early
 */
export function showToast(message, type = 'info', durationMs = 4000) {
  const area = document.getElementById(AREA_ID);
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.textContent = message;
  area.appendChild(el);

  const dismiss = () => el.remove();

  if (type !== 'progress') {
    setTimeout(dismiss, durationMs);
  }

  return dismiss;
}
