import { openStoryModal } from './shared/story-modal.js';

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
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

function normalizeGraph(data, resolvePath) {
    const cacheBuster = Date.now();
    const nodesRaw = Array.isArray(data?.nodes) ? data.nodes : [];
    const edgesRaw = Array.isArray(data?.edges) ? data.edges : [];

    const nodes = nodesRaw
        .map((node, index) => {
            const d = node?.data || {};
            const id = String(d.id || `ove-character-${index + 1}`).trim();
            if (!id) return null;
            return {
                data: {
                    id,
                    label: d.name || '未命名',
                    role: d.role || '',
                    description: d.description || '',
                    nameEn: d.nameEn || '',
                    avatar: typeof d.avatar === 'string' && d.avatar.trim() ? `${resolvePath(d.avatar)}?v=${cacheBuster}` : '',
                    color: d.color || '#64748B',
                    deceased: !!d.deceased
                }
            };
        })
        .filter(Boolean);

    const validIds = new Set(nodes.map((node) => node.data.id));
    const edges = edgesRaw
        .map((edge) => {
            const d = edge?.data || {};
            const source = String(d.source || '').trim();
            const target = String(d.target || '').trim();
            if (!source || !target) return null;
            if (!validIds.has(source) || !validIds.has(target)) return null;
            return {
                data: {
                    source,
                    target,
                    label: d.relationship || d.label || '',
                    color: d.color || '#475569'
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
        const dataPath = ctx.module.data || 'characters.json';
        const cacheKey = Date.now();
        const joiner = dataPath.includes('?') ? '&' : '?';
        const data = await ctx.fetchJSON(`${dataPath}${joiner}v=${cacheKey}`);
        ctx.state.graph = normalizeGraph(data, ctx.resolvePath);

        ctx.panelEl.innerHTML = `
            <div class="panel-header">
                <h2>👥 人物图谱</h2>
                <p class="panel-desc">关系网络从对抗到连接</p>
            </div>
            <div class="character-graph-container" id="oveCharacterGraph" style="height:520px;min-height:520px;">
                <div class="loading">人物关系图加载中...</div>
            </div>
        `;

        try {
            await ensureCytoscape();
            this._scheduleMount(ctx, 0);
        } catch (error) {
            this._renderError(ctx, `人物关系图加载失败：${error?.message || '未知错误'}`);
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

    _scheduleMount(ctx, attempt) {
        if (ctx.state?.cy) return;

        if (ctx.state?.mountTimer) {
            window.clearTimeout(ctx.state.mountTimer);
            ctx.state.mountTimer = null;
        }

        const panelEl = ctx.panelEl;
        const container = panelEl?.querySelector?.('#oveCharacterGraph');
        if (!panelEl || !container) return;

        const rect = container.getBoundingClientRect();
        const isVisible = panelEl.classList.contains('active') && rect.width > 20 && rect.height > 20;
        if (!isVisible) {
            if (attempt >= 30) {
                this._renderError(ctx, '人物关系图容器未就绪，请切换标签后重试。');
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
                this._renderError(ctx, `人物关系图加载失败：${error?.message || '未知错误'}`);
                return;
            }
            ctx.state.mountTimer = window.setTimeout(() => {
                this._scheduleMount(ctx, attempt + 1);
            }, 120);
        }
    },

    _mountGraph(ctx) {
        if (ctx.state.cy) {
            ctx.state.cy.destroy();
            ctx.state.cy = null;
        }

        const container = ctx.panelEl.querySelector('#oveCharacterGraph');
        if (!container) {
            throw new Error('Missing graph container');
        }
        container.style.height = container.style.height || '520px';
        container.style.minHeight = container.style.minHeight || '520px';
        container.innerHTML = '';

        const cy = window.cytoscape({
            container,
            elements: {
                nodes: ctx.state.graph.nodes,
                edges: ctx.state.graph.edges
            },
            style: [
                {
                    selector: 'node',
                    style: {
                        label: 'data(label)',
                        color: '#F8FAFC',
                        'text-valign': 'bottom',
                        'text-halign': 'center',
                        'text-margin-y': 8,
                        'font-size': 12,
                        'background-color': 'data(color)',
                        'background-image': 'data(avatar)',
                        'background-fit': 'cover',
                        'background-clip': 'node',
                        'background-image-opacity': 1,
                        width: 52,
                        height: 52,
                        'border-width': 2,
                        'border-color': '#F8FAFC'
                    }
                },
                {
                    selector: 'node[deceased]',
                    style: {
                        'border-style': 'dashed'
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        label: 'data(label)',
                        width: 2,
                        'line-color': 'data(color)',
                        'curve-style': 'bezier',
                        opacity: 0.85,
                        'font-size': 10,
                        color: '#94A3B8',
                        'text-rotation': 'autorotate',
                        'text-margin-y': -7,
                        'text-background-opacity': 0,
                        'text-wrap': 'wrap',
                        'text-max-width': 100
                    }
                }
            ],
            layout: {
                name: 'cose',
                padding: 40,
                animate: false,
                nodeRepulsion: 7000,
                idealEdgeLength: 110
            }
        });

        cy.on('tap', 'node', (event) => {
            this._openCharacterModal(event.target.data());
        });

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                try {
                    cy.resize();
                    cy.fit(undefined, 30);
                } catch (_error) {
                    // ignore early-frame sizing issues
                }
            });
        });

        // One more delayed fit for slower devices/layout recalculation.
        window.setTimeout(() => {
            try {
                cy.resize();
                cy.fit(undefined, 30);
            } catch (_error) {
                // ignore transient layout issues
            }
        }, 160);

        if (typeof ctx.state.onResize === 'function') {
            window.removeEventListener('resize', ctx.state.onResize);
        }
        ctx.state.onResize = () => {
            try {
                cy.resize();
                cy.fit(undefined, 30);
            } catch (_error) {
                // ignore transient layout issues
            }
        };
        window.addEventListener('resize', ctx.state.onResize, { passive: true });

        ctx.state.cy = cy;
    },

    _renderError(ctx, message) {
        const container = ctx.panelEl.querySelector('#oveCharacterGraph');
        if (!container) return;
        container.innerHTML = `<div class="loading">${escapeHtml(message)}</div>`;
    },

    _openCharacterModal(data) {
        const html = `
            <article>
                <div style="display:flex;gap:14px;align-items:flex-start;">
                    ${data.avatar
                ? `<img src="${escapeHtml(data.avatar)}" alt="${escapeHtml(data.label || '')}" style="width:78px;height:78px;border-radius:10px;object-fit:cover;border:2px solid ${escapeHtml(data.color || '#64748B')};">`
                : ''
            }
                    <div>
                        <h3 style="margin:0 0 6px;color:${escapeHtml(data.color || '#64748B')};">${escapeHtml(data.label || '未命名')}</h3>
                        <p style="margin:0 0 6px;color:var(--color-text-muted);">${escapeHtml(data.nameEn || '')}</p>
                        <p style="margin:0;color:var(--color-text-muted);font-size:0.92rem;">${escapeHtml(data.role || '')}</p>
                    </div>
                </div>
                <p style="margin:14px 0 0;line-height:1.8;">${escapeHtml(data.description || '暂无介绍')}</p>
            </article>
        `;
        openStoryModal({ html, lockBodyScroll: true });
    }
};
