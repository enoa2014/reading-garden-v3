import { escapeHtml } from "../core/dom.js";

function normalizeScenes(raw) {
  if (raw && Array.isArray(raw.scenes)) return raw.scenes;
  if (Array.isArray(raw)) return raw;
  return [];
}

function renderSceneCard(ctx, s) {
  const id = escapeHtml(String(s?.id || ""));
  const name = escapeHtml(String(s?.name || "场景"));
  const desc = escapeHtml(String(s?.description || ""));
  const imgRaw = String(s?.image || "").trim();
  const img = imgRaw ? ctx.resolvePath(imgRaw) : "";
  return `
    <button type="button" class="rg-scenecard" data-action="open-scene" data-id="${id}">
      ${img ? `<img class="rg-scenecard__img" src="${escapeHtml(img)}" alt="" loading="lazy">` : ""}
      <span class="rg-scenecard__body">
        <span class="rg-scenecard__name">${name}</span>
        <span class="rg-scenecard__desc">${desc}</span>
      </span>
    </button>
  `;
}

function renderSceneModal(ctx, s) {
  const name = escapeHtml(String(s?.name || "场景"));
  const imgRaw = String(s?.image || "").trim();
  const img = imgRaw ? ctx.resolvePath(imgRaw) : "";
  const desc = escapeHtml(String(s?.description || ""));
  const events = Array.isArray(s?.events) ? s.events : [];
  const discussion = Array.isArray(s?.discussion) ? s.discussion : [];

  return `
    <div class="rg-scene">
      ${img ? `<img class="rg-scene__img" src="${escapeHtml(img)}" alt="" loading="lazy">` : ""}
      ${desc ? `<p class="rg-scene__desc">${desc}</p>` : ""}

      ${events.length ? `
        <section class="rg-scene__sec">
          <h3>关键事件</h3>
          <ul>
            ${events.map((e) => `<li>${escapeHtml(String(e))}</li>`).join("")}
          </ul>
        </section>
      ` : ""}

      ${discussion.length ? `
        <section class="rg-scene__sec">
          <h3>讨论引导</h3>
          <ol>
            ${discussion.map((d) => `<li>${escapeHtml(String(d?.question || ""))}</li>`).join("")}
          </ol>
        </section>
      ` : ""}
    </div>
  `;
}

export default {
  async init(ctx) {
    ctx.state = { scenes: [], onClick: null };
  },

  async render(ctx) {
    if (!ctx.state.scenes.length) {
      const raw = await ctx.fetchJSON(ctx.module.data || "scenes.json");
      ctx.state.scenes = normalizeScenes(raw);
    }

    ctx.panelEl.innerHTML = `
      <div class="rg-modulehead">
        <h2>场景化思考</h2>
        <p>选择一个场景，回到关键节点，展开讨论问题。</p>
      </div>
      <div class="rg-scenes">
        ${ctx.state.scenes.length ? ctx.state.scenes.map((s) => renderSceneCard(ctx, s)).join("") : `<div class="rg-skeleton">暂无场景数据</div>`}
      </div>
    `;

    this._bind(ctx);
  },

  async destroy(ctx) {
    if (typeof ctx.state?.onClick === "function") {
      ctx.panelEl?.removeEventListener("click", ctx.state.onClick);
      ctx.state.onClick = null;
    }
  },

  _bind(ctx) {
    if (typeof ctx.state.onClick === "function") {
      ctx.panelEl.removeEventListener("click", ctx.state.onClick);
    }
    ctx.state.onClick = (event) => {
      const t = event.target instanceof HTMLElement ? event.target : null;
      const btn = t?.closest("[data-action]");
      if (!btn) return;
      if (btn.getAttribute("data-action") !== "open-scene") return;
      const id = String(btn.getAttribute("data-id") || "");
      const scene = ctx.state.scenes.find((s) => String(s?.id) === id) || null;
      if (!scene || !ctx.modal) return;
      ctx.modal.open({
        title: String(scene?.name || "场景"),
        bodyHtml: renderSceneModal(ctx, scene),
      });
    };
    ctx.panelEl.addEventListener("click", ctx.state.onClick);
  },
};

