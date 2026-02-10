import { escapeHtml } from "../core/dom.js";

function normalizeHotspots(raw) {
  if (raw && Array.isArray(raw.hotspots)) return raw.hotspots;
  return [];
}

function renderHotspot(h, index) {
  const id = escapeHtml(String(h?.id || `hs-${index + 1}`));
  const name = escapeHtml(String(h?.name || "热点"));
  const x = Number(h?.position?.x ?? 0);
  const y = Number(h?.position?.y ?? 0);
  const w = Number(h?.size?.width ?? 10);
  const hgt = Number(h?.size?.height ?? 10);
  return `
    <button
      type="button"
      class="rg-hotspot"
      data-action="open-hotspot"
      data-id="${id}"
      style="left:${x}%;top:${y}%;width:${w}%;height:${hgt}%;"
      aria-label="查看：${name}"
    >
      <span class="rg-hotspot__pin" aria-hidden="true">${index + 1}</span>
      <span class="rg-hotspot__label">${name}</span>
    </button>
  `;
}

function renderHotspotModal(ctx, h) {
  const name = escapeHtml(String(h?.name || "热点"));
  const story = escapeHtml(String(h?.story || "")).replace(/\n/g, "<br/>");
  const highlight = escapeHtml(String(h?.highlight || "")).replace(/\n/g, "<br/>");
  const philosophy = String(h?.philosophy || "").trim();

  return `
    <div class="rg-hotspotmodal">
      <h3 class="rg-hotspotmodal__title">${name}</h3>
      ${highlight ? `<p class="rg-hotspotmodal__hl">${highlight}</p>` : ""}
      ${story ? `<div class="rg-hotspotmodal__story">${story}</div>` : ""}
      ${philosophy ? `<button type="button" class="rg-btn rg-btn--primary" data-action="go-philosophy" data-philosophy="${escapeHtml(philosophy)}">查看关联理念</button>` : ""}
    </div>
  `;
}

export default {
  async init(ctx) {
    ctx.state = { hotspots: [], onClick: null };
  },

  async render(ctx) {
    if (!ctx.state.hotspots.length) {
      const raw = await ctx.fetchJSON(ctx.module.data || "map-hotspots.json");
      ctx.state.hotspots = normalizeHotspots(raw);
    }

    const mapImg = ctx.resolvePath("assets/images/totto-chan/map/map_tomoe_gakuen.webp");

    ctx.panelEl.innerHTML = `
      <div class="rg-modulehead">
        <h2>巴学园互动地图</h2>
        <p>点击地图热点，了解故事片段与教育理念。</p>
      </div>
      <div class="rg-map">
        <div class="rg-map__frame">
          <img class="rg-map__img" src="${escapeHtml(mapImg)}" alt="巴学园地图" loading="lazy" />
          <div class="rg-map__hotspots" aria-label="地图热点">
            ${ctx.state.hotspots.length ? ctx.state.hotspots.map((h, i) => renderHotspot(h, i)).join("") : ""}
          </div>
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
      const action = btn.getAttribute("data-action");

      if (action === "open-hotspot") {
        const id = String(btn.getAttribute("data-id") || "");
        const hs = ctx.state.hotspots.find((x) => String(x?.id) === id) || null;
        if (!hs || !ctx.modal) return;
        ctx.modal.open({
          title: String(hs?.name || "热点"),
          bodyHtml: renderHotspotModal(ctx, hs),
        });
        // bind modal local action
        const body = document.getElementById("rgModalBody");
        body?.addEventListener(
          "click",
          (e) => {
            const tt = e.target instanceof HTMLElement ? e.target : null;
            const go = tt?.closest('[data-action="go-philosophy"]');
            if (!go) return;
            const pid = String(go.getAttribute("data-philosophy") || "");
            ctx.modal?.close?.();
            ctx.activateModule("philosophy", { philosophyId: pid });
          },
          { once: true }
        );
      }
    };

    ctx.panelEl.addEventListener("click", ctx.state.onClick);
  },
};

