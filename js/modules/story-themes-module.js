import { openStoryModal } from './shared/story-modal.js';

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
}

export default {
    async init(ctx) {
        ctx.state = {
            items: [],
            onPanelClick: null
        };
    },

    async render(ctx) {
        if (!ctx.state.items.length) {
            const dataPath = ctx.module.data || 'themes.json';
            const data = await ctx.fetchJSON(dataPath);
            ctx.state.items = Array.isArray(data) ? data : [];
        }

        ctx.panelEl.innerHTML = `
            <div class="panel-header">
                <h2>💡 哲学主题</h2>
            </div>
            <section class="story-theme-atlas">
                <span class="story-theme-atlas-label">THEMATIC ATLAS</span>
                <h3>语言、时间与选择</h3>
                <p>参考原版学习路径：先理解核心问题，再进入讨论与投票反思。</p>
            </section>
            <div class="bento-grid">
                ${ctx.state.items.map((item) => `
                    <button type="button" class="flip-card theme-card story-theme-card-btn" data-action="open-theme" data-id="${escapeHtml(item.id)}">
                        <div class="flip-card-inner">
                            <div class="flip-card-front">
                                <span class="card-icon">${escapeHtml(item.icon || '💡')}</span>
                                <h3 class="card-title">${escapeHtml(item.title || '未命名主题')}</h3>
                                <p class="story-theme-front-text">${escapeHtml(item.frontText || '')}</p>
                                <span class="story-theme-cta">点击逐步展开</span>
                            </div>
                        </div>
                    </button>
                `).join('')}
            </div>
        `;

        this._bindEvents(ctx);
    },

    async destroy(ctx) {
        if (typeof ctx.state?.onPanelClick === 'function') {
            ctx.panelEl?.removeEventListener('click', ctx.state.onPanelClick);
            ctx.state.onPanelClick = null;
        }
    },

    _bindEvents(ctx) {
        if (typeof ctx.state.onPanelClick === 'function') {
            ctx.panelEl.removeEventListener('click', ctx.state.onPanelClick);
        }

        ctx.state.onPanelClick = (event) => {
            const target = event.target.closest('[data-action="open-theme"]');
            if (!target) return;
            const id = String(target.dataset.id || '').trim();
            if (!id) return;

            const item = ctx.state.items.find((entry) => entry.id === id);
            if (item) {
                this._openTheme(item);
            }
        };
        ctx.panelEl.addEventListener('click', ctx.state.onPanelClick);
    },

    _openTheme(item) {
        const steps = Array.isArray(item.steps) ? item.steps : [];
        const discussion = item.discussion || {};
        const options = Array.isArray(discussion?.poll?.options) ? discussion.poll.options : [];
        const isMobile = typeof window !== 'undefined'
            && typeof window.matchMedia === 'function'
            && window.matchMedia('(max-width: 768px)').matches;
        let stepIndex = 0;
        let showDiscussion = false;
        let selectedOption = -1;
        const pollResults = this._buildMockResults(options.length);

        const modalApi = openStoryModal({
            html: '<div class="story-theme-flow" id="storyThemeModalInner"></div>',
            classes: ['story-theme-flow-modal'],
            lockBodyScroll: true
        });
        const modalBody = modalApi.modalBody;

        const renderDots = () => {
            if (!steps.length) return '';
            return `
                <div class="step-dots">
                    ${steps.map((_, idx) => `
                        <span class="step-dot ${idx < stepIndex ? 'completed' : ''} ${idx === stepIndex ? 'active' : ''}"></span>
                    `).join('')}
                </div>
            `;
        };

        const renderStep = () => {
            const step = steps[stepIndex];
            if (!step) {
                return `
                    <section class="story-theme-step-empty">
                        <p>暂无步骤内容</p>
                    </section>
                `;
            }

            return `
                <section>
                    <div class="step-label">${escapeHtml(step.label || step.type || '步骤')}</div>
                    <div class="step-content">${escapeHtml(step.content || '')}</div>
                    ${step.tip ? `
                        <div class="teaching-tip">
                            <div class="tip-header">💡 教学提示</div>
                            <div class="tip-content">${escapeHtml(step.tip)}</div>
                        </div>
                    ` : ''}
                </section>
            `;
        };

        const renderPollResults = () => {
            if (selectedOption < 0 || !options.length) return '';
            return `
                <div class="poll-results">
                    ${options.map((label, idx) => `
                        <div class="poll-result-bar">
                            <div class="poll-result-label">
                                <span>${escapeHtml(label)}</span>
                                <span>${pollResults[idx]}%</span>
                            </div>
                            <div class="poll-result-track">
                                <div class="poll-result-fill" style="width:${pollResults[idx]}%;"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        };

        const renderDiscussion = () => `
            <section class="theme-discussion">
                <div class="discussion-question">${escapeHtml(discussion?.question || '暂无讨论问题')}</div>
                ${options.length
                ? `
                    <div class="poll-options">
                        ${options.map((option, idx) => `
                            <button type="button" class="poll-option ${selectedOption === idx ? 'selected' : ''}" data-action="story-theme-vote" data-index="${idx}">
                                <span class="poll-option-radio"></span>
                                <span>${escapeHtml(option)}</span>
                            </button>
                        `).join('')}
                    </div>
                    ${renderPollResults()}
                `
                : '<p class="panel-desc">暂无选项</p>'}
            </section>
        `;

        const render = () => {
            const total = steps.length;
            const stepCounter = total > 0 ? `${Math.min(stepIndex + 1, total)} / ${total}` : '讨论';
            const isLastStep = total === 0 || stepIndex >= total - 1;
            const shouldHideNextBtn = isMobile && !showDiscussion;

            modalBody.innerHTML = `
                <div class="story-theme-flow">
                    <div class="story-theme-flow-header">
                        <h3>${escapeHtml(item.icon || '💡')} ${escapeHtml(item.title || '主题')}</h3>
                        <span class="step-counter">${showDiscussion ? '讨论环节' : `步骤 ${stepCounter}`}</span>
                    </div>
                    <div class="story-theme-flow-body">
                        ${showDiscussion ? renderDiscussion() : renderStep()}
                    </div>
                    <div class="story-theme-flow-footer">
                        <button
                            type="button"
                            class="btn-nav"
                            data-action="story-theme-prev"
                            ${stepIndex <= 0 && !showDiscussion ? 'disabled' : ''}
                        >
                            ← 上一步
                        </button>
                        ${showDiscussion ? '<div></div>' : renderDots()}
                        ${shouldHideNextBtn
                    ? '<div></div>'
                    : `
                            <button type="button" class="btn-nav btn-primary" data-action="story-theme-next">
                                ${showDiscussion ? '完成' : (isLastStep ? '查看讨论 →' : '下一步 →')}
                            </button>
                        `}
                    </div>
                </div>
            `;

            requestAnimationFrame(() => {
                if (showDiscussion) {
                    const selector = selectedOption >= 0
                        ? `[data-action="story-theme-vote"][data-index="${selectedOption}"]`
                        : '[data-action="story-theme-vote"]';
                    modalBody.querySelector(selector)?.focus();
                    return;
                }
                modalBody.querySelector('[data-action="story-theme-next"]')?.focus();
            });
        };

        const runAction = (action, target = null) => {
            if (action === 'story-theme-prev') {
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

            if (action === 'story-theme-next') {
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
                return;
            }

            if (action === 'story-theme-vote') {
                const index = Number(target?.dataset?.index);
                if (!Number.isInteger(index)) return;
                selectedOption = index;
                render();
            }
        };

        const onClick = (event) => {
            if (isMobile && !showDiscussion) {
                const inBody = event.target.closest('.story-theme-flow-body');
                const blocked = event.target.closest('button, a, input, textarea, select, [data-action], [data-no-tap-advance="true"]');
                if (inBody && !blocked) {
                    runAction('story-theme-next');
                    return;
                }
            }

            const target = event.target.closest('[data-action]');
            if (!target) return;
            runAction(target.dataset.action, target);
        };

        const onKeydown = (event) => {
            const { key } = event;
            if (key === 'ArrowLeft') {
                event.preventDefault();
                runAction('story-theme-prev');
                return;
            }
            if (key === 'ArrowRight') {
                event.preventDefault();
                runAction('story-theme-next');
                return;
            }
            if (key === 'Enter') {
                const focusedVote = document.activeElement?.closest?.('[data-action="story-theme-vote"]');
                if (focusedVote) return;
                event.preventDefault();
                runAction('story-theme-next');
                return;
            }

            if (!showDiscussion || !options.length) return;

            if (key === 'ArrowDown' || key === 'ArrowUp') {
                event.preventDefault();
                if (!Number.isInteger(selectedOption) || selectedOption < 0) {
                    selectedOption = 0;
                } else {
                    const delta = key === 'ArrowDown' ? 1 : -1;
                    selectedOption = (selectedOption + delta + options.length) % options.length;
                }
                render();
                return;
            }

            if (/^[1-9]$/.test(key)) {
                const index = Number(key) - 1;
                if (index < options.length) {
                    event.preventDefault();
                    selectedOption = index;
                    render();
                }
            }
        };

        modalBody.addEventListener('click', onClick);
        document.addEventListener('keydown', onKeydown);
        modalApi.addCleanup(() => {
            modalBody.removeEventListener('click', onClick);
            document.removeEventListener('keydown', onKeydown);
        });
        render();
    },

    _buildMockResults(size) {
        if (!Number.isInteger(size) || size <= 0) return [];
        const raw = Array.from({ length: size }, () => 20 + Math.random() * 50);
        const sum = raw.reduce((acc, value) => acc + value, 0);
        const percents = raw.map((value) => Math.round((value / sum) * 100));
        const delta = 100 - percents.reduce((acc, value) => acc + value, 0);
        percents[0] += delta;
        return percents;
    }
};
