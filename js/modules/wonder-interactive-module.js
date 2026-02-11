import { openStoryModal } from './shared/story-modal.js';

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
}

export default {
    async init(ctx) {
        ctx.state = {
            scenarios: [],
            themes: [],
            votes: {},
            onPanelClick: null
        };
    },

    async render(ctx) {
        if (!ctx.state.scenarios.length) {
            const dataPath = ctx.module.data || 'scenarios.json';
            const data = await ctx.fetchJSON(dataPath);
            ctx.state.scenarios = Array.isArray(data) ? data : [];
        }

        if (!ctx.state.themes.length) {
            const extra = Array.isArray(ctx.module.extraData) ? ctx.module.extraData : [];
            const themePath = extra.find((p) => p === 'themes.json');
            if (themePath) {
                try {
                    const data = await ctx.fetchJSON(themePath);
                    ctx.state.themes = Array.isArray(data) ? data : [];
                } catch (_error) {
                    ctx.state.themes = [];
                }
            }
        }

        ctx.panelEl.innerHTML = `
            <div class="interactive-grid">
                <div class="interactive-card dilemma-card">
                    <h3><span class="icon">⚖️</span> 道德抉择</h3>
                    <div class="dilemma-content" id="wonderDilemmaList">
                      ${ctx.state.scenarios.map((item) => this._renderScenario(item, ctx.state.votes[item.id])).join('')}
                    </div>
                </div>

                <div class="interactive-card scenes-card">
                    <h3><span class="icon">🖼️</span> 共情时刻 (Empathy Moments)</h3>
                    <div class="scenes-gallery">
                      ${this._scenes().map((scene) => this._renderSceneCard(ctx, scene)).join('')}
                    </div>
                </div>

                <div class="tips-section">
                    <div class="section-header" style="margin-bottom: 24px; text-align: left;">
                        <h3>🌱 给家长/教师的行动锦囊</h3>
                    </div>
                    <div class="tips-grid">
                        ${this._renderTips(ctx).join('')}
                    </div>
                </div>
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
            const target = event.target.closest('[data-action]');
            if (!target) return;

            const action = target.dataset.action;
            if (action === 'vote-scenario') {
                this._voteScenario(ctx, target.dataset.scenarioId, target.dataset.optionId);
                return;
            }
            if (action === 'toggle-outcome') {
                this._toggleOutcome(ctx, target.dataset.scenarioId);
                return;
            }
            if (action === 'open-scene') {
                this._openScene(ctx, target.dataset.sceneId);
            }
        };
        ctx.panelEl.addEventListener('click', ctx.state.onPanelClick);
    },

    _renderScenario(scenario, selectedOptionId) {
        const options = Array.isArray(scenario?.options) ? scenario.options : [];
        const isVoted = Boolean(selectedOptionId);
        const selected = options.find((opt) => opt.id === selectedOptionId);

        return `
            <div class="scenario-item" id="scenario-${escapeHtml(scenario.id)}">
                <h4 style="margin-bottom:12px;">${escapeHtml(scenario.question || '情境问题')}</h4>
                ${scenario?.context ? `<div class="scenario-context"><strong>背景：</strong>${escapeHtml(scenario.context)}</div>` : ''}
                <div class="scenario-options">
                    ${options.map((opt) => `
                        <button
                            class="option-btn ${selectedOptionId === opt.id ? 'selected' : ''}"
                            type="button"
                            data-action="vote-scenario"
                            data-scenario-id="${escapeHtml(scenario.id)}"
                            data-option-id="${escapeHtml(opt.id)}"
                            ${isVoted ? 'disabled' : ''}
                        >
                            ${escapeHtml(opt.text)}
                        </button>
                    `).join('')}
                </div>
                <div class="scenario-result" style="${isVoted ? '' : 'display:none;'}">
                    ${isVoted ? this._renderVoteResult(selected?.text) : ''}
                </div>
                ${this._renderDiscussion(scenario, isVoted)}
            </div>
        `;
    },

    _renderVoteResult(selectedText) {
        return `
            <p><strong>你的选择：</strong>${escapeHtml(selectedText || '未记录')}</p>
            <p>✨ 感谢你的选择！你可以继续阅读下方讨论点，看看不同选择背后的价值冲突。</p>
        `;
    },

    _renderDiscussion(scenario, expanded) {
        const points = Array.isArray(scenario?.discussion_points) ? scenario.discussion_points : [];
        if (!points.length && !scenario?.book_outcome) return '';

        return `
            <div id="discussion-${escapeHtml(scenario.id)}" class="discussion-points" style="${expanded ? '' : 'display:none;'}">
                ${points.length ? `
                    <h5>🗣️ 深度讨论时刻：</h5>
                    <ul>${points.map((point) => `<li>${escapeHtml(point)}</li>`).join('')}</ul>
                ` : ''}
                ${scenario?.book_outcome ? `
                    <button class="book-outcome-toggle" type="button" data-action="toggle-outcome" data-scenario-id="${escapeHtml(scenario.id)}">📖 点击查看原著结局</button>
                    <div id="outcome-${escapeHtml(scenario.id)}" class="book-outcome-content">
                        <strong>原著剧情：</strong> ${escapeHtml(scenario.book_outcome)}
                    </div>
                ` : ''}
            </div>
        `;
    },

    _renderSceneCard(ctx, scene) {
        return `
            <article class="scene-thumb" data-action="open-scene" data-scene-id="${escapeHtml(scene.id)}">
                <img src="${escapeHtml(ctx.resolvePath(scene.image))}" alt="${escapeHtml(scene.title)}" style="width:100%; height:160px; object-fit:cover;">
                <div class="scene-info">
                    <div class="scene-title">${escapeHtml(scene.title)}</div>
                    <div class="emotion-tags">
                        ${scene.tags.map((tag) => `<span class="emotion-tag">${escapeHtml(tag)}</span>`).join('')}
                    </div>
                </div>
            </article>
        `;
    },

    _renderTips(ctx) {
        const themeTips = (ctx.state.themes || []).slice(0, 3).map((theme) => ({
            title: theme.title,
            content: theme.description
        }));

        const fallbackTips = [
            {
                title: '制作“信念罐”',
                content: '每周写下一条鼓励他人的“信念”，周末一起朗读，把善良变成家庭固定仪式。'
            },
            {
                title: '寻找“无名英雄”',
                content: '鼓励孩子关注容易被忽视的人，练习主动说谢谢、主动打招呼。'
            },
            {
                title: '同理心暂停',
                content: '看电影或读书时停下来问一句：如果你是那个人，你当时会怎么想？'
            }
        ];

        const tips = themeTips.length ? themeTips : fallbackTips;
        return tips.map((tip) => `
            <article class="tip-card">
                <h4>📌 ${escapeHtml(tip.title)}</h4>
                <p>${escapeHtml(tip.content)}</p>
            </article>
        `);
    },

    _voteScenario(ctx, scenarioId, optionId) {
        const scenarioKey = String(scenarioId || '').trim();
        const optionKey = String(optionId || '').trim();
        if (!scenarioKey || !optionKey) return;

        const scenario = ctx.state.scenarios.find((item) => item.id === scenarioKey);
        if (!scenario) return;

        const optionExists = (Array.isArray(scenario.options) ? scenario.options : [])
            .some((opt) => opt.id === optionKey);
        if (!optionExists) return;

        ctx.state.votes[scenarioKey] = optionKey;
        const list = ctx.panelEl.querySelector('#wonderDilemmaList');
        if (list) {
            list.innerHTML = ctx.state.scenarios
                .map((item) => this._renderScenario(item, ctx.state.votes[item.id]))
                .join('');
        }
    },

    _toggleOutcome(ctx, scenarioId) {
        const id = String(scenarioId || '').trim();
        if (!id) return;
        const outcome = ctx.panelEl.querySelector(`#outcome-${id}`);
        if (!outcome) return;
        const isHidden = outcome.style.display === '' || outcome.style.display === 'none';
        outcome.style.display = isHidden ? 'block' : 'none';
    },

    _openScene(ctx, sceneId) {
        const id = String(sceneId || '').trim();
        const scene = this._scenes().find((item) => item.id === id);
        if (!scene) return;

        const html = `
            <img src="${escapeHtml(ctx.resolvePath(scene.image))}" style="width:100%; border-radius:8px; margin-bottom:16px;" alt="${escapeHtml(scene.title)}">
            <h3 style="color:var(--wonder-blue); margin-bottom:12px;">${escapeHtml(scene.title)}</h3>
            <blockquote style="font-size:1.1rem; font-style:italic; color:var(--text-primary); border-left:4px solid var(--kindness-orange); padding-left:16px; margin:0 0 12px;">
                "${escapeHtml(scene.quote)}"
            </blockquote>
            <p style="margin:0; color:var(--text-secondary);">${escapeHtml(scene.summary)}</p>
        `;
        openStoryModal({ html });
    },

    _scenes() {
        return [
            {
                id: 'graduation',
                title: '毕业典礼',
                image: 'assets/images/wonder/scenes/graduation.webp',
                quote: '每个人都值得大家起立鼓掌一次。',
                summary: '这一幕代表着“被看见”的力量。',
                tags: ['#荣誉', '#成长', '#接纳']
            },
            {
                id: 'campsite',
                title: '露营地',
                image: 'assets/images/wonder/scenes/campsite_unity.webp',
                quote: '在那一刻，我们不再分彼此。',
                summary: '冲突之后，群体开始真正地站在奥吉身边。',
                tags: ['#勇气', '#团结', '#保护']
            }
        ];
    }
};
