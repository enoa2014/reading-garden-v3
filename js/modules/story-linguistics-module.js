import { openStoryModal } from './shared/story-modal.js';

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
}

export default {
    async init(ctx) {
        ctx.state = {
            logograms: [],
            comparisons: [],
            onPanelClick: null,
            currentWritingMode: 'human',
            writingReplayTimer: null,
            writingAnimations: [],
            writingTimers: []
        };
    },

    async render(ctx) {
        if (!ctx.state.logograms.length) {
            const data = await ctx.fetchJSON(ctx.module.data || 'logograms.json');
            ctx.state.logograms = Array.isArray(data) ? data : [];
        }

        if (!ctx.state.comparisons.length) {
            const extra = Array.isArray(ctx.module.extraData) ? ctx.module.extraData : [];
            const path = extra.find((item) => item === 'comparisons.json');
            if (path) {
                try {
                    const data = await ctx.fetchJSON(path);
                    ctx.state.comparisons = Array.isArray(data) ? data : [];
                } catch {
                    ctx.state.comparisons = [];
                }
            }
        }

        ctx.panelEl.innerHTML = `
            <div class="research-container">
                <div class="panel-header">
                    <h2>异种语言实验室.SYS</h2>
                    <p class="panel-desc">研究对象：七肢桶 B // 分析模式：运行中</p>
                </div>

                <h3 class="section-title">语标数据库</h3>
                <div class="logogram-grid">
                    ${ctx.state.logograms.map((item) => `
                        <div
                            class="logogram-card"
                            data-action="open-logogram"
                            data-id="${escapeHtml(item.id)}"
                            title="分析语标: ${escapeHtml(item.meaning || '未知')}"
                        >
                            <img src="${escapeHtml(ctx.resolvePath(item.image || ''))}" alt="${escapeHtml(item.meaning || '')}" class="logogram-img" loading="lazy">
                            <span class="logogram-meaning">${escapeHtml(item.meaning || '分析中...')}</span>
                        </div>
                    `).join('')}
                </div>

                <h3 class="section-title">书写与思维模拟</h3>
                <div class="terminal-panel">
                    <div class="writing-contrast-scene">
                        <div class="writing-contrast-toolbar">
                            <button type="button" class="btn-secondary writing-action-btn" data-action="play-human-writing">▶ 人类顺序</button>
                            <button type="button" class="btn-secondary writing-action-btn" data-action="play-heptapod-writing">◎ 七肢桶同步</button>
                            <button type="button" class="btn-nav writing-action-btn writing-action-primary" data-action="play-contrast-writing">⇄ 对比播放</button>
                            <button type="button" class="btn-secondary writing-action-btn" data-action="reset-writing-scene">↺ 重置</button>
                        </div>

                        <div class="writing-contrast-grid">
                            <article class="writing-mode-card writing-mode-human-card">
                                <h4>人类线性书写</h4>
                                <p>笔画按顺序逐步完成，信息随时间展开。</p>
                                <div class="writing-mode-canvas">
                                    <svg id="humanWritingSvg" viewBox="0 0 200 200" aria-label="人类线性书写演示">
                                        <g class="human-guides">
                                            <circle cx="100" cy="100" r="78"></circle>
                                            <line x1="22" y1="100" x2="178" y2="100"></line>
                                            <line x1="100" y1="22" x2="100" y2="178"></line>
                                        </g>
                                        <g id="humanWriting" class="writing-layer">
                                            <path class="human-stroke hs-1" d="M40,100 L160,100"></path>
                                            <path class="human-stroke hs-2" d="M100,40 L100,160"></path>
                                            <path class="human-stroke hs-3" d="M60,60 L140,140"></path>
                                            <path class="human-stroke hs-4" d="M140,60 L60,140"></path>
                                        </g>
                                    </svg>
                                </div>
                                <ol class="human-stroke-order" id="humanStrokeOrder">
                                    <li data-step="1">① 横向笔画建立主语义轴</li>
                                    <li data-step="2">② 纵向笔画补齐时间方向</li>
                                    <li data-step="3">③ 对角线补充语境</li>
                                    <li data-step="4">④ 反向对角线完成表达</li>
                                </ol>
                            </article>

                            <article class="writing-mode-card writing-mode-heptapod-card">
                                <h4>七肢桶环状书写</h4>
                                <p>多条弧线同步生成，开头与结尾在同一整体中被规划。</p>
                                <div class="writing-mode-canvas">
                                    <svg id="heptapodWritingSvg" viewBox="0 0 200 200" aria-label="七肢桶环状书写演示">
                                        <g id="heptapodWriting" class="writing-layer">
                                            <circle class="heptapod-base base-1" cx="100" cy="100" r="22"></circle>
                                            <circle class="heptapod-base base-2" cx="100" cy="100" r="42"></circle>
                                            <circle class="heptapod-base base-3" cx="100" cy="100" r="62"></circle>
                                            <circle class="heptapod-base base-4" cx="100" cy="100" r="80"></circle>

                                            <path class="heptapod-arc arc-1" d="M100,20 A80,80 0 0 1 180,100"></path>
                                            <path class="heptapod-arc arc-2" d="M180,100 A80,80 0 0 1 100,180"></path>
                                            <path class="heptapod-arc arc-3" d="M100,180 A80,80 0 0 1 20,100"></path>
                                            <path class="heptapod-arc arc-4" d="M20,100 A80,80 0 0 1 100,20"></path>

                                            <circle class="heptapod-pulse pulse-1" cx="100" cy="100" r="24"></circle>
                                            <circle class="heptapod-pulse pulse-2" cx="100" cy="100" r="44"></circle>
                                            <circle class="heptapod-pulse pulse-3" cx="100" cy="100" r="64"></circle>
                                            <circle class="heptapod-core" cx="100" cy="100" r="4"></circle>
                                        </g>
                                    </svg>
                                </div>
                                <ul class="heptapod-notes">
                                    <li>同步笔画：多段信息并行形成</li>
                                    <li>环状结构：没有单一“起笔终笔”</li>
                                    <li>中心稳定：整体从同一认知核心展开</li>
                                </ul>
                            </article>
                        </div>

                        <p class="writing-scene-status" id="writingDescription">
                            点击“对比播放”，同时观察线性顺序与环状同步两种书写逻辑。
                        </p>
                    </div>
                </div>

                <h3 class="section-title">思维模式对比分析</h3>
                <div class="comparison-grid">
                    ${ctx.state.comparisons.map((item) => `
                        <div class="comparison-entry" data-action="open-comparison" data-id="${escapeHtml(item.id)}">
                            <div class="comparison-header">
                                <span class="comparison-title">${escapeHtml(item.title || '数据节点')}</span>
                                <span class="comparison-icon">${escapeHtml(item.icon || '💠')}</span>
                            </div>
                            <div class="comparison-preview">
                                <span class="comparison-tag">人类</span>
                                <span>vs</span>
                                <span class="comparison-tag">七肢桶</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        this._bindEvents(ctx);
        this._bindWritingDemo(ctx);
    },

    async destroy(ctx) {
        if (typeof ctx.state?.onPanelClick === 'function') {
            ctx.panelEl?.removeEventListener('click', ctx.state.onPanelClick);
            ctx.state.onPanelClick = null;
        }
        this._clearWritingTimeline(ctx);
        if (ctx.state?.writingReplayTimer) {
            window.clearTimeout(ctx.state.writingReplayTimer);
            ctx.state.writingReplayTimer = null;
        }
    },

    _bindEvents(ctx) {
        if (typeof ctx.state.onPanelClick === 'function') {
            ctx.panelEl.removeEventListener('click', ctx.state.onPanelClick);
        }

        ctx.state.onPanelClick = (event) => {
            const target = event.target.closest('[data-action]');
            if (!target) return;

            const action = target.dataset.action;
            const id = String(target.dataset.id || '').trim();

            if (action === 'play-writing-demo') {
                this._playWritingAnimation(ctx, 'both');
                return;
            }

            if (action === 'play-human-writing') {
                this._playWritingAnimation(ctx, 'human');
                return;
            }

            if (action === 'play-heptapod-writing') {
                this._playWritingAnimation(ctx, 'heptapod');
                return;
            }

            if (action === 'play-contrast-writing') {
                this._playWritingAnimation(ctx, 'both');
                return;
            }

            if (action === 'reset-writing-scene') {
                this._resetWritingScene(ctx);
                return;
            }

            if (action === 'open-logogram') {
                const item = ctx.state.logograms.find((entry) => entry.id === id);
                if (item) this._openLogogram(ctx, item);
            } else if (action === 'open-comparison') {
                const item = ctx.state.comparisons.find((entry) => entry.id === id);
                if (item) this._openComparison(item);
            }
        };
        ctx.panelEl.addEventListener('click', ctx.state.onPanelClick);
    },

    _bindWritingDemo(ctx) {
        this._resetWritingScene(ctx);
    },

    _playWritingAnimation(ctx, mode = 'both') {
        const normalizedMode = mode === 'human' || mode === 'heptapod' ? mode : 'both';
        ctx.state.currentWritingMode = normalizedMode;
        this._resetWritingScene(ctx, { keepStatus: true });

        const speed = 1;
        const shouldPlayHuman = normalizedMode === 'human' || normalizedMode === 'both';
        const shouldPlayHeptapod = normalizedMode === 'heptapod' || normalizedMode === 'both';

        if (shouldPlayHuman) {
            this._playHumanWriting(ctx, speed);
        }
        if (shouldPlayHeptapod) {
            this._playHeptapodWriting(ctx, speed);
        }

        this._setWritingStatus(ctx, normalizedMode);
    },

    _playHumanWriting(ctx, speed) {
        const strokes = Array.from(ctx.panelEl.querySelectorAll('#humanWriting .human-stroke'));
        const orderItems = Array.from(ctx.panelEl.querySelectorAll('#humanStrokeOrder li'));
        const duration = 540 / speed;
        const gap = 140 / speed;

        strokes.forEach((stroke, index) => {
            const length = this._preparePathForDrawing(stroke);
            const delay = index * (duration + gap);
            if (typeof stroke.animate !== 'function') {
                const timer = window.setTimeout(() => {
                    stroke.style.strokeDashoffset = '0';
                    orderItems.forEach((item) => item.classList.remove('active'));
                    orderItems[index]?.classList.add('active');
                }, delay);
                ctx.state.writingTimers.push(timer);
                return;
            }
            const animation = stroke.animate(
                [{ strokeDashoffset: length }, { strokeDashoffset: 0 }],
                {
                    duration,
                    delay,
                    fill: 'forwards',
                    easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)'
                }
            );
            ctx.state.writingAnimations.push(animation);

            const timer = window.setTimeout(() => {
                orderItems.forEach((item) => item.classList.remove('active'));
                orderItems[index]?.classList.add('active');
            }, delay + duration * 0.7);
            ctx.state.writingTimers.push(timer);
        });
    },

    _playHeptapodWriting(ctx, speed) {
        const arcs = Array.from(ctx.panelEl.querySelectorAll('#heptapodWriting .heptapod-arc'));
        const pulses = Array.from(ctx.panelEl.querySelectorAll('#heptapodWriting .heptapod-pulse'));
        const core = ctx.panelEl.querySelector('#heptapodWriting .heptapod-core');
        const duration = 900 / speed;

        arcs.forEach((arc, index) => {
            const length = this._preparePathForDrawing(arc);
            if (typeof arc.animate !== 'function') {
                const timer = window.setTimeout(() => {
                    arc.style.strokeDashoffset = '0';
                    arc.style.opacity = '1';
                }, index * (70 / speed));
                ctx.state.writingTimers.push(timer);
                return;
            }
            const animation = arc.animate(
                [{ strokeDashoffset: length, opacity: 0.25 }, { strokeDashoffset: 0, opacity: 1 }],
                {
                    duration,
                    delay: index * (70 / speed),
                    fill: 'forwards',
                    easing: 'cubic-bezier(0.15, 0.8, 0.2, 1)'
                }
            );
            ctx.state.writingAnimations.push(animation);
        });

        pulses.forEach((pulse, index) => {
            pulse.style.opacity = '0.2';
            if (typeof pulse.animate !== 'function') return;
            const animation = pulse.animate(
                [
                    { opacity: 0.15, transform: 'scale(0.86)' },
                    { opacity: 0.8, transform: 'scale(1.1)' },
                    { opacity: 0.2, transform: 'scale(1)' }
                ],
                {
                    duration: 1200 / speed,
                    delay: index * (110 / speed),
                    fill: 'forwards',
                    easing: 'ease-out'
                }
            );
            ctx.state.writingAnimations.push(animation);
        });

        if (core) {
            if (typeof core.animate !== 'function') return;
            const animation = core.animate(
                [
                    { opacity: 0.65, transform: 'scale(1)' },
                    { opacity: 1, transform: 'scale(1.25)' },
                    { opacity: 0.7, transform: 'scale(1)' }
                ],
                {
                    duration: 1000 / speed,
                    fill: 'forwards',
                    easing: 'ease-in-out'
                }
            );
            ctx.state.writingAnimations.push(animation);
        }
    },

    _preparePathForDrawing(pathEl) {
        if (!pathEl || typeof pathEl.getTotalLength !== 'function') return 0;
        const length = pathEl.getTotalLength();
        pathEl.style.strokeDasharray = String(length);
        pathEl.style.strokeDashoffset = String(length);
        return length;
    },

    _setWritingStatus(ctx, mode) {
        const desc = ctx.panelEl.querySelector('#writingDescription');
        if (!desc) return;
        if (mode === 'human') {
            desc.textContent = '人类模式：按顺序完成四笔，前一笔结束后才进入下一笔。';
            return;
        }
        if (mode === 'heptapod') {
            desc.textContent = '七肢桶模式：多段弧线同步生成，表达在同一时刻整体成形。';
            return;
        }
        desc.textContent = '对比模式：左侧顺序推进，右侧同步展开，直观看到两种时间观差异。';
    },

    _clearWritingTimeline(ctx) {
        const timers = Array.isArray(ctx.state?.writingTimers) ? ctx.state.writingTimers : [];
        timers.forEach((timer) => window.clearTimeout(timer));
        ctx.state.writingTimers = [];

        const animations = Array.isArray(ctx.state?.writingAnimations) ? ctx.state.writingAnimations : [];
        animations.forEach((animation) => {
            try {
                animation.cancel();
            } catch {
                // Ignore cancelled/ended animation instances.
            }
        });
        ctx.state.writingAnimations = [];
    },

    _resetWritingScene(ctx, options = {}) {
        this._clearWritingTimeline(ctx);

        const humanStrokes = Array.from(ctx.panelEl.querySelectorAll('#humanWriting .human-stroke'));
        const orderItems = Array.from(ctx.panelEl.querySelectorAll('#humanStrokeOrder li'));
        const heptapodArcs = Array.from(ctx.panelEl.querySelectorAll('#heptapodWriting .heptapod-arc'));
        const heptapodPulses = Array.from(ctx.panelEl.querySelectorAll('#heptapodWriting .heptapod-pulse'));
        const heptapodCore = ctx.panelEl.querySelector('#heptapodWriting .heptapod-core');

        humanStrokes.forEach((stroke) => {
            const length = this._preparePathForDrawing(stroke);
            stroke.style.strokeDashoffset = String(length);
            stroke.style.opacity = '1';
        });

        orderItems.forEach((item) => item.classList.remove('active'));

        heptapodArcs.forEach((arc) => {
            const length = this._preparePathForDrawing(arc);
            arc.style.strokeDashoffset = String(length);
            arc.style.opacity = '0.25';
        });

        heptapodPulses.forEach((pulse) => {
            pulse.style.opacity = '0.2';
            pulse.style.transform = 'scale(1)';
        });
        if (heptapodCore) {
            heptapodCore.style.opacity = '0.72';
            heptapodCore.style.transform = 'scale(1)';
        }

        if (options.keepStatus !== true) {
            const desc = ctx.panelEl.querySelector('#writingDescription');
            if (desc) {
                desc.textContent = '点击“对比播放”，同时观察线性顺序与环状同步两种书写逻辑。';
            }
        }
    },

    _openLogogram(ctx, item) {
        // Use inline styles to force a "dark terminal card" look within the modal
        const html = `
            <div style="font-family:var(--font-mono); color:#e2e8f0; background:#0f172a; padding:20px; border-radius:8px; border:1px solid #0891b2;">
                <h3 style="color:#0891b2; margin-bottom:16px; font-family:var(--font-tech); text-transform:uppercase; border-bottom:1px solid rgba(8,145,178,0.3); padding-bottom:8px;">
                    // LOGOGRAM: ${escapeHtml(item.meaning)}
                </h3>
                <div style="background:rgba(255,255,255,0.05); padding:24px; border-radius:4px; text-align:center; margin-bottom:20px;">
                    <img src="${escapeHtml(ctx.resolvePath(item.image))}" style="max-width:180px; filter:drop-shadow(0 0 10px rgba(8,145,178,0.4));">
                </div>
                <p style="border-left:2px solid #f97316; padding-left:12px; line-height:1.6; color:#94a3b8;">
                    ${escapeHtml(item.description || '暂无数据')}
                </p>
            </div>
        `;
        openStoryModal({ html });
    },

    _openComparison(item) {
        const html = `
            <div style="font-family:var(--font-mono); color:#e2e8f0; background:#0f172a; padding:20px; border-radius:8px; border:1px solid #0891b2;">
                <h3 style="color:#0891b2; margin-bottom:20px; font-family:var(--font-tech); border-bottom:1px solid rgba(8,145,178,0.3); padding-bottom:8px;">
                    // ANALYSIS: ${escapeHtml(item.title)}
                </h3>
                <div style="display:grid; gap:16px;">
                    <div style="border:1px solid #334155; padding:12px; border-radius:4px;">
                        <strong style="color:#94a3b8; font-size:0.8rem; display:block; margin-bottom:6px;">人类视角 (HUMAN)</strong>
                        <p style="margin:0; color:#e2e8f0;">${escapeHtml(item.human?.content)}</p>
                    </div>
                    <div style="border:1px solid #0891b2; padding:12px; border-radius:4px; background:rgba(8,145,178,0.1);">
                        <strong style="color:#0891b2; font-size:0.8rem; display:block; margin-bottom:6px;">七肢桶视角 (HEPTAPOD)</strong>
                        <p style="margin:0; color:#e2e8f0;">${escapeHtml(item.heptapod?.content)}</p>
                    </div>
                </div>
            </div>
        `;
        openStoryModal({ html });
    }
};
