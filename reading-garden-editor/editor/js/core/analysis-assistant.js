function normalizeText(raw) {
  return String(raw || "").replace(/\r\n/g, "\n").trim();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function extractTitleCandidate(text) {
  const firstLine = String(text || "").split("\n").map((item) => item.trim()).find(Boolean) || "";
  if (!firstLine) return "";
  return firstLine.replace(/^#+\s*/, "").slice(0, 60);
}

function buildHeuristicKeywordMap() {
  return {
    characters: ["角色", "人物", "主角", "配角", "关系", "对话", "姓名", "他们", "她", "他"],
    themes: ["主题", "意义", "价值", "成长", "选择", "冲突", "命运", "象征", "反思", "道德"],
    timeline: ["时间", "年代", "当年", "后来", "最初", "最后", "事件", "历史", "序章", "终章"],
    interactive: ["问题", "思考", "讨论", "任务", "练习", "挑战", "互动", "如果", "假设"],
  };
}

function countKeywordHits(text, keywords = []) {
  const source = String(text || "");
  let hits = 0;
  keywords.forEach((item) => {
    if (!item) return;
    if (source.includes(item)) hits += 1;
  });
  return hits;
}

function buildHeuristicModuleSuggestions(text) {
  const normalized = normalizeText(text);
  const size = normalized.length;
  const map = buildHeuristicKeywordMap();
  const suggestions = [
    {
      id: "reading",
      include: true,
      confidence: 1,
      reason: "所有书籍都需要基础阅读模块。",
    },
  ];

  const charactersHits = countKeywordHits(normalized, map.characters);
  suggestions.push({
    id: "characters",
    include: charactersHits >= 2 || size > 3000,
    confidence: clamp(0.35 + charactersHits * 0.12, 0, 0.95),
    reason: charactersHits > 0
      ? `检测到人物相关关键词 ${charactersHits} 次。`
      : "文本较短或人物描述信号较弱。",
  });

  const themesHits = countKeywordHits(normalized, map.themes);
  suggestions.push({
    id: "themes",
    include: themesHits >= 2 || size > 2200,
    confidence: clamp(0.3 + themesHits * 0.15, 0, 0.95),
    reason: themesHits > 0
      ? `检测到主题/反思关键词 ${themesHits} 次。`
      : "主题关键词信号不足，建议人工确认。",
  });

  const timelineHits = countKeywordHits(normalized, map.timeline);
  suggestions.push({
    id: "timeline",
    include: timelineHits >= 2,
    confidence: clamp(0.25 + timelineHits * 0.18, 0, 0.95),
    reason: timelineHits > 0
      ? `检测到时间/事件关键词 ${timelineHits} 次。`
      : "时间线特征不明显。",
  });

  const interactiveHits = countKeywordHits(normalized, map.interactive);
  suggestions.push({
    id: "interactive",
    include: interactiveHits >= 1 || size > 1800,
    confidence: clamp(0.3 + interactiveHits * 0.2, 0, 0.9),
    reason: interactiveHits > 0
      ? `检测到互动/讨论关键词 ${interactiveHits} 次。`
      : "可选启用互动模块以增强教学参与度。",
  });

  return suggestions;
}

function resolveChatCompletionsUrl(baseUrl) {
  const raw = String(baseUrl || "").trim().replace(/\/+$/, "");
  if (!raw) return "";
  if (/\/chat\/completions$/i.test(raw)) return raw;
  return `${raw}/chat/completions`;
}

function stripFencedBlock(text) {
  const raw = String(text || "").trim();
  if (!raw.startsWith("```")) return raw;
  const lines = raw.split("\n");
  if (!lines.length) return raw;
  const body = lines.slice(1, lines[lines.length - 1]?.trim() === "```" ? -1 : undefined);
  return body.join("\n").trim();
}

function parseJsonObjectFromText(text) {
  const cleaned = stripFencedBlock(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("LLM 返回内容不是有效 JSON。");
  }
}

function normalizeLlmSuggestions(raw) {
  const root = raw && typeof raw === "object" ? raw : {};
  const list = Array.isArray(root.moduleSuggestions) ? root.moduleSuggestions : [];
  const out = [];
  const seen = new Set();
  list.forEach((item) => {
    const id = String(item?.id || "").trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push({
      id,
      include: Boolean(item?.include),
      confidence: clamp(Number(item?.confidence || 0), 0, 1),
      reason: String(item?.reason || "").trim() || "LLM 建议未提供原因。",
    });
  });
  return out;
}

async function requestLlmModuleSuggestions({ text, aiSettings, title = "", signal }) {
  const llm = aiSettings?.llm || {};
  const url = resolveChatCompletionsUrl(llm.baseUrl);
  const apiKey = String(llm.apiKey || "").trim();
  const model = String(llm.model || "").trim();

  if (!url || !apiKey || !model) {
    throw new Error("LLM 配置不完整（需要 baseUrl/apiKey/model）。");
  }

  const excerpt = normalizeText(text).slice(0, 12000);
  const prompt = [
    "你是 reading-garden 编辑器的内容分析助手。",
    "请根据输入文本返回严格 JSON，不要解释。",
    "JSON 结构：",
    "{",
    '  "moduleSuggestions": [{"id":"reading|characters|themes|timeline|interactive","include":true,"confidence":0.0,"reason":"..."}],',
    '  "notes": ["..."]',
    "}",
    "请至少包含 reading 模块建议。",
    "",
    `书名候选：${title || "(unknown)"}`,
    "文本片段：",
    excerpt,
  ].join("\n");

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  const payload = {
    model,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "你是一个严格返回 JSON 的中文助手。" },
      { role: "user", content: prompt },
    ],
  };

  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal,
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`LLM 请求失败：HTTP ${resp.status} ${body.slice(0, 200)}`);
  }
  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("LLM 返回缺少 choices[0].message.content。");
  }
  const parsed = parseJsonObjectFromText(content);
  const moduleSuggestions = normalizeLlmSuggestions(parsed);
  const notes = Array.isArray(parsed?.notes) ? parsed.notes.map((item) => String(item || "").trim()).filter(Boolean) : [];
  return {
    moduleSuggestions,
    notes,
  };
}

