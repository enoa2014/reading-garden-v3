import { escapeHtml } from "../core/dom.js";

function normalizeToList(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.characters)) return raw.characters;
  return [];
}

function hasCyElements(raw) {
  return Boolean(raw && Array.isArray(raw.nodes) && raw.nodes.length && raw.nodes[0] && raw.nodes[0].data);
}

function pickColor(node) {
  const direct = String(node?.color || node?.data?.color || "").trim();
  if (direct) return direct;

  const faction = String(node?.faction || node?.data?.faction || "").trim();
  if (faction === "civilization") return "#2E86AB";
  if (faction === "savagery") return "#D4880F";

  const group = String(node?.group || node?.data?.group || "").trim();
  if (group === "family") return "#F4D03F";
  if (group === "school") return "#5DADE2";

  const stance = String(node?.stance || node?.data?.stance || "").trim();
  if (stance.includes("反对")) return "#A82C41";
  if (stance.includes("支持")) return "#2E86AB";
  if (stance.includes("觉醒")) return "#8FBC8F";

  return "#7D6B5D";
}

function asCyElements(ctx, raw) {
  if (hasCyElements(raw)) {
    const nodes = raw.nodes.map((n) => {
      const data = { ...(n.data || {}) };
      if (data.avatar) data.avatar = ctx.resolvePath(data.avatar);
      if (!data.color) data.color = pickColor(data);
      return { data };
    });
    const edges = (raw.edges || []).map((e, i) => {
      const data = { ...(e.data || {}) };
      if (!data.id) data.id = `e${i + 1}`;
      if (!data.label && data.relation) data.label = data.relation;
      return { data };
    });
    return [...nodes, ...edges];
  }

  // wave-style: { nodes:[{id,...}], edges:[{source,target,relation}] }
  if (raw && Array.isArray(raw.nodes) && raw.nodes.length && raw.nodes[0] && !raw.nodes[0].data) {
    const nodes = raw.nodes.map((n) => ({
      data: {
        id: String(n.id),
        name: n.name,
        role: n.role,
        description: n.description,
        avatar: n.avatar ? ctx.resolvePath(n.avatar) : "",
        stance: n.stance,
        color: pickColor(n),
      },
    }));
    const edges = (raw.edges || []).map((e, i) => ({
      data: {
        id: `e${i + 1}`,
        source: String(e.source),
        target: String(e.target),
        label: e.relation || e.label || "",
      },
    }));
    return [...nodes, ...edges];
  }

  // lotf-style: { characters:[{id,...,relationships:[{target,label}]}] }
  if (raw && Array.isArray(raw.characters)) {
    const chars = raw.characters;
    const nodes = chars.map((c) => ({
      data: {
        id: String(c.id),
        name: c.name,
        role: c.role || c.archetype || "",
        description: c.description,
        avatar: c.avatar ? ctx.resolvePath(c.avatar) : "",
        faction: c.faction,
        color: pickColor(c),
        quote: c.quote,
        traits: Array.isArray(c.traits) ? c.traits : [],
        arc: Array.isArray(c.arc) ? c.arc : [],
      },
    }));

    const edges = [];
    const seen = new Set();
    chars.forEach((c) => {
      const rels = Array.isArray(c.relationships) ? c.relationships : [];
      rels.forEach((r) => {
        const source = String(c.id);
        const target = String(r.target);
        const id = `${source}->${target}:${String(r.type || "")}`;
        if (seen.has(id)) return;
        seen.add(id);
        edges.push({
          data: {
            id,
            source,
            target,
            label: r.label || r.type || "",
          },
        });
      });
    });
    return [...nodes, ...edges];
  }

  return null;
}

