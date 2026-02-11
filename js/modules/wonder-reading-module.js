import { bindHorizontalSwipe } from './shared/mobile-swipe.js';

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
}

export default {
    async init(ctx) {
        ctx.state = {
            chapters: [],
            povs: [],
            activePov: '',
            currentIndex: 0,
            indexByPov: {},
            unsubscribePov: null,
            onPanelClick: null,
            swipeCleanup: null,
            ui: {
                povCollapsed: false,
                tocCollapsed: false
            }
        };
    },

    async render(ctx, payload = null) {
        if (!ctx.state.chapters.length) {
            const dataPath = ctx.module.data || 'chapters.json';
            const data = await ctx.fetchJSON(dataPath);
            ctx.state.chapters = Array.isArray(data) ? data : (Array.isArray(data.chapters) ? data.chapters : []);
        }

        if (!ctx.state.povs.length) {
            ctx.state.povs = this._normalizePovs(ctx, ctx.state.chapters);
        }

        const payloadPov = typeof payload?.pov === 'string' ? payload.pov : null;
        const sharedPov = typeof ctx.getSharedState === 'function'
            ? ctx.getSharedState('activePov', null)
            : null;
        const savedPov = localStorage.getItem(this._povStorageKey(ctx));
        const validPovIds = new Set(ctx.state.povs.map((item) => item.id));

        const nextPov = [payloadPov, sharedPov, savedPov, ctx.state.activePov, ctx.state.povs[0]?.id]
            .find((value) => typeof value === 'string' && validPovIds.has(value)) || '';
        if (nextPov) {
            ctx.state.activePov = nextPov;
        }

        if (typeof ctx.subscribeSharedState === 'function' && !ctx.state.unsubscribePov) {
            ctx.state.unsubscribePov = ctx.subscribeSharedState('activePov', (value) => {
                if (typeof value !== 'string' || !validPovIds.has(value) || value === ctx.state.activePov) {
                    return;
                }
                this._setActivePov(ctx, value, { keepIndex: false, rerender: true });
            });
        }

        ctx.panelEl.innerHTML = `
            <div class="wonder-reading-shell">
              <aside class="wonder-reading-pov" id="wonderPovSidebar">
                <div class="book-cover-container wonder-reading-cover-block">
                  <img src="${escapeHtml(ctx.resolvePath('assets/images/wonder/covers/cover.webp'))}" alt="奇迹男孩封面" class="book-cover-img">
                  <h2 class="book-title">奇迹男孩</h2>
                </div>
                <div class="pov-section">
                  <h3>叙述者视角</h3>
                  <div class="pov-list" id="wonderPovList">
                    ${ctx.state.povs.map((pov) => `
                      <button class="pov-btn ${pov.id === ctx.state.activePov ? 'active' : ''}" data-action="switch-pov" data-pov="${escapeHtml(pov.id)}">
                        ${this._renderPovAvatar(ctx, pov)}
                        <span>${escapeHtml(pov.name)}</span>
                      </button>
                    `).join('')}
                  </div>
                </div>
              </aside>

              <div class="wonder-reading-content">
                <div class="wonder-reading-controls">
                  <button type="button" class="btn-nav" data-action="toggle-pov" id="wonderTogglePov">收起讲述者</button>
                  <button type="button" class="btn-nav" data-action="toggle-toc" id="wonderToggleToc">收起目录</button>
                </div>
                <div class="reading-layout-inner">
                  <aside class="chapter-nav-sidebar" id="wonderTocSidebar">
                    <h3>目录</h3>
                    <ul class="chapter-list" id="wonderChapterList"></ul>
                  </aside>

                  <article class="chapter-viewer">
                    <div class="chapter-header">
                      <span class="part-label" id="wonderPartLabel">第1部</span>
                      <h2 id="wonderChapterTitle">加载中...</h2>
                      <p class="wonder-reading-meta" id="wonderReadingMeta"></p>
                    </div>
                    <div class="chapter-body" id="wonderChapterContent"></div>
                    <div class="chapter-footer">
                      <button class="nav-btn prev" data-action="prev-chapter">上一章</button>
                      <span class="wonder-reading-progress" id="wonderChapterProgress">1 / 1</span>
                      <button class="nav-btn next" data-action="next-chapter">下一章</button>
                    </div>
                  </article>
                </div>
              </div>
            </div>
         `;

        this._bindEvents(ctx);
        this._bindSwipeGestures(ctx);
        this._syncLayoutState(ctx);
        this._renderChapterList(ctx);

        const filtered = this._getFilteredChapters(ctx);
        const startIndex = this._resolveStartIndex(ctx, payload, filtered);
        this._goToChapter(ctx, startIndex, filtered);
    },

    async destroy(ctx) {
        if (typeof ctx.state?.onPanelClick === 'function') {
            ctx.panelEl?.removeEventListener('click', ctx.state.onPanelClick);
            ctx.state.onPanelClick = null;
        }
        if (typeof ctx.state?.unsubscribePov === 'function') {
            ctx.state.unsubscribePov();
            ctx.state.unsubscribePov = null;
        }
        if (typeof ctx.state?.swipeCleanup === 'function') {
            ctx.state.swipeCleanup();
            ctx.state.swipeCleanup = null;
        }
    },

    _normalizePovs(ctx, chapters) {
        const registryPovs = Array.isArray(ctx.registry?.povs) ? ctx.registry.povs : [];
        const items = registryPovs
            .map((item) => {
                const id = String(item?.id || '').trim();
                if (!id) return null;
                return {
                    id,
                    name: String(item?.name || id),
                    avatar: String(item?.avatar || '')
                };
            })
            .filter(Boolean);

        if (items.length > 0) {
            return items;
        }

        const uniqueIds = [...new Set(
            chapters
                .map((chapter) => String(chapter?.pov || '').trim())
                .filter(Boolean)
        )];

        return uniqueIds.map((id) => ({ id, name: id, avatar: '' }));
    },

    _renderPovAvatar(ctx, pov) {
        const avatarPath = typeof pov?.avatar === 'string' ? pov.avatar.trim() : '';
        if (avatarPath) {
            return `
              <div class="avatar-wrapper">
                <img src="${escapeHtml(ctx.resolvePath(avatarPath))}" alt="${escapeHtml(pov?.name || pov?.id || '')}">
              </div>
            `;
        }

        const letter = escapeHtml(String(pov?.name || pov?.id || '?').slice(0, 1).toUpperCase());
        return `<div class="avatar-wrapper avatar-fallback">${letter}</div>`;
    },

    _bindEvents(ctx) {
        if (typeof ctx.state.onPanelClick === 'function') {
            ctx.panelEl.removeEventListener('click', ctx.state.onPanelClick);
        }

        ctx.state.onPanelClick = (event) => {
            const target = event.target.closest('[data-action]');
            if (!target) return;

            const action = target.dataset.action;
            if (action === 'switch-pov') {
                const pov = String(target.dataset.pov || '').trim();
                if (!pov || pov === ctx.state.activePov) return;
                this._setActivePov(ctx, pov, { keepIndex: false, rerender: true });
                return;
            }

            if (action === 'toggle-pov') {
                ctx.state.ui.povCollapsed = !ctx.state.ui.povCollapsed;
                this._syncLayoutState(ctx);
                return;
            }

            if (action === 'toggle-toc') {
                ctx.state.ui.tocCollapsed = !ctx.state.ui.tocCollapsed;
                this._syncLayoutState(ctx);
                return;
            }

            if (action === 'open-chapter') {
                const index = Number(target.dataset.index);
                if (!Number.isInteger(index)) return;
                if (typeof target.blur === 'function') {
                    target.blur();
                }
                this._goToChapter(ctx, index);
                return;
            }

            if (action === 'prev-chapter') {
                if (typeof target.blur === 'function') {
                    target.blur();
                }
                this._goToChapter(ctx, ctx.state.currentIndex - 1);
                return;
            }

            if (action === 'next-chapter') {
                if (typeof target.blur === 'function') {
                    target.blur();
                }
                this._goToChapter(ctx, ctx.state.currentIndex + 1);
            }
        };

        ctx.panelEl.addEventListener('click', ctx.state.onPanelClick);
    },

    _bindSwipeGestures(ctx) {
        if (typeof ctx.state?.swipeCleanup === 'function') {
            ctx.state.swipeCleanup();
            ctx.state.swipeCleanup = null;
        }

        const contentEl = ctx.panelEl.querySelector('#wonderChapterContent');
        if (!contentEl) return;

        ctx.state.swipeCleanup = bindHorizontalSwipe(contentEl, {
            onSwipeLeft: () => {
                this._goToChapter(ctx, ctx.state.currentIndex + 1);
            },
            onSwipeRight: () => {
                this._goToChapter(ctx, ctx.state.currentIndex - 1);
            }
        });
    },

    _setActivePov(ctx, pov, options = {}) {
        const keepIndex = options.keepIndex === true;
        const shouldRerender = options.rerender === true;
        const previousPov = ctx.state.activePov;

        if (previousPov) {
            ctx.state.indexByPov[previousPov] = ctx.state.currentIndex;
        }

        ctx.state.activePov = pov;
        localStorage.setItem(this._povStorageKey(ctx), pov);
        if (typeof ctx.setSharedState === 'function') {
            ctx.setSharedState('activePov', pov);
        }

        if (keepIndex) {
            const rememberedIndex = Number(ctx.state.indexByPov[pov]);
            ctx.state.currentIndex = Number.isInteger(rememberedIndex) ? rememberedIndex : 0;
        } else {
            ctx.state.currentIndex = 0;
        }

        if (shouldRerender) {
            this._syncPovButtons(ctx);
            this._renderChapterList(ctx);
            this._goToChapter(ctx, ctx.state.currentIndex);
        }
    },

    _syncPovButtons(ctx) {
        ctx.panelEl.querySelectorAll('[data-action="switch-pov"]').forEach((button) => {
            button.classList.toggle('active', button.dataset.pov === ctx.state.activePov);
        });
    },

    _syncLayoutState(ctx) {
        const shell = ctx.panelEl.querySelector('.wonder-reading-shell');
        if (!shell) return;

        const povCollapsed = !!ctx.state?.ui?.povCollapsed;
        const tocCollapsed = !!ctx.state?.ui?.tocCollapsed;
        shell.classList.toggle('pov-collapsed', povCollapsed);
        shell.classList.toggle('toc-collapsed', tocCollapsed);

        const povBtn = ctx.panelEl.querySelector('#wonderTogglePov');
        const tocBtn = ctx.panelEl.querySelector('#wonderToggleToc');
        if (povBtn) {
            povBtn.textContent = povCollapsed ? '展开讲述者' : '收起讲述者';
        }
        if (tocBtn) {
            tocBtn.textContent = tocCollapsed ? '展开目录' : '收起目录';
        }
    },

    _renderChapterList(ctx) {
        const listEl = ctx.panelEl.querySelector('#wonderChapterList');
        if (!listEl) return;

        const chapters = this._getFilteredChapters(ctx);
        if (chapters.length === 0) {
            listEl.innerHTML = '<li class="wonder-reading-empty">当前视角暂无章节</li>';
            return;
        }

        listEl.innerHTML = chapters.map((chapter, index) => `
            <li class="chapter-item ${index === ctx.state.currentIndex ? 'active' : ''}">
              <button type="button" data-action="open-chapter" data-index="${index}">
                <span class="chapter-num">${index + 1}</span>
                <span class="chapter-name">${escapeHtml(chapter.title || `章节 ${index + 1}`)}</span>
              </button>
            </li>
        `).join('');
    },

    _goToChapter(ctx, index, chapters = null) {
        const filtered = Array.isArray(chapters) ? chapters : this._getFilteredChapters(ctx);
        if (!filtered.length) {
            this._renderEmptyReadingState(ctx);
            return;
        }

        const safeIndex = Math.max(0, Math.min(Number(index) || 0, filtered.length - 1));
        ctx.state.currentIndex = safeIndex;
        ctx.state.indexByPov[ctx.state.activePov] = safeIndex;

        const chapter = filtered[safeIndex];
        const paragraphs = String(chapter?.content || '')
            .split('\n\n')
            .map((line) => line.trim())
            .filter(Boolean);

        const partLabelEl = ctx.panelEl.querySelector('#wonderPartLabel');
        const titleEl = ctx.panelEl.querySelector('#wonderChapterTitle');
        const metaEl = ctx.panelEl.querySelector('#wonderReadingMeta');
        const contentEl = ctx.panelEl.querySelector('#wonderChapterContent');
        const progressEl = ctx.panelEl.querySelector('#wonderChapterProgress');
        const prevBtn = ctx.panelEl.querySelector('[data-action="prev-chapter"]');
        const nextBtn = ctx.panelEl.querySelector('[data-action="next-chapter"]');

        if (partLabelEl) {
            const part = chapter?.part ? `第${chapter.part}部` : '阅读';
            partLabelEl.textContent = part;
        }
        if (titleEl) {
            titleEl.textContent = chapter?.title || `章节 ${safeIndex + 1}`;
        }
        if (metaEl) {
            metaEl.textContent = `视角：${this._getPovName(ctx, ctx.state.activePov)} · 第 ${safeIndex + 1} / ${filtered.length} 章`;
        }
        if (contentEl) {
            contentEl.innerHTML = paragraphs.length
                ? paragraphs.map((line) => `<p>${escapeHtml(line)}</p>`).join('')
                : '<p>本章暂无正文内容。</p>';
            contentEl.scrollTop = 0;
        }
        if (progressEl) {
            progressEl.textContent = `${safeIndex + 1} / ${filtered.length}`;
        }
        if (prevBtn) {
            prevBtn.disabled = safeIndex <= 0;
        }
        if (nextBtn) {
            nextBtn.disabled = safeIndex >= filtered.length - 1;
        }

        ctx.panelEl.querySelectorAll('.chapter-item').forEach((item, itemIndex) => {
            item.classList.toggle('active', itemIndex === safeIndex);
        });

        this._resetReadingPosition(ctx);
    },

    _renderEmptyReadingState(ctx) {
        const titleEl = ctx.panelEl.querySelector('#wonderChapterTitle');
        const metaEl = ctx.panelEl.querySelector('#wonderReadingMeta');
        const contentEl = ctx.panelEl.querySelector('#wonderChapterContent');
        const progressEl = ctx.panelEl.querySelector('#wonderChapterProgress');
        const prevBtn = ctx.panelEl.querySelector('[data-action="prev-chapter"]');
        const nextBtn = ctx.panelEl.querySelector('[data-action="next-chapter"]');

        if (titleEl) titleEl.textContent = '暂无章节';
        if (metaEl) metaEl.textContent = `视角：${this._getPovName(ctx, ctx.state.activePov)}`;
        if (contentEl) contentEl.innerHTML = '<p>当前视角暂无章节内容，请切换其他叙述者。</p>';
        if (progressEl) progressEl.textContent = '0 / 0';
        if (prevBtn) prevBtn.disabled = true;
        if (nextBtn) nextBtn.disabled = true;
    },

    _resolveStartIndex(ctx, payload, chapters) {
        if (payload && payload.chapterId != null) {
            const targetId = String(payload.chapterId);
            const foundIndex = chapters.findIndex((item) => String(item?.id) === targetId);
            if (foundIndex >= 0) return foundIndex;
        }

        const payloadIndex = Number(payload?.chapterIndex);
        if (Number.isInteger(payloadIndex) && payloadIndex >= 0 && payloadIndex < chapters.length) {
            return payloadIndex;
        }

        const remembered = Number(ctx.state.indexByPov[ctx.state.activePov]);
        if (Number.isInteger(remembered) && remembered >= 0 && remembered < chapters.length) {
            return remembered;
        }

        return 0;
    },

    _getFilteredChapters(ctx) {
        const activePov = String(ctx.state.activePov || '').trim();
        if (!activePov) return [];
        return ctx.state.chapters.filter((chapter) => String(chapter?.pov || '').trim() === activePov);
    },

    _povStorageKey(ctx) {
        const bookId = ctx.book?.id || 'book';
        return `${bookId}_active_pov`;
    },

    _getPovName(ctx, povId) {
        const found = ctx.state.povs.find((item) => item.id === povId);
        return found?.name || povId || '未知';
    },

    _resetReadingPosition(ctx) {
        const contentEl = ctx.panelEl.querySelector('#wonderChapterContent');
        const viewerEl = ctx.panelEl.querySelector('.chapter-viewer');
        const readingContentEl = ctx.panelEl.querySelector('.wonder-reading-content');
        const layoutEl = ctx.panelEl.querySelector('.reading-layout-inner');
        const titleEl = ctx.panelEl.querySelector('#wonderChapterTitle');

        const resetNode = (el) => {
            if (!el) return;
            el.scrollTop = 0;
            el.scrollLeft = 0;
            if (typeof el.scrollTo === 'function') {
                el.scrollTo({ top: 0, left: 0, behavior: 'auto' });
            }
        };

        [contentEl, viewerEl, readingContentEl, layoutEl]
            .forEach(resetNode);

        const anchorTop = () => {
            if (titleEl && typeof titleEl.scrollIntoView === 'function') {
                titleEl.scrollIntoView({ block: 'start', inline: 'nearest' });
            }
        };

        // Run twice to override delayed layout/paint adjustments.
        requestAnimationFrame(anchorTop);
        setTimeout(anchorTop, 0);
    }
};
