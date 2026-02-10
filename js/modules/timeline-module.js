import { escapeHtml } from "../core/dom.js";

function normalizeRaw(raw) {
  // wave: { title, subtitle, events: [...] }
  if (raw && Array.isArray(raw.events)) return { meta: raw, events: raw.events };
  // ove: { timelines, events:[...] }
  if (raw && Array.isArray(raw.events)) return { meta: raw, events: raw.events };
  // story: [ ... ]
  if (Array.isArray(raw)) return { meta: {}, events: raw };
  return { meta: {}, events: [] };
}

function groupLabel(meta, groupId) {
  if (!groupId) return "全部";
  const timelines = meta && meta.timelines && typeof meta.timelines === "object" ? meta.timelines : null;
  if (timelines && timelines[groupId]) return String(timelines[groupId].name || groupId);
  const map = { arrival: "抵达线", daughter: "女儿线", past: "过去", present: "现在" };
  return map[groupId] || groupId;
}

function buildGroups(meta, events) {
  const set = new Set(events.map((e) => String(e?.timeline || e?.type || "").trim()).filter(Boolean));
  const ids = Array.from(set);
  if (!ids.length) return [];
  return ids.map((id) => ({ id, name: groupLabel(meta, id) }));
}

function eventSortKey(e) {
  if (e?.day != null) return Number(e.day) || 0;
  if (e?.linearPosition != null) return Number(e.linearPosition) || 0;
  if (e?.year != null) return Number(e.year) * 100 + Number(e.month || 0);
  return 0;
}

function renderEventCard(ctx, e) {
  const title = escapeHtml(String(e?.title || e?.name || "事件"));
  const subtitle = escapeHtml(String(e?.subtitle || e?.date || e?.descriptionShort || ""));
  const desc = escapeHtml(String(e?.description || ""));
  const day = e?.day != null ? `Day ${escapeHtml(String(e.day))}` : "";
  const year = e?.year != null ? `${escapeHtml(String(e.year))}${e?.month ? `-${escapeHtml(String(e.month)).padStart(2, "0")}` : ""}` : "";

  const badge = day || year || subtitle;
  const imgRaw = String(e?.image || "").trim();
  const img = imgRaw ? ctx.resolvePath(imgRaw) : "";

  const chapter = e?.chapter != null ? String(e.chapter) : "";

  return `
    <article class="rg-event">
      ${img ? `<img class="rg-event__img" src="${escapeHtml(img)}" alt="" loading="lazy" />` : ""}
      <div class="rg-event__body">
        <div class="rg-event__top">
          <h3 class="rg-event__title">${title}</h3>
          ${badge ? `<span class="rg-event__badge">${escapeHtml(badge)}</span>` : ""}
        </div>
        ${desc ? `<p class="rg-event__desc">${desc}</p>` : ""}
        ${chapter ? `<button type="button" class="rg-btn rg-btn--ghost rg-event__jump" data-action="jump-reading" data-chapter="${escapeHtml(chapter)}">跳转阅读</button>` : ""}
      </div>
    </article>
  `;
}

export default {
  async init(ctx) {
    ctx.state = {
      meta: {},
      events: [],
      groups: [],
      activeGroup: "",
      onClick: null,
    };
  },

  async render(ctx) {
    if (!ctx.state.events.length) {
      const raw = await ctx.fetchJSON(ctx.module.data || "timeline.json");
      const { meta, events } = normalizeRaw(raw);
      ctx.state.meta = meta || {};
      ctx.state.events = Array.isArray(events) ? events.slice() : [];
      ctx.state.events.sort((a, b) => eventSortKey(a) - eventSortKey(b));
      ctx.state.groups = buildGroups(ctx.state.meta, ctx.state.events);
    }

    const title = String(ctx.state.meta?.title || ctx.module?.title || "时间线").trim();
    const subtitle = String(ctx.state.meta?.subtitle || "").trim();

    const filters = ctx.state.groups.length
      ? `
        <div class="rg-tfilters" role="tablist" aria-label="时间线筛选">
          <button type="button" class="rg-tfilter ${!ctx.state.activeGroup ? "is-on" : ""}" data-action="set-group" data-group="">全部</button>
          ${ctx.state.groups
            .map((g) => {
              const on = ctx.state.activeGroup === g.id;
              return `<button type="button" class="rg-tfilter ${on ? "is-on" : ""}" data-action="set-group" data-group="${escapeHtml(g.id)}">${escapeHtml(g.name)}</button>`;
            })
            .join("")}
        </div>
      `
      : "";

    ctx.panelEl.innerHTML = `
      <div class="rg-modulehead">
        <h2>${escapeHtml(title)}</h2>
        ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : `<p>沿着事件的脉络，回到关键场景与讨论节点。</p>`}
      </div>
      <div class="rg-timeline">
        ${filters}
        <div class="rg-events" id="rgEventsList"></div>
      </div>
    `;

    this._renderList(ctx);
    this._bind(ctx);
  },

  async destroy(ctx) {
    if (typeof ctx.state?.onClick === "function") {
      ctx.panelEl?.removeEventListener("click", ctx.state.onClick);
      ctx.state.onClick = null;
    }
  },

  _renderList(ctx) {
    const list = ctx.panelEl.querySelector("#rgEventsList");
    if (!list) return;

    const group = String(ctx.state.activeGroup || "").trim();
    const events = group
      ? ctx.state.events.filter((e) => String(e?.timeline || e?.type || "").trim() === group)
      : ctx.state.events;

    list.innerHTML = events.length ? events.map((e) => renderEventCard(ctx, e)).join("") : `<div class="rg-skeleton">暂无事件</div>`;
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
      if (action === "set-group") {
        ctx.state.activeGroup = String(btn.getAttribute("data-group") || "");
        // update filter UI
        ctx.panelEl.querySelectorAll(".rg-tfilter").forEach((el) => {
          if (!(el instanceof HTMLElement)) return;
          const g = String(el.getAttribute("data-group") || "");
          el.classList.toggle("is-on", g === ctx.state.activeGroup);
        });
        this._renderList(ctx);
        return;
      }

      if (action === "jump-reading") {
        const chapter = String(btn.getAttribute("data-chapter") || "");
        if (chapter) {
          ctx.activateModule("reading", { chapterNumber: chapter, chapterId: chapter });
        } else {
          ctx.activateModule("reading");
        }
      }
    };

    ctx.panelEl.addEventListener("click", ctx.state.onClick);
  },
};

