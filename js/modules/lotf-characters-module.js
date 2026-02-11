
import { openStoryModal } from './shared/story-modal.js';

export default {
    async init(ctx) {
        this.data = await ctx.fetchJSON(ctx.module.data);
        // Create a map for quick lookup
        this.charMap = this.data.characters.reduce((acc, char) => {
            acc[char.id] = char;
            return acc;
        }, {});

        // Faction color map
        this.factionColors = this.data.factions.reduce((acc, f) => {
            acc[f.id] = f.color;
            return acc;
        }, {});
    },

    async render(ctx, payload) {
        ctx.panelEl.innerHTML = `
            <div class="lotf-char-container">
                <div class="char-graph-wrapper" id="charGraph"></div>
                <div class="char-legend">
                    ${this.data.factions.map(f => `
                        <div class="legend-item">
                            <span class="legend-dot" style="background:${f.color}"></span>
                            <span>${f.name}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="char-list-fallback" style="display:none; padding: 2rem;"></div>
            </div>
            
            <style>
                .lotf-char-container {
                    position: relative;
                    width: 100%;
                    min-height: 560px;
                    background: var(--bg-light);
                }
                .char-graph-wrapper {
                    width: 100%;
                    min-height: 500px;
                    height: 500px;
                }
                .char-legend {
                    position: absolute;
                    bottom: 20px;
                    left: 20px;
                    background: rgba(255,255,255,0.9);
                    padding: 10px;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                .legend-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin: 4px 0;
                    font-size: 0.9rem;
                    color: var(--text-primary);
                }
                .legend-dot {
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                }
                @media (max-width: 768px) {
                    .lotf-char-container {
                        min-height: 460px;
                    }
                    .char-graph-wrapper {
                        min-height: 420px;
                        height: 420px;
                    }
                    .char-legend {
                        left: 12px;
                        bottom: 12px;
                        padding: 8px;
                    }
                }
            </style>
        `;

        this.renderGraph(ctx);
    },

    renderGraph(ctx) {
        const container = ctx.panelEl.querySelector('#charGraph');
        const legend = ctx.panelEl.querySelector('.char-legend');
        if (!container || typeof window.cytoscape !== 'function') {
            if (legend) legend.style.display = 'none';
            this.renderFallback(ctx);
            return;
        }

        // Prevent zero-height mount causing an "invisible but initialized" graph.
        if ((container.clientHeight || 0) < 120) {
            container.style.minHeight = '500px';
            container.style.height = '500px';
        }

        const elements = [];

        // Nodes
        this.data.characters.forEach(char => {
            elements.push({
                data: {
                    id: char.id,
                    name: char.name,
                    avatar: ctx.resolvePath(char.avatar),
                    color: this.factionColors[char.faction] || '#999'
                }
            });

            // Edges from relationships
            if (char.relationships) {
                char.relationships.forEach(rel => {
                    elements.push({
                        data: {
                            source: char.id,
                            target: rel.target,
                            label: rel.label,
                            type: rel.type
                        }
                    });
                });
            }
        });

        try {
            const cy = window.cytoscape({
                container: container,
                elements: elements,
                style: [
                    {
                        selector: 'node',
                        style: {
                            'background-image': 'data(avatar)',
                            'background-fit': 'cover',
                            'width': 80,
                            'height': 80,
                            'border-width': 4,
                            'border-color': 'data(color)',
                            'label': 'data(name)',
                            'text-valign': 'bottom',
                            'text-margin-y': 10,
                            'font-family': 'Source Sans 3',
                            'font-size': '14px',
                            'font-weight': 700,
                            'color': '#111827',
                            'text-background-color': '#FFFFFF',
                            'text-background-opacity': 0.96,
                            'text-background-padding': 4,
                            'text-background-shape': 'roundrectangle',
                            'text-outline-color': '#FFFFFF',
                            'text-outline-width': 2,
                            'min-zoomed-font-size': 10
                        }
                    },
                    {
                        selector: 'edge',
                        style: {
                            'width': 2.5,
                            'curve-style': 'bezier',
                            'target-arrow-shape': 'triangle',
                            'line-color': '#A0AEC0',
                            'target-arrow-color': '#A0AEC0',
                            'label': 'data(label)',
                            'font-size': '12px',
                            'font-weight': 700,
                            'color': '#1A202C',
                            'text-rotation': 'none',
                            'text-background-color': '#FFFFFF',
                            'text-background-opacity': 0.95,
                            'text-background-padding': 3,
                            'text-outline-color': '#FFFFFF',
                            'text-outline-width': 2
                        }
                    },
                    {
                        selector: 'edge[type="rival"]',
                        style: {
                            'line-style': 'dashed',
                            'line-color': '#E53E3E',
                            'target-arrow-color': '#E53E3E'
                        }
                    }
                ],
                layout: {
                    name: 'cose',
                    animate: false,
                    padding: 50,
                    componentSpacing: 100,
                    nodeOverlap: 20
                }
            });

            cy.on('tap', 'node', (evt) => {
                this.showCharacterModal(ctx, evt.target.id());
            });
        } catch (err) {
            console.warn('LOTF character graph failed, fallback to cards.', err);
            if (legend) legend.style.display = 'none';
            this.renderFallback(ctx);
        }
    },

    renderFallback(ctx) {
        const fallbackEl = ctx.panelEl.querySelector('.char-list-fallback');
        if (fallbackEl) {
            fallbackEl.style.display = 'grid';
            fallbackEl.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';
            fallbackEl.style.gap = '20px';

            fallbackEl.innerHTML = this.data.characters.map(char => `
                <div class="lotf-card" style="padding: 1.5rem; text-align: center; cursor: pointer;" 
                     onclick="this.dispatchEvent(new CustomEvent('open-char', {bubbles:true, detail:'${char.id}'}))">
                    <img src="${ctx.resolvePath(char.avatar)}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid ${this.factionColors[char.faction]};margin-bottom:1rem;">
                    <h3>${char.name}</h3>
                    <p style="font-size:0.9rem;color:var(--text-secondary)">${char.archetype}</p>
                </div>
            `).join('');

            fallbackEl.addEventListener('open-char', (e) => {
                this.showCharacterModal(ctx, e.detail);
            });
        }
    },

    showCharacterModal(ctx, charId) {
        const char = this.charMap[charId];
        if (!char) return;

        const html = `
            <div class="char-modal-content" style="padding: 1rem;">
                <div class="char-header" style="display:flex; gap:1.5rem; margin-bottom:1.5rem; align-items:center;">
                    <img src="${ctx.resolvePath(char.avatar)}" 
                         style="width:100px;height:100px;border-radius:50%;object-fit:cover;border:4px solid ${this.factionColors[char.faction]};">
                    <div>
                        <h2 style="font-family:var(--font-heading); margin:0 0 0.5rem 0; color:var(--lotf-primary);">${char.name} <span style="font-size:1rem;color:var(--text-muted);font-weight:normal;">${char.nameEn}</span></h2>
                        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                            <span style="background:${this.factionColors[char.faction]};color:white;padding:2px 8px;border-radius:4px;font-size:0.8rem;">${char.archetype}</span>
                            ${char.traits.map(t => `<span style="background:var(--bg-sidebar);color:var(--text-secondary);padding:2px 8px;border-radius:4px;font-size:0.8rem;">${t}</span>`).join('')}
                        </div>
                    </div>
                </div>
                
                <blockquote style="background:var(--bg-light);padding:1rem;border-left:4px solid var(--lotf-conch);margin:0 0 1.5rem 0;font-family:var(--font-quote);font-style:italic;">
                    "${char.quote}"
                </blockquote>

                <p style="line-height:1.6;color:var(--text-primary);margin-bottom:1.5rem;">${this.linkifyChapterMentions(char.description)}</p>

                <h3 style="font-family:var(--font-heading);border-bottom:1px solid var(--text-muted);padding-bottom:0.5rem;margin-bottom:1rem;">人物弧光</h3>
                <div class="char-arc" style="padding-left:1rem;border-left:2px solid var(--text-muted);">
                    ${char.arc.map(stage => `
                        <div style="position:relative;margin-bottom:1.5rem;padding-left:1.5rem;">
                            <span style="position:absolute;left:-6px;top:6px;width:10px;height:10px;border-radius:50%;background:var(--lotf-primary);transform:translate(-50%,0);"></span>
                            <button type="button"
                                    class="lotf-chapter-jump"
                                    data-chapter="${stage.chapter}"
                                    style="font-weight:bold;color:var(--lotf-primary);margin-bottom:0.25rem;border:1px solid var(--lotf-primary);background:transparent;border-radius:999px;padding:0.2rem 0.6rem;cursor:pointer;">
                                第${stage.chapter}章：${stage.state}
                            </button>
                            <div style="font-size:0.95rem;color:var(--text-secondary);">${this.linkifyChapterMentions(stage.desc)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        const { modalBody, close, addCleanup } = openStoryModal({ html });
        const jumpHandler = (event) => {
            const trigger = event.target.closest('.lotf-chapter-jump');
            if (!trigger) return;
            const chapterId = Number.parseInt(trigger.dataset.chapter, 10);
            if (!Number.isFinite(chapterId)) return;
            close();
            ctx.activateModule('reading', { chapterId });
        };
        modalBody.addEventListener('click', jumpHandler);
        addCleanup(() => modalBody.removeEventListener('click', jumpHandler));
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
            return `<button type="button" class="lotf-chapter-jump" data-chapter="${chapterId}" style="font-weight:700;color:var(--lotf-primary);border:1px solid var(--lotf-primary);background:transparent;border-radius:999px;padding:0.08rem 0.5rem;cursor:pointer;">${full.replace(/\s+/g, '')}</button>`;
        });
    }
}
