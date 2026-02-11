import { clamp, escapeHtml } from "../core/dom.js";
import { getJSON, getText, key, setJSON, setText } from "../core/storage.js";

function progressKey(bookId) {
  return key(["progress", bookId]);
}

function notesKey(bookId) {
  return key(["notes", bookId]);
}

function fontKey() {
  return key(["reading", "font"]);
}

function povKey(bookId) {
  return key(["reading", bookId, "pov"]);
}

function trySplitParagraphs(text) {
  const s = String(text || "");
  return s
    .split(/\n{2,}/g)
    .map((p) => p.trim())
    .filter(Boolean);
}

function normalizeChapters(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.chapters)) return raw.chapters;
  return [];
}

function chapterTitle(ch, index) {
  const title = String(ch?.title || "").trim();
  if (title) return title;

  const timeline = String(ch?.timeline || "").trim();
  if (timeline) {
    const map = {
      daughter: "女儿时间线",
      arrival: "抵达时间线",
    };
    const label = map[timeline] || timeline;
    return `${label} · 片段 ${index + 1}`;
  }

  const id = ch?.id;
  if (typeof id === "number") return `第 ${id} 章`;
  if (typeof id === "string" && id) return `片段 ${index + 1}`;
  const num = ch?.number;
  if (typeof num === "number") return `第 ${num} 章`;
  return `章节 ${index + 1}`;
}

