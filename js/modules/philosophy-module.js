import { escapeHtml } from "../core/dom.js";

function normalize(raw) {
  if (raw && Array.isArray(raw.philosophies)) return raw.philosophies;
  if (Array.isArray(raw)) return raw;
  return [];
}

function renderCard(p) {
  const id = escapeHtml(String(p?.id || ""));
  const title = escapeHtml(String(p?.title || "理念"));
  const tagline = escapeHtml(String(p?.tagline || ""));
  const sceneTitle = escapeHtml(String(p?.scene?.title || ""));
  return `
    <button type="button" class="rg-phcard" data-action="open-philosophy" data-id="${id}">
      <div class="rg-phcard__top">
        <span class="rg-phcard__kicker">理念卡</span>
        <span class="rg-phcard__title">${title}</span>
        ${tagline ? `<span class="rg-phcard__tagline">“${tagline}”</span>` : ""}
      </div>
      ${sceneTitle ? `<div class="rg-phcard__scene">场景：${sceneTitle}</div>` : ""}
      <div class="rg-phcard__hint">点击展开</div>
    </button>
  `;
}

function renderModal(p) {
  const title = escapeHtml(String(p?.title || "理念"));
  const scene = p?.scene || {};
  const analysis = p?.analysis || {};
  const app = p?.application || {};

  const steps = [
    {
      label: "书中场景",
      html: `
        <h3>${escapeHtml(String(scene.title || ""))}</h3>
        <p>${escapeHtml(String(scene.content || "")).replace(/\\n/g, "<br/>")}</p>
        ${scene.quote ? `<blockquote class="rg-tmodal__quote">“${escapeHtml(String(scene.quote))}”</blockquote>` : ""}
      `,
    },
    {
      label: "理念解读",
      html: `
        <h3>核心观点</h3>
        <p>${escapeHtml(String(analysis.core || "")).replace(/\\n/g, "<br/>")}</p>
      `,
    },
    {
      label: "对比：传统 vs 巴学园",
      html: `
        <div class="rg-compare">
          <div class="rg-compare__col">
            <h4>传统</h4>
            <p>${escapeHtml(String(analysis.comparison?.traditional || ""))}</p>
          </div>
          <div class="rg-compare__col">
            <h4>巴学园</h4>
            <p>${escapeHtml(String(analysis.comparison?.tomoe || ""))}</p>
          </div>
        </div>
      `,
    },
    {
      label: "现代应用",
      html: `
        <h3>落地建议</h3>
        ${app.scenario ? `<p>${escapeHtml(String(app.scenario)).replace(/\\n/g, "<br/>")}</p>` : ""}
        ${
          Array.isArray(app.tips) && app.tips.length
            ? `<ul>${app.tips.map((t) => `<li>${escapeHtml(String(t))}</li>`).join("")}</ul>`
            : ""
        }
      `,
    },
  ];

  return { title, steps };
}

export default {
  async init(ctx) {
    ctx.state = {
      items: [],
      onClick: null,
    };
  },

  async render(ctx, payload = null) {
    if (!ctx.state.items.length) {
      const raw = await ctx.fetchJSON(ctx.module.data || "philosophies.json");
      ctx.state.items = normalize(raw);
    }

    ctx.panelEl.innerHTML = `
      <div class="rg-modulehead">
        <h2>教育理念卡片</h2>
        <p>每张卡片：书中场景 → 理念解读 → 对比 → 现代应用。</p>
      </div>
      <div class="rg-phgrid">
        ${ctx.state.items.length ? ctx.state.items.map((p) => renderCard(p)).join("") : `<div class="rg-skeleton">暂无理念卡</div>`}
      </div>
    `;

    this._bind(ctx);

    const targetId = String(payload?.philosophyId || "").trim();
    if (targetId) {
      const p = ctx.state.items.find((x) => String(x?.id) === targetId) || null;
      if (p) this._open(ctx, p);
    }
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
      const btn = t?.closest('[data-action="open-philosophy"]');
      if (!btn) return;
      const id = String(btn.getAttribute("data-id") || "");
      const p = ctx.state.items.find((x) => String(x?.id) === id) || null;
      if (p) this._open(ctx, p);
    };
    ctx.panelEl.addEventListener("click", ctx.state.onClick);
  },

  _open(ctx, p) {
    if (!ctx.modal) return;
    const { title, steps } = renderModal(p);
    let index = 0;

    const render = () => {
      const step = steps[index];
      const bodyHtml = `
        <div class="rg-tmodal">
          <div class="rg-tmodal__kicker">${escapeHtml(title)} · ${escapeHtml(step.label)}</div>
          <div class="rg-tmodal__content">${step.html}</div>
        </div>
      `;
      const footHtml = `
        <button type="button" class="rg-btn rg-btn--ghost" data-action="prev"${index <= 0 ? " disabled" : ""}>◄ 上一步</button>
        <button type="button" class="rg-btn rg-btn--primary" data-action="next"${index >= steps.length - 1 ? " disabled" : ""}>下一步 ►</button>
      `;
      ctx.modal.open({
        title,
        bodyHtml,
        footHtml,
        onClose: () => cleanup(),
      });
    };

    const onKeydown = (e) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        index = Math.max(0, index - 1);
        render();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        index = Math.min(steps.length - 1, index + 1);
        render();
      }
    };

    const onClick = (e) => {
      const t = e.target instanceof HTMLElement ? e.target : null;
      const btn = t?.closest("[data-action]");
      if (!btn) return;
      const action = btn.getAttribute("data-action");
      if (action === "prev") {
        index = Math.max(0, index - 1);
        render();
      } else if (action === "next") {
        index = Math.min(steps.length - 1, index + 1);
        render();
      }
    };

    const cleanup = () => {
      window.removeEventListener("keydown", onKeydown);
      document.getElementById("rgModalFoot")?.removeEventListener("click", onClick);
    };

    window.addEventListener("keydown", onKeydown);
    document.getElementById("rgModalFoot")?.addEventListener("click", onClick);

    render();
  },
};

