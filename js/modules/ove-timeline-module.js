import { openStoryModal } from './shared/story-modal.js';

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
}

function sortEvents(events) {
    return [...events].sort((a, b) => {
        const ay = Number(a?.year || 0);
        const by = Number(b?.year || 0);
        if (ay !== by) return ay - by;
        const am = Number(a?.month || 0);
        const bm = Number(b?.month || 0);
        if (am !== bm) return am - bm;
        return String(a?.id || '').localeCompare(String(b?.id || ''));
    });
}

export default {
    async init(ctx) {
        ctx.state = {
            data: null,
            onPanelClick: null
        };
    },

    async render(ctx) {
        if (!ctx.state.data) {
            const dataPath = ctx.module.data || 'timeline.json';
            const data = await ctx.fetchJSON(dataPath);
            ctx.state.data = data && typeof data === 'object' ? data : { timelines: {}, events: [] };
        }

        const events = Array.isArray(ctx.state.data.events) ? ctx.state.data.events : [];
        const grouped = {
            past: sortEvents(events.filter((event) => event?.timeline === 'past')),
            present: sortEvents(events.filter((event) => event?.timeline === 'present'))
        };
        const timelineMeta = ctx.state.data.timelines || {};

        ctx.panelEl.innerHTML = `
            <div class="panel-header">
                <h2>📅 双时间线</h2>
                <p class="panel-desc">过去与现在交织：欧维的记忆如何改变当下</p>
            </div>
            <div class="timeline-container">
                <section class="timeline-linear">
                    <h3 style="margin:0 0 12px;color:${escapeHtml(timelineMeta.past?.color || '#D97706')};">${escapeHtml(timelineMeta.past?.name || '过去')}</h3>
                    ${grouped.past.map((event) => this._renderEventCard(event, timelineMeta.past?.color || '#D97706')).join('')}
                </section>
                <section class="timeline-linear">
                    <h3 style="margin:0 0 12px;color:${escapeHtml(timelineMeta.present?.color || '#64748B')};">${escapeHtml(timelineMeta.present?.name || '现在')}</h3>
                    ${grouped.present.map((event) => this._renderEventCard(event, timelineMeta.present?.color || '#64748B')).join('')}
                </section>
            </div>
        `;

        this._bindEvents(ctx, events);
    },

    async destroy(ctx) {
        if (typeof ctx.state?.onPanelClick === 'function') {
            ctx.panelEl?.removeEventListener('click', ctx.state.onPanelClick);
            ctx.state.onPanelClick = null;
        }
    },

    _renderEventCard(event, color) {
        const chapterBadge = Number.isFinite(Number(event?.chapter))
            ? `<span style="font-size:0.8rem;color:var(--color-text-muted);">第 ${escapeHtml(event.chapter)} 章</span>`
            : '';
        const year = Number.isFinite(Number(event?.year)) ? `${event.year}` : '';
        const month = Number.isFinite(Number(event?.month)) ? ` · ${event.month}月` : '';

        return `
            <button
                type="button"
                class="timeline-event"
                data-action="open-event"
                data-id="${escapeHtml(event?.id || '')}"
                style="border-left-color:${escapeHtml(color)};text-align:left;width:100%;border-top:0;border-right:0;border-bottom:0;background:transparent;"
            >
                <div class="event-title">${escapeHtml(event?.title || '未命名事件')}</div>
                <div class="event-desc">${escapeHtml(event?.description || event?.method || '')}</div>
                <div style="margin-top:8px;display:flex;justify-content:space-between;gap:8px;align-items:center;">
                    <span style="font-size:0.85rem;color:var(--color-text-muted);">${escapeHtml(year)}${escapeHtml(month)}</span>
                    ${chapterBadge}
                </div>
            </button>
        `;
    },

    _bindEvents(ctx, events) {
        if (typeof ctx.state.onPanelClick === 'function') {
            ctx.panelEl.removeEventListener('click', ctx.state.onPanelClick);
        }

        ctx.state.onPanelClick = (event) => {
            const trigger = event.target.closest('[data-action="open-event"]');
            if (!trigger) return;
            const id = String(trigger.dataset.id || '').trim();
            if (!id) return;

            const item = events.find((entry) => String(entry?.id || '') === id);
            if (!item) return;

            this._openEventModal(ctx, item);
        };

        ctx.panelEl.addEventListener('click', ctx.state.onPanelClick);
    },

    _openEventModal(ctx, item) {
        const hasChapter = Number.isFinite(Number(item?.chapter));
        const html = `
            <article>
                <h3 style="margin:0 0 10px;color:var(--color-primary);">${escapeHtml(item?.title || '未命名事件')}</h3>
                <p style="margin:0 0 8px;color:var(--color-text-muted);">
                    ${escapeHtml(item?.timeline === 'past' ? '过去时间线' : '现在时间线')}
                    ${item?.year ? ` · ${escapeHtml(item.year)}` : ''}
                    ${item?.month ? `/${escapeHtml(item.month)}` : ''}
                </p>
                <p style="margin:0 0 12px;line-height:1.8;">${escapeHtml(item?.description || item?.method || '')}</p>
                ${item?.interrupted ? `<p style="margin:0 0 12px;color:var(--color-text-muted);"><strong>被打断：</strong>${escapeHtml(item.interrupted)}</p>` : ''}
                ${hasChapter ? '<button type="button" class="btn-nav" data-action="jump-reading">跳到对应章节</button>' : ''}
            </article>
        `;

        const modalApi = openStoryModal({ html, lockBodyScroll: true });
        if (!hasChapter) return;

        const onClick = (event) => {
            const btn = event.target.closest('[data-action="jump-reading"]');
            if (!btn) return;
            modalApi.close();
            ctx.activateModule('reading', { chapterNumber: Number(item.chapter) });
        };
        modalApi.modalBody.addEventListener('click', onClick);
        modalApi.addCleanup(() => {
            modalApi.modalBody.removeEventListener('click', onClick);
        });
    }
};
