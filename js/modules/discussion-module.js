import { escapeHtml } from "../core/dom.js";
import { getJSON, key, setJSON } from "../core/storage.js";

function normalize(raw) {
  const categories = raw && Array.isArray(raw.categories) ? raw.categories : [];
  const scenarios = raw && Array.isArray(raw.scenarios) ? raw.scenarios : [];
  const questions = raw && Array.isArray(raw.questions) ? raw.questions : [];
  return { categories, scenarios, questions };
}

function asInt(value) {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? n : null;
}

function stateKey(bookId) {
  return key(["discussion", bookId, "state"]);
}

function loadState(bookId) {
  const raw = getJSON(stateKey(bookId), null);
  const choices = raw && typeof raw.choices === "object" ? raw.choices : {};
  const notes = raw && typeof raw.notes === "object" ? raw.notes : {};
  return { choices: { ...choices }, notes: { ...notes } };
}

function saveState(bookId, state) {
  setJSON(stateKey(bookId), state);
}

function renderCategories(categories, active) {
  if (!categories.length) return "";
  return `
    <div class="rg-tfilters" role="tablist" aria-label="讨论类别">
      ${categories
        .map((c) => {
          const id = escapeHtml(String(c?.id || ""));
          const name = escapeHtml(String(c?.name || "类别"));
          const on = String(c?.id || "") === String(active || "");
          return `<button type="button" class="rg-tfilter ${on ? "is-on" : ""}" data-action="set-category" data-id="${id}">${name}</button>`;
        })
        .join("")}
    </div>
  `;
}

function renderScenarioCard(s, selectedOptionId) {
  const id = escapeHtml(String(s?.id || ""));
  const title = escapeHtml(String(s?.title || "场景"));
  const context = escapeHtml(String(s?.context || ""));
  const question = escapeHtml(String(s?.question || ""));
  const chapter = asInt(s?.chapter);
  const options = Array.isArray(s?.options) ? s.options : [];

  const selected = options.find((o) => String(o?.id || "") === String(selectedOptionId || "")) || null;
  const analysis = selected ? String(selected?.analysis || "").trim() : "";

  const optHtml = options
    .map((o, idx) => {
      const oid = escapeHtml(String(o?.id || String(idx)));
      const text = escapeHtml(String(o?.text || "选项"));
      const on = String(o?.id || "") === String(selectedOptionId || "");
      const label = String.fromCharCode(65 + idx);
      return `
        <button
          type="button"
          class="rg-discopt ${on ? "is-on" : ""}"
          data-action="choose-option"
          data-sid="${id}"
          data-oid="${oid}"
          aria-pressed="${on ? "true" : "false"}"
        >
          <span class="rg-discopt__label" aria-hidden="true">${escapeHtml(label)}</span>
          <span class="rg-discopt__text">${text}</span>
        </button>
      `;
    })
    .join("");

  return `
    <article class="rg-scenario">
      <div class="rg-scenario__top">
        <h3 class="rg-scenario__title">${title}</h3>
        ${chapter ? `<button type="button" class="rg-chip" data-action="jump-reading" data-chapter="${escapeHtml(String(chapter))}">第${escapeHtml(String(chapter))}章</button>` : ""}
      </div>
      ${context ? `<p class="rg-scenario__context">${context}</p>` : ""}
      ${question ? `<p class="rg-scenario__q">${question}</p>` : ""}
      <div class="rg-discopts" role="group" aria-label="选择一个观点">
        ${optHtml}
      </div>
      <div class="rg-discanalysis" aria-live="polite">
        ${
          analysis
            ? `<div class="rg-discanalysis__card"><strong>解析：</strong>${escapeHtml(analysis)}</div>`
            : `<div class="rg-discanalysis__hint">选择一个选项后，这里会显示解析。</div>`
        }
      </div>
    </article>
  `;
}

function renderScenarioList(scenarios, activeCategory, choices) {
  const list = scenarios.filter((s) => String(s?.category || "") === String(activeCategory || ""));
  if (!list.length) return `<div class="rg-skeleton">暂无此类别场景</div>`;
  return list.map((s) => renderScenarioCard(s, choices[String(s?.id || "")])).join("");
}