function chapterMetaLine(ch) {
  const parts = [];
  if (ch?.part != null) parts.push(`第${String(ch.part)}部`);
  if (ch?.pov) parts.push(`视角：${String(ch.pov)}`);
  if (ch?.timeline) parts.push(`线索：${String(ch.timeline)}`);
  if (ch?.readingTime) parts.push(`约 ${String(ch.readingTime)} 分钟`);
  return parts.join(" · ");
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function renderFontButtons(active) {
  const v = active === "l" ? "l" : active === "s" ? "s" : "m";
  return `
    <div class="rg-reading__font" role="group" aria-label="字号">
      <button type="button" class="rg-reading__fontbtn ${v === "s" ? "is-on" : ""}" data-action="font" data-font="s" aria-label="小字号">A-</button>
      <button type="button" class="rg-reading__fontbtn ${v === "m" ? "is-on" : ""}" data-action="font" data-font="m" aria-label="中字号">A</button>
      <button type="button" class="rg-reading__fontbtn ${v === "l" ? "is-on" : ""}" data-action="font" data-font="l" aria-label="大字号">A+</button>
    </div>
  `;
}

function resolvePovs(chapters, registryPovs) {
  const fromRegistry = Array.isArray(registryPovs)
    ? registryPovs
      .map((p) => ({ id: String(p?.id || "").trim(), name: String(p?.name || "").trim() }))
      .filter((p) => p.id)
    : [];
  if (fromRegistry.length) return fromRegistry;

  const ids = Array.from(new Set(chapters.map((c) => String(c?.pov || "").trim()).filter(Boolean)));
  return ids.map((id) => ({ id, name: id }));
}

function filteredIndices(chapters, activePov) {
  const pov = String(activePov || "").trim();
  if (!pov || pov === "all") return chapters.map((_, i) => i);
  return chapters.map((c, i) => (String(c?.pov || "").trim() === pov ? i : -1)).filter((i) => i >= 0);
}

function clampIndex(i, len) {
  if (!Number.isFinite(i)) return 0;
  if (len <= 0) return 0;
  return clamp(Math.trunc(i), 0, len - 1);
}

function renderPovSelector(povs, active) {
  if (!povs.length) return "";
  const value = String(active || "all");
  return `
    <label class="rg-reading__pov">
      <span class="rg-reading__povlabel">视角</span>
      <select data-action="pov" aria-label="选择视角">
        <option value="all"${value === "all" ? " selected" : ""}>全部</option>
        ${povs
      .map((p) => {
        const id = String(p.id);
        const name = String(p.name || p.id);
        return `<option value="${escapeHtml(id)}"${value === id ? " selected" : ""}>${escapeHtml(name)}</option>`;
      })
      .join("")}
      </select>
    </label>
  `;
}

async function ensureChapterContent(ctx, chapter) {
  if (!chapter) return chapter;

  if (Array.isArray(chapter.paragraphs) && chapter.paragraphs.length) return chapter;
  if (typeof chapter.content === "string" && chapter.content.trim()) return chapter;
  if (Array.isArray(chapter.content) && chapter.content.length) return chapter;

  // LOTF style: lazy load per chapter file under chapters/<id>.json
  const id = chapter.id ?? chapter.number;
  if (typeof id === "number" || (typeof id === "string" && id)) {
    try {
      const detail = await ctx.fetchJSON(`chapters/${id}.json`);
      return { ...chapter, ...detail };
    } catch {
      return chapter;
    }
  }
  return chapter;
}

function chapterKeyForNotes(chapter, activePov) {
  const id = chapter?.id != null ? String(chapter.id) : chapter?.number != null ? String(chapter.number) : "";
  const pov = String(activePov || "all");
  return `${id}|${pov}`;
}

function defaultReflection() {
  return {
    takeaway: "",
    question: "",
    apply: "",
  };
}

export default {
  async init(ctx) {
    ctx.state = {
      chapters: [],
      povs: [],
      activePov: "all",
      indices: [],
      currentIndexInFiltered: 0,
      currentIndexFull: 0,
      tocCollapsed: false,
      sideCollapsed: false,
      font: "m",
      notes: {},
      onClick: null,
      onChange: null,
      onInput: null,
      onPointerDown: null,
      onPointerUp: null,
      swipeTargetEl: null,
      pointerStart: null,
      saveTimer: null,
    };

    // Reading panels want full-bleed layout.
    if (ctx.panelEl) {
      ctx.panelEl.dataset.layout = "full";
    }
  },

  async render(ctx, payload = null) {
    const bookId = String(ctx.book?.id || "").trim() || "book";

    if (!ctx.state.chapters.length) {
      const dataPath = String(ctx.module?.data || "chapters.json");
      const raw = await ctx.fetchJSON(dataPath);
      ctx.state.chapters = normalizeChapters(raw);
    }

    const hasPov = ctx.state.chapters.some((c) => String(c?.pov || "").trim());
    ctx.state.povs = hasPov ? resolvePovs(ctx.state.chapters, ctx.registry?.povs) : [];

    const savedPov = getText(povKey(bookId), "all");
    const payloadPov = typeof payload?.pov === "string" ? payload.pov : null;
    const nextPov = payloadPov || savedPov || "all";
    ctx.state.activePov = nextPov;

    ctx.state.indices = filteredIndices(ctx.state.chapters, ctx.state.activePov);

    const savedFont = getText(fontKey(), "m");
    ctx.state.font = savedFont === "l" ? "l" : savedFont === "s" ? "s" : "m";

    ctx.state.notes = getJSON(notesKey(bookId), {}) || {};

    // Start index: payload.chapterId preferred; else saved progress.
    const progress = getJSON(progressKey(bookId), null);
    const payloadChapterId = payload?.chapterId ?? payload?.chapterNumber;
    const payloadIndex = payload?.chapterIndex;

    let fullIndex = 0;
    if (payloadChapterId != null) {
      const idx = ctx.state.chapters.findIndex(
        (c) => String(c?.id) === String(payloadChapterId) || String(c?.number) === String(payloadChapterId)
      );
      if (idx >= 0) fullIndex = idx;
    } else if (Number.isInteger(payloadIndex)) {
      fullIndex = payloadIndex;
    } else if (Number.isInteger(progress?.currentIndexFull)) {
      fullIndex = progress.currentIndexFull;
    }
    fullIndex = clampIndex(fullIndex, ctx.state.chapters.length);

    // Map full index to filtered index.
    const filteredIndex = (() => {
      const pos = ctx.state.indices.indexOf(fullIndex);
      if (pos >= 0) return pos;
      return 0;
    })();

    ctx.state.currentIndexFull = fullIndex;
    ctx.state.currentIndexInFiltered = clampIndex(filteredIndex, ctx.state.indices.length);

    ctx.panelEl.innerHTML = `
      <div class="rg-reading" data-font="${escapeHtml(ctx.state.font)}">
        <aside class="rg-reading__toc" id="rgReadingToc">
          <div class="rg-reading__tochead">
            <h2 class="rg-reading__toctitle">目录</h2>
            <button type="button" class="rg-reading__collapse" data-action="toggle-toc" aria-label="收起或展开目录">◀</button>
          </div>
          <div class="rg-reading__tocbody">
            <div class="rg-reading__filters">
              ${renderPovSelector(ctx.state.povs, ctx.state.activePov)}
            </div>
            <nav class="rg-reading__toclist" id="rgTocList" aria-label="章节目录"></nav>
          </div>
        </aside>

        <article class="rg-reading__main">
          <div class="rg-reading__toolbar">
            <button type="button" class="rg-reading__mobiletoc" data-action="open-toc" aria-label="打开目录">目录</button>
            ${renderFontButtons(ctx.state.font)}
            <div class="rg-reading__toolbarspacer"></div>
            <button type="button" class="rg-reading__export" data-action="export-notes">导出笔记</button>
          </div>

          <header class="rg-reading__header">
            <p class="rg-reading__meta" id="rgChapterMeta"></p>
            <h2 class="rg-reading__title" id="rgChapterTitle">加载中...</h2>
            <div class="rg-reading__progressline">
              <span id="rgChapterProgress">0 / 0</span>
            </div>
          </header>

          <div class="rg-reading__content" id="rgChapterBody"></div>

          <div class="rg-reading__nav">
            <button type="button" class="rg-btn rg-btn--ghost" data-action="prev">◄ 上一章</button>
            <button type="button" class="rg-btn rg-btn--primary" data-action="next">下一章 ►</button>
          </div>
        </article>

        <aside class="rg-reading__side" id="rgReadingSide">
          <div class="rg-reading__sidehead">
            <h3 class="rg-reading__sidetitle">讨论与笔记</h3>
            <button type="button" class="rg-reading__collapse" data-action="toggle-side" aria-label="收起或展开侧栏">▶</button>
          </div>

          <div class="rg-reading__sidebody">
            <section class="rg-reading__card">
              <h4>自我反思</h4>
              <label>
                <span>这一章最触动我的一句话 / 一个场景</span>
                <textarea data-action="reflect" data-field="takeaway" rows="2" placeholder="写下你的捕捉..."></textarea>
              </label>
              <label>
                <span>我想带到课堂/家庭讨论的问题</span>
                <textarea data-action="reflect" data-field="question" rows="2" placeholder="写下你的问题..."></textarea>
              </label>
              <label>
                <span>现代应用：我想尝试的一件小事</span>
                <textarea data-action="reflect" data-field="apply" rows="2" placeholder="写下一个可落地的行动..."></textarea>
              </label>
            </section>

            <section class="rg-reading__card">
              <h4>我的笔记</h4>
              <textarea data-action="note" id="rgNotesInput" rows="7" placeholder="边读边记（自动保存到本地）..."></textarea>
              <p class="rg-reading__hint" id="rgNotesHint">自动保存 · 仅保存在当前浏览器</p>
            </section>
          </div>
        </aside>

        <div class="rg-reading__drawer" id="rgReadingDrawer" aria-hidden="true">
          <div class="rg-reading__drawerbackdrop" data-action="close-drawer"></div>
          <div class="rg-reading__drawerpanel">
            <div class="rg-reading__drawerhead">
              <span>章节目录</span>
              <button type="button" class="rg-iconbtn" data-action="close-drawer" aria-label="关闭目录">✕</button>
            </div>
            <div class="rg-reading__drawerscroll">
              <div class="rg-reading__filters">
                ${renderPovSelector(ctx.state.povs, ctx.state.activePov)}
              </div>
              <nav class="rg-reading__toclist" id="rgTocListMobile" aria-label="章节目录"></nav>
            </div>
          </div>
        </div>
      </div>
    `;

    this._bindEvents(ctx);
    this._renderToc(ctx);
    await this._renderChapter(ctx);
    this._bindSwipe(ctx);
  },

  async destroy(ctx) {
    if (typeof ctx.state?.onClick === "function") {
      ctx.panelEl?.removeEventListener("click", ctx.state.onClick);
      ctx.state.onClick = null;
    }
    if (typeof ctx.state?.onChange === "function") {
      ctx.panelEl?.removeEventListener("change", ctx.state.onChange);
      ctx.state.onChange = null;
    }
    if (typeof ctx.state?.onInput === "function") {
      ctx.panelEl?.removeEventListener("input", ctx.state.onInput);
      ctx.state.onInput = null;
    }
    const swipeTarget = ctx.state?.swipeTargetEl;
    if (typeof ctx.state?.onPointerDown === "function") {
      swipeTarget?.removeEventListener("pointerdown", ctx.state.onPointerDown);
      ctx.state.onPointerDown = null;
    }
    if (typeof ctx.state?.onPointerUp === "function") {
      swipeTarget?.removeEventListener("pointerup", ctx.state.onPointerUp);
      ctx.state.onPointerUp = null;
    }
    ctx.state.swipeTargetEl = null;
    if (ctx.state?.saveTimer) {
      window.clearTimeout(ctx.state.saveTimer);
      ctx.state.saveTimer = null;
    }
    // Ensure module switches do not leave page scroll locked (e.g. drawer left open).
    document.body.style.overflow = "";
  },

  _bindEvents(ctx) {
    const bookId = String(ctx.book?.id || "").trim() || "book";
    if (typeof ctx.state.onClick === "function") {
      ctx.panelEl.removeEventListener("click", ctx.state.onClick);
    }
    if (typeof ctx.state.onChange === "function") {
      ctx.panelEl.removeEventListener("change", ctx.state.onChange);
    }
    if (typeof ctx.state.onInput === "function") {
      ctx.panelEl.removeEventListener("input", ctx.state.onInput);
    }

    const updateFont = (font) => {
      const v = font === "l" ? "l" : font === "s" ? "s" : "m";
      ctx.state.font = v;
      setText(fontKey(), v);
      const root = ctx.panelEl.querySelector(".rg-reading");
      if (root) root.setAttribute("data-font", v);
      // rerender toolbar for active state
      const toolbar = ctx.panelEl.querySelector(".rg-reading__toolbar");
      if (toolbar) {
        toolbar.querySelector(".rg-reading__font")?.remove();
        toolbar.insertAdjacentHTML("afterbegin", renderFontButtons(v));
      }
    };

    const setPov = async (pov) => {
      const v = pov && pov !== "all" ? String(pov) : "all";
      ctx.state.activePov = v;
      setText(povKey(bookId), v);
      ctx.state.indices = filteredIndices(ctx.state.chapters, v);

      // Map current full index into the new filtered list.
      const pos = ctx.state.indices.indexOf(ctx.state.currentIndexFull);
      ctx.state.currentIndexInFiltered = pos >= 0 ? pos : 0;
      this._renderToc(ctx);
      await this._renderChapter(ctx);
    };

    const openDrawer = () => {
      const drawer = ctx.panelEl.querySelector("#rgReadingDrawer");
      if (!drawer) return;
      drawer.classList.add("is-open");
      drawer.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    };

    const closeDrawer = () => {
      const drawer = ctx.panelEl.querySelector("#rgReadingDrawer");
      if (!drawer) return;
      drawer.classList.remove("is-open");
      drawer.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    };

    const toggleCollapse = (targetId, stateKey) => {
      const el = ctx.panelEl.querySelector(targetId);
      if (!el) return;
      const next = !el.classList.contains("is-collapsed");
      el.classList.toggle("is-collapsed", next);
      ctx.state[stateKey] = next;
    };

    const go = async (delta) => {
      const next = ctx.state.currentIndexInFiltered + delta;
      ctx.state.currentIndexInFiltered = clampIndex(next, ctx.state.indices.length);
      ctx.state.currentIndexFull = ctx.state.indices[ctx.state.currentIndexInFiltered] ?? 0;
      this._renderToc(ctx);
      await this._renderChapter(ctx);
      closeDrawer();
    };

    ctx.state.onClick = async (event) => {
      const t = event.target instanceof HTMLElement ? event.target : null;
      const actionEl = t?.closest("[data-action]");
      if (!actionEl) return;

      const action = String(actionEl.dataset.action || "");

      if (action === "open-toc") {
        openDrawer();
        return;
      }
      if (action === "close-drawer") {
        closeDrawer();
        return;
      }
      if (action === "toggle-toc") {
        toggleCollapse("#rgReadingToc", "tocCollapsed");
        return;
      }
      if (action === "toggle-side") {
        toggleCollapse("#rgReadingSide", "sideCollapsed");
        return;
      }
      if (action === "font") {
        updateFont(String(actionEl.dataset.font || "m"));
        return;
      }
      if (action === "prev") {
        await go(-1);
        return;
      }
      if (action === "next") {
        await go(1);
        return;
      }
      if (action === "open-chapter") {
        const full = Number(actionEl.dataset.fullIndex);
        const pos = ctx.state.indices.indexOf(full);
        if (pos >= 0) {
          ctx.state.currentIndexInFiltered = pos;
          ctx.state.currentIndexFull = full;
          this._renderToc(ctx);
          await this._renderChapter(ctx);
          closeDrawer();
        }
        return;
      }
      if (action === "export-notes") {
        const notes = ctx.state.notes || {};
        const lines = [];
        lines.push(`# 阅读花园笔记导出`);
        lines.push(``);
        lines.push(`书籍：${String(ctx.book?.title || bookId)}`);
        lines.push(`导出时间：${new Date().toISOString()}`);
        lines.push(``);

        const keys = Object.keys(notes);
        keys.sort((a, b) => a.localeCompare(b));
        keys.forEach((k) => {
          const entry = notes[k] || {};
          const [chapterId, pov] = String(k).split("|");
          lines.push(`## 章节 ${chapterId}${pov && pov !== "all" ? `（视角：${pov}）` : ""}`);
          if (entry.note) {
            lines.push(entry.note);
          }
          if (entry.reflection) {
            lines.push(``);
            lines.push(`- 触动：${entry.reflection.takeaway || ""}`);
            lines.push(`- 问题：${entry.reflection.question || ""}`);
            lines.push(`- 应用：${entry.reflection.apply || ""}`);
          }
          lines.push(``);
        });

        downloadText(`reading-garden-notes-${bookId}.md`, lines.join("\n"));
        return;
      }
    };

    ctx.panelEl.addEventListener("click", ctx.state.onClick);

    // Delegated change events for select/textarea.
    ctx.state.onChange = async (event) => {
      const t = event.target;
      if (!(t instanceof HTMLElement)) return;

      const action = String(t.getAttribute("data-action") || "");
      if (action === "pov" && t instanceof HTMLSelectElement) {
        await setPov(t.value);
      }
    };
    ctx.panelEl.addEventListener("change", ctx.state.onChange);

    const scheduleSave = () => {
      if (ctx.state.saveTimer) window.clearTimeout(ctx.state.saveTimer);
      ctx.state.saveTimer = window.setTimeout(() => {
        setJSON(notesKey(bookId), ctx.state.notes || {});
      }, 250);
    };

    ctx.state.onInput = (event) => {
      const t = event.target;
      if (!(t instanceof HTMLElement)) return;

      const action = String(t.getAttribute("data-action") || "");
      const current = ctx.state.chapters[ctx.state.currentIndexFull];
      const k = chapterKeyForNotes(current, ctx.state.activePov);
      const entry = ctx.state.notes[k] || { note: "", reflection: defaultReflection(), updatedAt: 0 };

      if (action === "note" && t instanceof HTMLTextAreaElement) {
        entry.note = t.value;
        entry.updatedAt = Date.now();
        ctx.state.notes[k] = entry;
        scheduleSave();
        const hint = ctx.panelEl.querySelector("#rgNotesHint");
        if (hint) hint.textContent = "已保存 · 仅保存在当前浏览器";
        return;
      }

      if (action === "reflect" && t instanceof HTMLTextAreaElement) {
        const field = String(t.getAttribute("data-field") || "");
        entry.reflection = entry.reflection || defaultReflection();
        if (field === "takeaway" || field === "question" || field === "apply") {
          entry.reflection[field] = t.value;
          entry.updatedAt = Date.now();
          ctx.state.notes[k] = entry;
          scheduleSave();
        }
      }
    };
    ctx.panelEl.addEventListener("input", ctx.state.onInput);
  },

  _renderToc(ctx) {
    const list = ctx.panelEl.querySelector("#rgTocList");
    const listMobile = ctx.panelEl.querySelector("#rgTocListMobile");
    if (!list || !listMobile) return;

    const items = ctx.state.indices.map((fullIndex, pos) => {
      const ch = ctx.state.chapters[fullIndex];
      const active = pos === ctx.state.currentIndexInFiltered;
      const title = chapterTitle(ch, fullIndex);
      const sub = String(ch?.titleEn || "").trim();
      return `
        <button type="button" class="rg-reading__tocitem ${active ? "is-on" : ""}" data-action="open-chapter" data-full-index="${fullIndex}">
          <span class="rg-reading__tocnum">${pos + 1}</span>
          <span class="rg-reading__toctext">
            <span class="rg-reading__toctitleline">${escapeHtml(title)}</span>
            ${sub ? `<span class="rg-reading__tocsub">${escapeHtml(sub)}</span>` : ""}
          </span>
        </button>
      `;
    });

    list.innerHTML = items.join("");
    listMobile.innerHTML = items.join("");
  },

  async _renderChapter(ctx) {
    const bookId = String(ctx.book?.id || "").trim() || "book";

    const total = ctx.state.indices.length || 0;
    const pos = clampIndex(ctx.state.currentIndexInFiltered, total);
    const fullIndex = ctx.state.indices[pos] ?? 0;
    ctx.state.currentIndexFull = clampIndex(fullIndex, ctx.state.chapters.length);
    ctx.state.currentIndexInFiltered = pos;

    const raw = ctx.state.chapters[ctx.state.currentIndexFull];
    const chapter = await ensureChapterContent(ctx, raw);
    ctx.state.chapters[ctx.state.currentIndexFull] = chapter;

    const titleEl = ctx.panelEl.querySelector("#rgChapterTitle");
    const metaEl = ctx.panelEl.querySelector("#rgChapterMeta");
    const progEl = ctx.panelEl.querySelector("#rgChapterProgress");
    const bodyEl = ctx.panelEl.querySelector("#rgChapterBody");

    if (metaEl) metaEl.textContent = chapterMetaLine(chapter);
    if (titleEl) titleEl.textContent = chapterTitle(chapter, ctx.state.currentIndexFull);
    if (progEl) progEl.textContent = `${pos + 1} / ${total}`;

    if (bodyEl) {
      bodyEl.innerHTML = "<div class=\"rg-loading\">正在渲染...</div>";
      const paragraphs = (() => {
        if (Array.isArray(chapter?.paragraphs)) {
          if (chapter.paragraphs.length && typeof chapter.paragraphs[0] === "string") {
            return chapter.paragraphs.map((t, i) => ({
              id: `p${i + 1}`,
              text: String(t),
              highlight: false,
            }));
          }
          return chapter.paragraphs.map((p, i) => ({
            id: p?.id || `p${i + 1}`,
            text: typeof p === "string" ? p : String(p?.text || ""),
            highlight: Boolean(p?.highlight),
          }));
        }
        if (Array.isArray(chapter?.content)) {
          return chapter.content.map((t, i) => ({ id: `p${i + 1}`, text: String(t), highlight: false }));
        }
        if (typeof chapter?.content === "string") {
          return trySplitParagraphs(chapter.content).map((t, i) => ({ id: `p${i + 1}`, text: t, highlight: false }));
        }
        return [];
      })();

      if (!paragraphs.length) {
        bodyEl.innerHTML = `<div class="rg-skeleton">暂无正文内容（此章节可能仅提供结构化信息）。</div>`;
      } else {
        bodyEl.innerHTML = `
          <div class="rg-reading__text">
            ${paragraphs
            .map((p) => `<p class="${p.highlight ? "is-highlight" : ""}" id="${escapeHtml(p.id || "")}">${escapeHtml(p.text)}</p>`)
            .join("")}
          </div>
        `;
      }
    }

    // Restore notes for this chapter.
    const k = chapterKeyForNotes(chapter, ctx.state.activePov);
    const entry = ctx.state.notes[k] || { note: "", reflection: defaultReflection(), updatedAt: 0 };
    const notesInput = ctx.panelEl.querySelector("#rgNotesInput");
    if (notesInput && notesInput instanceof HTMLTextAreaElement) {
      notesInput.value = entry.note || "";
    }

    ctx.panelEl.querySelectorAll('textarea[data-action="reflect"]').forEach((el) => {
      if (!(el instanceof HTMLTextAreaElement)) return;
      const field = String(el.getAttribute("data-field") || "");
      const v = entry.reflection && typeof entry.reflection === "object" ? String(entry.reflection[field] || "") : "";
      el.value = v;
    });

    // Persist progress (full index; stable for home progress bars).
    setJSON(progressKey(bookId), {
      currentIndexFull: ctx.state.currentIndexFull,
      currentId: chapter?.id ?? chapter?.number ?? null,
      total: ctx.state.chapters.length,
      pov: ctx.state.activePov,
      updatedAt: Date.now(),
    });

    // Update nav button disabled states.
    const prev = ctx.panelEl.querySelector('[data-action="prev"]');
    const next = ctx.panelEl.querySelector('[data-action="next"]');
    if (prev instanceof HTMLButtonElement) {
      prev.disabled = ctx.state.currentIndexInFiltered <= 0;
      prev.style.visibility = prev.disabled ? "hidden" : "";
    }
    if (next instanceof HTMLButtonElement) {
      next.disabled = ctx.state.currentIndexInFiltered >= total - 1;
      next.style.visibility = next.disabled ? "hidden" : "";
    }
  },

  _bindSwipe(ctx) {
    // Mobile swipe to change chapter.
    const content = ctx.panelEl.querySelector("#rgChapterBody");
    if (!content) return;

    const onPointerDown = (e) => {
      if (!(e instanceof PointerEvent)) return;
      if (e.pointerType === "mouse") return; // avoid desktop accidental swipes
      ctx.state.pointerStart = { x: e.clientX, y: e.clientY, t: Date.now() };
    };

    const onPointerUp = async (e) => {
      if (!(e instanceof PointerEvent)) return;
      const start = ctx.state.pointerStart;
      ctx.state.pointerStart = null;
      if (!start) return;

      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      const dt = Date.now() - start.t;

      if (dt > 800) return;
      if (Math.abs(dx) < 60) return;
      if (Math.abs(dy) > 44) return;

      if (dx < 0) {
        await this._jump(ctx, 1);
      } else {
        await this._jump(ctx, -1);
      }
    };

    const prevTarget = ctx.state.swipeTargetEl;
    if (prevTarget && typeof ctx.state.onPointerDown === "function") {
      prevTarget.removeEventListener("pointerdown", ctx.state.onPointerDown);
    }
    if (prevTarget && typeof ctx.state.onPointerUp === "function") {
      prevTarget.removeEventListener("pointerup", ctx.state.onPointerUp);
    }
    ctx.state.onPointerDown = onPointerDown;
    ctx.state.onPointerUp = onPointerUp;
    ctx.state.swipeTargetEl = content;
    content.addEventListener("pointerdown", onPointerDown, { passive: true });
    content.addEventListener("pointerup", onPointerUp, { passive: true });
  },

  async _jump(ctx, delta) {
    const next = ctx.state.currentIndexInFiltered + delta;
    ctx.state.currentIndexInFiltered = clampIndex(next, ctx.state.indices.length);
    ctx.state.currentIndexFull = ctx.state.indices[ctx.state.currentIndexInFiltered] ?? 0;
    this._renderToc(ctx);
    await this._renderChapter(ctx);
    const bodyEl = ctx.panelEl.querySelector("#rgChapterBody");
    if (bodyEl) bodyEl.scrollIntoView({ behavior: "smooth", block: "start" });
  },
};
