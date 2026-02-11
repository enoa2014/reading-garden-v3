import { bindHorizontalSwipe } from './shared/mobile-swipe.js';

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

export default {
    async init(ctx) {
        ctx.state = {
            manifest: null,
            chapterCache: new Map(),
            currentChapter: 1,
            sidebarOpen: false,
            onPanelClick: null,
            swipeCleanup: null
        };
    },

    async render(ctx, payload = null) {
        if (!ctx.state.manifest) {
            const dataPath = ctx.module.data || 'chapters.json';
            const data = await ctx.fetchJSON(dataPath);
            ctx.state.manifest = data && typeof data === 'object' ? data : { chapters: [], totalChapters: 0 };
        }

        const requestedChapter = Number(payload?.chapterNumber);
        if (Number.isInteger(requestedChapter)) {
            ctx.state.currentChapter = requestedChapter;
        }

        ctx.panelEl.innerHTML = `
            <div class="reading-layout">
                <button
                    type="button"
                    class="sidebar-toggle"
                    data-action="open-sidebar"
                    aria-label="显示目录"
                    aria-expanded="false"
                >☰</button>
                <aside class="sidebar" id="oveReadingSidebar">
                    <div class="sidebar-header">
                        <h2>目录</h2>
                        <button type="button" class="sidebar-close" data-action="close-sidebar">✕</button>
                    </div>
                    <nav class="toc" id="oveReadingToc"></nav>
                </aside>
                <button
                    type="button"
                    class="ove-sidebar-backdrop"
                    id="oveSidebarBackdrop"
                    data-action="close-sidebar"
                    aria-label="关闭目录"
                    aria-hidden="true"
                ></button>
                <div class="reading-content">
                    <article class="chapter-content" id="oveChapterContent">
                        <div class="loading">正在加载章节...</div>
                    </article>
                    <nav class="chapter-nav">
                        <button type="button" class="btn-nav" data-action="prev-chapter">◄ 上一章</button>
                        <span class="chapter-progress" id="oveChapterProgress">-- / --</span>
                        <button type="button" class="btn-nav" data-action="next-chapter">下一章 ►</button>
                    </nav>
                </div>
            </div>
        `;

        this._bindEvents(ctx);
        this._bindSwipeGestures(ctx);
        this._renderToc(ctx);
        this._syncSidebar(ctx);

        const chapters = Array.isArray(ctx.state.manifest?.chapters) ? ctx.state.manifest.chapters : [];
        if (chapters.length === 0) {
            const host = ctx.panelEl.querySelector('#oveChapterContent');
            if (host) {
                host.innerHTML = '<div class="loading">未找到章节目录数据</div>';
            }
            return;
        }

        const chapterNumbers = chapters.map((item) => Number(item?.number)).filter(Number.isFinite);
        const minChapter = Math.min(...chapterNumbers);
        const maxChapter = Math.max(...chapterNumbers);
        ctx.state.currentChapter = clamp(ctx.state.currentChapter, minChapter, maxChapter);

        await this._loadChapter(ctx, ctx.state.currentChapter);
    },

    async destroy(ctx) {
        if (typeof ctx.state?.onPanelClick === 'function') {
            ctx.panelEl?.removeEventListener('click', ctx.state.onPanelClick);
            ctx.state.onPanelClick = null;
        }
        if (typeof ctx.state?.swipeCleanup === 'function') {
            ctx.state.swipeCleanup();
            ctx.state.swipeCleanup = null;
        }
    },

    _bindEvents(ctx) {
        if (typeof ctx.state.onPanelClick === 'function') {
            ctx.panelEl.removeEventListener('click', ctx.state.onPanelClick);
        }

        ctx.state.onPanelClick = async (event) => {
            const target = event.target.closest('[data-action]');
            if (!target) return;

            const action = target.dataset.action;
            if (action === 'open-sidebar') {
                ctx.state.sidebarOpen = !ctx.state.sidebarOpen;
                this._syncSidebar(ctx);
                return;
            }
            if (action === 'close-sidebar') {
                ctx.state.sidebarOpen = false;
                this._syncSidebar(ctx);
                return;
            }
            if (action === 'select-chapter') {
                const number = Number(target.dataset.chapter);
                if (!Number.isInteger(number)) return;
                if (typeof target.blur === 'function') {
                    target.blur();
                }
                ctx.state.currentChapter = number;
                ctx.state.sidebarOpen = false;
                this._syncSidebar(ctx);
                await this._loadChapter(ctx, number);
                return;
            }
            if (action === 'prev-chapter') {
                if (typeof target.blur === 'function') {
                    target.blur();
                }
                await this._loadChapter(ctx, ctx.state.currentChapter - 1);
                return;
            }
            if (action === 'next-chapter') {
                if (typeof target.blur === 'function') {
                    target.blur();
                }
                await this._loadChapter(ctx, ctx.state.currentChapter + 1);
            }
        };

        ctx.panelEl.addEventListener('click', ctx.state.onPanelClick);
    },

    _bindSwipeGestures(ctx) {
        if (typeof ctx.state?.swipeCleanup === 'function') {
            ctx.state.swipeCleanup();
            ctx.state.swipeCleanup = null;
        }

        const contentEl = ctx.panelEl.querySelector('#oveChapterContent');
        if (!contentEl) return;

        ctx.state.swipeCleanup = bindHorizontalSwipe(contentEl, {
            onSwipeLeft: () => {
                void this._loadChapter(ctx, ctx.state.currentChapter + 1);
            },
            onSwipeRight: () => {
                void this._loadChapter(ctx, ctx.state.currentChapter - 1);
            }
        });
    },

    _syncSidebar(ctx) {
        const sidebar = ctx.panelEl.querySelector('#oveReadingSidebar');
        const toggle = ctx.panelEl.querySelector('[data-action="open-sidebar"]');
        const backdrop = ctx.panelEl.querySelector('#oveSidebarBackdrop');
        if (!sidebar) return;
        sidebar.classList.toggle('open', !!ctx.state.sidebarOpen);
        if (toggle) {
            toggle.setAttribute('aria-expanded', String(!!ctx.state.sidebarOpen));
        }
        if (backdrop) {
            backdrop.classList.toggle('active', !!ctx.state.sidebarOpen);
            backdrop.setAttribute('aria-hidden', String(!ctx.state.sidebarOpen));
        }
    },

    _renderToc(ctx) {
        const toc = ctx.panelEl.querySelector('#oveReadingToc');
        const chapters = Array.isArray(ctx.state.manifest?.chapters) ? ctx.state.manifest.chapters : [];
        if (!toc) return;

        toc.innerHTML = chapters.map((chapter) => `
            <button
                type="button"
                class="toc-item ${Number(chapter?.number) === Number(ctx.state.currentChapter) ? 'active' : ''}"
                data-action="select-chapter"
                data-chapter="${escapeHtml(chapter?.number)}"
            >
                <span class="toc-number">${escapeHtml(chapter?.number)}</span>
                <span class="toc-title">${escapeHtml(chapter?.title || `第 ${chapter?.number} 章`)}</span>
            </button>
        `).join('');
    },

    async _loadChapter(ctx, chapterNumber) {
        const chapters = Array.isArray(ctx.state.manifest?.chapters) ? ctx.state.manifest.chapters : [];
        const chapter = chapters.find((entry) => Number(entry?.number) === Number(chapterNumber));
        if (!chapter) return;

        const contentHost = ctx.panelEl.querySelector('#oveChapterContent');
        if (!contentHost) return;

        ctx.state.currentChapter = Number(chapter.number);
        contentHost.innerHTML = '<div class="loading">正在加载章节...</div>';

        let data = ctx.state.chapterCache.get(ctx.state.currentChapter);
        if (!data) {
            try {
                data = await ctx.fetchJSON(`chapters/${ctx.state.currentChapter}.json`);
                ctx.state.chapterCache.set(ctx.state.currentChapter, data);
            } catch (error) {
                contentHost.innerHTML = `<div class="loading">章节加载失败：${escapeHtml(error?.message || '未知错误')}</div>`;
                return;
            }
        }

        const paragraphs = Array.isArray(data?.content) ? data.content : [];
        contentHost.innerHTML = `
            <h2 class="chapter-title">${escapeHtml(data?.title || chapter.title || `第 ${chapter.number} 章`)}</h2>
            <div class="chapter-text">
                ${paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}
            </div>
        `;
        contentHost.scrollTop = 0;

        this._renderToc(ctx);
        this._updateNavigation(ctx);
        this._resetReadingPosition(ctx);
    },

    _updateNavigation(ctx) {
        const chapters = Array.isArray(ctx.state.manifest?.chapters) ? ctx.state.manifest.chapters : [];
        const currentIndex = chapters.findIndex((entry) => Number(entry?.number) === Number(ctx.state.currentChapter));
        const prevBtn = ctx.panelEl.querySelector('[data-action="prev-chapter"]');
        const nextBtn = ctx.panelEl.querySelector('[data-action="next-chapter"]');
        const progress = ctx.panelEl.querySelector('#oveChapterProgress');

        if (prevBtn) {
            prevBtn.disabled = currentIndex <= 0;
            prevBtn.style.visibility = prevBtn.disabled ? 'hidden' : '';
        }
        if (nextBtn) {
            nextBtn.disabled = currentIndex < 0 || currentIndex >= chapters.length - 1;
            nextBtn.style.visibility = nextBtn.disabled ? 'hidden' : '';
        }
        if (progress) {
            progress.textContent = currentIndex >= 0 ? `${currentIndex + 1} / ${chapters.length}` : '-- / --';
        }
    },

    _resetReadingPosition(ctx) {
        const contentHost = ctx.panelEl.querySelector('#oveChapterContent');
        const chapterText = ctx.panelEl.querySelector('#oveChapterContent .chapter-text');
        const readingContent = ctx.panelEl.querySelector('.reading-content');
        const layoutEl = ctx.panelEl.querySelector('.reading-layout');
        const chapterTitle = ctx.panelEl.querySelector('#oveChapterContent .chapter-title');

        const resetNode = (el) => {
            if (!el) return;
            el.scrollTop = 0;
            el.scrollLeft = 0;
            if (typeof el.scrollTo === 'function') {
                el.scrollTo({ top: 0, left: 0, behavior: 'auto' });
            }
        };

        [chapterText, contentHost, readingContent, layoutEl].forEach(resetNode);

        const anchorEl = chapterTitle || contentHost;
        const getHeaderOffset = () => {
            const raw = getComputedStyle(document.documentElement).getPropertyValue('--header-height');
            const parsed = Number.parseFloat(raw);
            return Number.isFinite(parsed) && parsed > 0 ? parsed + 8 : 64;
        };
        const alignToChapterTop = () => {
            if (!anchorEl) return;
            if (typeof anchorEl.scrollIntoView === 'function') {
                anchorEl.scrollIntoView({ block: 'start', inline: 'nearest' });
            }
            if (typeof window.scrollTo === 'function') {
                const rect = anchorEl.getBoundingClientRect();
                const targetTop = Math.max(0, rect.top + window.scrollY - getHeaderOffset());
                window.scrollTo({ top: targetTop, left: 0, behavior: 'auto' });
            }
        };

        const blurActive = () => {
            if (typeof document.activeElement?.blur === 'function') {
                document.activeElement.blur();
            }
        };

        blurActive();
        requestAnimationFrame(() => {
            alignToChapterTop();
            blurActive();
        });
        setTimeout(() => {
            alignToChapterTop();
            blurActive();
        }, 0);
    }
};