function buildHeuristicSuggestionResult({ text, title = "", bookId = "" }) {
  const normalized = normalizeText(text);
  const moduleSuggestions = buildHeuristicModuleSuggestions(normalized);
  return {
    mode: "heuristic",
    titleCandidate: title || extractTitleCandidate(normalized),
    bookIdSuggestion: String(bookId || "").trim(),
    textLength: normalized.length,
    moduleSuggestions,
    notes: [
      "未启用或未配置 LLM，已使用本地启发式分析。",
      "建议先人工确认模块后再写入 registry。",
    ],
  };
}

function normalizeSuggestionsWithReading(suggestions = []) {
  const out = [];
  const seen = new Set();
  suggestions.forEach((item) => {
    const id = String(item?.id || "").trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push({
      id,
      include: Boolean(item?.include),
      confidence: clamp(Number(item?.confidence || 0), 0, 1),
      reason: String(item?.reason || "").trim() || "未提供原因。",
    });
  });
  if (!seen.has("reading")) {
    out.unshift({
      id: "reading",
      include: true,
      confidence: 1,
      reason: "基础阅读模块为必选。",
    });
  }
  return out;
}

export async function analyzeBookText({
  text,
  aiSettings,
  title = "",
  bookId = "",
  timeoutMs = 25000,
} = {}) {
  const normalized = normalizeText(text);
  if (!normalized) {
    throw new Error("原文内容为空，无法分析。");
  }

  const safeSettings = aiSettings && typeof aiSettings === "object" ? aiSettings : {};
  const analysisMode = String(safeSettings?.analysis?.mode || "manual");
  const llmEnabled = Boolean(safeSettings?.llm?.enabled);
  if (analysisMode === "auto-suggest" && llmEnabled) {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const llmResult = await requestLlmModuleSuggestions({
        text: normalized,
        aiSettings: safeSettings,
        title: title || extractTitleCandidate(normalized),
        signal: controller?.signal,
      });
      return {
        mode: "llm",
        titleCandidate: title || extractTitleCandidate(normalized),
        bookIdSuggestion: String(bookId || "").trim(),
        textLength: normalized.length,
        moduleSuggestions: normalizeSuggestionsWithReading(llmResult.moduleSuggestions),
        notes: llmResult.notes,
      };
    } catch (err) {
      return {
        ...buildHeuristicSuggestionResult({ text: normalized, title, bookId }),
        mode: "llm-fallback",
        notes: [
          `LLM 调用失败，已回退本地分析：${err?.message || String(err)}`,
          "可检查 AI 配置或网络后重试。",
        ],
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  return buildHeuristicSuggestionResult({ text: normalized, title, bookId });
}

export function buildAnalysisSuggestionReport({
  analysis,
  source = {},
  aiSettings = {},
} = {}) {
  const safe = analysis && typeof analysis === "object" ? analysis : {};
  return {
    format: "rg-analysis-suggestion",
    version: 1,
    generatedAt: new Date().toISOString(),
    source: {
      fileName: String(source.fileName || ""),
      title: String(source.title || safe.titleCandidate || ""),
      bookId: String(source.bookId || safe.bookIdSuggestion || ""),
      textLength: Number(safe.textLength || 0),
      mode: String(safe.mode || "heuristic"),
    },
    moduleSuggestions: Array.isArray(safe.moduleSuggestions) ? safe.moduleSuggestions : [],
    notes: Array.isArray(safe.notes) ? safe.notes : [],
    ai: {
      analysisMode: String(aiSettings?.analysis?.mode || "manual"),
      llmEnabled: Boolean(aiSettings?.llm?.enabled),
      imageMode: String(aiSettings?.image?.mode || "disabled"),
    },
  };
}

