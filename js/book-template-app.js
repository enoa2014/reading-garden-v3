/**
 * Book Template App
 *
 * 复制本文件为 js/<book-id>-app.js，然后替换数据路径。
 */

let chapters = [];
let currentChapter = 0;

document.addEventListener('DOMContentLoaded', async () => {
  initTabs();
  initThemeToggle();
  initSidebar();
  await loadChapters();
  renderOverview();
});

function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.view-panel');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const viewId = btn.dataset.view;
      tabBtns.forEach(x => x.classList.remove('active'));
      panels.forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(viewId)?.classList.add('active');
    });
  });
}

function initThemeToggle() {
  const toggle = document.getElementById('themeToggle');
  if (!toggle) return;
  toggle.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
  });
}

function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  document.getElementById('sidebarToggle')?.addEventListener('click', () => {
    sidebar?.classList.add('open');
  });
  document.getElementById('sidebarClose')?.addEventListener('click', () => {
    sidebar?.classList.remove('open');
  });
}

async function loadChapters() {
  const toc = document.getElementById('toc');
  const content = document.getElementById('chapterContent');

  try {
    // TODO: 替换为你的实际路径
    const response = await fetch('../data/__BOOK_ID__/chapters.json');
    const data = await response.json();
    chapters = data.chapters || [];

    if (chapters.length === 0) {
      if (content) content.innerHTML = '<p class="loading">暂无章节数据</p>';
      if (toc) toc.innerHTML = '';
      return;
    }

    renderTOC();
    goToChapter(0);
    bindChapterNav();
  } catch (error) {
    console.error('Failed to load chapters:', error);
    if (content) content.innerHTML = '<p class="loading">章节加载失败，请检查数据路径</p>';
    if (toc) toc.innerHTML = '';
  }
}

function renderOverview() {
  const el = document.getElementById('overviewContainer');
  if (!el) return;
  el.innerHTML = `
    <div class="cards-container">
      <p>请在 <code>js/<book-id>-app.js</code> 中实现你的业务模块。</p>
      <p>当前模板已包含：tab 切换、主题切换、侧边栏、章节阅读基础逻辑。</p>
    </div>
  `;
}

function renderTOC() {
  const toc = document.getElementById('toc');
  if (!toc) return;

  toc.innerHTML = chapters
    .map((ch, idx) => `<button class="toc-item" data-index="${idx}">${idx + 1}. ${escapeHtml(ch.title || `章节 ${idx + 1}`)}</button>`)
    .join('');

  toc.querySelectorAll('.toc-item').forEach(item => {
    item.addEventListener('click', () => {
      const idx = Number(item.dataset.index);
      goToChapter(idx);
      document.getElementById('sidebar')?.classList.remove('open');
    });
  });
}

function bindChapterNav() {
  document.getElementById('prevChapter')?.addEventListener('click', () => goToChapter(currentChapter - 1));
  document.getElementById('nextChapter')?.addEventListener('click', () => goToChapter(currentChapter + 1));
}

function goToChapter(index) {
  if (index < 0 || index >= chapters.length) return;
  currentChapter = index;

  const chapter = chapters[index] || {};
  const title = chapter.title || `章节 ${index + 1}`;
  const paragraphs = Array.isArray(chapter.content)
    ? chapter.content
    : String(chapter.content || '').split('\n\n').filter(Boolean);

  const content = document.getElementById('chapterContent');
  if (content) {
    content.innerHTML = `
      <h2>${escapeHtml(title)}</h2>
      ${paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join('')}
    `;
  }

  document.querySelectorAll('.toc-item').forEach((item, idx) => {
    item.classList.toggle('active', idx === index);
  });

  const progress = document.getElementById('chapterProgress');
  if (progress) progress.textContent = `${index + 1} / ${chapters.length}`;

  const prev = document.getElementById('prevChapter');
  const next = document.getElementById('nextChapter');
  if (prev) prev.disabled = index === 0;
  if (next) next.disabled = index === chapters.length - 1;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
