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