function renderDetailCard(data) {
  const name = escapeHtml(String(data?.name || data?.id || ""));
  const role = escapeHtml(String(data?.role || ""));
  const desc = escapeHtml(String(data?.description || ""));
  const avatar = String(data?.avatar || "").trim();
  const traits = Array.isArray(data?.traits) ? data.traits : [];
  const quote = String(data?.quote || "").trim();

  return `
    <div class="rg-chardetail">
      <div class="rg-chardetail__head">
        ${avatar ? `<img class="rg-chardetail__avatar" src="${escapeHtml(avatar)}" alt="${name}" loading="lazy">` : `<div class="rg-chardetail__avatar rg-chardetail__avatar--fallback" aria-hidden="true">${name.slice(0, 1)}</div>`}
        <div class="rg-chardetail__meta">
          <h3 class="rg-chardetail__name">${name}</h3>
          ${role ? `<p class="rg-chardetail__role">${role}</p>` : ""}
        </div>
      </div>
      ${desc ? `<p class="rg-chardetail__desc">${desc}</p>` : ""}
      ${traits.length ? `<div class="rg-chardetail__tags">${traits.slice(0, 8).map((t) => `<span class="rg-badge">${escapeHtml(String(t))}</span>`).join("")}</div>` : ""}
      ${quote ? `<blockquote class="rg-chardetail__quote">“${escapeHtml(quote)}”</blockquote>` : ""}
    </div>
  `;
}

function renderCardList(ctx, items) {
  const list = items
    .map((c) => {
      const name = escapeHtml(String(c?.name || c?.data?.name || c?.id || c?.data?.id || ""));
      const role = escapeHtml(String(c?.role || c?.data?.role || ""));
      const desc = escapeHtml(String(c?.description || c?.data?.description || ""));
      const avatarRaw = String(c?.avatar || c?.data?.avatar || "").trim();
      const avatar = avatarRaw ? ctx.resolvePath(avatarRaw) : "";
      const color = pickColor(c);
      return `
        <article class="rg-charcard" style="--char-accent:${escapeHtml(color)}">
          <div class="rg-charcard__head">
            ${avatar ? `<img class="rg-charcard__avatar" src="${escapeHtml(avatar)}" alt="${name}" loading="lazy">` : `<div class="rg-charcard__avatar rg-charcard__avatar--fallback" aria-hidden="true">${name.slice(0, 1)}</div>`}
            <div class="rg-charcard__meta">
              <h3 class="rg-charcard__name">${name}</h3>
              ${role ? `<p class="rg-charcard__role">${role}</p>` : ""}
            </div>
          </div>
          ${desc ? `<p class="rg-charcard__desc">${desc}</p>` : ""}
        </article>
      `;
    })
    .join("");

  return `<div class="rg-chargrid">${list}</div>`;
}