function renderQuestions(questions, notes) {
  if (!questions.length) return `<div class="rg-skeleton">暂无问题</div>`;
  return `
    <div class="rg-qgrid">
      ${questions
        .map((q, idx) => {
          const qid = `q${idx}`;
          const level = escapeHtml(String(q?.level || "问题"));
          const text = escapeHtml(String(q?.text || ""));
          const saved = escapeHtml(String(notes[qid] || ""));
          return `
            <article class="rg-qcard">
              <div class="rg-qcard__level">${level}</div>
              <p class="rg-qcard__text">${text}</p>
              <label class="rg-qcard__note">
                <span>我的记录</span>
                <textarea rows="3" data-action="note" data-qid="${escapeHtml(qid)}" placeholder="写下你准备如何引导讨论...">${saved}</textarea>
              </label>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

export default {
  async init(ctx) {
    ctx.state = {
      data: null,
      activeCategory: "",
      saved: { choices: {}, notes: {} },
      onClick: null,
      onInput: null,
    };
  },

  async render(ctx) {
    if (!ctx.state.data) {
      const raw = await ctx.fetchJSON(ctx.module.data || "discussions.json");
      ctx.state.data = normalize(raw);
    }

    const bookId = String(ctx.book?.id || "book");
    ctx.state.saved = loadState(bookId);

    if (!ctx.state.activeCategory) {
      ctx.state.activeCategory = String(ctx.state.data.categories[0]?.id || "moral");
    }

    ctx.panelEl.innerHTML = `
      <div class="rg-modulehead">
        <h2>${escapeHtml(String(ctx.module?.title || "讨论"))}</h2>
        <p>适合课堂投屏与小组讨论。先选一个类别，再用场景问题引出更深的分析。</p>
      </div>

      <div class="rg-discussion">
        ${renderCategories(ctx.state.data.categories, ctx.state.activeCategory)}
        <div class="rg-scenarios" id="rgScenarioList">
          ${renderScenarioList(ctx.state.data.scenarios, ctx.state.activeCategory, ctx.state.saved.choices)}
        </div>

        <section class="rg-openq">
          <div class="rg-openq__head">
            <h3>开放性问题（Bloom's Taxonomy）</h3>
            <button type="button" class="rg-btn rg-btn--ghost" data-action="clear-notes">清空我的记录</button>
          </div>
          ${renderQuestions(ctx.state.data.questions, ctx.state.saved.notes)}
        </section>
      </div>
    `;

    this._bind(ctx, bookId);
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

  _bind(ctx, bookId) {
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

      if (action === "set-category") {
        const id = String(btn.getAttribute("data-id") || "");
        if (!id) return;
        ctx.state.activeCategory = id;
        // update filter UI
        ctx.panelEl.querySelectorAll(".rg-tfilter").forEach((el) => {
          if (!(el instanceof HTMLElement)) return;
          el.classList.toggle("is-on", String(el.getAttribute("data-id") || "") === id);
        });
        const host = ctx.panelEl.querySelector("#rgScenarioList");
        if (host) {
          host.innerHTML = renderScenarioList(ctx.state.data.scenarios, ctx.state.activeCategory, ctx.state.saved.choices);
        }
        return;
      }

      if (action === "choose-option") {
        const sid = String(btn.getAttribute("data-sid") || "");
        const oid = String(btn.getAttribute("data-oid") || "");
        if (!sid || !oid) return;
        ctx.state.saved.choices[sid] = oid;
        saveState(bookId, ctx.state.saved);
        const host = ctx.panelEl.querySelector("#rgScenarioList");
        if (host) {
          host.innerHTML = renderScenarioList(ctx.state.data.scenarios, ctx.state.activeCategory, ctx.state.saved.choices);
        }
        return;
      }

      if (action === "jump-reading") {
        const ch = asInt(btn.getAttribute("data-chapter"));
        if (!ch) return;
        ctx.activateModule("reading", { chapterNumber: ch, chapterId: ch });
        return;
      }

      if (action === "clear-notes") {
        ctx.state.saved.notes = {};
        saveState(bookId, ctx.state.saved);
        ctx.panelEl.querySelectorAll('textarea[data-action="note"]').forEach((el) => {
          if (el instanceof HTMLTextAreaElement) el.value = "";
        });
      }
    };

    ctx.state.onInput = (event) => {
      const t = event.target;
      if (!(t instanceof HTMLTextAreaElement)) return;
      const action = String(t.getAttribute("data-action") || "");
      if (action !== "note") return;
      const qid = String(t.getAttribute("data-qid") || "");
      if (!qid) return;
      ctx.state.saved.notes[qid] = t.value;
      saveState(bookId, ctx.state.saved);
    };

    ctx.panelEl.addEventListener("click", ctx.state.onClick);
    ctx.panelEl.addEventListener("input", ctx.state.onInput);
  },
};

