import { clamp, escapeHtml, isReducedMotion } from "../core/dom.js";

const SVG_NS = "http://www.w3.org/2000/svg";

function makePath2D(d) {
  try {
    return new Path2D(String(d || ""));
  } catch {
    return null;
  }
}

function createPathMeasurer() {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.setAttribute("aria-hidden", "true");
  svg.style.position = "absolute";
  svg.style.left = "-9999px";
  svg.style.top = "-9999px";
  svg.style.opacity = "0";
  svg.style.pointerEvents = "none";
  svg.style.overflow = "hidden";

  const path = document.createElementNS(SVG_NS, "path");
  svg.appendChild(path);
  document.body.appendChild(svg);

  return {
    measure: (d) => {
      try {
        path.setAttribute("d", String(d || ""));
        const len = path.getTotalLength();
        return Number.isFinite(len) ? len : 0;
      } catch {
        return 0;
      }
    },
    destroy: () => {
      try {
        svg.remove();
      } catch {
        // ignore
      }
    },
  };
}

function getThemeColors() {
  const styles = window.getComputedStyle(document.body);
  return {
    primary: styles.getPropertyValue("--book-primary").trim() || "#4a3728",
    secondary: styles.getPropertyValue("--book-secondary").trim() || "#7d6b5d",
    text: styles.getPropertyValue("--text-primary").trim() || "#4a3728",
    muted: styles.getPropertyValue("--text-secondary").trim() || "#7d6b5d",
    border: styles.getPropertyValue("--card-border").trim() || "rgba(125, 107, 93, 0.18)",
  };
}

function clamp01(n) {
  return clamp(Number(n) || 0, 0, 1);
}

function formatSpeed(v) {
  const n = Number(v);
  const safe = Number.isFinite(n) ? n : 1;
  return `${safe.toFixed(1)}x`;
}

function getLogogramById(list, id) {
  const target = String(id || "").trim();
  if (!target) return null;
  const found = list.find((x) => String(x?.id || "") === target);
  return found || null;
}

function normalizeComparisons(raw) {
  return Array.isArray(raw) ? raw : [];
}

function normalizeLogograms(raw) {
  return Array.isArray(raw) ? raw : [];
}

function buildStrokeSet(measure, strokes = []) {
  const list = Array.isArray(strokes) ? strokes : [];
  return list
    .map((d) => {
      const path2d = makePath2D(d);
      const len = measure ? measure(d) : 0;
      return { d: String(d || ""), path2d, len: Number.isFinite(len) ? len : 0 };
    })
    .filter((s) => s.path2d);
}

function syncCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(rect.width * dpr));
  const h = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  return { cssW: rect.width, cssH: rect.height, dpr };
}

function beginCanvas2d(canvas, ctx2d) {
  const { cssW, cssH, dpr } = syncCanvas(canvas);
  ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx2d.clearRect(0, 0, cssW, cssH);
  return { w: cssW, h: cssH };
}

function drawGuide(ctx2d, w, h, scale) {
  const colors = getThemeColors();
  ctx2d.save();
  ctx2d.lineWidth = 1 / scale;
  ctx2d.strokeStyle = colors.border;
  ctx2d.globalAlpha = 0.55;
  ctx2d.beginPath();
  ctx2d.arc(100, 100, 80, 0, Math.PI * 2);
  ctx2d.stroke();
  ctx2d.restore();
}

function drawStrokes(ctx2d, strokes, progressList, { primary, secondary }, scale) {
  const baseWidth = 3;
  const lineWidth = baseWidth / scale;
  ctx2d.save();
  ctx2d.lineCap = "round";
  ctx2d.lineJoin = "round";
  ctx2d.lineWidth = lineWidth;

  strokes.forEach((s, i) => {
    const p = clamp01(progressList[i] ?? 0);
    if (!s.path2d) return;
    const isActive = p > 0 && p < 1;
    ctx2d.strokeStyle = isActive ? secondary : primary;

    const len = Number.isFinite(s.len) && s.len > 0 ? s.len : 420;
    if (p >= 1) {
      ctx2d.setLineDash([]);
      ctx2d.lineDashOffset = 0;
    } else if (p <= 0) {
      ctx2d.setLineDash([len]);
      ctx2d.lineDashOffset = len;
    } else {
      ctx2d.setLineDash([len]);
      ctx2d.lineDashOffset = len * (1 - p);
    }

    ctx2d.stroke(s.path2d);
  });

  ctx2d.restore();
}

