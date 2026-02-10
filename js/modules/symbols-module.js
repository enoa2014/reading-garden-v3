import { escapeHtml } from "../core/dom.js";

function normalize(raw) {
  const symbols = raw && Array.isArray(raw.symbols) ? raw.symbols : [];
  return symbols;
}

function asInt(value) {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? n : null;
}

function renderCard(ctx, s) {
  const id = escapeHtml(String(s?.id || ""));
  const name = escapeHtml(String(s?.name || "象征"));
  const nameEn = escapeHtml(String(s?.nameEn || ""));
  const meaning = escapeHtml(String(s?.meaning || ""));
  const imgRaw = String(s?.image || "").trim();
  const img = imgRaw ? ctx.resolvePath(imgRaw) : "";
  const points = Array.isArray(s?.evolution) ? s.evolution.length : 0;

  return `
    <button type="button" class="rg-symbolcard" data-action="open-symbol" data-id="${id}">
      <div class="rg-symbolcard__img">
        ${img ? `<img src="${escapeHtml(img)}" alt="${name}" loading="lazy" />` : `<div class="rg-symbolcard__ph">RG</div>`}
      </div>
      <div class="rg-symbolcard__body">
        <div class="rg-symbolcard__top">
          <h3 class="rg-symbolcard__name">${name}</h3>
          ${nameEn ? `<span class="rg-symbolcard__en">${nameEn}</span>` : ""}
        </div>
        ${meaning ? `<p class="rg-symbolcard__meaning">${meaning}</p>` : ""}
        <div class="rg-symbolcard__meta">
          <span class="rg-badge">演变节点：${escapeHtml(String(points))}</span>
          <span class="rg-badge">点击展开</span>
        </div>
      </div>
    </button>
  `;
}

function renderModal(ctx, s) {
  const name = String(s?.name || "象征").trim() || "象征";
  const nameEn = String(s?.nameEn || "").trim();
  const meaning = String(s?.meaning || "").trim();
  const imgRaw = String(s?.image || "").trim();
  const img = imgRaw ? ctx.resolvePath(imgRaw) : "";
  const evo = Array.isArray(s?.evolution) ? s.evolution : [];

  const timeline = evo.length
    ? `
      <ol class="rg-symboltimeline">
        ${evo
          .map((p) => {
            const ch = asInt(p?.chapter);
            const title = escapeHtml(String(p?.title || "节点"));
            const desc = escapeHtml(String(p?.description || ""));
            return `
              <li class="rg-symbolpoint">
                <div class="rg-symbolpoint__top">
                  ${ch ? `<button type="button" class="rg-chip" data-action="jump-reading" data-chapter="${escapeHtml(String(ch))}">第${escapeHtml(String(ch))}章</button>` : ""}
                  <h4 class="rg-symbolpoint__title">${title}</h4>
                </div>
                ${desc ? `<p class="rg-symbolpoint__desc">${desc}</p>` : ""}
              </li>
            `;
          })
          .join("")}
      </ol>
    `
    : `<div class="rg-skeleton">暂无演变节点</div>`;

  const body = `
    <article class="rg-symbolmodal">
      <div class="rg-symbolmodal__head">
        <p class="rg-symbolmodal__kicker">Symbol</p>
        <h3 class="rg-symbolmodal__title">${escapeHtml(name)}${nameEn ? ` <span class="rg-symbolmodal__en">${escapeHtml(nameEn)}</span>` : ""}</h3>
      </div>
      ${img ? `<img class="rg-symbolmodal__img" src="${escapeHtml(img)}" alt="${escapeHtml(name)}" loading="lazy" />` : ""}
      ${meaning ? `<p class="rg-symbolmodal__meaning">${escapeHtml(meaning)}</p>` : ""}
      <div class="rg-symbolmodal__sec">
        <h4>演变轨迹</h4>
        ${timeline}
      </div>
    </article>
  `;

  return { title: name, bodyHtml: body };
}

export default {
  async init(ctx) {
    ctx.state = {
      symbols: [],
      onClick: null,
    };
  },

  async render(ctx) {
    if (!ctx.state.symbols.length) {
      const raw = await ctx.fetchJSON(ctx.module.data || "symbols.json");
      ctx.state.symbols = normalize(raw);
    }

    ctx.panelEl.innerHTML = `
      <div class="rg-modulehead">
        <h2>${escapeHtml(String(ctx.module?.title || "象征"))}</h2>
        <p>从“物”到“意义”，追踪文明规则如何建立、动摇与瓦解。</p>
      </div>
      <div class="rg-symbols">
        <div class="rg-symbolgrid">
          ${ctx.state.symbols.length ? ctx.state.symbols.map((s) => renderCard(ctx, s)).join("") : `<div class="rg-skeleton">暂无象征数据</div>`}
        </div>
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
      const action = String(btn.getAttribute("data-action") || "");
      if (action !== "open-symbol") return;

      const id = String(btn.getAttribute("data-id") || "");
      const item = ctx.state.symbols.find((s) => String(s?.id || "") === id) || null;
      if (item) this._open(ctx, item);
    };

    ctx.panelEl.addEventListener("click", ctx.state.onClick);
  },

  _open(ctx, symbol) {
    if (!ctx.modal?.open) return;
    const { title, bodyHtml } = renderModal(ctx, symbol);

    const onClick = (event) => {
      const t = event.target instanceof HTMLElement ? event.target : null;
      const jump = t?.closest('[data-action="jump-reading"]');
      if (!jump) return;
      const ch = asInt(jump.getAttribute("data-chapter"));
      if (!ch) return;
      ctx.modal?.close?.();
      ctx.activateModule("reading", { chapterNumber: ch, chapterId: ch });
    };

    const onClose = () => {
      const bodyEl = document.getElementById("rgModalBody");
      bodyEl?.removeEventListener("click", onClick);
    };

    ctx.modal.open({ title, bodyHtml, footHtml: "", onClose });
    const bodyEl = document.getElementById("rgModalBody");
    bodyEl?.addEventListener("click", onClick);
  },
};

