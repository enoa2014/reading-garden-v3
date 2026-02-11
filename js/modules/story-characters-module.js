import { openStoryModal } from './shared/story-modal.js';

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
}

function getCssVar(name, fallback) {
    const value = getComputedStyle(document.body).getPropertyValue(name).trim();
    return value || fallback;
}

async function ensureCytoscape() {
    if (window.cytoscape) return;

    const candidates = [
        new URL('../lib/cytoscape.min.js', import.meta.url).href,
        '../js/lib/cytoscape.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.28.1/cytoscape.min.js'
    ];

    let lastError = null;
    for (const src of candidates) {
        if (window.cytoscape) return;
        try {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = src;
                script.onload = resolve;
                script.onerror = () => reject(new Error(`Failed to load cytoscape from: ${src}`));
                document.head.appendChild(script);
            });
            if (window.cytoscape) return;
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error('Failed to load cytoscape');
}

function normalizeCharacters(raw, resolvePath) {
    const nodesRaw = Array.isArray(raw?.nodes) ? raw.nodes : [];
    const edgesRaw = Array.isArray(raw?.edges) ? raw.edges : [];

    const nodes = nodesRaw
        .map((node, index) => {
            const data = node?.data || node || {};
            const id = String(data.id || `story-character-${index + 1}`).trim();
            if (!id) return null;

            return {
                data: {
                    id,
                    name: data.name || '未命名角色',
                    role: data.role || '',
                    description: data.description || '',
                    avatar: data.avatar ? resolvePath(data.avatar) : '',
                    color: data.color || '#3498DB'
                }
            };
        })
        .filter(Boolean);

    const nodeIds = new Set(nodes.map((node) => node.data.id));
    const edges = edgesRaw
        .map((edge) => {
            const data = edge?.data || edge || {};
            const source = String(data.source || '').trim();
            const target = String(data.target || '').trim();
            if (!source || !target) return null;
            if (!nodeIds.has(source) || !nodeIds.has(target)) return null;

            return {
                data: {
                    source,
                    target,
                    label: data.label || ''
                }
            };
        })
        .filter(Boolean);

    return { nodes, edges };
}