function renderLogogramCards(ctx, list) {
  if (!list.length) return `<div class="rg-skeleton">暂无语标数据</div>`;
  return list
    .map((item) => {
      const id = escapeHtml(String(item?.id || ""));
      const meaning = escapeHtml(String(item?.meaning || "语标"));
      const desc = escapeHtml(String(item?.description || ""));
      const imgRaw = String(item?.image || "").trim();
      const img = imgRaw ? ctx.resolvePath(imgRaw) : "";
      return `
        <button type="button" class="rg-logocard" data-action="open-logogram" data-id="${id}">
          <div class="rg-logocard__img">
            ${img ? `<img src="${escapeHtml(img)}" alt="${meaning}" loading="lazy" />` : `<div class="rg-logocard__ph">RG</div>`}
          </div>
          <div class="rg-logocard__meta">
            <div class="rg-logocard__title">${meaning}</div>
            ${desc ? `<div class="rg-logocard__desc">${desc}</div>` : ""}
          </div>
        </button>
      `;
    })
    .join("");
}

function renderComparisonCards(list) {
  if (!list.length) return `<div class="rg-skeleton">暂无对比数据</div>`;
  return list
    .map((item) => {
      const id = escapeHtml(String(item?.id || ""));
      const title = escapeHtml(String(item?.title || "对比"));
      return `
        <button type="button" class="rg-comparecard" data-action="open-comparison" data-id="${id}">
          <div class="rg-comparecard__title">${title}</div>
          <div class="rg-comparecard__tags" aria-hidden="true">
            <span class="rg-badge">人类</span>
            <span class="rg-badge">七肢桶语言B</span>
          </div>
        </button>
      `;
    })
    .join("");
}

