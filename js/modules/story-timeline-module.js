function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
}

function getTimelineColor(type) {
    if (type === 'daughter') return 'var(--color-accent)';
    if (type === 'arrival') return 'var(--color-arrival)';
    return 'var(--color-secondary)';
}

export default {
    async init(ctx) {
        ctx.state = {
            events: [],
            activeId: null,
            onPanelClick: null
        };
    },

    async render(ctx) {
        if (!ctx.state.events.length) {
            const dataPath = ctx.module.data || 'timeline.json';
            const data = await ctx.fetchJSON(dataPath);
            ctx.state.events = Array.isArray(data) ? data : [];
        }

        const events = this._sortedEvents(ctx.state.events);
        const firstId = events[0]?.id || null;
        if (!ctx.state.activeId && firstId) {
            ctx.state.activeId = firstId;
        }

        ctx.panelEl.innerHTML = `
            <div class="panel-header">
                <h2>🔄 时间观</h2>
                <p class="panel-desc">线性时间 vs 非线性时间：两种感知世界的方式</p>
            </div>
            <div class="timeline-container">
                <div class="timeline-linear">
                    <h3 style="margin-bottom: 16px; color: var(--color-primary);">线性时间 →</h3>
                    <div id="storyLinearTimeline"></div>
                </div>
                <div class="timeline-circular">
                    <svg viewBox="0 0 200 200" width="100%" style="max-height: 420px;">
                        <circle class="time-ring" cx="100" cy="100" r="80"></circle>
                        <circle class="time-ring" cx="100" cy="100" r="60" style="animation-delay:-1s;"></circle>
                        <circle class="time-ring" cx="100" cy="100" r="40" style="animation-delay:-2s;"></circle>
                        <g id="storyCircularTimeline"></g>
                        <text x="100" y="105" text-anchor="middle" fill="var(--color-text-light)" font-size="12">同时存在</text>
                    </svg>
                </div>
            </div>
        `;

        this._bindEvents(ctx);
        this._renderLinear(ctx, events);
        this._renderCircular(ctx, events);
        this._syncActiveState(ctx);
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
            if (target.dataset.action === 'timeline-focus') {
                const id = String(target.dataset.id || '').trim();
                if (!id) return;
                ctx.state.activeId = id;
                this._syncActiveState(ctx);
            }
        };
        ctx.panelEl.addEventListener('click', ctx.state.onPanelClick);
    },

    _renderLinear(ctx, events) {
        const host = ctx.panelEl.querySelector('#storyLinearTimeline');
        if (!host) return;

        host.innerHTML = events.map((event) => `
            <article
                class="timeline-event"
                data-id="${escapeHtml(event.id)}"
                data-action="timeline-focus"
                style="border-left-color:${escapeHtml(getTimelineColor(event.type))};"
            >
                <div class="event-title">${escapeHtml(event.title || '未命名事件')}</div>
                <div class="event-desc">${escapeHtml(event.description || '')}</div>
            </article>
        `).join('');
    },

    _renderCircular(ctx, events) {
        const host = ctx.panelEl.querySelector('#storyCircularTimeline');
        if (!host) return;

        host.innerHTML = events.map((event) => {
            const ratio = Number(event.circularPosition);
            const normalized = Number.isFinite(ratio) ? ratio : 0;
            const angle = normalized * 2 * Math.PI - Math.PI / 2;
            const radius = 70;
            const cx = 100 + Math.cos(angle) * radius;
            const cy = 100 + Math.sin(angle) * radius;

            return `
                <circle
                    cx="${cx.toFixed(2)}"
                    cy="${cy.toFixed(2)}"
                    r="6"
                    fill="${escapeHtml(getTimelineColor(event.type))}"
                    data-id="${escapeHtml(event.id)}"
                    data-action="timeline-focus"
                    style="cursor:pointer; transition:r 0.2s ease, opacity 0.2s ease;"
                >
                    <title>${escapeHtml(event.title || '事件')}</title>
                </circle>
            `;
        }).join('');
    },

    _syncActiveState(ctx) {
        const activeId = String(ctx.state.activeId || '');
        ctx.panelEl.querySelectorAll('.timeline-event').forEach((node) => {
            node.classList.toggle('active', node.dataset.id === activeId);
        });
        ctx.panelEl.querySelectorAll('#storyCircularTimeline circle').forEach((node) => {
            const isActive = node.dataset.id === activeId;
            node.setAttribute('r', isActive ? '10' : '6');
            node.style.opacity = isActive ? '1' : '0.75';
        });
    },

    _sortedEvents(events) {
        return [...events].sort((a, b) => {
            const av = a?.linearPosition;
            const bv = b?.linearPosition;
            const an = Number.isFinite(av) ? av : Number.MAX_SAFE_INTEGER;
            const bn = Number.isFinite(bv) ? bv : Number.MAX_SAFE_INTEGER;
            if (an !== bn) return an - bn;
            return String(a?.id || '').localeCompare(String(b?.id || ''));
        });
    }
};
