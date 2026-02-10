import { escapeHtml } from "../core/dom.js";

function normalize(raw) {
  const lessonPlans = raw && Array.isArray(raw.lessonPlans) ? raw.lessonPlans : [];
  const essayTopics = raw && Array.isArray(raw.essayTopics) ? raw.essayTopics : [];
  const furtherReading = raw && Array.isArray(raw.furtherReading) ? raw.furtherReading : [];
  return { lessonPlans, essayTopics, furtherReading };
}

function renderLessonPlans(plans) {
  if (!plans.length) return `<div class="rg-skeleton">暂无教案</div>`;
  return `
    <div class="rg-resources">
      ${plans
        .map((p) => {
          const title = escapeHtml(String(p?.title || "课堂教案"));
          const duration = escapeHtml(String(p?.duration || ""));
          const objective = escapeHtml(String(p?.objective || ""));
          const activities = Array.isArray(p?.activities) ? p.activities : [];
          return `
            <details class="rg-resource">
              <summary class="rg-resource__summary">
                <div class="rg-resource__sumtop">
                  <span class="rg-resource__title">${title}</span>
                  ${duration ? `<span class="rg-badge">${duration}</span>` : ""}
                </div>
                ${objective ? `<div class="rg-resource__meta">目标：${objective}</div>` : ""}
              </summary>
              <div class="rg-resource__body">
                ${activities.length ? `<ol class="rg-resource__list">${activities.map((a) => `<li>${escapeHtml(String(a))}</li>`).join("")}</ol>` : `<div class="rg-muted">暂无活动步骤</div>`}
              </div>
            </details>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderEssayTopics(topics) {
  if (!topics.length) return `<div class="rg-skeleton">暂无选题</div>`;
  return `
    <div class="rg-topicgrid">
      ${topics
        .map((t) => {
          const title = escapeHtml(String(t?.title || "选题"));
          const desc = escapeHtml(String(t?.description || ""));
          const diff = escapeHtml(String(t?.difficulty || ""));
          return `
            <article class="rg-topiccard">
              <div class="rg-topiccard__top">
                <h4 class="rg-topiccard__title">${title}</h4>
                ${diff ? `<span class="rg-topiccard__diff" title="难度">${diff}</span>` : ""}
              </div>
              ${desc ? `<p class="rg-topiccard__desc">${desc}</p>` : ""}
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderFurtherReading(items) {
  if (!items.length) return `<div class="rg-skeleton">暂无延伸阅读</div>`;
  return `
    <div class="rg-readinggrid">
      ${items
        .map((b) => {
          const title = escapeHtml(String(b?.title || "书目"));
          const author = escapeHtml(String(b?.author || ""));
          const year = escapeHtml(String(b?.year || ""));
          const desc = escapeHtml(String(b?.desc || ""));
          const link = String(b?.link || "").trim();
          const safeLink = /^https?:\\/\\//.test(link) ? link : "";
          return `
            <article class="rg-readingcard">
              <div class="rg-readingcard__top">
                <h4 class="rg-readingcard__title">${title}</h4>
                <div class="rg-readingcard__meta">${author}${year ? ` · ${year}` : ""}</div>
              </div>
              ${desc ? `<p class="rg-readingcard__desc">${desc}</p>` : ""}
              ${safeLink ? `<a class="rg-readingcard__link" href="${escapeHtml(safeLink)}" target="_blank" rel="noreferrer noopener">打开链接</a>` : ""}
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

export default {
  async init(ctx) {
    ctx.state = {
      data: null,
    };
  },

  async render(ctx) {
    if (!ctx.state.data) {
      const raw = await ctx.fetchJSON(ctx.module.data || "teaching.json");
      ctx.state.data = normalize(raw);
    }

    ctx.panelEl.innerHTML = `
      <div class="rg-modulehead">
        <h2>${escapeHtml(String(ctx.module?.title || "教学"))}</h2>
        <p>面向课堂与读书会的教学资源：教案、研讨选题与延伸阅读。</p>
      </div>

      <div class="rg-teaching">
        <section class="rg-sec">
          <div class="rg-sec__head">
            <h3>课堂教案</h3>
            <p>建议投屏展示，可配合“象征/讨论”模块穿插使用。</p>
          </div>
          ${renderLessonPlans(ctx.state.data.lessonPlans)}
        </section>

        <section class="rg-sec">
          <div class="rg-sec__head">
            <h3>论文选题</h3>
            <p>用于课后写作、研讨汇报或读书会主题分工。</p>
          </div>
          ${renderEssayTopics(ctx.state.data.essayTopics)}
        </section>

        <section class="rg-sec">
          <div class="rg-sec__head">
            <h3>延伸阅读</h3>
            <p>从互文、主题与政治寓言方向拓展视野。</p>
          </div>
          ${renderFurtherReading(ctx.state.data.furtherReading)}
        </section>
      </div>
    `;
  },
};

