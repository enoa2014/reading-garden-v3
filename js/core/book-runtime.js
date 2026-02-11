import { moduleIcon } from "./icons.js";
import { escapeHtml, qsa } from "./dom.js";

const DEFAULT_TIMEOUT_MS = 12000;
const SCRIPT_CACHE = new Map();

function withTimeout(promise, timeoutMs, message) {
  let timer = null;
  const ms = Number(timeoutMs) > 0 ? Number(timeoutMs) : DEFAULT_TIMEOUT_MS;
  return new Promise((resolve, reject) => {
    timer = window.setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (v) => {
        if (timer != null) window.clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        if (timer != null) window.clearTimeout(timer);
        reject(e);
      }
    );
  });
}

async function loadScriptOnce(url) {
  const abs = new URL(url, window.location.href).href;
  const existed = SCRIPT_CACHE.get(abs);
  if (existed) return existed;

  const p = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = abs;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error(`Failed to load script: ${abs}`));
    document.head.appendChild(script);
  });
  SCRIPT_CACHE.set(abs, p);
  return p;
}

export class BookRuntime {
  constructor(options) {
    this.options = {
      registryUrl: "",
      registryLoadTimeoutMs: DEFAULT_TIMEOUT_MS,
      moduleLoadTimeoutMs: DEFAULT_TIMEOUT_MS,
      dataLoadTimeoutMs: DEFAULT_TIMEOUT_MS,
      selectors: {
        main: "#runtimeMain",
        tabs: "#runtimeTabBar",
        themeToggle: "#themeToggle",
        teacherToggle: "#teacherToggle",
        title: "#runtimeTitle",
        subtitle: "#runtimeSubtitle",
        logo: "#runtimeLogo",
      },
      ...options,
    };

    this.registry = null;
    this.registryAbsUrl = "";

    this.activeModuleId = null;
    this.moduleState = new Map();

    this.sharedState = new Map();
    this.sharedSubscribers = new Map();

    this.themeController = null;
    this.teacherController = null;
  }

  async start({ modal } = {}) {
    this.modal = modal || null;
    this.registryAbsUrl = new URL(this.options.registryUrl, window.location.href).href;
    this.registry = await this.#loadRegistry();
    this.#normalizeRegistryModules();
    this.#applyBookMeta();
    this.#initTheme();
    this.#initTeacherMode();
    this.#bindToggles();
    this.#renderShell();

    const defaultId = this.#getDefaultModuleId();
    if (defaultId) {
      await this.activate(defaultId);
    }
  }

  async activate(moduleId, payload = null) {
    if (!this.registry) return;
    const normalizedId = String(moduleId || "").trim();
    if (!normalizedId) return;

    const isSame = this.activeModuleId === normalizedId;
    if (isSame && payload == null) return;

    const moduleConfig = this.registry.modules.find((m) => m && m.id === normalizedId);
    if (!moduleConfig) return;

    const prevId = this.activeModuleId;
    try {
      if (prevId && !isSame) {
        const prevState = this.moduleState.get(prevId);
        if (prevState?.impl?.destroy) {
          await prevState.impl.destroy(prevState.ctx);
        }
      }

      const state = await this.#ensureModuleLoaded(moduleConfig);
      await state.impl.render(state.ctx, payload);
    } catch (err) {
      console.error(`Failed to activate module: ${normalizedId}`, err);
      this.#renderModuleError(moduleConfig, err, payload);
    }

    this.activeModuleId = normalizedId;
    this.#updateActiveUI(normalizedId);

    // Move focus to the active panel for accessibility
    if (!isSame) {
      const activePanel = document.getElementById(`panel-${normalizedId}`);
      if (activePanel) {
        activePanel.setAttribute("tabindex", "-1");
        activePanel.focus({ preventScroll: true });
      }
    }
  }

