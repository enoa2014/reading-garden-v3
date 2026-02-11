import { openStoryModal } from './shared/story-modal.js';

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
}

function iconByMethod(method) {
    const m = String(method || '');
    if (m.includes('上吊')) return '🪢';
    if (m.includes('一氧化碳')) return '🚗';
    if (m.includes('卧轨')) return '🚉';
    if (m.includes('枪')) return '🔫';
    return '☁️';
}

export default {
    async init(ctx) {
        ctx.state = {
            attempts: [],
            onPanelClick: null
        };
    },

    async render(ctx) {
        if (!ctx.state.attempts.length) {
            const dataPath = ctx.module.data || 'suicide_attempts.json';
            const data = await ctx.fetchJSON(dataPath);
            ctx.state.attempts = Array.isArray(data) ? data : [];
        }

        ctx.panelEl.innerHTML = `
            <div class="panel-header">
                <h2>☁️ 未遂的告别</h2>
                <p class="panel-desc">每次他想离开，生活都会把他拉回来</p>
            </div>
            <div class="suicide-attempts-grid">
                ${ctx.state.attempts.map((item) => `
                    <button
                        type="button"
                        class="suicide-card"
                        data-action="open-attempt"
                        data-id="${escapeHtml(item.id)}"
                        style="text-align:left;border:none;width:100%;"
                    >
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                            <div style="font-size:1.1rem;font-weight:700;">${iconByMethod(item.method)} ${escapeHtml(item.method || '未命名尝试')}</div>
                            <div style="color:var(--ove-text-muted);font-size:0.85rem;">Ch.${escapeHtml(item.chapter || '-')}</div>
                        </div>
                        <div style="color:var(--ove-text-muted);font-size:0.92rem;margin-bottom:6px;">${escapeHtml(item.preparation || '')}</div>
                        <div style="font-size:0.92rem;">被 <strong>${escapeHtml(item.interruptedBy || '未知')}</strong> 打断</div>
                    </button>
                `).join('')}
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
            const trigger = event.target.closest('[data-action="open-attempt"]');
            if (!trigger) return;
            const id = String(trigger.dataset.id || '').trim();
            if (!id) return;

            const item = ctx.state.attempts.find((attempt) => String(attempt?.id || '') === id);
            if (!item) return;

            this._openAttemptModal(ctx, item);
        };

        ctx.panelEl.addEventListener('click', ctx.state.onPanelClick);
    },

    _openAttemptModal(ctx, item) {
        const hasChapter = Number.isFinite(Number(item?.chapter));
        const image = item?.image ? ctx.resolvePath(item.image) : '';

        const html = `
            <article>
                <h3 style="margin:0 0 10px;color:var(--color-primary);">${iconByMethod(item.method)} ${escapeHtml(item.method || '未命名尝试')}</h3>
                <p style="margin:0 0 8px;color:var(--color-text-muted);">地点：${escapeHtml(item.location || '未知')} · 第 ${escapeHtml(item.chapter || '-')} 章</p>
                ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(item.method || '')}" style="width:100%;border-radius:10px;margin:8px 0 12px;" loading="lazy">` : ''}
                <p style="margin:0 0 8px;line-height:1.8;"><strong>准备：</strong>${escapeHtml(item.preparation || '无')}</p>
                <p style="margin:0 0 8px;line-height:1.8;"><strong>被谁打断：</strong>${escapeHtml(item.interruptedBy || '未知')}</p>
                <p style="margin:0 0 8px;line-height:1.8;"><strong>打断原因：</strong>${escapeHtml(item.interruptReason || '未知')}</p>
                <p style="margin:0 0 12px;line-height:1.8;"><strong>结果：</strong>${escapeHtml(item.result || '未知')}</p>
                ${item.quote ? `<blockquote style="margin:0 0 14px;padding-left:10px;border-left:3px solid var(--color-border);color:var(--color-text-muted);">"${escapeHtml(item.quote)}"</blockquote>` : ''}
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
