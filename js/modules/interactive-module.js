import { escapeHtml } from "../core/dom.js";
import { getJSON, key, setJSON } from "../core/storage.js";

function stateKey(bookId, moduleId) {
  return key(["interactive", bookId, moduleId]);
}

function normalizeScenarios(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.scenarios)) return raw.scenarios;
  return [];
}

const ratingMeta = {
  excellent: { label: "太棒了", tone: "excellent" },
  good: { label: "不错", tone: "good" },
  neutral: { label: "可再想想", tone: "neutral" },
  poor: { label: "换个角度", tone: "poor" },
};

function scenarioId(s, index) {
  const id = String(s?.id || "").trim();
  return id || `scenario_${index + 1}`;
}

function scenarioTitle(s) {
  return String(s?.title || s?.question || "情境").trim();
}

function scenarioDesc(s) {
  return String(s?.description || s?.context || "").trim();
}

function scenarioImage(ctx, bookId, s) {
  const raw = String(s?.image || "").trim();
  if (!raw) return "";
  // totto stores "scenarios/xxx.webp"; wonder stores absolute-ish "assets/..."
  if (raw.startsWith("assets/") || raw.startsWith("../assets/")) return ctx.resolvePath(raw);
  return ctx.resolvePath(`assets/images/${bookId}/${raw}`);
}

function renderFeedback(s, selectedOption) {
  const rating = String(selectedOption?.rating || "").trim();
  const meta = ratingMeta[rating] || ratingMeta.neutral;
  const feedback = String(selectedOption?.feedback || selectedOption?.analysis || "").trim();
  const ref = s?.reference?.content ? String(s.reference.content) : "";

  return `
    <div class="rg-feedback rg-feedback--${escapeHtml(meta.tone)}">
      <div class="rg-feedback__head">
        <span class="rg-feedback__badge">${escapeHtml(meta.label)}</span>
      </div>
      ${feedback ? `<p class="rg-feedback__text">${escapeHtml(feedback)}</p>` : ""}
      ${ref ? `<div class="rg-feedback__ref"><div class="rg-feedback__refk">书中参考</div><p>${escapeHtml(ref)}</p></div>` : ""}
    </div>
  `;
}

function renderOpenEnded(s, choiceText, savedReason) {
  const points = Array.isArray(s?.discussion_points) ? s.discussion_points : [];
  const outcome = String(s?.book_outcome || "").trim();
  return `
    <div class="rg-feedback rg-feedback--open">
      <div class="rg-feedback__head">
        <span class="rg-feedback__badge">你的选择</span>
        <span class="rg-feedback__choice">${escapeHtml(choiceText)}</span>
      </div>

      ${outcome ? `<div class="rg-feedback__ref"><div class="rg-feedback__refk">书中走向</div><p>${escapeHtml(outcome)}</p></div>` : ""}

      ${points.length ? `
        <div class="rg-feedback__ref">
          <div class="rg-feedback__refk">讨论点</div>
          <ol>
            ${points.map((q) => `<li>${escapeHtml(String(q))}</li>`).join("")}
          </ol>
        </div>
      ` : ""}

      <label class="rg-feedback__reason">
        <span>我的理由 / 我会如何引导讨论</span>
        <textarea rows="3" data-action="reason" placeholder="写下你的想法（自动保存到本地）...">${escapeHtml(savedReason || "")}</textarea>
      </label>
      <p class="rg-feedback__hint">自动保存 · 仅保存在当前浏览器</p>
    </div>
  `;
}