export default {
  async init(ctx) {
    ctx.state = {
      data: null,
      cy: null,
      onPanelClick: null,
    };
  },

  async render(ctx) {
    if (!ctx.state.data) {
      const raw = await ctx.fetchJSON(ctx.module.data || "characters.json");
      ctx.state.data = raw;
    }

    ctx.panelEl.innerHTML = `
      <div class="rg-modulehead">
        <h2>人物关系</h2>
        <p>点击角色查看：名称 / 角色 / 关系 / 教育意义（若有）。</p>
      </div>
      <div class="rg-characters" id="rgCharactersRoot">
        <div class="rg-loading">正在加载图谱...</div>
      </div>
    `;

    const root = ctx.panelEl.querySelector("#rgCharactersRoot");
    if (!root) return;

    const cyElements = asCyElements(ctx, ctx.state.data);
    const listFallback = normalizeToList(ctx.state.data);

    // If no graph edges or cytoscape is unavailable, fallback to cards.
    const hasEdges = Array.isArray(cyElements) && cyElements.some((el) => el && el.data && el.data.source && el.data.target);
    if (!cyElements || !hasEdges) {
      root.innerHTML = renderCardList(ctx, listFallback.length ? listFallback : []);
      return;
    }

    // Load Cytoscape and render graph
    try {
      await ctx.loadScriptOnce("js/vendor/cytoscape.min.js");
      if (typeof window.cytoscape !== "function") {
        throw new Error("Cytoscape not available");
      }
    } catch (e) {
      console.warn(e);
      root.innerHTML = renderCardList(ctx, listFallback.length ? listFallback : []);
      return;
    }

    root.innerHTML = `
      <div class="rg-graph">
        <div class="rg-graph__stage">
          <div class="rg-graph__toolbar">
            <button type="button" class="rg-btn rg-btn--ghost rg-graph__tool" data-action="fit">适配画布</button>
            <button type="button" class="rg-btn rg-btn--ghost rg-graph__tool" data-action="zoom-in">放大</button>
            <button type="button" class="rg-btn rg-btn--ghost rg-graph__tool" data-action="zoom-out">缩小</button>
          </div>
          <div class="rg-graph__canvas" id="rgCyCanvas" aria-label="人物关系图谱"></div>
        </div>
        <aside class="rg-graph__detail" id="rgCharDetail">
          <div class="rg-skeleton">点击一个角色，查看详情。</div>
        </aside>
      </div>
    `;

    const canvas = root.querySelector("#rgCyCanvas");
    const detail = root.querySelector("#rgCharDetail");
    if (!canvas) return;

    const cy = window.cytoscape({
      container: canvas,
      elements: cyElements,
      layout: { name: "cose", animate: true, fit: true, padding: 30 },
      style: [
        {
          selector: "node",
          style: {
            label: "data(name)",
            "text-valign": "bottom",
            "text-halign": "center",
            "font-size": 11,
            color: "#4A3728",
            "text-background-color": "#FFFBF5",
            "text-background-opacity": 0.75,
            "text-background-padding": 4,
            "border-width": 2,
            "border-color": "data(color)",
            "background-color": "data(color)",
            "background-image": "data(avatar)",
            "background-fit": "cover",
            width: 54,
            height: 54,
          },
        },
        {
          selector: "edge",
          style: {
            width: 2,
            "curve-style": "bezier",
            "line-color": "rgba(125,107,93,0.45)",
            "target-arrow-shape": "triangle",
            "target-arrow-color": "rgba(125,107,93,0.45)",
            label: "data(label)",
            "font-size": 10,
            "text-rotation": "autorotate",
            "text-background-color": "#FFFBF5",
            "text-background-opacity": 0.75,
            "text-background-padding": 3,
            color: "#7D6B5D",
          },
        },
        { selector: ":selected", style: { "border-width": 4 } },
      ],
      minZoom: 0.35,
      maxZoom: 2.5,
    });

    ctx.state.cy = cy;

    const showDetail = (data) => {
      const html = renderDetailCard(data);
      const isDesktop = window.matchMedia && window.matchMedia("(min-width: 1024px)").matches;
      if (isDesktop && detail) {
        detail.innerHTML = html;
      } else if (ctx.modal) {
        ctx.modal.open({ title: String(data?.name || "人物"), bodyHtml: html });
      }
    };

    cy.on("tap", "node", (evt) => {
      const d = evt?.target?.data?.() || null;
      if (d) showDetail(d);
    });

    if (typeof ctx.state.onPanelClick === "function") {
      ctx.panelEl.removeEventListener("click", ctx.state.onPanelClick);
    }

    ctx.state.onPanelClick = (event) => {
      const t = event.target instanceof HTMLElement ? event.target : null;
      const btn = t?.closest("[data-action]");
      if (!btn) return;
      const action = String(btn.getAttribute("data-action") || "");
      if (!ctx.state.cy) return;
      if (action === "fit") ctx.state.cy.fit(undefined, 30);
      if (action === "zoom-in") ctx.state.cy.zoom({ level: ctx.state.cy.zoom() * 1.15, renderedPosition: { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 } });
      if (action === "zoom-out") ctx.state.cy.zoom({ level: ctx.state.cy.zoom() / 1.15, renderedPosition: { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 } });
    };

    ctx.panelEl.addEventListener("click", ctx.state.onPanelClick);
  },

  async destroy(ctx) {
    if (ctx.state?.cy) {
      try {
        ctx.state.cy.destroy();
      } catch {
        // ignore
      }
      ctx.state.cy = null;
    }
    if (typeof ctx.state?.onPanelClick === "function") {
      ctx.panelEl?.removeEventListener("click", ctx.state.onPanelClick);
      ctx.state.onPanelClick = null;
    }
  },
};

