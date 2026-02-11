
const LOTF_TOC_COLLAPSED_KEY = 'lotf-reading-toc-collapsed';

export default {
    async init(ctx) {
        this.data = await ctx.fetchJSON(ctx.module.data);
        this.currentChapterIndex = 0;
        this.sidebarCollapsed = localStorage.getItem(LOTF_TOC_COLLAPSED_KEY) === '1';
    },

    async render(ctx, payload) {
        // Build layout
        ctx.panelEl.innerHTML = `
            <div class="lotf-reading-shell">
                <div class="lotf-reading-toolbar">
                    <button type="button"
                            class="lotf-toc-toggle"
                            id="lotfTocToggle"
                            aria-controls="lotfSidebar"
                            aria-expanded="${this.sidebarCollapsed ? 'false' : 'true'}">
                        ${this.sidebarCollapsed ? '展开目录' : '收起目录'}
                    </button>
                </div>
                <div class="lotf-reading-layout ${this.sidebarCollapsed ? 'sidebar-collapsed' : ''}" id="lotfReadingLayout">
                    <aside class="lotf-sidebar" id="lotfSidebar">
                        <nav class="chapter-list" id="chapterList"></nav>
                    </aside>
                    <article class="lotf-content" id="chapterContent">
                        <div class="loading">Select a chapter to begin...</div>
                    </article>
                </div>
            </div>
        `;

        this.bindSidebarToggle(ctx);
        this.renderSidebar(ctx);

        // If payload has chapterId, use it, otherwise default to 0
        if (payload && payload.chapterId) {
            const idx = this.data.chapters.findIndex(c => c.id == payload.chapterId);
            if (idx >= 0) this.currentChapterIndex = idx;
        }

        this.renderChapter(ctx, this.currentChapterIndex);
    },

    bindSidebarToggle(ctx) {
        const toggleBtn = ctx.panelEl.querySelector('#lotfTocToggle');
        if (!toggleBtn) return;

        toggleBtn.addEventListener('click', () => {
            this.sidebarCollapsed = !this.sidebarCollapsed;
            localStorage.setItem(LOTF_TOC_COLLAPSED_KEY, this.sidebarCollapsed ? '1' : '0');

            const layout = ctx.panelEl.querySelector('#lotfReadingLayout');
            layout?.classList.toggle('sidebar-collapsed', this.sidebarCollapsed);

            toggleBtn.textContent = this.sidebarCollapsed ? '展开目录' : '收起目录';
            toggleBtn.setAttribute('aria-expanded', this.sidebarCollapsed ? 'false' : 'true');
        });
    },

    renderSidebar(ctx) {
        const listEl = ctx.panelEl.querySelector('#chapterList');
        listEl.innerHTML = this.data.chapters.map((chapter, index) => `
            <li class="chapter-item">
                <button class="chapter-btn ${index === this.currentChapterIndex ? 'active' : ''}" 
                        data-index="${index}">
                    ${chapter.id}. ${chapter.title}
                </button>
            </li>
        `).join('');

        listEl.querySelectorAll('.chapter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.currentChapterIndex = index;
                this.renderChapter(ctx, index);
                this.updateSidebarActive(ctx, index);
            });
        });
    },

    updateSidebarActive(ctx, index) {
        const btns = ctx.panelEl.querySelectorAll('.chapter-btn');
        btns.forEach((btn, idx) => {
            btn.classList.toggle('active', idx === index);
        });
    },

    async renderChapter(ctx, index) {
        let chapter = this.data.chapters[index];
        const contentEl = ctx.panelEl.querySelector('#chapterContent');

        if (!chapter) return;

        // Lazy load chapter content if paragraphs are missing
        if (!chapter.paragraphs || !Array.isArray(chapter.paragraphs)) {
            contentEl.innerHTML = '<div class="loading">正在加载章节内容...</div>';
            try {
                // Assuming data structure: data/lord-of-the-flies/chapters/<id>.json
                // We need to resolve the path relative to the registry or data folder
                // The registry uses "data": "chapters.json", so we can infer the base
                // However, ctx.fetchJSON resolves relative to registry location usually
                // unique logic for modular data structure:
                const chapterId = chapter.id;
                const chapterData = await ctx.fetchJSON(`chapters/${chapterId}.json`);

                // Merge loaded detailed data into the lightweight chapter object
                Object.assign(chapter, chapterData);
                // Update local reference
                this.data.chapters[index] = chapter;
            } catch (err) {
                console.error('Failed to load chapter content:', err);
                contentEl.innerHTML = '<div class="error">章节加载失败，请重试。</div>';
                return;
            }
        }

        // paragraphs rendering
        const paragraphsHtml = (chapter.paragraphs || []).map(p => `
            <p id="${p.id}" class="${p.highlight ? 'highlight' : ''}">${p.text}</p>
        `).join('');

        contentEl.innerHTML = `
            <h2 class="chapter-title">第${chapter.id}章 ${chapter.title}</h2>
            <h3 class="chapter-subtitle">${chapter.titleEn}</h3>
            <div class="chapter-text">
                ${paragraphsHtml}
            </div>
            
            <div class="chapter-nav">
                <button class="btn-nav" id="prevBtn" ${index === 0 ? 'disabled' : ''}>上一章</button>
                <button class="btn-nav" id="nextBtn" ${index === this.data.chapters.length - 1 ? 'disabled' : ''}>下一章</button>
            </div>
        `;

        // Scroll to top
        contentEl.scrollTop = 0;

        // Bind Nav Buttons
        contentEl.querySelector('#prevBtn').addEventListener('click', () => {
            if (index > 0) {
                this.currentChapterIndex = index - 1;
                this.renderChapter(ctx, this.currentChapterIndex);
                this.updateSidebarActive(ctx, this.currentChapterIndex);
                this.scrollSidebar(ctx, this.currentChapterIndex);
            }
        });

        contentEl.querySelector('#nextBtn').addEventListener('click', () => {
            if (index < this.data.chapters.length - 1) {
                this.currentChapterIndex = index + 1;
                this.renderChapter(ctx, this.currentChapterIndex);
                this.updateSidebarActive(ctx, this.currentChapterIndex);
                this.scrollSidebar(ctx, this.currentChapterIndex);
            }
        });
    },

    scrollSidebar(ctx, index) {
        const btn = ctx.panelEl.querySelectorAll('.chapter-btn')[index];
        if (btn) {
            btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    },

    async destroy(ctx) {
        // Cleanup if needed
    }
}
