import { escapeHtml } from "../core/dom.js";
import { getJSON, key, setJSON } from "../core/storage.js";

function draftsKey(bookId) {
  return key(["precepts", bookId, "drafts"]);
}

function archiveKey(bookId) {
  return key(["precepts", bookId, "archive"]);
}

function normalize(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.precepts)) return raw.precepts;
  return [];
}

function preceptId(p, index) {
  return String(p?.month || p?.title || p?.id || `p${index + 1}`).trim();
}

function renderCard(ctx, p, index) {
  const id = escapeHtml(preceptId(p, index));
  const month = escapeHtml(String(p?.month || ""));
  const title = escapeHtml(String(p?.title || ""));
  const content = escapeHtml(String(p?.content || ""));
  const imgRaw = String(p?.image || "").trim();
  const img = imgRaw ? ctx.resolvePath(imgRaw) : "";
  return `
    <button type="button" class="rg-precard" data-action="open-precept" data-id="${id}" aria-label="打开信念：${month} ${title}">
      <span class="rg-precard__inner">
        <span class="rg-precard__face rg-precard__front">
          ${img ? `<img class="rg-precard__img" src="${escapeHtml(img)}" alt="" loading="lazy">` : ""}
          <span class="rg-precard__month">${month}</span>
          <span class="rg-precard__title">${title}</span>
        </span>
        <span class="rg-precard__face rg-precard__back">
          <span class="rg-precard__backk">Precept</span>
          <span class="rg-precard__content">${content}</span>
        </span>
      </span>
    </button>
  `;
}

