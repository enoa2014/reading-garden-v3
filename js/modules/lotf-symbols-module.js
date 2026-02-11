
export default {
    async init(ctx) {
        this.data = await ctx.fetchJSON(ctx.module.data);
    },

    async render(ctx, payload) {
        ctx.panelEl.innerHTML = `
            <div class="lotf-symbols-container">
                <h2 class="section-title">象征符号演变</h2>
                <div class="symbols-grid">
                    ${this.data.symbols.map(symbol => `
                        <div class="symbol-card" data-id="${symbol.id}">
                            <div class="symbol-header">
                                <img src="${ctx.resolvePath(symbol.image)}" alt="${symbol.name}" class="symbol-img">
                                <div class="symbol-info">
                                    <h3>${symbol.name}</h3>
                                    <span class="symbol-subtitle">${symbol.nameEn}</span>
                                </div>
                            </div>
                            <p class="symbol-meaning">${this.linkifyChapterMentions(symbol.meaning)}</p>
                            
                            <div class="symbol-timeline">
                                ${symbol.evolution.map((point, idx) => `
                                    <div class="timeline-point">
                                        <div class="point-marker"></div>
                                        <div class="point-content">
                                            <button type="button"
                                                    class="point-chapter chapter-jump"
                                                    data-chapter="${point.chapter}"
                                                    title="跳转到第${point.chapter}章">
                                                第${point.chapter}章
                                            </button>
                                            <h4 class="point-title">${point.title}</h4>
                                            <p class="point-desc">${this.linkifyChapterMentions(point.description)}</p>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <style>
                .lotf-symbols-container {
                    padding: 2rem;
                    background: var(--bg-light);
                    height: 100%;
                    overflow-y: auto;
                }
                .section-title {
                    font-family: var(--font-heading);
                    color: var(--lotf-primary);
                    text-align: center;
                    margin-bottom: 3rem;
                    font-size: 2.5rem;
                }
                .symbols-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
                    gap: 3rem;
                    max-width: 1200px;
                    margin: 0 auto;
                }
                .symbol-card {
                    background: var(--bg-card);
                    border-radius: 16px;
                    padding: 2rem;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.05);
                    border-top: 4px solid var(--lotf-primary);
                    transition: transform 0.3s ease;
                }
                .symbol-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                }
                .symbol-header {
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                    margin-bottom: 1.5rem;
                }
                .symbol-img {
                    width: 80px;
                    height: 80px;
                    object-fit: contain;
                    border-radius: 12px;
                    background: var(--bg-light);
                    padding: 8px;
                }
                .symbol-info h3 {
                    margin: 0;
                    font-family: var(--font-heading);
                    color: var(--lotf-primary);
                    font-size: 1.5rem;
                }
                .symbol-subtitle {
                    color: var(--text-secondary);
                    font-style: italic;
                    font-family: var(--font-quote);
                }
                .symbol-meaning {
                    background: var(--bg-light);
                    padding: 1rem;
                    border-radius: 8px;
                    margin-bottom: 2rem;
                    line-height: 1.6;
                    color: var(--text-primary);
                    border-left: 3px solid var(--lotf-conch);
                }
                
                /* Vertical Timeline */
                .symbol-timeline {
                    position: relative;
                    padding-left: 1.5rem;
                    border-left: 2px solid var(--text-muted);
                }
                .timeline-point {
                    position: relative;
                    margin-bottom: 2rem;
                    padding-left: 1.5rem;
                }
                .timeline-point:last-child {
                    margin-bottom: 0;
                }
                .point-marker {
                    position: absolute;
                    left: -1.5rem; /* center on line */
                    top: 0.25rem;
                    width: 12px;
                    height: 12px;
                    background: var(--bg-card);
                    border: 3px solid var(--lotf-primary);
                    border-radius: 50%;
                    transform: translateX(-50%);
                    z-index: 1;
                }
                .point-chapter {
                    display: inline-block;
                    background: var(--lotf-primary);
                    color: white;
                    font-size: 0.75rem;
                    padding: 2px 8px;
                    border-radius: 4px;
                    margin-bottom: 0.25rem;
                    border: none;
                    cursor: pointer;
                    transition: transform 0.15s ease, box-shadow 0.15s ease;
                }
                .point-chapter:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
                }
                .point-chapter:focus-visible {
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
                .point-title {
                    margin: 0.25rem 0;
                    font-size: 1.1rem;
                    color: var(--lotf-primary-dark);
                }
                .point-desc {
                    margin: 0;
                    font-size: 0.95rem;
                    color: var(--text-secondary);
                    line-height: 1.5;
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