function renderScenario(ctx, bookId, moduleId, scenarios, state) {
  const idx = state.currentIndex || 0;
  const s = scenarios[idx];
  if (!s) return `<div class="rg-skeleton">暂无情境数据</div>`;

  const sid = scenarioId(s, idx);
  const title = escapeHtml(scenarioTitle(s));
  const desc = escapeHtml(scenarioDesc(s));
  const img = scenarioImage(ctx, bookId, s);
  const options = Array.isArray(s?.options) ? s.options : [];

  const selectedId = state.answers?.[sid]?.optionId || "";
  const selectedOption = options.find((o) => String(o?.id) === String(selectedId)) || null;

  const openEnded = !selectedOption?.rating && !selectedOption?.feedback && !selectedOption?.analysis;
  const savedReason = state.answers?.[sid]?.reason || "";

  const feedbackHtml = selectedOption
    ? openEnded
      ? renderOpenEnded(s, selectedOption?.text || "", savedReason)
      : renderFeedback(s, selectedOption)
    : "";

  return `
    <article class="rg-scenario" data-sid="${escapeHtml(sid)}">
      <header class="rg-scenario__head">
        <div class="rg-scenario__count">情境 ${idx + 1} / ${scenarios.length}</div>
        <h3 class="rg-scenario__title">${title}</h3>
        ${desc ? `<p class="rg-scenario__desc">${desc}</p>` : ""}
      </header>

      ${img ? `<img class="rg-scenario__img" src="${escapeHtml(img)}" alt="" loading="lazy" onerror="this.style.display='none'">` : ""}

      <div class="rg-options">
        <div class="rg-options__k">你会怎么做？</div>
        <div class="rg-options__list">
          ${options
      .map((o, i) => {
        const oid = escapeHtml(String(o?.id || `opt_${i + 1}`));
        const text = escapeHtml(String(o?.text || ""));
        const on = String(selectedId) === String(o?.id);
        const disabled = selectedId ? " disabled" : "";
        return `<button type="button" class="rg-option ${on ? "is-on" : ""}" data-action="choose" data-option="${oid}"${disabled}><span class="rg-option__letter">${String.fromCharCode(65 + i)}</span><span class="rg-option__text">${text}</span></button>`;
      })
      .join("")}
        </div>
      </div>

      <div class="rg-feedbackwrap ${selectedId ? "is-open" : ""}" id="rgFeedbackWrap">
        ${feedbackHtml}
      </div>

      <nav class="rg-snav">
        <button type="button" class="rg-btn rg-btn--ghost" data-action="prev" ${idx <= 0 ? "disabled" : ""} style="${idx <= 0 ? "visibility:hidden" : ""}">◄ 上一个</button>
        <button type="button" class="rg-btn rg-btn--primary" data-action="next" ${idx >= scenarios.length - 1 ? "disabled" : ""} style="${idx >= scenarios.length - 1 ? "visibility:hidden" : ""}">下一个 ►</button>
      </nav>
    </article>
  `;
}

function renderReport(scenarios, state) {
  const answers = state.answers || {};
  const answered = Object.keys(answers).length;
  const total = scenarios.length;

  const ratings = { excellent: 0, good: 0, neutral: 0, poor: 0 };
  Object.values(answers).forEach((a) => {
    const r = String(a?.rating || "").trim();
    if (ratings[r] != null) ratings[r] += 1;
  });

  const hasRating = Object.values(ratings).some((n) => n > 0);

  return `
    <div class="rg-report">
      <h3>完成报告</h3>
      <p class="rg-report__meta">已完成：${answered} / ${total}</p>
      ${hasRating ? `
        <div class="rg-report__grid">
          ${Object.keys(ratings)
        .map((k) => `<div class="rg-report__cell"><div class="rg-report__k">${escapeHtml(ratingMeta[k]?.label || k)}</div><div class="rg-report__v">${ratings[k]}</div></div>`)
        .join("")}
        </div>
      ` : `
        <p class="rg-report__hint">本书互动更偏向讨论式选择：重点不在“对错”，而在于你如何解释与引导。</p>
      `}
      <button type="button" class="rg-btn rg-btn--ghost" data-action="reset">清空本地记录</button>
    </div>
  `;
}