function renderArchiveItem(item, i) {
  const title = escapeHtml(String(item?.title || ""));
  const month = escapeHtml(String(item?.month || ""));
  const draft = escapeHtml(String(item?.draft || ""));
  const when = item?.savedAt ? new Date(item.savedAt).toLocaleString() : "";
  return `
    <div class="rg-archiveitem">
      <div class="rg-archiveitem__top">
        <div class="rg-archiveitem__title">${month} · ${title}</div>
        <button type="button" class="rg-btn rg-btn--ghost rg-archiveitem__del" data-action="del-archive" data-index="${i}">删除</button>
      </div>
      <div class="rg-archiveitem__draft">${draft || "<span class='rg-muted'>（空白草稿）</span>"}</div>
      ${when ? `<div class="rg-archiveitem__when">${escapeHtml(when)}</div>` : ""}
    </div>
  `;
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

export default {
  async init(ctx) {
    ctx.state = {
      precepts: [],
      drafts: {},
      archive: [],
      onClick: null,
      onInput: null,
    };
  },

  async render(ctx) {
    const bookId = String(ctx.book?.id || "").trim() || "book";

    if (!ctx.state.precepts.length) {
      const raw = await ctx.fetchJSON(ctx.module.data || "precepts.json");
      ctx.state.precepts = normalize(raw);
    }

    ctx.state.drafts = getJSON(draftsKey(bookId), {}) || {};
    ctx.state.archive = getJSON(archiveKey(bookId), []) || [];

    ctx.panelEl.innerHTML = `
      <div class="rg-modulehead">
        <h2>信念墙</h2>
        <p>翻转卡片浏览每月信念。点击打开明信片草稿，自动保存并可存档。</p>
      </div>

      <div class="rg-precepts">
        ${ctx.state.precepts.length ? ctx.state.precepts.map((p, i) => renderCard(ctx, p, i)).join("") : `<div class="rg-skeleton">暂无信念墙数据</div>`}
      </div>

      <div class="rg-archive">
        <div class="rg-archive__head">
          <h3>明信片盒</h3>
          <div class="rg-archive__actions">
            <button type="button" class="rg-btn rg-btn--ghost" data-action="export-archive">导出</button>
            <button type="button" class="rg-btn rg-btn--ghost" data-action="clear-archive">清空</button>
          </div>
        </div>
        <div class="rg-archive__list">
          ${ctx.state.archive.length ? ctx.state.archive.map((it, i) => renderArchiveItem(it, i)).join("") : `<div class="rg-skeleton">还没有存档的明信片</div>`}
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
    const bookId = String(ctx.book?.id || "").trim() || "book";

    if (typeof ctx.state.onClick === "function") {
      ctx.panelEl.removeEventListener("click", ctx.state.onClick);
    }

    const persist = () => {
      setJSON(draftsKey(bookId), ctx.state.drafts || {});
      setJSON(archiveKey(bookId), ctx.state.archive || []);
    };

    const openPrecept = (p, pid) => {
      if (!ctx.modal) return;
      const month = String(p?.month || "").trim();
      const title = String(p?.title || "信念").trim();
      const content = String(p?.content || "").trim();
      const attr = String(p?.attribution || "").trim();
      const imgRaw = String(p?.image || "").trim();
      const img = imgRaw ? ctx.resolvePath(imgRaw) : "";
      const draft = String(ctx.state.drafts[pid] || "");

      const bodyHtml = `
        <div class="rg-postcard">
          ${img ? `<img class="rg-postcard__img" src="${escapeHtml(img)}" alt="" loading="lazy">` : ""}
          <div class="rg-postcard__meta">
            <div class="rg-postcard__k">${escapeHtml(month)}</div>
            <h3 class="rg-postcard__t">${escapeHtml(title)}</h3>
          </div>
          <blockquote class="rg-postcard__q">“${escapeHtml(content)}”</blockquote>
          ${attr ? `<div class="rg-postcard__a">— ${escapeHtml(attr)}</div>` : ""}

          <label class="rg-postcard__draft">
            <span>明信片草稿</span>
            <textarea rows="5" data-action="draft" data-id="${escapeHtml(pid)}" placeholder="写给孩子 / 学生 / 未来的自己...">${escapeHtml(draft)}</textarea>
          </label>
          <p class="rg-postcard__hint">自动保存 · 仅保存在当前浏览器</p>
        </div>
      `;

      const footHtml = `
        <button type="button" class="rg-btn rg-btn--ghost" data-action="archive" data-id="${escapeHtml(pid)}">存档</button>
        <button type="button" class="rg-btn rg-btn--primary" data-action="close-modal">完成</button>
      `;

      const onFootClick = (e) => {
        const t = e.target instanceof HTMLElement ? e.target : null;
        const btn = t?.closest("[data-action]");
        if (!btn) return;
        const action = btn.getAttribute("data-action");
        if (action === "close-modal") {
          ctx.modal?.close?.();
          return;
        }
        if (action === "archive") {
          const id = String(btn.getAttribute("data-id") || "");
          const draftNow = String(ctx.state.drafts[id] || "");
          ctx.state.archive.unshift({
            id,
            month,
            title,
            content,
            attribution: attr,
            draft: draftNow,
            savedAt: Date.now(),
          });
          persist();
          ctx.modal?.close?.();
          void this.render(ctx);
        }
      };

      const onBodyInput = (e) => {
        const t = e.target;
        if (!(t instanceof HTMLTextAreaElement)) return;
        if (t.getAttribute("data-action") !== "draft") return;
        const id = String(t.getAttribute("data-id") || "");
        ctx.state.drafts[id] = t.value;
        persist();
      };

      ctx.modal.open({
        title: "明信片草稿",
        bodyHtml,
        footHtml,
        onClose: () => {
          document.getElementById("rgModalFoot")?.removeEventListener("click", onFootClick);
          document.getElementById("rgModalBody")?.removeEventListener("input", onBodyInput);
        },
      });

      document.getElementById("rgModalFoot")?.addEventListener("click", onFootClick);

      document.getElementById("rgModalBody")?.addEventListener("input", onBodyInput);
    };

    ctx.state.onClick = (event) => {
      const t = event.target instanceof HTMLElement ? event.target : null;
      const btn = t?.closest("[data-action]");
      if (!btn) return;
      const action = btn.getAttribute("data-action");

      if (action === "open-precept") {
        const pid = String(btn.getAttribute("data-id") || "");
        const index = ctx.state.precepts.findIndex((p, i) => preceptId(p, i) === pid);
        const p = ctx.state.precepts[index];
        if (p) openPrecept(p, pid);
        return;
      }

      if (action === "del-archive") {
        const i = Number(btn.getAttribute("data-index"));
        if (!Number.isInteger(i) || i < 0 || i >= ctx.state.archive.length) return;
        ctx.state.archive.splice(i, 1);
        persist();
        void this.render(ctx);
        return;
      }

      if (action === "clear-archive") {
        ctx.state.archive = [];
        persist();
        void this.render(ctx);
        return;
      }

      if (action === "export-archive") {
        const lines = [];
        lines.push(`# 信念墙明信片存档`);
        lines.push(`书籍：${String(ctx.book?.title || bookId)}`);
        lines.push(`导出时间：${new Date().toISOString()}`);
        lines.push(``);
        ctx.state.archive.forEach((it) => {
          lines.push(`## ${it.month} · ${it.title}`);
          lines.push(`> ${it.content}`);
          if (it.attribution) lines.push(`— ${it.attribution}`);
          lines.push(``);
          if (it.draft) lines.push(it.draft);
          lines.push(``);
        });
        downloadText(`reading-garden-precepts-${bookId}.md`, lines.join("\n"));
      }
    };

    ctx.panelEl.addEventListener("click", ctx.state.onClick);
  },
};
