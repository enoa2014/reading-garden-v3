export function qs(sel, root = document) {
  return root.querySelector(sel);
}

export function qsa(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

export function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : String(text);
  return div.innerHTML;
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function isTouchLike() {
  return window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
}

export function isReducedMotion() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Render an empty state placeholder into a container.
 * @param {HTMLElement} container
 * @param {string} message
 */
export function renderEmptyState(container, message = "暂无内容") {
  if (!container) return;
  container.innerHTML = `
    <div class="rg-empty" role="status">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="9" y1="15" x2="15" y2="15"/>
      </svg>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

