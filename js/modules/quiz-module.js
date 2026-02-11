function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
}

const ratingConfig = {
    excellent: { icon: '🎉', text: '太棒了！' },
    good: { icon: '👍', text: '不错的选择' },
    neutral: { icon: '🤔', text: '可以考虑更好的方式' },
    poor: { icon: '💭', text: '让我们换个角度思考' }
};

function renderFeedback(option, reference) {
    const config = ratingConfig[option?.rating] || ratingConfig.neutral;
    return `
      <div class="feedback-header">
        <span class="feedback-icon">${config.icon}</span>
        <span class="feedback-rating ${escapeHtml(option?.rating || 'neutral')}">${config.text}</span>
      </div>
      <p class="feedback-content">${escapeHtml(option?.feedback || '')}</p>
      ${reference ? `
        <div class="feedback-reference">
          <div class="reference-title">📖 书中参考</div>
          <p class="reference-content">${escapeHtml(reference.content || '')}</p>
        </div>
      ` : ''}
    `;
}

function renderScenario(ctx) {
    const container = ctx.panelEl.querySelector('#runtime-quiz-container');
    if (!container) return;

    const scenarios = ctx.state.scenarios || [];
    const current = ctx.state.currentIndex || 0;
    const scenario = scenarios[current];
    if (!scenario) {
        container.innerHTML = '<p class="loading">暂无情境数据</p>';
        return;
    }

    const scenarioId = scenario.id || `scenario-${current}`;
    const options = Array.isArray(scenario.options) ? scenario.options : [];
    const letters = ['A', 'B', 'C', 'D'];
    const selectedId = ctx.state.answers[scenarioId] || null;
    const selectedOption = options.find(opt => opt?.id === selectedId) || null;

    container.innerHTML = `
      <article class="scenario-card" data-id="${escapeHtml(scenarioId)}">
        <header class="scenario-header">
          <div class="scenario-number">情境 ${current + 1} / ${scenarios.length}</div>
          <h3 class="scenario-title">${escapeHtml(scenario.title || '')}</h3>
          <p class="scenario-description">${escapeHtml(scenario.description || '')}</p>
        </header>

        <img
          src="${ctx.resolvePath(`../assets/images/totto-chan/${scenario.image || ''}`)}"
          alt="${escapeHtml(scenario.title || '')}"
          class="scenario-image"
          loading="lazy"
          onerror="this.style.display='none'"
        >

        <div class="options-container">
          <div class="options-title">您会怎么做？</div>
          ${options.length > 0
            ? options.map((opt, i) => {
            const selected = selectedId === opt.id;
            const disabled = selectedId ? 'disabled' : '';
            const selectedClass = selected ? `selected ${escapeHtml(opt.rating || '')}` : '';
            return `
              <button class="option-btn ${selectedClass}" data-option-id="${escapeHtml(opt.id)}" ${disabled}>
                <span class="option-letter">${letters[i] || '?'}</span>
                <span class="option-text">${escapeHtml(opt.text || '')}</span>
              </button>
            `;
        }).join('')
            : '<p class="question-text">暂无可选项</p>'}
        </div>

        <div class="feedback-panel ${selectedId ? 'active' : ''}" id="runtime-feedback-panel">
          ${selectedId && selectedOption
            ? renderFeedback(
                selectedOption,
                scenario.reference
            )
            : ''}
        </div>

        <nav class="quiz-nav">
          <button class="btn-nav" id="runtime-quiz-prev" ${current === 0 ? 'disabled' : ''}>◄ 上一个</button>
          <span class="quiz-progress">${current + 1} / ${scenarios.length}</span>
          <button class="btn-nav" id="runtime-quiz-next" ${current === scenarios.length - 1 ? 'disabled' : ''}>下一个 ►</button>
        </nav>
      </article>
    `;

    container.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const optionId = btn.getAttribute('data-option-id');
            if (!optionId) return;
            ctx.state.answers[scenarioId] = optionId;
            renderScenario(ctx);
            container.querySelector('#runtime-feedback-panel')?.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest'
            });
        });
    });

    container.querySelector('#runtime-quiz-prev')?.addEventListener('click', () => {
        if (ctx.state.currentIndex > 0) {
            ctx.state.currentIndex -= 1;
            renderScenario(ctx);
        }
    });

    container.querySelector('#runtime-quiz-next')?.addEventListener('click', () => {
        if (ctx.state.currentIndex < scenarios.length - 1) {
            ctx.state.currentIndex += 1;
            renderScenario(ctx);
        }
    });
}

export default {
    async init(ctx) {
        ctx.state = {
            scenarios: [],
            currentIndex: 0,
            answers: {}
        };
    },

    async render(ctx) {
        if (!ctx.state.scenarios.length) {
            const dataPath = ctx.module.data || 'scenarios.json';
            const data = await ctx.fetchJSON(dataPath);
            ctx.state.scenarios = Array.isArray(data.scenarios) ? data.scenarios : [];
        }

        ctx.panelEl.innerHTML = `
          <div class="panel-header">
            <h2>🎯 情境选择</h2>
            <p class="panel-desc">如果是你，会怎么做？</p>
          </div>
          <div class="quiz-container" id="runtime-quiz-container"></div>
        `;

        renderScenario(ctx);
    }
};
