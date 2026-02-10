import { escapeHtml } from "../core/dom.js";
import { getJSON, key, setJSON } from "../core/storage.js";

function responseKey(bookId, themeId) {
  return key(["themes", bookId, themeId]);
}

function normalizeThemes(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.themes)) return raw.themes;
  return [];
}

function themeSummary(t) {
  const s = String(t?.summary || t?.description || t?.frontText || "").trim();
  if (s) return s;
  if (Array.isArray(t?.points) && t.points.length) return String(t.points[0] || "");
  return "点击展开，逐步阅读分析。";
}

function buildSteps(t) {
  const steps = Array.isArray(t?.steps) ? t.steps : [];
  if (steps.length) return steps;

  const scene = t?.caseStudy?.situation || t?.scene?.content || "";
  const quote = t?.caseStudy?.outcome || t?.analysis?.core || "";
  const modern = t?.application?.scenario || "";

  const discussion = (() => {
    if (Array.isArray(t?.discussion)) {
      return t.discussion.map((d) => `- ${String(d?.question || "").trim()}`).filter(Boolean).join("\n");
    }
    if (t?.discussion?.question) return String(t.discussion.question);
    return "";
  })();

  const points = Array.isArray(t?.points) ? t.points.map((p) => `- ${String(p)}`).join("\n") : "";

  return [
    { type: "scene", label: "书中场景", content: scene || "", quote: t?.quote || "" },
    { type: "analysis", label: "主题解读", content: quote || themeSummary(t), tip: points || "" },
    { type: "apply", label: "现代应用", content: modern || "把观点带回到课堂 / 家庭场景中，尝试一件小事。", tip: "" },
    { type: "discussion", label: "讨论", content: discussion || "写下你的观点，或者在课堂中发起讨论投票。", tip: "" },
  ];
}

function renderCard(t, ctx) {
  const title = escapeHtml(String(t?.title || "主题"));
  const summary = escapeHtml(themeSummary(t));
  const imgRaw = String(t?.image || "").trim();
  const img = imgRaw ? ctx.resolvePath(imgRaw) : "";
  const id = escapeHtml(String(t?.id || title));

  return `
    <button type="button" class="rg-tcard" data-action="open-theme" data-id="${id}" aria-label="打开主题：${title}">
      <span class="rg-tcard__inner">
        <span class="rg-tcard__face rg-tcard__front">
          <span class="rg-tcard__title">${title}</span>
          <span class="rg-tcard__hint">点击展开</span>
          ${img ? `<img class="rg-tcard__img" src="${escapeHtml(img)}" alt="" loading="lazy" />` : ""}
        </span>
        <span class="rg-tcard__face rg-tcard__back">
          <span class="rg-tcard__backtitle">核心观点</span>
          <span class="rg-tcard__summary">${summary}</span>
        </span>
      </span>
    </button>
  `;
}

function renderStep(theme, steps, index, saved) {
  const step = steps[index] || {};
  const title = escapeHtml(String(theme?.title || "主题"));

  const label = escapeHtml(String(step.label || `步骤 ${index + 1}`));
  const content = escapeHtml(String(step.content || ""));
  const quote = String(step.quote || theme?.quote || "").trim();
  const tip = String(step.tip || "").trim();

  const poll = theme?.discussion?.poll;
  const pollOptions = Array.isArray(poll?.options) ? poll.options : null;
  const pollQ = String(poll?.question || theme?.discussion?.question || "").trim();

  const selected = String(saved?.pollChoice || "").trim();
  const note = String(saved?.note || "").trim();

  const isDiscussionStep = String(step.type || "").toLowerCase() === "discussion" || index === steps.length - 1;

  return `
    <div class="rg-tmodal" data-theme-id="${escapeHtml(String(theme?.id || ""))}" data-step="${index}">
      <div class="rg-tmodal__kicker">${title} · ${label}</div>
      ${quote ? `<blockquote class="rg-tmodal__quote">“${escapeHtml(quote)}”</blockquote>` : ""}
      ${content ? `<div class="rg-tmodal__content">${content.replace(/\n/g, "<br/>")}</div>` : `<div class="rg-skeleton">暂无内容</div>`}
      ${tip ? `<div class="rg-tmodal__tip"><strong>提示</strong><div>${escapeHtml(tip).replace(/\n/g, "<br/>")}</div></div>` : ""}

      ${isDiscussionStep ? `
        <div class="rg-tmodal__discussion">
          <h3>讨论区</h3>
          ${pollOptions ? `
            <div class="rg-tmodal__poll">
              ${pollQ ? `<p class="rg-tmodal__pollq">${escapeHtml(pollQ)}</p>` : ""}
              <div class="rg-tmodal__pollopts" role="group" aria-label="投票选项">
                ${pollOptions
                  .map((opt) => {
                    const v = String(opt);
                    const on = selected === v;
                    return `<button type="button" class="rg-tmodal__pollbtn ${on ? "is-on" : ""}" data-action="poll" data-value="${escapeHtml(v)}">${escapeHtml(v)}</button>`;
                  })
                  .join("")}
              </div>
            </div>
          ` : ""}

          <label class="rg-tmodal__note">
            <span>我的观点 / 课堂引导</span>
            <textarea rows="4" data-action="note" placeholder="写下你的思考（自动保存到本地）...">${escapeHtml(note)}</textarea>
          </label>
          <p class="rg-tmodal__hint">自动保存 · 仅保存在当前浏览器</p>
        </div>
      ` : ""}
    </div>
  `;
}