export default {
  async init(ctx) {
    ctx.state = {
      logograms: [],
      comparisons: [],

      mode: "compare",
      speed: 1,
      playing: false,
      startAt: 0,
      pausedAt: 0,
      raf: 0,

      measurer: null,
      humanStrokes: [],
      heptapodStrokes: [],

      ro: null,
      onClick: null,
      onInput: null,
      onKeydown: null,
    };
  },

  async render(ctx) {
    if (!ctx.state.logograms.length) {
      const raw = await ctx.fetchJSON(ctx.module.data || "logograms.json");
      ctx.state.logograms = normalizeLogograms(raw);
    }

    if (!ctx.state.comparisons.length) {
      const extra = Array.isArray(ctx.module.extraData) ? ctx.module.extraData : [];
      const comparisonPath = extra.find((x) => String(x) === "comparisons.json") || "comparisons.json";
      try {
        const raw = await ctx.fetchJSON(comparisonPath);
        ctx.state.comparisons = normalizeComparisons(raw);
      } catch {
        ctx.state.comparisons = [];
      }
    }

    if (!ctx.state.measurer) {
      ctx.state.measurer = createPathMeasurer();
    }

    const human = getLogogramById(ctx.state.logograms, "human") || ctx.state.logograms[0] || null;
    const heptapod = getLogogramById(ctx.state.logograms, "heptapod") || ctx.state.logograms[1] || null;
    ctx.state.humanStrokes = buildStrokeSet(ctx.state.measurer?.measure, human?.strokes);
    ctx.state.heptapodStrokes = buildStrokeSet(ctx.state.measurer?.measure, heptapod?.strokes);

    const reduced = isReducedMotion();
    const intro = reduced
      ? "系统检测到“减少动态效果”。动画不会自动播放，你可以手动播放并调整速度。"
      : "点击播放，在两块画布上对比“线性顺序”与“同步整体”的书写逻辑。";

    ctx.panelEl.innerHTML = `
      <div class="rg-modulehead">
        <h2>${escapeHtml(String(ctx.module?.title || "语言学"))}</h2>
        <p>书写方式如何塑造时间感？在这里用一个小实验把差异看见。</p>
      </div>

      <div class="rg-lab">
        <section class="rg-lab__section">
          <div class="rg-lab__sectionhead">
            <h3>语标数据库</h3>
            <p>点击语标查看含义与背景说明。</p>
          </div>
          <div class="rg-logogrid">
            ${renderLogogramCards(ctx, ctx.state.logograms)}
          </div>
        </section>

        <section class="rg-lab__section">
          <div class="rg-lab__sectionhead">
            <h3>书写与思维模拟</h3>
            <p>${escapeHtml(intro)}</p>
          </div>

          <div class="rg-lab__controls">
            <div class="rg-seg" role="group" aria-label="演示模式">
              <button type="button" class="rg-seg__btn" data-action="set-mode" data-mode="human">人类顺序</button>
              <button type="button" class="rg-seg__btn" data-action="set-mode" data-mode="heptapod">七肢桶同步</button>
              <button type="button" class="rg-seg__btn" data-action="set-mode" data-mode="compare">对比</button>
            </div>

            <button type="button" class="rg-btn rg-btn--primary" data-action="toggle-play" aria-label="播放或暂停动画">
              <span data-role="play-label">${reduced ? "播放" : "播放"}</span>
            </button>

            <button type="button" class="rg-btn rg-btn--ghost" data-action="reset">重置</button>

            <label class="rg-lab__speed">
              <span>速度</span>
              <input id="rgLabSpeed" type="range" min="0.5" max="2" step="0.1" value="${escapeHtml(String(ctx.state.speed))}" />
              <span id="rgLabSpeedVal" aria-hidden="true">${escapeHtml(formatSpeed(ctx.state.speed))}</span>
            </label>
          </div>

          <div class="rg-lab__canvases">
            <article class="rg-canvascard">
              <div class="rg-canvascard__head">
                <h4>人类线性书写</h4>
                <p>笔画按顺序逐步完成，意义随时间展开。</p>
              </div>
              <canvas class="rg-canvas" id="rgHumanCanvas" aria-label="人类线性书写演示画布"></canvas>
            </article>

            <article class="rg-canvascard">
              <div class="rg-canvascard__head">
                <h4>七肢桶同步书写</h4>
                <p>整体结构同时成形，开头与结尾被一并规划。</p>
              </div>
              <canvas class="rg-canvas" id="rgHeptapodCanvas" aria-label="七肢桶同步书写演示画布"></canvas>
            </article>
          </div>

          <p class="rg-lab__status" id="rgLabStatus"></p>
        </section>

        <section class="rg-lab__section">
          <div class="rg-lab__sectionhead">
            <h3>思维模式对比</h3>
            <p>从书写到时间表达，再到因果逻辑。</p>
          </div>
          <div class="rg-comparegrid">
            ${renderComparisonCards(ctx.state.comparisons)}
          </div>
        </section>
      </div>
    `;

    this._bind(ctx);
    this._setupCanvas(ctx);
    this._syncControlsUI(ctx);
    this._drawFrame(ctx, { force: true });
  },

  async destroy(ctx) {
    this._stop(ctx);

    if (ctx.state?.ro) {
      try {
        ctx.state.ro.disconnect();
      } catch {
        // ignore
      }
      ctx.state.ro = null;
    }

    if (typeof ctx.state?.onClick === "function") {
      ctx.panelEl?.removeEventListener("click", ctx.state.onClick);
      ctx.state.onClick = null;
    }
    if (typeof ctx.state?.onInput === "function") {
      ctx.panelEl?.removeEventListener("input", ctx.state.onInput);
      ctx.state.onInput = null;
    }
    if (typeof ctx.state?.onKeydown === "function") {
      window.removeEventListener("keydown", ctx.state.onKeydown);
      ctx.state.onKeydown = null;
    }

    if (ctx.state?.measurer) {
      ctx.state.measurer.destroy();
      ctx.state.measurer = null;
    }
  },

  _setupCanvas(ctx) {
    const human = ctx.panelEl.querySelector("#rgHumanCanvas");
    const heptapod = ctx.panelEl.querySelector("#rgHeptapodCanvas");
    if (!(human instanceof HTMLCanvasElement) || !(heptapod instanceof HTMLCanvasElement)) return;
    if (typeof ResizeObserver === "undefined") return;

    const ro = new ResizeObserver(() => {
      this._drawFrame(ctx, { force: true });
    });
    ro.observe(human);
    ro.observe(heptapod);
    ctx.state.ro = ro;
  },

  _bind(ctx) {
    if (typeof ctx.state.onClick === "function") {
      ctx.panelEl.removeEventListener("click", ctx.state.onClick);
    }
    if (typeof ctx.state.onInput === "function") {
      ctx.panelEl.removeEventListener("input", ctx.state.onInput);
    }

    ctx.state.onClick = (event) => {
      const t = event.target instanceof HTMLElement ? event.target : null;
      const btn = t?.closest("[data-action]");
      if (!btn) return;

      const action = String(btn.getAttribute("data-action") || "");
      if (action === "set-mode") {
        const mode = String(btn.getAttribute("data-mode") || "");
        if (mode === "human" || mode === "heptapod" || mode === "compare") {
          ctx.state.mode = mode;
          this._syncControlsUI(ctx);
          this._drawFrame(ctx, { force: true });
        }
        return;
      }

      if (action === "toggle-play") {
        if (ctx.state.playing) {
          this._pause(ctx);
        } else {
          this._play(ctx);
        }
        this._syncControlsUI(ctx);
        return;
      }

      if (action === "reset") {
        this._reset(ctx);
        this._syncControlsUI(ctx);
        this._drawFrame(ctx, { force: true });
        return;
      }

      if (action === "open-logogram") {
        const id = String(btn.getAttribute("data-id") || "");
        const item = getLogogramById(ctx.state.logograms, id);
        if (item) this._openLogogram(ctx, item);
        return;
      }

      if (action === "open-comparison") {
        const id = String(btn.getAttribute("data-id") || "");
        const item = ctx.state.comparisons.find((x) => String(x?.id || "") === id) || null;
        if (item) this._openComparison(ctx, item);
      }
    };

    ctx.state.onInput = (event) => {
      const t = event.target;
      if (!(t instanceof HTMLInputElement)) return;
      if (t.id !== "rgLabSpeed") return;

      const prevSpeed = Number(ctx.state.speed) || 1;
      const next = clamp(Number(t.value) || 1, 0.5, 2);
      const now = performance.now();

      // Keep the animation progress stable when changing speed.
      if (ctx.state.playing) {
        const progressMs = Math.max(0, now - (ctx.state.startAt || now)) * prevSpeed;
        ctx.state.startAt = now - progressMs / next;
      } else {
        const progressMs = (ctx.state.pausedAt || 0) * prevSpeed;
        ctx.state.pausedAt = progressMs / next;
      }

      ctx.state.speed = next;
      const val = ctx.panelEl.querySelector("#rgLabSpeedVal");
      if (val) val.textContent = formatSpeed(next);
      this._drawFrame(ctx, { force: true });
    };

    ctx.panelEl.addEventListener("click", ctx.state.onClick);
    ctx.panelEl.addEventListener("input", ctx.state.onInput);

    ctx.state.onKeydown = (e) => {
      if (!ctx.panelEl.isConnected) return;
      // Space toggles play/pause when focus is within this panel.
      const within = document.activeElement && ctx.panelEl.contains(document.activeElement);
      if (!within) return;
      if (e.key !== " ") return;
      // Avoid messing with input sliders.
      if (document.activeElement instanceof HTMLInputElement) return;
      e.preventDefault();
      if (ctx.state.playing) this._pause(ctx);
      else this._play(ctx);
      this._syncControlsUI(ctx);
    };
    window.addEventListener("keydown", ctx.state.onKeydown);
  },

  _syncControlsUI(ctx) {
    const mode = ctx.state.mode;
    ctx.panelEl.querySelectorAll(".rg-seg__btn").forEach((el) => {
      if (!(el instanceof HTMLButtonElement)) return;
      const m = String(el.getAttribute("data-mode") || "");
      el.classList.toggle("is-on", m === mode);
    });

    const label = ctx.panelEl.querySelector('[data-role="play-label"]');
    if (label) label.textContent = ctx.state.playing ? "暂停" : "播放";

    const status = ctx.panelEl.querySelector("#rgLabStatus");
    if (status) {
      const map = { human: "人类顺序", heptapod: "七肢桶同步", compare: "对比模式" };
      status.textContent = `当前：${map[mode] || "对比模式"} · 速度：${formatSpeed(ctx.state.speed)}`;
    }
  },

  _reset(ctx) {
    this._stop(ctx);
    ctx.state.pausedAt = 0;
  },

  _play(ctx) {
    if (ctx.state.playing) return;
    ctx.state.playing = true;
    ctx.state.startAt = performance.now() - (ctx.state.pausedAt || 0);
    ctx.state.raf = window.requestAnimationFrame(() => this._tick(ctx));
  },

  _pause(ctx) {
    if (!ctx.state.playing) return;
    ctx.state.playing = false;
    const now = performance.now();
    ctx.state.pausedAt = Math.max(0, now - (ctx.state.startAt || now));
    if (ctx.state.raf) window.cancelAnimationFrame(ctx.state.raf);
    ctx.state.raf = 0;
  },

  _stop(ctx) {
    ctx.state.playing = false;
    if (ctx.state.raf) window.cancelAnimationFrame(ctx.state.raf);
    ctx.state.raf = 0;
  },

  _tick(ctx) {
    if (!ctx.state.playing) return;
    this._drawFrame(ctx);
    if (!ctx.state.playing) return;
    ctx.state.raf = window.requestAnimationFrame(() => this._tick(ctx));
  },

  _computeProgress(ctx) {
    const speed = Number(ctx.state.speed) || 1;
    const now = performance.now();
    const baseElapsed = ctx.state.playing ? Math.max(0, now - (ctx.state.startAt || now)) : Math.max(0, ctx.state.pausedAt || 0);
    const elapsed = baseElapsed * speed;

    const humanCount = ctx.state.humanStrokes.length || 0;
    const heptCount = ctx.state.heptapodStrokes.length || 0;

    const strokeDur = 720;
    const gap = 140;
    const humanTotal = humanCount ? humanCount * strokeDur + Math.max(0, humanCount - 1) * gap : 0;
    const heptTotal = 1200;
    const total = Math.max(humanTotal, heptTotal);

    // Stop once finished.
    if (ctx.state.playing && total > 0 && elapsed >= total + 60) {
      ctx.state.playing = false;
      ctx.state.pausedAt = total / speed;
      if (ctx.state.raf) window.cancelAnimationFrame(ctx.state.raf);
      ctx.state.raf = 0;
      this._syncControlsUI(ctx);
    }

    const human = new Array(humanCount).fill(0);
    for (let i = 0; i < humanCount; i += 1) {
      const start = i * (strokeDur + gap);
      const p = (elapsed - start) / strokeDur;
      human[i] = clamp01(p);
    }

    const hept = new Array(heptCount).fill(0);
    const pHept = clamp01(heptTotal > 0 ? elapsed / heptTotal : 1);
    for (let i = 0; i < heptCount; i += 1) hept[i] = pHept;

    return { human, hept };
  },

  _drawFrame(ctx, { force = false } = {}) {
    const humanCanvas = ctx.panelEl.querySelector("#rgHumanCanvas");
    const heptCanvas = ctx.panelEl.querySelector("#rgHeptapodCanvas");
    if (!(humanCanvas instanceof HTMLCanvasElement) || !(heptCanvas instanceof HTMLCanvasElement)) return;
    const humanCtx = humanCanvas.getContext("2d");
    const heptCtx = heptCanvas.getContext("2d");
    if (!humanCtx || !heptCtx) return;

    const mode = ctx.state.mode;
    const { human: humanProg, hept: heptProg } = this._computeProgress(ctx);
    const colors = getThemeColors();

    const drawOne = (canvas, ctx2d, strokes, progressList, palette) => {
      const { w, h } = beginCanvas2d(canvas, ctx2d);
      const pad = 18;
      const scale = Math.min((w - pad * 2) / 200, (h - pad * 2) / 200);
      const ox = (w - 200 * scale) / 2;
      const oy = (h - 200 * scale) / 2;

      ctx2d.save();
      ctx2d.translate(ox, oy);
      ctx2d.scale(scale, scale);

      drawGuide(ctx2d, w, h, scale);
      drawStrokes(ctx2d, strokes, progressList, palette, scale);

      // Gentle center pulse (only while playing, and only if not reduced motion).
      if (ctx.state.playing && !isReducedMotion()) {
        const p = clamp01(progressList[0] ?? 0);
        ctx2d.save();
        ctx2d.fillStyle = `color-mix(in srgb, ${palette.secondary} 28%, transparent)`;
        ctx2d.beginPath();
        ctx2d.arc(100, 100, 6 + 10 * p, 0, Math.PI * 2);
        ctx2d.fill();
        ctx2d.restore();
      }

      ctx2d.restore();
    };

    if (mode === "human") {
      drawOne(humanCanvas, humanCtx, ctx.state.humanStrokes, humanProg, { primary: colors.primary, secondary: colors.secondary });
      drawOne(heptCanvas, heptCtx, ctx.state.heptapodStrokes, new Array(ctx.state.heptapodStrokes.length).fill(force ? 0 : 0), {
        primary: colors.primary,
        secondary: colors.secondary,
      });
      return;
    }

    if (mode === "heptapod") {
      drawOne(humanCanvas, humanCtx, ctx.state.humanStrokes, new Array(ctx.state.humanStrokes.length).fill(force ? 0 : 0), {
        primary: colors.primary,
        secondary: colors.secondary,
      });
      drawOne(heptCanvas, heptCtx, ctx.state.heptapodStrokes, heptProg, { primary: colors.primary, secondary: colors.secondary });
      return;
    }

    // compare
    drawOne(humanCanvas, humanCtx, ctx.state.humanStrokes, humanProg, { primary: colors.primary, secondary: colors.secondary });
    drawOne(heptCanvas, heptCtx, ctx.state.heptapodStrokes, heptProg, { primary: colors.primary, secondary: colors.secondary });
  },

  _openLogogram(ctx, item) {
    if (!ctx.modal?.open) return;
    const meaning = String(item?.meaning || "语标").trim() || "语标";
    const desc = String(item?.description || "").trim();
    const imgRaw = String(item?.image || "").trim();
    const img = imgRaw ? ctx.resolvePath(imgRaw) : "";
    const strokes = Array.isArray(item?.strokes) ? item.strokes : [];

    const body = `
      <article class="rg-labmodal">
        <div class="rg-labmodal__top">
          <div>
            <p class="rg-labmodal__kicker">Logogram</p>
            <h3 class="rg-labmodal__title">${escapeHtml(meaning)}</h3>
          </div>
        </div>
        ${img ? `<img class="rg-labmodal__img" src="${escapeHtml(img)}" alt="${escapeHtml(meaning)}" loading="lazy" />` : ""}
        ${desc ? `<p class="rg-labmodal__desc">${escapeHtml(desc)}</p>` : ""}
        ${strokes.length ? `<p class="rg-labmodal__hint">笔画数：${escapeHtml(String(strokes.length))}（用于画布演示）</p>` : ""}
      </article>
    `;

    ctx.modal.open({
      title: meaning,
      bodyHtml: body,
      footHtml: "",
    });
  },

  _openComparison(ctx, item) {
    if (!ctx.modal?.open) return;
    const title = String(item?.title || "对比").trim() || "对比";
    const human = item?.human || {};
    const hept = item?.heptapod || {};

    const body = `
      <article class="rg-compmodal">
        <div class="rg-compmodal__grid">
          <section class="rg-compmodal__col">
            <p class="rg-compmodal__kicker">人类语言</p>
            <h3 class="rg-compmodal__h">${escapeHtml(String(human?.content || ""))}</h3>
            ${human?.example ? `<p class="rg-compmodal__ex">${escapeHtml(String(human.example))}</p>` : ""}
          </section>
          <section class="rg-compmodal__col">
            <p class="rg-compmodal__kicker">七肢桶语言B</p>
            <h3 class="rg-compmodal__h">${escapeHtml(String(hept?.content || ""))}</h3>
            ${hept?.example ? `<p class="rg-compmodal__ex">${escapeHtml(String(hept.example))}</p>` : ""}
          </section>
        </div>
      </article>
    `;

    ctx.modal.open({
      title,
      bodyHtml: body,
      footHtml: "",
    });
  },
};
