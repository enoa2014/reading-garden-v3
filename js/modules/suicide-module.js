import { escapeHtml } from "../core/dom.js";
import { getText, key, setText } from "../core/storage.js";

function normalizeAttempts(raw) {
  return Array.isArray(raw) ? raw : [];
}

function asInt(value) {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? n : null;
}

function renderAttemptCard(ctx, item) {
  const id = escapeHtml(String(item?.id ?? ""));
  const chapter = asInt(item?.chapter);
  const location = escapeHtml(String(item?.location || "未知地点"));
  const interruptedBy = escapeHtml(String(item?.interruptedBy || "未知"));
  const interruptReason = escapeHtml(String(item?.interruptReason || ""));
  const result = escapeHtml(String(item?.result || ""));
  const quote = escapeHtml(String(item?.quote || ""));
  const imgRaw = String(item?.image || "").trim();
  const img = imgRaw ? ctx.resolvePath(imgRaw) : "";

  const title = chapter ? `第 ${chapter} 章 · ${location}` : location;
  const sub = interruptReason ? `被 ${interruptedBy} 打断：${interruptReason}` : `被 ${interruptedBy} 打断`;

  return `
    <button type="button" class="rg-attempt" data-action="open-attempt" data-id="${id}">
      ${img ? `<img class="rg-attempt__img" src="${escapeHtml(img)}" alt="相关插图" loading="lazy" />` : ""}
      <div class="rg-attempt__body">
        <div class="rg-attempt__top">
          <h3 class="rg-attempt__title">${escapeHtml(title)}</h3>
          ${chapter ? `<span class="rg-attempt__badge">Ch.${escapeHtml(String(chapter))}</span>` : ""}
        </div>
        <p class="rg-attempt__sub">${sub}</p>
        ${result ? `<p class="rg-attempt__result">转折：${result}</p>` : ""}
        ${quote ? `<p class="rg-attempt__quote">“${quote}”</p>` : ""}
      </div>
    </button>
  `;
}

function renderDiscussionHints() {
  return `
    <ul class="rg-hints">
      <li>把焦点放在“被打断之后发生了什么”，而不是过程细节。</li>
      <li>讨论：哪些关系、哪些微小请求，让一个人重新连接到生活？</li>
      <li>课堂场景：用“社区支持”视角，引导学生辨析关怀与刻板印象。</li>
    </ul>
  `;
}

