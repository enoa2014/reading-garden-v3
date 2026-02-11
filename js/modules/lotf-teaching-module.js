
export default {
    async init(ctx) {
        this.data = await ctx.fetchJSON(ctx.module.data);
    },

    async render(ctx, payload) {
        ctx.panelEl.innerHTML = `
            <div class="lotf-teaching-container">
                <header class="teaching-header">
                    <h2 class="section-title">教学资源库</h2>
                    <p class="section-subtitle">为教师和深度阅读者提供的教案与研讨课题</p>
                </header>

                <div class="teaching-grid">
                    <!-- Lesson Plans -->
                    <section class="teaching-section">
                        <h3 class="subsection-title">📚 课堂教案</h3>
                        <div class="cards-stack">
                            ${this.data.lessonPlans.map(plan => `
                                <div class="resource-card lesson-plan">
                                    <h4 class="card-title">${plan.title}</h4>
                                    <div class="card-meta">
                                        <span class="duration">⏱️ ${plan.duration}</span>
                                        <span class="objective">🎯 教学目标：${plan.objective}</span>
                                    </div>
                                    <ul class="activity-list">
                                        ${plan.activities.map(act => `<li>${this.linkifyChapterMentions(act)}</li>`).join('')}
                                    </ul>
                                </div>
                            `).join('')}
                        </div>
                    </section>

                    <!-- Essay Topics -->
                    <section class="teaching-section">
                        <h3 class="subsection-title">✍️ 论文选题</h3>
                        <div class="cards-stack">
                            ${this.data.essayTopics.map(topic => `
                                <div class="resource-card essay-topic">
                                    <div class="topic-header">
                                        <h4 class="card-title">${topic.title}</h4>
                                        <span class="difficulty" title="难度系数">${topic.difficulty}</span>
                                    </div>
                                    <p class="topic-desc">${this.linkifyChapterMentions(topic.description)}</p>
                                </div>
                            `).join('')}
                        </div>
                    </section>
                </div>

                <!-- Further Reading -->
                <section class="further-reading">
                    <h3 class="subsection-title">📖 延伸阅读</h3>
                    <div class="books-row">
                        ${this.data.furtherReading.map(book => `
                            <div class="book-card">
                                <h4>${book.title}</h4>
                                <span class="author">${book.author} (${book.year || 'Classic'})</span>
                                <p>${this.linkifyChapterMentions(book.desc)}</p>
                            </div>
                        `).join('')}
                    </div>
                </section>
            </div>

            <style>
                .lotf-teaching-container {
                    padding: 2rem;
                    max-width: 1200px;
                    margin: 0 auto;
                }
                .teaching-header {
                    text-align: center;
                    margin-bottom: 3rem;
                }
                .section-title {
                    font-family: var(--font-heading);
                    font-size: 2.5rem;
                    color: var(--lotf-primary);
                }
                
                .teaching-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
                    gap: 3rem;
                    margin-bottom: 4rem;
                }
                
                .subsection-title {
                    font-family: var(--font-heading);
                    font-size: 1.5rem;
                    color: var(--lotf-primary-dark);
                    border-bottom: 2px solid var(--lotf-conch);
                    padding-bottom: 0.5rem;
                    margin-bottom: 1.5rem;
                }
                
                .cards-stack {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }
                
                .resource-card {
                    background: var(--bg-card);
                    padding: 1.5rem;
                    border-radius: 12px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
                    border: 1px solid var(--text-muted);
                    transition: transform 0.2s;
                }
                .resource-card:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                    border-color: var(--lotf-primary);
                }
                
                .card-title {
                    margin: 0 0 0.5rem 0;
                    color: var(--lotf-primary);
                    font-size: 1.2rem;
                }
                
                /* Lesson Plan Specifics */
                .card-meta {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                    margin-bottom: 1rem;
                    font-size: 0.9rem;
                    color: var(--text-secondary);
                    background: var(--bg-light);
                    padding: 0.5rem;
                    border-radius: 6px;
                }
                .activity-list {
                    padding-left: 1.2rem;
                    margin: 0;
                    color: var(--text-primary);
                }
                .activity-list li {
                    margin-bottom: 0.25rem;
                }
                
                /* Essay Topic Specifics */
                .topic-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.5rem;
                }
                .difficulty {
                    font-size: 0.8rem;
                    color: var(--lotf-conch);
                }
                .topic-desc {
                    color: var(--text-primary);
                    line-height: 1.6;
                    margin: 0;
                }
                
                /* Further Reading */
                .books-row {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 2rem;
                }
                .book-card {
                    background: var(--bg-card);
                    padding: 1.5rem;
                    border-radius: 8px;
                    border-left: 4px solid var(--lotf-jungle);
                }
                .book-card h4 {
                    margin: 0 0 0.25rem 0;
                    color: var(--lotf-primary-dark);
                }
                .book-card .author {
                    display: block;
                    font-size: 0.9rem;
                    color: var(--text-secondary);
                    margin-bottom: 1rem;
                    font-style: italic;
                }
                .book-card p {
                    margin: 0;
                    font-size: 0.95rem;
                    line-height: 1.5;
                }
                .chapter-inline-jump {
                    border: 1px solid var(--lotf-primary);
                    background: transparent;
                    color: var(--lotf-primary);
                    border-radius: 999px;
                    padding: 0.05rem 0.5rem;
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
            </style>
        `;

        this.bindChapterJumps(ctx);
    },

    bindChapterJumps(ctx) {
        ctx.panelEl.querySelectorAll('.chapter-jump').forEach((btn) => {
            btn.addEventListener('click', () => {
                const chapterId = Number.parseInt(btn.dataset.chapter, 10);
                if (!Number.isFinite(chapterId)) return;
                ctx.activateModule('reading', { chapterId });
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