export default {
    async init(ctx) {
        ctx.state = {
            graph: null,
            cy: null,
            onResize: null,
            mountTimer: null
        };
    },

    async render(ctx) {
        if (!ctx.state.graph) {
            const dataPath = ctx.module.data || 'characters.json';
            const data = await ctx.fetchJSON(dataPath);
            ctx.state.graph = normalizeCharacters(data, ctx.resolvePath);
        }

        ctx.panelEl.innerHTML = `
            <div class="panel-header">
                <h2>👥 人物图谱</h2>
                <p class="panel-desc">点击节点查看人物详情</p>
            </div>
            <div class="character-graph-container" id="characterGraph">
                <div class="loading">人物关系图加载中...</div>
            </div>
        `;

        try {
            await ensureCytoscape();
            if (!window.cytoscape) {
                this._renderGraphError(ctx, '未检测到 Cytoscape，无法渲染关系网。');
                return;
            }
            this._scheduleMount(ctx, 0);
        } catch (error) {
            console.warn('Cytoscape unavailable:', error);
            this._renderGraphError(ctx, `人物关系图加载失败：${error?.message || '未知错误'}`);
        }
    },

    async destroy(ctx) {
        if (ctx.state?.cy) {
            ctx.state.cy.destroy();
            ctx.state.cy = null;
        }
        if (typeof ctx.state?.onResize === 'function') {
            window.removeEventListener('resize', ctx.state.onResize);
            ctx.state.onResize = null;
        }
        if (ctx.state?.mountTimer) {
            window.clearTimeout(ctx.state.mountTimer);
            ctx.state.mountTimer = null;
        }
    },

    _mountGraph(ctx) {
        if (ctx.state.cy) {
            ctx.state.cy.destroy();
            ctx.state.cy = null;
        }

        const graphEl = ctx.panelEl.querySelector('#characterGraph');
        if (!graphEl) return;
        graphEl.innerHTML = '';

        const textColor = getCssVar('--color-text', '#1E293B');
        const mutedColor = getCssVar('--color-text-muted', '#64748B');
        const lineColor = getCssVar('--color-border', '#94A3B8');

        const cy = window.cytoscape({
            container: graphEl,
            elements: {
                nodes: ctx.state.graph.nodes,
                edges: ctx.state.graph.edges
            },
            style: [
                {
                    selector: 'node',
                    style: {
                        label: 'data(name)',
                        'text-valign': 'bottom',
                        'text-halign': 'center',
                        'text-margin-y': 10,
                        'font-size': 12,
                        color: textColor,
                        'background-image': 'data(avatar)',
                        'background-fit': 'cover',
                        'background-clip': 'node',
                        'background-color': 'data(color)',
                        width: 64,
                        height: 64,
                        'border-width': 3,
                        'border-color': 'data(color)'
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        label: 'data(label)',
                        width: 2,
                        'line-color': lineColor,
                        'curve-style': 'bezier',
                        'font-size': 10,
                        color: mutedColor,
                        'text-rotation': 'autorotate',
                        'text-margin-y': -8
                    }
                },
                {
                    selector: 'node:selected',
                    style: {
                        'border-width': 4,
                        'border-color': '#2C3E50'
                    }
                }
            ],
            layout: {
                name: 'cose',
                padding: 48,
                nodeRepulsion: 9000,
                idealEdgeLength: 110
            }
        });

        cy.on('tap', 'node', (event) => {
            this._openCharacterModal(event.target.data());
        });

        // Runtime activates tab after module render; defer resize/fit to next frames.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                try {
                    cy.resize();
                    cy.fit(undefined, 36);
                } catch (_error) {
                    // Ignore transient layout errors from early frame timing.
                }
            });
        });

        if (typeof ctx.state.onResize === 'function') {
            window.removeEventListener('resize', ctx.state.onResize);
        }
        ctx.state.onResize = () => {
            cy.resize();
            cy.fit(undefined, 36);
        };
        window.addEventListener('resize', ctx.state.onResize, { passive: true });

        ctx.state.cy = cy;
    },

    _scheduleMount(ctx, attempt) {
        if (ctx.state?.cy) return;

        if (ctx.state?.mountTimer) {
            window.clearTimeout(ctx.state.mountTimer);
            ctx.state.mountTimer = null;
        }

        const panelEl = ctx.panelEl;
        const graphEl = panelEl?.querySelector?.('#characterGraph');
        if (!panelEl || !graphEl) return;

        const rect = graphEl.getBoundingClientRect();
        const isVisible = panelEl.classList.contains('active') && rect.width > 20 && rect.height > 20;

        if (!isVisible) {
            if (attempt >= 30) {
                this._renderGraphError(ctx, '人物关系图容器未就绪，请切换标签后重试。');
                return;
            }
            ctx.state.mountTimer = window.setTimeout(() => {
                this._scheduleMount(ctx, attempt + 1);
            }, 80);
            return;
        }

        try {
            this._mountGraph(ctx);
        } catch (error) {
            if (attempt >= 30) {
                this._renderGraphError(ctx, `人物关系图加载失败：${error?.message || '未知错误'}`);
                return;
            }
            ctx.state.mountTimer = window.setTimeout(() => {
                this._scheduleMount(ctx, attempt + 1);
            }, 120);
        }
    },

    _renderGraphError(ctx, message) {
        const graphEl = ctx.panelEl.querySelector('#characterGraph');
        if (!graphEl) return;
        graphEl.innerHTML = `<div class="loading">${escapeHtml(message)}</div>`;
    },

    _openCharacterModal(character) {
        const color = character?.color || '#3498DB';
        const html = `
            <article>
                <div style="text-align:center;margin-bottom:14px;">
                    ${character.avatar
                ? `<img src="${escapeHtml(character.avatar)}" alt="${escapeHtml(character.name)}" style="width:96px;height:96px;border-radius:50%;object-fit:cover;border:4px solid ${escapeHtml(color)};">`
                : ''
            }
                </div>
                <h3 style="margin:0 0 6px;color:${escapeHtml(color)};text-align:center;">${escapeHtml(character.name || '未命名')}</h3>
                <p style="margin:0 0 14px;text-align:center;color:var(--color-text-muted);font-size:0.92rem;">${escapeHtml(character.role || '')}</p>
                <p style="margin:0;line-height:1.8;">${escapeHtml(character.description || '暂无介绍')}</p>
            </article>
        `;
        openStoryModal({ html, lockBodyScroll: true });
    }
};