export default {
  async init(ctx) {
    ctx.state = {
      scenarios: [],
      currentIndex: 0,
      answers: {},
      onClick: null,
      onInput: null,
    };
  },

  async render(ctx) {
    const bookId = String(ctx.book?.id || "").trim() || "book";
    const moduleId = String(ctx.module?.id || "").trim() || "interactive";

    if (!ctx.state.scenarios.length) {
      const raw = await ctx.fetchJSON(ctx.module.data || "scenarios.json");
      ctx.state.scenarios = normalizeScenarios(raw);
    }

    // restore local state
    const saved = getJSON(stateKey(bookId, moduleId), null);
    if (saved && typeof saved === "object") {
      ctx.state.currentIndex = Number(saved.currentIndex || 0);
      ctx.state.answers = saved.answers && typeof saved.answers === "object" ? saved.answers : {};
    }

    const scenarios = ctx.state.scenarios;
    const atEnd = ctx.state.currentIndex >= scenarios.length;

    ctx.panelEl.innerHTML = `
      <div class="rg-modulehead">
        <h2>互动情境</h2>
        <p>做出选择后会展开分析面板。完成后可查看综合报告。</p>
      </div>
      <div class="rg-interactive" id="rgInteractiveRoot">
        ${scenarios.length ? (atEnd ? renderReport(scenarios, ctx.state) : renderScenario(ctx, bookId, moduleId, scenarios, ctx.state)) : `<div class="rg-skeleton">暂无互动情境</div>`}
      </div>
    `;

    this._bind(ctx);
  },

  async destroy(ctx) {
    if (typeof ctx.state?.onClick === "function") {
      ctx.panelEl?.removeEventListener("click", ctx.state.onClick);
      ctx.state.onClick = null;
    }
    if (typeof ctx.state?.onInput === "function") {
      ctx.panelEl?.removeEventListener("input", ctx.state.onInput);
      ctx.state.onInput = null;
    }
  },

  _persist(ctx, bookId, moduleId) {
    setJSON(stateKey(bookId, moduleId), {
      currentIndex: ctx.state.currentIndex,
      answers: ctx.state.answers,
      updatedAt: Date.now(),
    });
  },

  _bind(ctx) {
    const bookId = String(ctx.book?.id || "").trim() || "book";
    const moduleId = String(ctx.module?.id || "").trim() || "interactive";
    const scenarios = ctx.state.scenarios;

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

      const action = btn.getAttribute("data-action");

      if (action === "prev") {
        ctx.state.currentIndex = Math.max(0, ctx.state.currentIndex - 1);
        this._persist(ctx, bookId, moduleId);
        void this.render(ctx);
        return;
      }
      if (action === "next") {
        ctx.state.currentIndex = Math.min(scenarios.length, ctx.state.currentIndex + 1);
        this._persist(ctx, bookId, moduleId);
        void this.render(ctx);
        return;
      }
      if (action === "reset") {
        ctx.state.currentIndex = 0;
        ctx.state.answers = {};
        this._persist(ctx, bookId, moduleId);
        void this.render(ctx);
        return;
      }

      if (action === "choose") {
        const optionId = String(btn.getAttribute("data-option") || "");
        const idx = ctx.state.currentIndex || 0;
        const s = scenarios[idx];
        if (!s) return;
        const sid = scenarioId(s, idx);
        const options = Array.isArray(s?.options) ? s.options : [];
        const opt = options.find((o) => String(o?.id) === optionId) || null;
        if (!opt) return;

        ctx.state.answers[sid] = {
          optionId,
          rating: opt.rating || "",
          updatedAt: Date.now(),
          reason: ctx.state.answers[sid]?.reason || "",
        };
        this._persist(ctx, bookId, moduleId);
        void this.render(ctx);
      }
    };

    ctx.state.onInput = (event) => {
      const t = event.target;
      if (!(t instanceof HTMLElement)) return;
      if (t.getAttribute("data-action") !== "reason") return;
      if (!(t instanceof HTMLTextAreaElement)) return;

      const idx = ctx.state.currentIndex || 0;
      const s = scenarios[idx];
      if (!s) return;
      const sid = scenarioId(s, idx);
      const existed = ctx.state.answers[sid] || { optionId: "", rating: "" };
      ctx.state.answers[sid] = { ...existed, reason: t.value, updatedAt: Date.now() };
      this._persist(ctx, bookId, moduleId);
    };

    ctx.panelEl.addEventListener("click", ctx.state.onClick);
    ctx.panelEl.addEventListener("input", ctx.state.onInput);
  },
};

