import { qs } from "./dom.js";

function getFocusable(root) {
  if (!root) return [];
  const sel =
    'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
  return Array.from(root.querySelectorAll(sel)).filter((el) => el.offsetParent !== null);
}

export function createModal() {
  const modal = qs("#rgModal");
  const titleEl = qs("#rgModalTitle");
  const bodyEl = qs("#rgModalBody");
  const footEl = qs("#rgModalFoot");

  let lastActive = null;
  let onClose = null;

  function close() {
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (typeof onClose === "function") {
      try {
        onClose();
      } catch {
        // ignore
      }
    }
    onClose = null;
    if (lastActive && typeof lastActive.focus === "function") {
      lastActive.focus();
    }
    lastActive = null;
  }

  function open({ title = "内容", bodyHtml = "", footHtml = "", onClose: nextOnClose = null } = {}) {
    if (!modal || !titleEl || !bodyEl || !footEl) return;
    lastActive = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    onClose = typeof nextOnClose === "function" ? nextOnClose : null;
    titleEl.textContent = String(title || "内容");
    bodyEl.innerHTML = bodyHtml || "";
    footEl.innerHTML = footHtml || "";
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    // Focus first focusable element, otherwise the close button.
    const panel = modal.querySelector(".rg-modal__panel");
    const focusables = getFocusable(panel);
    const preferred = focusables[0] || modal.querySelector("[data-modal-close]");
    if (preferred && typeof preferred.focus === "function") {
      preferred.focus();
    }
  }

  function bind() {
    if (!modal) return;
    modal.addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      if (t.closest("[data-modal-close]")) {
        close();
      }
    });

    window.addEventListener("keydown", (e) => {
      if (!modal.classList.contains("is-open")) return;
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }

      if (e.key !== "Tab") return;
      const panel = modal.querySelector(".rg-modal__panel");
      const focusables = getFocusable(panel);
      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  bind();

  return { open, close };
}

