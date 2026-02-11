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
        const isNarrow = typeof window !== 'undefined'
            && typeof window.matchMedia === 'function'
            && window.matchMedia('(max-width: 1024px)').matches;

        ctx.state = {
            segments: [],
            globalIndex: 0,
            currentFilter: 'all',
            fontSize: 1.05,
            ui: {
                sidebarOpen: !isNarrow,
                notesOpen: !isNarrow
            },
            onPanelClick: null,
            swipeCleanup: null
        };
    },

    async render(ctx, payload = null) {
        if (!ctx.state.segments.length) {
            const dataPath = ctx.module.data || 'content.json';
            const data = await ctx.fetchJSON(dataPath);
            ctx.state.segments = Array.isArray(data) ? data : [];
            ctx.state.globalIndex = 0;
        }

        this._applyPayload(ctx, payload);

        ctx.panelEl.innerHTML = `
            <div class="reading-layout">
                <aside class="reading-sidebar" id="storyReadingSidebar">
                    <div class="sidebar-header">
                        <h3>📑 目录</h3>
                        <button type="button" class="btn-icon sidebar-close" data-action="close-sidebar">◀</button>
                    </div>
                    <nav class="reading-toc" id="storyReadingToc"></nav>
                </aside>

                <div class="reading-main">
                    <div class="reading-toolbar">
                        <button type="button" class="btn-icon sidebar-toggle" data-action="open-sidebar" title="目录">📑</button>
                        <button type="button" class="btn-icon notes-toolbar-toggle" data-action="toggle-notes" title="阅读笔记">📝</button>
                        <div class="toolbar-group">
                            <span class="toolbar-label">时间线:</span>
                            <button type="button" class="timeline-filter" data-action="set-filter" data-filter="all">全部</button>
                            <button type="button" class="timeline-filter" data-action="set-filter" data-filter="arrival">接触</button>
                            <button type="button" class="timeline-filter" data-action="set-filter" data-filter="daughter">回忆</button>
                        </div>
                        <div class="toolbar-group">
                            <span class="toolbar-label">字体:</span>
                            <button type="button" class="btn-icon font-btn" data-action="font-decrease" title="缩小">A-</button>
                            <button type="button" class="btn-icon font-btn" data-action="font-increase" title="放大">A+</button>
                        </div>
                    </div>

                    <article class="chapter-content" id="storyChapterContent">
                        <div class="loading">加载中...</div>
                    </article>

                    <nav class="chapter-nav">
                        <button type="button" class="btn-nav" data-action="prev-segment">◄ 上一段</button>
                        <span class="chapter-progress" id="storySegmentProgress">1 / 1</span>
                        <button type="button" class="btn-nav" data-action="next-segment">下一段 ►</button>
                    </nav>
                </div>

                <aside class="notes-panel" id="storyNotesPanel">
                    <div class="notes-header">
                        <h3>📝 阅读笔记</h3>
                        <button type="button" class="btn-icon notes-edge-toggle" data-action="toggle-notes" title="收起/展开">◀</button>
                    </div>
                    <textarea class="notes-input" id="storyReadingNotes" placeholder="记录你的思考和感悟..."></textarea>
                    <button type="button" class="btn-save" data-action="save-notes">💾 保存笔记</button>
                </aside>
            </div>
            <div class="reading-progress">
                <div id="storyReadingProgressBar" style="width:100%;height:0%;border-radius:9999px;background:linear-gradient(180deg,var(--color-secondary) 0%,var(--color-accent) 100%);transition:height 0.2s ease;"></div>
            </div>
        `;

        this._bindEvents(ctx);
        this._bindSwipeGestures(ctx);
        this._syncSidebarState(ctx);
        this._syncNotesState(ctx);
        this._renderReading(ctx);
        this._loadNotes(ctx);
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

    _applyPayload(ctx, payload) {
        if (!payload || typeof payload !== 'object') return;

        const requestedFilter = String(payload.filter || '').trim();
        if (requestedFilter === 'all' || requestedFilter === 'arrival' || requestedFilter === 'daughter') {
            ctx.state.currentFilter = requestedFilter;
        }

        if (payload.segmentId != null) {
            const targetId = String(payload.segmentId).trim();
            const index = ctx.state.segments.findIndex((segment) => String(segment?.id || '').trim() === targetId);
            if (index >= 0) {
                ctx.state.globalIndex = index;
                return;
            }
        }

        const requestedIndex = Number(payload.segmentIndex);
        if (Number.isInteger(requestedIndex)) {
            ctx.state.globalIndex = clamp(requestedIndex, 0, Math.max(0, ctx.state.segments.length - 1));
        }
    },

    _bindEvents(ctx) {
        if (typeof ctx.state.onPanelClick === 'function') {
            ctx.panelEl.removeEventListener('click', ctx.state.onPanelClick);
        }

        ctx.state.onPanelClick = (event) => {
            const target = event.target.closest('[data-action]');
            if (!target) return;

            const action = target.dataset.action;
            if (action === 'open-sidebar') {
                ctx.state.ui.sidebarOpen = !ctx.state.ui.sidebarOpen;
                this._syncSidebarState(ctx);
                return;
            }
            if (action === 'close-sidebar') {
                ctx.state.ui.sidebarOpen = false;
                this._syncSidebarState(ctx);
                return;
            }
            if (action === 'toggle-notes') {
                ctx.state.ui.notesOpen = !ctx.state.ui.notesOpen;
                this._syncNotesState(ctx);
                return;
            }
            if (action === 'font-increase') {
                ctx.state.fontSize = clamp(Number((ctx.state.fontSize + 0.1).toFixed(2)), 0.85, 1.5);
                this._renderContent(ctx, this._getFilteredSegments(ctx), false);
                return;
            }
            if (action === 'font-decrease') {
                ctx.state.fontSize = clamp(Number((ctx.state.fontSize - 0.1).toFixed(2)), 0.85, 1.5);
                this._renderContent(ctx, this._getFilteredSegments(ctx), false);
                return;
            }
            if (action === 'set-filter') {
                const nextFilter = String(target.dataset.filter || '').trim();
                if (nextFilter === 'all' || nextFilter === 'arrival' || nextFilter === 'daughter') {
                    ctx.state.currentFilter = nextFilter;
                    this._renderReading(ctx);
                }
                return;
            }
            if (action === 'select-segment') {
                const originalIndex = Number(target.dataset.originalIndex);
                if (Number.isInteger(originalIndex)) {
                    if (typeof target.blur === 'function') {
                        target.blur();
                    }
                    ctx.state.globalIndex = clamp(originalIndex, 0, Math.max(0, ctx.state.segments.length - 1));
                    this._renderReading(ctx);
                }
                return;
            }
            if (action === 'prev-segment') {
                this._moveSegment(ctx, -1);
                return;
            }
            if (action === 'next-segment') {
                this._moveSegment(ctx, 1);
                return;
            }
            if (action === 'save-notes') {
                this._saveNotes(ctx, target);
            }
        };

        ctx.panelEl.addEventListener('click', ctx.state.onPanelClick);
    },

    _bindSwipeGestures(ctx) {
        if (typeof ctx.state?.swipeCleanup === 'function') {
            ctx.state.swipeCleanup();
            ctx.state.swipeCleanup = null;
        }

        const contentEl = ctx.panelEl.querySelector('#storyChapterContent');
        if (!contentEl) return;

        ctx.state.swipeCleanup = bindHorizontalSwipe(contentEl, {
            onSwipeLeft: () => {
                this._moveSegment(ctx, 1);
            },
            onSwipeRight: () => {
                this._moveSegment(ctx, -1);
            }
        });
    },

    _renderReading(ctx, shouldResetPosition = true) {
        const filtered = this._getFilteredSegments(ctx);
        this._ensureCurrentInFilter(ctx, filtered);
        const finalFiltered = this._getFilteredSegments(ctx);
        this._renderFilters(ctx);
        this._renderToc(ctx, finalFiltered);
        this._renderContent(ctx, finalFiltered, shouldResetPosition);
    },

    _getFilteredSegments(ctx) {
        const result = [];
        ctx.state.segments.forEach((segment, index) => {
            const timeline = String(segment?.timeline || '').trim();
            if (ctx.state.currentFilter === 'all' || timeline === ctx.state.currentFilter) {
                result.push({ segment, originalIndex: index });
            }
        });
        return result;
    },

    _ensureCurrentInFilter(ctx, filtered) {
        if (!filtered.length) return;
        const hit = filtered.find((item) => item.originalIndex === ctx.state.globalIndex);
        if (hit) return;

        const nearest = filtered.find((item) => item.originalIndex >= ctx.state.globalIndex);
        if (nearest) {
            ctx.state.globalIndex = nearest.originalIndex;
            return;
        }
        ctx.state.globalIndex = filtered[filtered.length - 1].originalIndex;
    },

    _renderFilters(ctx) {
        ctx.panelEl.querySelectorAll('[data-action="set-filter"]').forEach((button) => {
            button.classList.toggle('active', button.dataset.filter === ctx.state.currentFilter);
        });
    },

    _renderToc(ctx, filtered) {
        const tocEl = ctx.panelEl.querySelector('#storyReadingToc');
        if (!tocEl) return;

        tocEl.innerHTML = filtered.map((item, displayIndex) => {
            const timeline = String(item.segment?.timeline || '').trim();
            const isDaughter = timeline === 'daughter';
            return `
                <button
                    type="button"
                    class="toc-item ${item.originalIndex === ctx.state.globalIndex ? 'active' : ''}"
                    data-action="select-segment"
                    data-original-index="${item.originalIndex}"
                >
                    <span class="toc-indicator ${isDaughter ? 'daughter' : 'arrival'}"></span>
                    <span>${isDaughter ? '回忆' : '接触'} · 第 ${displayIndex + 1} 段</span>
                </button>
            `;
        }).join('');
    },

    _renderContent(ctx, filtered, shouldResetPosition = true) {
        const contentEl = ctx.panelEl.querySelector('#storyChapterContent');
        const progressTextEl = ctx.panelEl.querySelector('#storySegmentProgress');
        const prevBtn = ctx.panelEl.querySelector('[data-action="prev-segment"]');
        const nextBtn = ctx.panelEl.querySelector('[data-action="next-segment"]');
        const barEl = ctx.panelEl.querySelector('#storyReadingProgressBar');

        if (!contentEl) return;

        if (!filtered.length) {
            contentEl.innerHTML = '<div class="loading">没有匹配的内容</div>';
            if (progressTextEl) progressTextEl.textContent = '0 / 0';
            if (prevBtn) prevBtn.disabled = true;
            if (nextBtn) nextBtn.disabled = true;
            if (barEl) barEl.style.height = '0%';
            return;
        }

        const displayIndex = filtered.findIndex((item) => item.originalIndex === ctx.state.globalIndex);
        const safeDisplayIndex = displayIndex >= 0 ? displayIndex : 0;
        const currentItem = filtered[safeDisplayIndex];
        const segment = currentItem.segment || {};
        const paragraphs = Array.isArray(segment.paragraphs) ? segment.paragraphs : [];
        const timeline = String(segment.timeline || '').trim();
        const isDaughter = timeline === 'daughter';

        contentEl.innerHTML = `
            <div class="segment-header">
                <span class="segment-label ${isDaughter ? 'daughter' : 'arrival'}">${isDaughter ? '回忆时间线' : '接触时间线'}</span>
                <span class="segment-number">第 ${safeDisplayIndex + 1} / ${filtered.length} 段</span>
            </div>
            ${paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}
        `;
        contentEl.style.fontSize = `${ctx.state.fontSize}rem`;
        contentEl.scrollTop = 0;

        if (progressTextEl) {
            progressTextEl.textContent = `${safeDisplayIndex + 1} / ${filtered.length}`;
        }
        if (prevBtn) prevBtn.disabled = safeDisplayIndex === 0;
        if (nextBtn) nextBtn.disabled = safeDisplayIndex >= filtered.length - 1;
        if (barEl) {
            barEl.style.height = `${Math.round(((safeDisplayIndex + 1) / filtered.length) * 100)}%`;
        }
        if (shouldResetPosition) {
            this._resetReadingPosition(ctx);
        }
    },

    _moveSegment(ctx, delta) {
        const filtered = this._getFilteredSegments(ctx);
        if (!filtered.length) return;

        const displayIndex = filtered.findIndex((item) => item.originalIndex === ctx.state.globalIndex);
        const safeDisplayIndex = displayIndex >= 0 ? displayIndex : 0;
        const nextIndex = safeDisplayIndex + delta;
        if (nextIndex < 0 || nextIndex >= filtered.length) return;

        ctx.state.globalIndex = filtered[nextIndex].originalIndex;
        this._renderReading(ctx);
    },

    _resetReadingPosition(ctx) {
        const contentEl = ctx.panelEl.querySelector('#storyChapterContent');
        const readingMainEl = ctx.panelEl.querySelector('.reading-main');
        const layoutEl = ctx.panelEl.querySelector('.reading-layout');
        const mainEl = document.getElementById('runtimeMain');
        const segmentHeaderEl = ctx.panelEl.querySelector('#storyChapterContent .segment-header');

        const resetNode = (el) => {
            if (!el) return;
            el.scrollTop = 0;
            el.scrollLeft = 0;
            if (typeof el.scrollTo === 'function') {
                el.scrollTo({ top: 0, left: 0, behavior: 'auto' });
            }
        };

        [contentEl, readingMainEl, layoutEl, mainEl, document.scrollingElement, document.documentElement, document.body]
            .forEach(resetNode);

        if (segmentHeaderEl && typeof segmentHeaderEl.scrollIntoView === 'function') {
            requestAnimationFrame(() => {
                segmentHeaderEl.scrollIntoView({ block: 'start', inline: 'nearest' });
            });
        }
    },

    _syncSidebarState(ctx) {
        const layout = ctx.panelEl.querySelector('.reading-layout');
        const sidebar = ctx.panelEl.querySelector('#storyReadingSidebar');
        const toggleBtn = ctx.panelEl.querySelector('.sidebar-toggle');
        const closeBtn = ctx.panelEl.querySelector('[data-action="close-sidebar"]');
        if (!sidebar || !layout) return;

        const isOpen = !!ctx.state.ui.sidebarOpen;
        layout.classList.toggle('toc-collapsed', !isOpen);
        sidebar.classList.toggle('open', isOpen);
        if (toggleBtn) {
            toggleBtn.classList.toggle('active', isOpen);
            toggleBtn.title = isOpen ? '收起目录' : '展开目录';
            toggleBtn.setAttribute('aria-pressed', String(isOpen));
        }
        if (closeBtn) {
            closeBtn.textContent = isOpen ? '◀' : '▶';
            closeBtn.title = isOpen ? '收起目录' : '展开目录';
        }
    },

    _syncNotesState(ctx) {
        const layout = ctx.panelEl.querySelector('.reading-layout');
        const notesPanel = ctx.panelEl.querySelector('#storyNotesPanel');
        const toolbarToggle = ctx.panelEl.querySelector('.notes-toolbar-toggle');
        const edgeToggle = ctx.panelEl.querySelector('.notes-edge-toggle');
        if (!notesPanel || !layout) return;

        const isOpen = !!ctx.state.ui.notesOpen;
        layout.classList.toggle('notes-collapsed', !isOpen);
        notesPanel.classList.toggle('open', isOpen);

        if (toolbarToggle) {
            toolbarToggle.classList.toggle('active', isOpen);
            toolbarToggle.title = isOpen ? '收起笔记' : '展开笔记';
            toolbarToggle.setAttribute('aria-pressed', String(isOpen));
        }
        if (edgeToggle) {
            edgeToggle.textContent = isOpen ? '◀' : '▶';
            edgeToggle.title = isOpen ? '收起笔记' : '展开笔记';
        }
    },

    _notesStorageKey(ctx) {
        const bookId = String(ctx.book?.id || 'story-of-your-life').trim();
        return `${bookId}-notes`;
    },

    _loadNotes(ctx) {
        const textarea = ctx.panelEl.querySelector('#storyReadingNotes');
        if (!textarea) return;
        const text = localStorage.getItem(this._notesStorageKey(ctx));
        textarea.value = text == null ? '' : text;
    },

    _saveNotes(ctx, buttonEl) {
        const textarea = ctx.panelEl.querySelector('#storyReadingNotes');
        if (!textarea) return;

        localStorage.setItem(this._notesStorageKey(ctx), textarea.value || '');

        if (!buttonEl) return;
        const original = buttonEl.textContent;
        buttonEl.textContent = '✅ 已保存';
        setTimeout(() => {
            buttonEl.textContent = original;
        }, 1400);
    }
};