export default {
  async init(ctx) {
    ctx.state = {
      attempts: [],
      onClick: null,
      onInput: null,
    };
  },

  async render(ctx) {
    if (!ctx.state.attempts.length) {
      const raw = await ctx.fetchJSON(ctx.module.data || "suicide_attempts.json");
      ctx.state.attempts = normalizeAttempts(raw);
    }

    const noteKey = key(["suicide", ctx.book?.id || "book", "notes"]);
    const savedNotes = getText(noteKey, "");

    ctx.panelEl.innerHTML = `
      <div class="rg-modulehead">
        <h2>${escapeHtml(String(ctx.module?.title || "未遂告别"))}</h2>
        <p>以文学阅读与关怀视角梳理关键节点。本模块会刻意省略可操作的细节描述。</p>
      </div>

      <div class="rg-suicide">
        <div class="rg-alert" role="note">
          <strong>内容提示：</strong>本模块涉及自杀议题，可能引起不适。这里侧重讨论“被打断后的关系与转折”，不呈现具体实施细节。
        </div>

        <div class="rg-attemptgrid">
          ${ctx.state.attempts.length ? ctx.state.attempts.map((a) => renderAttemptCard(ctx, a)).join("") : `<div class="rg-skeleton">暂无数据</div>`}
        </div>

        <section class="rg-notes">
          <h3 class="rg-notes__title">讨论引导 / 我的记录</h3>
          ${renderDiscussionHints()}
          <label class="rg-notes__field">
            <span>随手记（自动保存）</span>
            <textarea id="rgSuicideNotes" rows="5" placeholder="记录你想在课堂/亲子讨论中提出的问题或观察...">${escapeHtml(savedNotes)}</textarea>
          </label>
          <div class="rg-notes__actions">
            <button type="button" class="rg-btn rg-btn--ghost" data-action="clear-notes">清空记录</button>
          </div>
        </section>
      </div>
    `;

    this._bind(ctx, noteKey);
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

  _bind(ctx, noteKey) {
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

      if (action === "open-attempt") {
        const id = String(btn.getAttribute("data-id") || "");
        const item = ctx.state.attempts.find((a) => String(a?.id ?? "") === id) || null;
        if (item) this._openAttempt(ctx, item);
        return;
      }

      if (action === "clear-notes") {
        const textarea = ctx.panelEl.querySelector("#rgSuicideNotes");
        if (textarea instanceof HTMLTextAreaElement) {
          textarea.value = "";
          setText(noteKey, "");
        }
      }
    };

    ctx.state.onInput = (event) => {
      const t = event.target;
      if (!(t instanceof HTMLTextAreaElement)) return;
      if (t.id !== "rgSuicideNotes") return;
      setText(noteKey, t.value);
    };

    ctx.panelEl.addEventListener("click", ctx.state.onClick);
    ctx.panelEl.addEventListener("input", ctx.state.onInput);
  },

  _openAttempt(ctx, item) {
    if (!ctx.modal?.open) return;

    const chapter = asInt(item?.chapter);
    const location = String(item?.location || "未知地点");
    const interruptedBy = String(item?.interruptedBy || "未知");
    const interruptReason = String(item?.interruptReason || "");
    const result = String(item?.result || "");
    const quote = String(item?.quote || "");
    const imgRaw = String(item?.image || "").trim();
    const img = imgRaw ? ctx.resolvePath(imgRaw) : "";

    const title = chapter ? `第 ${chapter} 章` : "关键节点";
    const body = `
      <article class="rg-attemptmodal">
        <p class="rg-attemptmodal__kicker">关键打断</p>
        <h3 class="rg-attemptmodal__title">${escapeHtml(title)} · ${escapeHtml(location)}</h3>
        ${img ? `<img class="rg-attemptmodal__img" src="${escapeHtml(img)}" alt="相关插图" loading="lazy" />` : ""}

        <div class="rg-attemptmodal__grid">
          <div class="rg-attemptmodal__row"><span>被谁打断</span><span>${escapeHtml(interruptedBy)}</span></div>
          ${interruptReason ? `<div class="rg-attemptmodal__row"><span>打断原因</span><span>${escapeHtml(interruptReason)}</span></div>` : ""}
          ${result ? `<div class="rg-attemptmodal__row"><span>结果/转折</span><span>${escapeHtml(result)}</span></div>` : ""}
        </div>

        ${
          quote
            ? `<blockquote class="rg-attemptmodal__quote">“${escapeHtml(quote)}”</blockquote>`
            : `<p class="rg-attemptmodal__hint">提示：这里聚焦“关系与转折”，不展开可操作细节。</p>`
        }
      </article>
    `;

    const foot = chapter
      ? `<button type="button" class="rg-btn rg-btn--primary" data-action="jump-reading" data-chapter="${escapeHtml(String(chapter))}">跳转到阅读</button>`
      : "";

    const onClose = () => {
      const footEl = document.getElementById("rgModalFoot");
      if (!footEl) return;
      footEl.removeEventListener("click", onFootClick);
    };

    const onFootClick = (event) => {
      const t = event.target instanceof HTMLElement ? event.target : null;
      const jump = t?.closest('[data-action="jump-reading"]');
      if (!jump) return;
      const ch = asInt(jump.getAttribute("data-chapter"));
      if (!ch) return;
      ctx.modal?.close?.();
      ctx.activateModule("reading", { chapterNumber: ch });
    };

    ctx.modal.open({ title, bodyHtml: body, footHtml: foot, onClose });
    const footEl = document.getElementById("rgModalFoot");
    footEl?.addEventListener("click", onFootClick);
  },
};

