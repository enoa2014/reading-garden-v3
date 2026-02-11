
export default {
    async init(ctx) {
        this.data = await ctx.fetchJSON(ctx.module.data);
        this.activeCategory = 'moral';
    },

    async render(ctx, payload) {
        ctx.panelEl.innerHTML = `
            <div class="lotf-discussion-container">
                <header class="discussion-header">
                    <h2 class="section-title">讨论与思考</h2>
                    <p class="section-subtitle">深入探讨《蝇王》中的道德困境与社会问题</p>
                </header>

                <div class="category-tabs">
                    ${this.data.categories.map(cat => `
                        <button class="category-btn ${cat.id === this.activeCategory ? 'active' : ''}" 
                                data-id="${cat.id}">
                            <span class="category-icon">${cat.icon}</span>
                            ${cat.name}
                        </button>
                    `).join('')}
                </div>

                <div class="scenarios-list" id="scenariosList">
                    ${this.renderScenarios(this.activeCategory)}
                </div>

                <div class="open-questions-section">
                    <h3 class="subsection-title">开放性问题 (Bloom's Taxonomy)</h3>
                    <div class="questions-grid">
                        ${this.data.questions.map(q => `
                            <div class="question-card">
                                <span class="question-level">${q.level}</span>
                                <p class="question-text">${this.linkifyChapterMentions(q.text)}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            
            <style>
                .lotf-discussion-container {
                    padding: 2rem;
                    max-width: 1000px;
                    margin: 0 auto;
                    color: var(--text-primary);
                }
                
                .discussion-header {
                    text-align: center;
                    margin-bottom: 3rem;
                }
                .section-title {
                    font-family: var(--font-heading);
                    font-size: 2.5rem;
                    color: var(--lotf-primary);
                    margin-bottom: 0.5rem;
                }
                .section-subtitle {
                    color: var(--text-secondary);
                    font-size: 1.1rem;
                }

                /* Categories */
                .category-tabs {
                    display: flex;
                    justify-content: center;
                    gap: 1rem;
                    margin-bottom: 3rem;
                    flex-wrap: wrap;
                }
                .category-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 0.75rem 1.5rem;
                    background: var(--bg-card);
                    border: 1px solid var(--text-muted);
                    border-radius: 50px;
                    cursor: pointer;
                    font-family: var(--font-body);
                    font-size: 1rem;
                    color: var(--text-secondary);
                    transition: all 0.2s;
                }
                .category-btn:hover {
                    border-color: var(--lotf-primary);
                    color: var(--lotf-primary);
                }
                .category-btn.active {
                    background: var(--lotf-primary);
                    color: white;
                    border-color: var(--lotf-primary);
                    box-shadow: 0 4px 12px rgba(30, 58, 95, 0.2);
                }

                /* Scenarios */
                .scenario-card {
                    background: var(--bg-card);
                    border-radius: 16px;
                    padding: 2rem;
                    margin-bottom: 2rem;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.05);
                }
                .scenario-meta {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                    font-size: 0.9rem;
                    color: var(--text-muted);
                }
                .scenario-chapter {
                    border: 1px solid var(--lotf-primary);
                    background: transparent;
                    color: var(--lotf-primary);
                    border-radius: 999px;
                    padding: 0.2rem 0.65rem;
                    font-size: 0.82rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }
                .scenario-chapter:hover {
                    background: var(--lotf-primary);
                    color: #fff;
                }
                .scenario-chapter:focus-visible {
                    outline: 2px solid var(--lotf-conch);
                    outline-offset: 2px;
                }
                .chapter-inline-jump {
                    border: 1px solid var(--lotf-primary);
                    background: transparent;
                    color: var(--lotf-primary);
                    border-radius: 999px;
                    padding: 0.02rem 0.45rem;
                    margin: 0 0.12rem;
                    font-size: 0.85em;
                    font-weight: 700;
                    cursor: pointer;
                    vertical-align: baseline;
                    transition: all 0.15s ease;
                }
                .chapter-inline-jump:hover {
                    background: var(--lotf-primary);
                    color: #fff;
                }
                .chapter-inline-jump:focus-visible {
                    outline: 2px solid var(--lotf-conch);
                    outline-offset: 2px;
                }
                .scenario-title {
                    font-family: var(--font-heading);
                    font-size: 1.5rem;
                    color: var(--lotf-primary);
                    margin: 0 0 1rem 0;
                }
                .scenario-context {
                    background: var(--bg-light);
                    padding: 1.5rem;
                    border-radius: 8px;
                    border-left: 4px solid var(--lotf-conch);
                    margin-bottom: 2rem;
                    line-height: 1.6;
                }
                .scenario-question {
                    font-weight: bold;
                    margin-bottom: 1.5rem;
                    font-size: 1.1rem;
                }
                
                .options-list {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }
                .option-btn {
                    padding: 1rem 1.5rem;
                    background: var(--bg-light);
                    border: 2px solid transparent;
                    border-radius: 8px;
                    text-align: left;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-family: var(--font-body);
                    font-size: 1rem;
                    color: var(--text-primary);
                }
                .option-btn:hover {
                    background: white;
                    border-color: var(--lotf-primary-light);
                    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
                }
                .option-analysis {
                    margin-top: 0.5rem;
                    padding: 1rem;
                    background: #EDF2F7;
                    border-radius: 8px;
                    font-size: 0.95rem;
                    color: var(--text-secondary);
                    display: none;
                }
                .option-btn.selected {
                    background: var(--lotf-primary);
                    color: white;
                }
                
                /* Questions Grid */
                .open-questions-section {
                    margin-top: 4rem;
                }
                .subsection-title {
                    font-family: var(--font-heading);
                    font-size: 1.8rem;
                    color: var(--lotf-primary);
                    margin-bottom: 2rem;
                    text-align: center;
                }
                .questions-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 1.5rem;
                }
                .question-card {
                    background: var(--bg-card);
                    padding: 1.5rem;
                    border-radius: 12px;
                    border: 1px solid var(--text-muted);
                    position: relative;
                }
                .question-level {
                    position: absolute;
                    top: -10px;
                    left: 1rem;
                    background: var(--lotf-conch);
                    color: var(--lotf-primary-dark);
                    font-size: 0.8rem;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-weight: bold;
                }
                .question-text {
                    margin-top: 1rem;
                    line-height: 1.6;
                    font-weight: 500;
                }
            </style>
        `;

        this.bindEvents(ctx);
    },

    renderScenarios(categoryId) {
        const scenarios = this.data.scenarios.filter(s => s.category === categoryId);
        if (scenarios.length === 0) return '<div style="text-align:center;color:var(--text-muted);">暂无此类场景</div>';

        return scenarios.map(s => `
            <div class="scenario-card" data-id="${s.id}">
                <div class="scenario-meta">
                    <span>${this.data.categories.find(c => c.id === s.category)?.name}</span>
                    <button type="button"
                            class="scenario-chapter chapter-jump"
                            data-chapter="${s.chapter}"
                            title="跳转到第${s.chapter}章">
                        第 ${s.chapter} 章
                    </button>
                </div>
                <h3 class="scenario-title">${s.title}</h3>
                <div class="scenario-context">${this.linkifyChapterMentions(s.context)}</div>
                <div class="scenario-interaction">
                    <p class="scenario-question">${this.linkifyChapterMentions(s.question)}</p>
                    <div class="options-list">
                        ${s.options.map(opt => `
                            <div class="option-wrapper">
                                <button class="option-btn" data-scenario="${s.id}" data-option="${opt.id}">
                                    ${opt.text}
                                </button>
                                <div class="option-analysis" id="analysis-${s.id}-${opt.id}">
                                    <strong>解析：</strong>${this.linkifyChapterMentions(opt.analysis)}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `).join('');
    },

    bindEvents(ctx) {
        // Category Tabs
        ctx.panelEl.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.activeCategory = btn.dataset.id;
                this.render(ctx); // Re-render with new category
            });
        });

        // Chapter jump links
        ctx.panelEl.querySelectorAll('.chapter-jump').forEach((btn) => {
            btn.addEventListener('click', () => {
                const chapterId = Number.parseInt(btn.dataset.chapter, 10);
                if (!Number.isFinite(chapterId)) return;
                ctx.activateModule('reading', { chapterId });
            });
        });

        // Option selection
        ctx.panelEl.querySelectorAll('.option-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const wrapper = e.target.closest('.option-wrapper');
                const analysis = wrapper.querySelector('.option-analysis');

                // Toggle analysis visibility
                const isVisible = analysis.style.display === 'block';

                // Reset siblings
                const container = e.target.closest('.options-list');
                container.querySelectorAll('.option-analysis').forEach(el => el.style.display = 'none');
                container.querySelectorAll('.option-btn').forEach(el => el.classList.remove('selected'));

                if (!isVisible) {
                    analysis.style.display = 'block';
                    e.target.classList.add('selected');
                }
            });
        });
    },

    parseChapterToken(token) {
        if (/^\d+$/.test(token)) {
            return Number.parseInt(token, 10);
        }

        const map = {
            '零': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4,
            '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
        };
        if (!/^[零一二两三四五六七八九十]+$/.test(token)) return NaN;
        if (token === '十') return 10;
        if (token.endsWith('十') && token.length === 2) return (map[token[0]] || 0) * 10;
        if (token.startsWith('十') && token.length === 2) return 10 + (map[token[1]] || 0);

        const tenIndex = token.indexOf('十');
        if (tenIndex > 0) {
            const tens = map[token.slice(0, tenIndex)] || 0;
            const onesToken = token.slice(tenIndex + 1);
            const ones = onesToken ? (map[onesToken] || 0) : 0;
            return tens * 10 + ones;
        }
        return map[token] ?? NaN;
    },

    linkifyChapterMentions(text) {
        if (!text) return '';
        return String(text).replace(/第\s*([0-9]{1,2}|[零一二两三四五六七八九十]{1,3})\s*章/g, (full, token) => {
            const chapterId = this.parseChapterToken(String(token).trim());
            if (!Number.isFinite(chapterId) || chapterId <= 0) return full;
            return `<button type="button" class="chapter-inline-jump chapter-jump" data-chapter="${chapterId}" title="跳转到第${chapterId}章">${full.replace(/\s+/g, '')}</button>`;
        });
    }
}