export default {
  async init(ctx) {
    ctx.state = {
      themes: [],
      onPanelClick: null,
      modalKeydown: null,
      modalClick: null,
      modalInput: null,
      active: null,
    };
  },

  async render(ctx) {
    if (!ctx.state.themes.length) {
      const raw = await ctx.fetchJSON(ctx.module.data || "themes.json");
      ctx.state.themes = normalizeThemes(raw);
    }

    const themes = ctx.state.themes;
    ctx.panelEl.innerHTML = `
      <div class="rg-modulehead">
        <h2>主题分析</h2>
        <p>卡片翻转预览核心观点。点击进入分步弹窗，逐步展开（支持键盘左右键）。</p>
      </div>
      <div class="rg-themes">
        ${themes.length ? themes.map((t) => renderCard(t, ctx)).join("") : `<div class="rg-skeleton">暂无主题数据</div>`}
      </div>
    `;

    this._bindPanel(ctx);
  },

  async destroy(ctx) {
    if (typeof ctx.state?.onPanelClick === "function") {
      ctx.panelEl?.removeEventListener("click", ctx.state.onPanelClick);
      ctx.state.onPanelClick = null;
    }
  },

  _bindPanel(ctx) {
    if (typeof ctx.state.onPanelClick === "function") {
      ctx.panelEl.removeEventListener("click", ctx.state.onPanelClick);
    }

    ctx.state.onPanelClick = (event) => {
      const t = event.target instanceof HTMLElement ? event.target : null;
      const btn = t?.closest("[data-action]");
      if (!btn) return;

      if (btn.getAttribute("data-action") === "open-theme") {
        const id = String(btn.getAttribute("data-id") || "");
        const theme = ctx.state.themes.find((x) => String(x?.id) === id) || null;
        if (theme) this._openThemeModal(ctx, theme);
      }
    };
    ctx.panelEl.addEventListener("click", ctx.state.onPanelClick);
  },

  _openThemeModal(ctx, theme) {
    if (!ctx.modal) return;
    const bookId = String(ctx.book?.id || "").trim() || "book";
    const themeId = String(theme?.id || "").trim() || String(theme?.title || "theme");

    const steps = buildSteps(theme);
    let index = 0;

    const loadSaved = () => getJSON(responseKey(bookId, themeId), {}) || {};
    let saved = loadSaved();

    const render = () => {
      const bodyHtml = renderStep(theme, steps, index, saved);
      const footHtml = `
        <button type="button" class="rg-btn rg-btn--ghost" data-action="prev-step"${index <= 0 ? " disabled" : ""}>◄ 上一步</button>
        <button type="button" class="rg-btn rg-btn--primary" data-action="next-step"${index >= steps.length - 1 ? " disabled" : ""}>下一步 ►</button>
      `;
      ctx.modal.open({
        title: String(theme?.title || "主题"),
        bodyHtml,
        footHtml,
        onClose: () => cleanup(),
      });
    };

    const isMobile = () => !(window.matchMedia && window.matchMedia("(min-width: 768px)").matches);

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

    const onModalClick = (e) => {
      const t = e.target instanceof HTMLElement ? e.target : null;
      const btn = t?.closest("[data-action]");
      if (btn) {
        const action = btn.getAttribute("data-action");
        if (action === "prev-step") {
          index = Math.max(0, index - 1);
          render();
        } else if (action === "next-step") {
          index = Math.min(steps.length - 1, index + 1);
          render();
        } else if (action === "poll") {
          const v = String(btn.getAttribute("data-value") || "");
          saved = { ...saved, pollChoice: v, updatedAt: Date.now() };
          setJSON(responseKey(bookId, themeId), saved);
          render();
        }
        return;
      }

      // Mobile: tap content to advance (no explicit next button).
      if (isMobile()) {
        const panel = document.querySelector("#rgModalBody .rg-tmodal");
        if (!panel) return;
        const tag = String(t?.tagName || "").toLowerCase();
        if (tag === "textarea" || tag === "button" || tag === "select" || tag === "a") return;
        index = Math.min(steps.length - 1, index + 1);
        render();
      }
    };

    const onModalInput = (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      if (t.getAttribute("data-action") !== "note") return;
      if (!(t instanceof HTMLTextAreaElement)) return;
      saved = { ...saved, note: t.value, updatedAt: Date.now() };
      setJSON(responseKey(bookId, themeId), saved);
    };

    const cleanup = () => {
      window.removeEventListener("keydown", onKeydown);
      document.getElementById("rgModalBody")?.removeEventListener("click", onModalClick);
      document.getElementById("rgModalFoot")?.removeEventListener("click", onModalClick);
      document.getElementById("rgModalBody")?.removeEventListener("input", onModalInput);
    };

    window.addEventListener("keydown", onKeydown);
    document.getElementById("rgModalBody")?.addEventListener("click", onModalClick);
    document.getElementById("rgModalFoot")?.addEventListener("click", onModalClick);
    document.getElementById("rgModalBody")?.addEventListener("input", onModalInput);

    render();
  },
};

