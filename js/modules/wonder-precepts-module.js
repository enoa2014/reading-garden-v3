function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
}

export default {
    async init(ctx) {
        ctx.state = {
            items: [],
            onPanelClick: null,
            onPostcardInput: null
        };
    },

    async render(ctx) {
        if (!ctx.state.items.length) {
            const dataPath = ctx.module.data || 'precepts.json';
            const data = await ctx.fetchJSON(dataPath);
            ctx.state.items = Array.isArray(data) ? data : [];
        }

        const draftKey = this._draftStorageKey(ctx);
        const savedDraft = localStorage.getItem(draftKey) || '';

        ctx.panelEl.innerHTML = `
            <div class="section-header">
                <h2>Mr. Browne's Precepts</h2>
                <p>每月一条人生格言，指引我们成长的方向</p>
            </div>

            <div class="precepts-grid">
              ${ctx.state.items.map((item) => this._renderPreceptCard(ctx, item)).join('')}
            </div>

            <div class="submit-precept-box">
                <div class="postcard-content">
                    <div class="postcard-left">
                        <h3>寄给布朗先生的明信片</h3>
                        <p>写下你的信念 (Precept)</p>
                        <textarea id="wonderPreceptDraft" placeholder="比如：当你看到有人孤单时，走过去坐在他身边。">${escapeHtml(savedDraft)}</textarea>
                        <button class="btn-primary" type="button" data-action="save-postcard">发送明信片</button>
                        <p class="panel-desc" id="wonderPreceptFeedback"></p>
                    </div>
                    <div class="postcard-right">
                        <div class="stamp-placeholder">WONDER<br>POST</div>
                        <div class="address-lines">
                            <span class="addr-label">To: Mr. Browne</span>
                            <div class="address-line"></div>
                            <div class="address-line"></div>
                            <div class="address-line"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this._bindEvents(ctx);
    },

    async destroy(ctx) {
        if (typeof ctx.state?.onPanelClick === 'function') {
            ctx.panelEl?.removeEventListener('click', ctx.state.onPanelClick);
            ctx.state.onPanelClick = null;
        }
        if (typeof ctx.state?.onPostcardInput === 'function') {
            ctx.panelEl.querySelector('#wonderPreceptDraft')?.removeEventListener('input', ctx.state.onPostcardInput);
            ctx.state.onPostcardInput = null;
        }
    },

    _renderPreceptCard(ctx, item) {
        const image = String(item?.image || '').trim();
        const imageUrl = image ? ctx.resolvePath(image) : '';
        const bgStyle = imageUrl
            ? `background-image: url('${escapeHtml(imageUrl)}');`
            : 'background-color: #3AB8EB;';

        return `
            <article class="precept-card">
                <div class="precept-inner">
                    <div class="precept-front" style="${bgStyle}">
                        <span class="month-badge">${escapeHtml(item?.month || '')}</span>
                        ${imageUrl ? '' : `<h3 style="color:white; padding:20px;">${escapeHtml(item?.title || '未命名')}</h3>`}
                    </div>
                    <div class="precept-back">
                        <h3>${escapeHtml(item?.title || '未命名')}</h3>
                        <blockquote>"${escapeHtml(item?.content || '暂无内容')}"</blockquote>
                        <cite>— ${escapeHtml(item?.attribution || '未知')}</cite>
                    </div>
                </div>
            </article>
        `;
    },

    _bindEvents(ctx) {
        if (typeof ctx.state.onPanelClick === 'function') {
            ctx.panelEl.removeEventListener('click', ctx.state.onPanelClick);
        }
        if (typeof ctx.state.onPostcardInput === 'function') {
            ctx.panelEl.querySelector('#wonderPreceptDraft')?.removeEventListener('input', ctx.state.onPostcardInput);
        }

        ctx.state.onPanelClick = (event) => {
            const target = event.target.closest('[data-action]');
            if (!target) return;
            if (target.dataset.action === 'save-postcard') {
                this._submitPostcard(ctx);
            }
        };
        ctx.panelEl.addEventListener('click', ctx.state.onPanelClick);

        const textarea = ctx.panelEl.querySelector('#wonderPreceptDraft');
        ctx.state.onPostcardInput = () => {
            localStorage.setItem(this._draftStorageKey(ctx), textarea?.value || '');
        };
        textarea?.addEventListener('input', ctx.state.onPostcardInput);
    },

    _submitPostcard(ctx) {
        const textarea = ctx.panelEl.querySelector('#wonderPreceptDraft');
        const feedback = ctx.panelEl.querySelector('#wonderPreceptFeedback');
        if (!textarea || !feedback) return;

        const content = (textarea.value || '').trim();
        if (!content) {
            feedback.textContent = '请先写下你的信念，再发送。';
            return;
        }

        const records = this._readPostcardRecords(ctx);
        records.unshift({
            content,
            createdAt: new Date().toISOString()
        });
        localStorage.setItem(this._recordsStorageKey(ctx), JSON.stringify(records.slice(0, 20)));

        textarea.value = '';
        localStorage.removeItem(this._draftStorageKey(ctx));
        feedback.textContent = '已保存到本地“信念明信片”，你可以继续写下一张。';
    },

    _readPostcardRecords(ctx) {
        try {
            const raw = localStorage.getItem(this._recordsStorageKey(ctx));
            const parsed = JSON.parse(raw || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (_error) {
            return [];
        }
    },

    _draftStorageKey(ctx) {
        const bookId = ctx.book?.id || 'wonder';
        return `${bookId}_precept_draft`;
    },

    _recordsStorageKey(ctx) {
        const bookId = ctx.book?.id || 'wonder';
        return `${bookId}_precept_records`;
    }
};
