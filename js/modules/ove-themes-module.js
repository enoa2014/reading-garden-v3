import { openStoryModal } from './shared/story-modal.js';

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
}

function iconByThemeId(id) {
    const map = {
        grief: '💔',
        community: '🏘️',
        principles: '🛡️',
        loneliness: '❄️'
    };
    return map[String(id || '')] || '💬';
}

export default {
    async init(ctx) {
        ctx.state = {
            items: [],
            activeTag: 'all',
            page: 1,
            pageSize: 3,
            onPanelClick: null
        };
    },

    async render(ctx) {
        if (!ctx.state.items.length) {
            const dataPath = ctx.module.data || 'themes.json';
            const data = await ctx.fetchJSON(dataPath);
            ctx.state.items = Array.isArray(data) ? data : [];
        }

        const tags = this._collectTags(ctx.state.items);
        const filtered = this._filteredItems(ctx.state.items, ctx.state.activeTag);
        const totalPages = Math.max(1, Math.ceil(filtered.length / ctx.state.pageSize));
        ctx.state.page = Math.min(ctx.state.page, totalPages);
        const start = (ctx.state.page - 1) * ctx.state.pageSize;
        const pageItems = filtered.slice(start, start + ctx.state.pageSize);

        ctx.panelEl.innerHTML = `
            <div class="panel-header">
                <h2>💬 核心主题</h2>
                <p class="panel-desc">悲伤、社区、原则与孤独</p>
            </div>

            <div class="theme-controls">
                <div class="theme-tags">
                    ${tags.map((tag) => `
                        <button
                            type="button"
                            class="theme-tag-btn ${ctx.state.activeTag === tag ? 'active' : ''}"
                            data-action="set-tag"
                            data-tag="${escapeHtml(tag)}"
                        >
                            ${tag === 'all' ? '全部' : escapeHtml(tag)}
                        </button>
                    `).join('')}
                </div>
            </div>

            <div class="bento-grid">
                ${pageItems.length
                ? pageItems.map((item) => `
                        <button
                            type="button"
                            class="theme-card"
                            data-action="open-theme"
                            data-id="${escapeHtml(item.id)}"
                            style="text-align:left;border-left:4px solid ${escapeHtml(item.color || '#D4AF37')};"
                        >
                            <div style="font-size:1.6rem;margin-bottom:10px;">${iconByThemeId(item.id)}</div>
                            <h3 style="margin:0 0 8px;color:var(--ove-text-main);">${escapeHtml(item.title || '未命名主题')}</h3>
                            <p style="margin:0;color:var(--ove-text-muted);line-height:1.7;">${escapeHtml(item.description || '')}</p>
                            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;">
                                ${(Array.isArray(item.tags) ? item.tags : []).map((tag) => `
                                    <span style="font-size:0.75rem;padding:2px 8px;background:rgba(255,255,255,0.1);border-radius:9999px;color:var(--ove-text-muted);">${escapeHtml(tag)}</span>
                                `).join('')}
                            </div>
                        </button>
                    `).join('')
                : '<div class="loading">暂无匹配主题</div>'}
            </div>

            ${totalPages > 1 ? `
                <div class="theme-pagination">
                    <button type="button" class="pagination-btn" data-action="set-page" data-page="${ctx.state.page - 1}" ${ctx.state.page <= 1 ? 'disabled' : ''}>&lt;</button>
                    ${Array.from({ length: totalPages }, (_, idx) => idx + 1).map((page) => `
                        <button
                            type="button"
                            class="pagination-btn ${page === ctx.state.page ? 'active' : ''}"
                            data-action="set-page"
                            data-page="${page}"
                        >
                            ${page}
                        </button>
                    `).join('')}
                    <button type="button" class="pagination-btn" data-action="set-page" data-page="${ctx.state.page + 1}" ${ctx.state.page >= totalPages ? 'disabled' : ''}>&gt;</button>
                </div>
            ` : ''}
        `;

        this._bindEvents(ctx);
    },

    async destroy(ctx) {
        if (typeof ctx.state?.onPanelClick === 'function') {
            ctx.panelEl?.removeEventListener('click', ctx.state.onPanelClick);
            ctx.state.onPanelClick = null;
        }
    },

    _collectTags(items) {
        const set = new Set(['all']);
        items.forEach((item) => {
            const tags = Array.isArray(item?.tags) ? item.tags : [];
            tags.forEach((tag) => set.add(String(tag)));
        });
        return [...set];
    },

    _filteredItems(items, activeTag) {
        if (activeTag === 'all') return items;
        return items.filter((item) => Array.isArray(item?.tags) && item.tags.includes(activeTag));
    },

    _bindEvents(ctx) {
        if (typeof ctx.state.onPanelClick === 'function') {
            ctx.panelEl.removeEventListener('click', ctx.state.onPanelClick);
        }

        ctx.state.onPanelClick = (event) => {
            const trigger = event.target.closest('[data-action]');
            if (!trigger) return;

            const action = trigger.dataset.action;
            if (action === 'set-tag') {
                const tag = String(trigger.dataset.tag || 'all');
                ctx.state.activeTag = tag;
                ctx.state.page = 1;
                this.render(ctx);
                return;
            }
            if (action === 'set-page') {
                const page = Number(trigger.dataset.page);
                if (!Number.isInteger(page) || page < 1) return;
                ctx.state.page = page;
                this.render(ctx);
                return;
            }
            if (action === 'open-theme') {
                const id = String(trigger.dataset.id || '').trim();
                if (!id) return;
                const item = ctx.state.items.find((entry) => String(entry?.id || '') === id);
                if (item) {
                    this._openThemeModal(item);
                }
            }
        };

        ctx.panelEl.addEventListener('click', ctx.state.onPanelClick);
    },

    _openThemeModal(theme) {
        const steps = Array.isArray(theme?.steps) ? theme.steps : [];
        const poll = theme?.discussion?.poll || null;
        const pollOptions = Array.isArray(poll?.options) ? poll.options : [];
        const isMobile = typeof window !== 'undefined'
            && typeof window.matchMedia === 'function'
            && window.matchMedia('(max-width: 768px)').matches;

        let stepIndex = 0;
        let showDiscussion = false;
        let selectedOption = -1;

        const modalApi = openStoryModal({ html: '<div id="oveThemeModalInner"></div>', lockBodyScroll: true });
        const modalBody = modalApi.modalBody;

        const renderPollResults = () => {
            if (selectedOption < 0 || !pollOptions.length) return '';
            const base = Math.max(5, Math.floor(60 / Math.max(1, pollOptions.length - 1)));
            const raw = pollOptions.map((_, idx) => (idx === selectedOption ? 40 : base));
            const total = raw.reduce((sum, value) => sum + value, 0) || 1;
            const values = raw.map((value) => Math.round((value / total) * 100));

            return `
                <div style="margin-top:14px;">
                    ${pollOptions.map((option, idx) => `
                        <div style="margin-bottom:10px;">
                            <div style="display:flex;justify-content:space-between;font-size:0.85rem;color:var(--ove-text-muted);margin-bottom:4px;">
                                <span>${escapeHtml(option)}</span>
                                <span>${values[idx]}%</span>
                            </div>
                            <div style="height:6px;background:rgba(255,255,255,0.12);border-radius:9999px;overflow:hidden;">
                                <div style="height:100%;width:${values[idx]}%;background:${idx === selectedOption ? 'var(--ove-gold)' : 'var(--ove-text-muted)'};"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        };

        const render = () => {
            const total = steps.length;
            const isLastStep = total === 0 || stepIndex >= total - 1;
            const step = steps[stepIndex] || null;
            const shouldHideNextBtn = isMobile && !showDiscussion;

            modalBody.innerHTML = `
                <div>
                    <h2 style="margin:0 0 8px;color:var(--color-primary);">${iconByThemeId(theme?.id)} ${escapeHtml(theme?.title || '主题')}</h2>
                    ${!showDiscussion ? `
                        <div style="color:var(--color-text-muted);font-size:0.9rem;margin-bottom:10px;">步骤 ${total ? `${stepIndex + 1} / ${total}` : '- / -'}</div>
                        <section style="padding:12px;border-radius:12px;background:rgba(44,62,80,0.06);">
                            <div style="font-size:0.85rem;color:var(--color-text-muted);margin-bottom:6px;">${escapeHtml(step?.label || '主题导读')}</div>
                            <p style="margin:0;line-height:1.8;">${escapeHtml(step?.content || theme?.description || '暂无内容')}</p>
                            ${step?.quote ? `<blockquote style="margin:10px 0 0;padding-left:10px;border-left:3px solid var(--color-border);color:var(--color-text-muted);">"${escapeHtml(step.quote)}"</blockquote>` : ''}
                            ${step?.tip ? `<p style="margin:10px 0 0;color:var(--color-text-muted);font-size:0.9rem;">💡 ${escapeHtml(step.tip)}</p>` : ''}
                        </section>
                    ` : `
                        <section style="padding:12px;border-radius:12px;background:rgba(212,175,55,0.12);">
                            <div style="font-weight:700;color:var(--color-primary);margin-bottom:8px;">讨论问题</div>
                            <p style="margin:0 0 10px;line-height:1.8;">${escapeHtml(theme?.discussion?.question || '暂无讨论问题')}</p>
                            <div style="display:flex;flex-direction:column;gap:8px;">
                                ${pollOptions.map((option, idx) => `
                                    <button
                                        type="button"
                                        class="poll-option ${selectedOption === idx ? 'selected' : ''}"
                                        data-action="pick-option"
                                        data-index="${idx}"
                                    >
                                        ${escapeHtml(option)}
                                    </button>
                                `).join('')}
                            </div>
                            ${renderPollResults()}
                        </section>
                    `}
                    <div style="display:flex;justify-content:space-between;gap:8px;margin-top:14px;">
                        <button type="button" class="btn-nav" data-action="theme-prev" ${stepIndex <= 0 && !showDiscussion ? 'disabled' : ''}>← 上一步</button>
                        ${shouldHideNextBtn
                    ? '<div></div>'
                    : `
                            <button type="button" class="btn-nav" data-action="theme-next">
                                ${showDiscussion ? '完成' : (isLastStep ? '参与讨论 →' : '下一步 →')}
                            </button>
                        `}
                    </div>
                </div>
            `;
        };

        const moveToNext = () => {
            if (showDiscussion) {
                modalApi.close();
                return;
            }
            if (stepIndex < steps.length - 1) {
                stepIndex += 1;
                render();
                return;
            }
            showDiscussion = true;
            render();
        };

        const onClick = (event) => {
            if (isMobile && !showDiscussion) {
                const inStepCard = event.target.closest('section');
                const blocked = event.target.closest('button, a, input, textarea, select, [data-action], [data-no-tap-advance="true"]');
                if (inStepCard && !blocked) {
                    moveToNext();
                    return;
                }
            }

            const trigger = event.target.closest('[data-action]');
            if (!trigger) return;
            const action = trigger.dataset.action;

            if (action === 'theme-prev') {
                if (showDiscussion) {
                    showDiscussion = false;
                    stepIndex = Math.max(0, steps.length - 1);
                    render();
                    return;
                }
                if (stepIndex > 0) {
                    stepIndex -= 1;
                    render();
                }
                return;
            }

            if (action === 'theme-next') {
                moveToNext();
                return;
            }

            if (action === 'pick-option') {
                const idx = Number(trigger.dataset.index);
                if (!Number.isInteger(idx)) return;
                selectedOption = idx;
                render();
            }
        };

        modalBody.addEventListener('click', onClick);
        modalApi.addCleanup(() => {
            modalBody.removeEventListener('click', onClick);
        });
        render();
    }
};
