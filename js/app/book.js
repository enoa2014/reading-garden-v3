import { BookRuntime } from "../core/book-runtime.js";
import { createModal } from "../core/modal.js";
import { icon } from "../core/icons.js";
import { key } from "../core/storage.js";

function getParam(name) {
  const u = new URL(window.location.href);
  return u.searchParams.get(name);
}

function setIcon(id, svg) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = svg || "";
}

function getTheme() {
  try {
    return localStorage.getItem(key("theme")) || document.documentElement.getAttribute("data-theme") || "light";
  } catch {
    return document.documentElement.getAttribute("data-theme") || "light";
  }
}

function syncTopbarIcons() {
  const theme = getTheme();
  setIcon("themeIcon", theme === "dark" ? icon("moon") : icon("sun"));

  const onTeacher = document.body.classList.contains("is-teacher");
  const teacherHost = document.getElementById("teacherIcon");
  if (teacherHost) {
    teacherHost.innerHTML = icon("teacher");
    teacherHost.parentElement?.classList.toggle("is-on", onTeacher);
  }
}

async function main() {
  setIcon("backIcon", icon("back"));
  setIcon("closeIcon", icon("close"));

  const bookId = String(getParam("book") || "").trim();
  if (!bookId) {
    const mainEl = document.getElementById("runtimeMain");
    if (mainEl) {
      mainEl.innerHTML = `
        <section class="rg-panel rg-panel--active">
          <div class="rg-skeleton">缺少参数：book。请从首页进入书籍。</div>
        </section>
      `;
    }
    return;
  }

  const modal = createModal();

  const runtime = new BookRuntime({
    registryUrl: `data/${encodeURIComponent(bookId)}/registry.json`,
  });

  document.getElementById("themeToggle")?.addEventListener("click", () => {
    // runtime toggles theme; we sync icon after it runs.
    window.setTimeout(syncTopbarIcons, 0);
  });

  document.getElementById("teacherToggle")?.addEventListener("click", () => {
    window.setTimeout(syncTopbarIcons, 0);
  });

  await runtime.start({ modal });
  syncTopbarIcons();
}

main().catch((err) => {
  console.error(err);
  const mainEl = document.getElementById("runtimeMain");
  if (mainEl) {
    mainEl.innerHTML = `
      <section class="rg-panel rg-panel--active">
        <div class="rg-skeleton">页面初始化失败，请查看控制台。</div>
      </section>
    `;
  }
});