  async #loadRegistry() {
    const res = await withTimeout(
      fetch(this.registryAbsUrl),
      this.options.registryLoadTimeoutMs,
      `加载书籍配置超时：${this.registryAbsUrl}`
    );
    if (!res.ok) throw new Error(`Failed to load registry: ${res.status}`);
    const data = await res.json();
    return data;
  }

  #normalizeRegistryModules() {
    if (!this.registry || !Array.isArray(this.registry.modules)) return;
    const modules = this.registry.modules.slice();

    const readingIndex = modules.findIndex((m) => m && m.id === "reading");
    if (readingIndex > 0) {
      const [reading] = modules.splice(readingIndex, 1);
      modules.unshift(reading);
    }

    // Only one active module: reading by default
    let hasActive = false;
    modules.forEach((m) => {
      if (!m || typeof m !== "object") return;
      if (m.active && !hasActive) {
        hasActive = true;
      } else {
        delete m.active;
      }
    });
    if (!hasActive && modules[0]) modules[0].active = true;

    this.registry.modules = modules;
  }

  #applyBookMeta() {
    const book = this.registry?.book || {};
    const id = String(book.id || "").trim();

    const titleEl = document.querySelector(this.options.selectors.title);
    const subtitleEl = document.querySelector(this.options.selectors.subtitle);
    const logoEl = document.querySelector(this.options.selectors.logo);

    if (titleEl && book.title) titleEl.textContent = book.title;
    if (subtitleEl && book.subtitle) subtitleEl.textContent = book.subtitle;

    if (logoEl) {
      // Avoid emoji marks: keep the header consistent with SVG icon system.
      const svg = moduleIcon("reading");
      if (svg) {
        logoEl.innerHTML = svg;
      } else {
        logoEl.textContent = "RG";
      }
    }

    if (id) {
      document.body.setAttribute("data-book", id);
    }

    if (book.themeClass) {
      document.body.classList.add(String(book.themeClass));
    }

    if (book.title) {
      document.title = `${book.title} - 阅读花园`;
    }
  }

  #initTheme() {
    const key = "rg:v3:theme";
    const attr = "data-theme";
    const defaultTheme = "light";

    const apply = (value) => {
      const next = value === "dark" ? "dark" : "light";
      document.documentElement.setAttribute(attr, next);
      try {
        localStorage.setItem(key, next);
      } catch {
        // ignore
      }
    };

    const current = (() => {
      try {
        return localStorage.getItem(key) || defaultTheme;
      } catch {
        return defaultTheme;
      }
    })();
    apply(current);

    this.themeController = {
      toggle: () => {
        const now = document.documentElement.getAttribute(attr) || defaultTheme;
        apply(now === "dark" ? "light" : "dark");
      },
      get: () => document.documentElement.getAttribute(attr) || defaultTheme,
    };
  }

  #initTeacherMode() {
    const key = "rg:v3:teacher";
    const apply = (value) => {
      const on = value === "1";
      document.body.classList.toggle("is-teacher", on);
      try {
        localStorage.setItem(key, on ? "1" : "0");
      } catch {
        // ignore
      }
    };

    const current = (() => {
      try {
        return localStorage.getItem(key) || "0";
      } catch {
        return "0";
      }
    })();

    apply(current);

    this.teacherController = {
      toggle: () => {
        const on = document.body.classList.contains("is-teacher");
        apply(on ? "0" : "1");
      },
      get: () => (document.body.classList.contains("is-teacher") ? "1" : "0"),
    };
  }

  #bindToggles() {
    const themeBtn = document.querySelector(this.options.selectors.themeToggle);
    if (themeBtn) themeBtn.addEventListener("click", () => this.themeController?.toggle?.());

    const teacherBtn = document.querySelector(this.options.selectors.teacherToggle);
    if (teacherBtn) teacherBtn.addEventListener("click", () => this.teacherController?.toggle?.());
  }

  #renderShell() {
    const tabsHost = document.querySelector(this.options.selectors.tabs);
    const mainHost = document.querySelector(this.options.selectors.main);
    if (!tabsHost || !mainHost) return;

    tabsHost.innerHTML = "";
    mainHost.innerHTML = "";

    tabsHost.setAttribute("role", "tablist");

    this.registry.modules.forEach((mod) => {
      const tabBtn = document.createElement("button");
      tabBtn.type = "button";
      tabBtn.className = "rg-tab";
      tabBtn.dataset.moduleId = mod.id;
      tabBtn.setAttribute("role", "tab");
      tabBtn.setAttribute("aria-controls", `panel-${mod.id}`);
      tabBtn.setAttribute("aria-selected", mod.active ? "true" : "false");
      tabBtn.innerHTML = `
        <span class="rg-icon" aria-hidden="true">${moduleIcon(mod.id)}</span>
        <span class="rg-tab__label">${escapeHtml(mod.title || mod.id)}</span>
      `;
      tabBtn.addEventListener("click", () => this.activate(mod.id));
      tabBtn.addEventListener("keydown", (e) => this.#onTabKeydown(e, mod.id));
      tabsHost.appendChild(tabBtn);

      const section = document.createElement("section");
      section.className = `rg-panel${mod.active ? " rg-panel--active" : ""}`;
      section.id = `panel-${mod.id}`;
      section.setAttribute("role", "tabpanel");
      section.setAttribute("aria-labelledby", `tab-${mod.id}`);
      section.setAttribute("aria-live", "polite");
      section.innerHTML = '<div class="rg-loading">加载中...</div>';
      mainHost.appendChild(section);
    });

    // Give tabs stable IDs for aria-labelledby
    qsa(".rg-tab", tabsHost).forEach((btn) => {
      const id = String(btn.dataset.moduleId || "");
      if (id) btn.id = `tab-${id}`;
    });
  }

  #onTabKeydown(e, moduleId) {
    const tabsHost = document.querySelector(this.options.selectors.tabs);
    if (!tabsHost) return;
    const tabs = qsa(".rg-tab", tabsHost);
    const currentIndex = tabs.findIndex((btn) => btn.dataset.moduleId === moduleId);
    if (currentIndex < 0) return;

    const key = e.key;
    if (key !== "ArrowLeft" && key !== "ArrowRight" && key !== "Home" && key !== "End" && key !== "Enter" && key !== " ") {
      return;
    }
    e.preventDefault();

    if (key === "Enter" || key === " ") {
      this.activate(moduleId);
      return;
    }

    let nextIndex = currentIndex;
    if (key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
    if (key === "Home") nextIndex = 0;
    if (key === "End") nextIndex = tabs.length - 1;

    const next = tabs[nextIndex];
    if (next) {
      next.focus();
      this.activate(next.dataset.moduleId);
    }
  }

  #getDefaultModuleId() {
    const active = this.registry.modules.find((m) => m.active);
    if (active) return active.id;
    return this.registry.modules[0]?.id || null;
  }

  async #ensureModuleLoaded(moduleConfig) {
    const existed = this.moduleState.get(moduleConfig.id);
    if (existed) return existed;

    const entryUrl = new URL(moduleConfig.entry, this.registryAbsUrl).href;
    const mod = await withTimeout(import(entryUrl), this.options.moduleLoadTimeoutMs, `Module load timeout: ${moduleConfig.id}`);
    const impl = mod.default;
    if (!impl || typeof impl.render !== "function") {
      throw new Error(`Invalid module: ${moduleConfig.id}`);
    }

    const panelEl = document.getElementById(`panel-${moduleConfig.id}`);
    const ctx = this.#createModuleContext(moduleConfig, panelEl);

    if (impl.init) {
      await impl.init(ctx);
    }

    const state = { impl, ctx };
    this.moduleState.set(moduleConfig.id, state);
    return state;
  }

  #renderModuleError(moduleConfig, err, payload) {
    const panelEl = document.getElementById(`panel-${moduleConfig.id}`);
    if (!panelEl) return;
    const message = escapeHtml(err?.message || String(err || "Unknown error"));
    panelEl.innerHTML = `
      <div class="rg-card" style="padding:16px;">
        <h3 style="margin:0 0 10px;font-family:var(--font-heading);">模块加载失败</h3>
        <p style="margin:0 0 10px;color:var(--text-secondary);">模块：${escapeHtml(moduleConfig.title || moduleConfig.id)}</p>
        <pre style="margin:0 0 14px;white-space:pre-wrap;color:var(--text-secondary);">${message}</pre>
        <button type="button" class="rg-btn rg-btn--primary" data-action="retry">重试</button>
      </div>
    `;

    panelEl.querySelector('[data-action="retry"]')?.addEventListener("click", async () => {
      const state = this.moduleState.get(moduleConfig.id);
      if (state?.impl?.destroy) {
        try {
          await state.impl.destroy(state.ctx);
        } catch {
          // ignore
        }
      }
      this.moduleState.delete(moduleConfig.id);
      panelEl.innerHTML = '<div class="rg-loading">重试中...</div>';
      await this.activate(moduleConfig.id, payload);
    });
  }

  #createModuleContext(moduleConfig, panelEl) {
    const dataBase = new URL(".", this.registryAbsUrl);
    const projectBase = new URL("../../../", this.registryAbsUrl);
    const pageBase = window.location.href;
    return {
      registry: this.registry,
      book: this.registry.book,
      module: moduleConfig,
      panelEl,

      modal: this.modal,

      activateModule: (id, payload) => this.activate(id, payload),
      getModuleConfig: (id) => this.registry.modules.find((m) => m.id === id) || null,

      setSharedState: (k, v) => this.#setSharedState(k, v),
      getSharedState: (k, fb = null) => this.#getSharedState(k, fb),
      subscribeSharedState: (k, fn) => this.#subscribeSharedState(k, fn),

      resolvePath: (p) => {
        if (!p) return "";
        const s = String(p).trim();
        // Check for absolute URL or data URI
        if (/^(https?:)?\/\//.test(s) || s.startsWith("data:")) return s;
        if (s.startsWith("/")) return new URL(s, window.location.origin).href;

        // Assets are stored at project root `assets/` while registries live under `data/<bookId>/`.
        // Normalize any `../assets/...` / `./assets/...` / `assets/...` to `${projectBase}/assets/...`
        // Use regex to ensure "assets/" is a proper path segment (preceded by start, `/`, or `./`)
        const assetMatch = s.match(/(^|[./])assets\//);
        if (assetMatch) {
          const assetIndex = s.indexOf("assets/", assetMatch.index);
          return new URL(s.slice(assetIndex), projectBase).href;
        }

        return new URL(s, dataBase).href;
      },

      fetchJSON: async (p) => {
        const url = new URL(String(p || ""), dataBase).href;
        const res = await withTimeout(
          fetch(url),
          this.options.dataLoadTimeoutMs,
          `加载数据超时：${url}`
        );
        if (!res.ok) throw new Error(`Failed to load json: ${url}`);
        return await res.json();
      },

      loadScriptOnce: async (p) => {
        const url = new URL(String(p || ""), pageBase).href;
        return await loadScriptOnce(url);
      },
    };
  }

  #setSharedState(key, value) {
    const k = String(key || "").trim();
    if (!k) return;
    const prev = this.sharedState.get(k);
    if (Object.is(prev, value)) return;
    this.sharedState.set(k, value);
    const listeners = this.sharedSubscribers.get(k);
    if (!listeners || !listeners.size) return;
    listeners.forEach((fn) => {
      try {
        fn(value, prev);
      } catch (e) {
        console.error(`Shared state listener failed: ${k}`, e);
      }
    });
  }

  #getSharedState(key, fallback = null) {
    const k = String(key || "").trim();
    if (!k || !this.sharedState.has(k)) return fallback;
    return this.sharedState.get(k);
  }

  #subscribeSharedState(key, listener) {
    const k = String(key || "").trim();
    if (!k || typeof listener !== "function") return () => { };
    let set = this.sharedSubscribers.get(k);
    if (!set) {
      set = new Set();
      this.sharedSubscribers.set(k, set);
    }
    set.add(listener);
    return () => {
      const cur = this.sharedSubscribers.get(k);
      if (!cur) return;
      cur.delete(listener);
      if (!cur.size) this.sharedSubscribers.delete(k);
    };
  }

  #updateActiveUI(moduleId) {
    const tabsHost = document.querySelector(this.options.selectors.tabs);
    if (!tabsHost) return;
    qsa(".rg-tab", tabsHost).forEach((btn) => {
      const on = btn.dataset.moduleId === moduleId;
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    qsa(".rg-panel", document).forEach((panel) => {
      panel.classList.toggle("rg-panel--active", panel.id === `panel-${moduleId}`);
    });
  }
}
