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
            itemById: {},
            cy: null,
            onPanelClick: null,
            hasInitialHeroFocus: false
        };
    },

    async render(ctx) {
        if (!ctx.state.items.length) {
            const dataPath = ctx.module.data || 'characters.json';
            const data = await ctx.fetchJSON(dataPath);
            ctx.state.items = Array.isArray(data) ? data : [];
            ctx.state.itemById = Object.fromEntries(
                ctx.state.items
                    .map((item) => [String(item?.id || '').trim(), item])
                    .filter(([id]) => id)
            );
        }

        if (ctx.state.cy) {
            ctx.state.cy.destroy();
            ctx.state.cy = null;
        }

        ctx.panelEl.innerHTML = `
            <div class="section-header">
                <h2>人物星系图</h2>
                <p>探索奥吉的宇宙以及围绕他旋转的行星</p>
            </div>
            <div id="wonderCharacterGraph" class="character-graph-container"></div>
            <div class="cards-container" id="wonderCharacterFallback" style="display:none;"></div>
        `;

        this._bindEvents(ctx);
        this._renderGraph(ctx);
    },

    async destroy(ctx) {
        if (ctx.state.cy) {
            ctx.state.cy.destroy();
            ctx.state.cy = null;
        }
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
            if (target.dataset.action === 'open-character') {
                this._openCharacter(ctx, target.dataset.id);
            }
        };
        ctx.panelEl.addEventListener('click', ctx.state.onPanelClick);
    },

    _renderGraph(ctx) {
        const container = ctx.panelEl.querySelector('#wonderCharacterGraph');
        if (!container) return;

        if (typeof window.cytoscape !== 'function') {
            this._renderFallbackList(ctx, '当前环境未加载 Cytoscape，已切换为列表展示。');
            return;
        }

        const elements = ctx.state.items.map((item) => ({
            data: {
                id: item.id,
                name: item.name,
                role: item.role,
                group: item.group,
                avatar: ctx.resolvePath(item.avatar || '')
            }
        }));

        const edges = this._buildEdges();
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const textPrimary = this._getCssVar('--text-primary', isDark ? '#F5EDE6' : '#1E293B');
        const textSecondary = this._getCssVar('--text-secondary', isDark ? '#BDB0A3' : '#64748B');
        const bgPrimary = this._getCssVar('--bg-primary', isDark ? '#2D2A26' : '#FFFFFF');

        const cy = window.cytoscape({
            container,
            elements: [...elements, ...edges],
            style: [
                {
                    selector: 'node',
                    style: {
                        'background-color': '#3AB8EB',
                        'background-image': 'data(avatar)',
                        'background-fit': 'cover',
                        'label': 'data(name)',
                        'font-family': 'Fredoka',
                        'font-size': '12px',
                        'text-valign': 'bottom',
                        'text-margin-y': 6,
                        'color': textPrimary,
                        'text-outline-color': bgPrimary,
                        'text-outline-width': 2,
                        'width': 60,
                        'height': 60,
                        'border-width': 3,
                        'border-color': '#ffffff'
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        'width': 2,
                        'line-color': textSecondary,
                        'curve-style': 'bezier',
                        'opacity': 0.6
                    }
                },
                {
                    selector: '[group="family"]',
                    style: { 'border-color': '#F97316' }
                },
                {
                    selector: '[id="auggie"]',
                    style: { 'width': 82, 'height': 82, 'border-color': '#3AB8EB', 'border-width': 5 }
                }
            ],
            layout: {
                name: 'cose',
                animate: false,
                padding: 30,
                fit: true,
                componentSpacing: 90
            }
        });

        cy.on('tap', 'node', (evt) => {
            const node = evt.target;
            this._openCharacter(ctx, node.id());
        });

        this._focusHeroOnFirstOpen(ctx, cy);
        ctx.state.cy = cy;
    },

    _renderFallbackList(ctx, message) {
        const graph = ctx.panelEl.querySelector('#wonderCharacterGraph');
        const fallback = ctx.panelEl.querySelector('#wonderCharacterFallback');
        if (!fallback) return;

        if (graph) {
            graph.style.display = 'none';
        }
        fallback.style.display = 'block';
        fallback.innerHTML = `
            <p class="panel-desc">${escapeHtml(message)}</p>
            <div class="cards-grid">
                ${ctx.state.items.map((item) => `
                    <button class="card btn-nav" type="button" data-action="open-character" data-id="${escapeHtml(item.id)}">
                        <strong>${escapeHtml(item.name)}</strong><br>
                        <span>${escapeHtml(item.role || '')}</span>
                    </button>
                `).join('')}
            </div>
        `;
    },

    _openCharacter(ctx, id) {
        const key = String(id || '').trim();
        if (!key) return;

        const item = ctx.state.itemById[key];
        if (!item) return;

        const html = `
            <div class="char-modal-content">
                <div class="char-header" style="display:flex; gap:12px; align-items:center; margin-bottom:12px;">
                    <img src="${escapeHtml(ctx.resolvePath(item.avatar || ''))}" alt="${escapeHtml(item.name)}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:3px solid rgba(58,184,235,0.35);">
                    <div>
                        <h2 style="margin:0 0 6px;color:var(--wonder-blue);">${escapeHtml(item.name)}</h2>
                        <span class="char-role" style="display:inline-block;background:var(--kindness-orange);color:white;padding:2px 10px;border-radius:999px;font-size:12px;">${escapeHtml(item.role || '人物')}</span>
                    </div>
                </div>
                <p style="margin:0;line-height:1.8;">${escapeHtml(item.description || '暂无介绍')}</p>
            </div>
        `;
        openStoryModal({ html });
    },

    _buildEdges() {
        const pairs = [
            ['auggie', 'via'],
            ['auggie', 'mom'],
            ['auggie', 'dad'],
            ['auggie', 'daisy'],
            ['auggie', 'jack'],
            ['auggie', 'summer'],
            ['auggie', 'tushman'],
            ['auggie', 'browne'],
            ['via', 'miranda'],
            ['via', 'justin'],
            ['jack', 'julian']
        ];
        return pairs.map(([source, target]) => ({
            data: { source, target }
        }));
    },

    _getCssVar(name, fallback) {
        const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        return value || fallback;
    },

    _focusHeroOnFirstOpen(ctx, cy) {
        if (ctx.state?.hasInitialHeroFocus) return;

        const focus = () => {
            if (ctx.state?.hasInitialHeroFocus || !cy || cy.destroyed()) return;
            const hero = cy.$id('auggie');
            if (!hero || hero.empty()) return;
            this._panNodeToViewportCenter(cy, hero);
            ctx.state.hasInitialHeroFocus = true;
        };

        const deferFocus = () => {
            requestAnimationFrame(() => {
                requestAnimationFrame(focus);
            });
        };

        // Different browsers/devices may emit layout/render at different times.
        cy.one('layoutstop', deferFocus);
        cy.one('render', deferFocus);
        window.setTimeout(deferFocus, 220);
    },

    _panNodeToViewportCenter(cy, node) {
        if (!cy || cy.destroyed() || !node || node.empty()) return;

        const pos = node.position();
        const width = cy.width();
        const height = cy.height();
        if (!Number.isFinite(pos?.x) || !Number.isFinite(pos?.y) || width <= 0 || height <= 0) return;

        const currentPan = cy.pan();
        const dx = width / 2 - pos.x;
        const dy = height / 2 - pos.y;
        cy.pan({
            x: currentPan.x + dx,
            y: currentPan.y + dy
        });
    }
};
