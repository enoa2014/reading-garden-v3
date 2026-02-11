export function createAiManager(deps = {}) {
  const {
    fs,
    getState,
    setState,
    setStatus,
    analyzeBookText,
    buildAnalysisSuggestionReport,
    buildDefaultAiSettings,
    sanitizeAiSettings,
    AI_SETTINGS_PATH,
    buildTimestampToken,
    downloadJsonFile,
    sanitizeBookId,
    MODULE_TEMPLATE_MAP,
    ensureSuggestedModuleDataFiles,
    createBookFlow,
    touchPreviewAfterWrite,
  } = deps;

  async function loadAiSettingsFlow() {
    const defaults = buildDefaultAiSettings();
    try {
      const exists = await fs.exists(AI_SETTINGS_PATH);
      if (!exists) {
        setState({
          aiSettings: defaults,
        });
        return;
      }
      const parsed = await fs.readJson(AI_SETTINGS_PATH);
      setState({
        aiSettings: sanitizeAiSettings(parsed),
      });
    } catch (err) {
      setState({
        aiSettings: defaults,
        aiFeedback: {
          type: "error",
          message: `读取 AI 配置失败，已回退默认值：${err?.message || String(err)}`,
        },
      });
    }
  }

  function buildAnalysisFilename(report = {}) {
    const safeBookId = String(report?.source?.bookId || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
    const suffix = safeBookId || "draft";
    return `analysis-suggestion-${suffix}-${buildTimestampToken()}.json`;
  }

  function buildValidationReportFilename(projectName = "") {
    const safeProject = String(projectName || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
    const suffix = safeProject || "project";
    return `validation-report-${suffix}-${buildTimestampToken()}.json`;
  }

  function buildValidationReport(state) {
    const safeState = state && typeof state === "object" ? state : {};
    return {
      type: "rg-validation-report",
      version: 1,
      generatedAt: new Date().toISOString(),
      project: {
        name: String(safeState.projectName || ""),
        mode: String(safeState.mode || ""),
      },
      structure: safeState.structure && typeof safeState.structure === "object"
        ? safeState.structure
        : { ok: false, missing: [] },
      summary: {
        errorCount: Array.isArray(safeState.errors) ? safeState.errors.length : 0,
        books: Array.isArray(safeState.books) ? safeState.books.length : 0,
        unhealthyBooks: Array.isArray(safeState.bookHealth)
          ? safeState.bookHealth.filter((item) => !item?.registryExists || (item?.moduleIssues || []).length).length
          : 0,
      },
      errors: Array.isArray(safeState.errors) ? safeState.errors : [],
      bookHealth: Array.isArray(safeState.bookHealth) ? safeState.bookHealth : [],
    };
  }

  function downloadValidationReportFlow() {
    const state = getState();
    const report = buildValidationReport(state);
    const filename = buildValidationReportFilename(state.projectName);
    downloadJsonFile(filename, report);
    setState({
      validationFeedback: {
        type: "ok",
        message: `校验报告已下载：${filename}`,
      },
    });
    setStatus("Validation report downloaded");
  }

  async function analyzeBookTextFlow(input = {}) {
    const file = input?.file || null;
    if (!file) {
      setState({
        analysisFeedback: {
          type: "error",
          message: "请选择要分析的原文文件（txt/md）。",
        },
      });
      return;
    }

    const state = getState();
    if (!state.projectHandle || !state.structure?.ok) {
      setState({
        analysisFeedback: {
          type: "error",
          message: "请先打开项目目录后再执行原文分析。",
        },
      });
      return;
    }

    setState({
      busy: true,
      analysisFeedback: null,
      packFeedback: null,
      newBookFeedback: null,
    });
    setStatus("Analyzing source text...");

    try {
      const text = await file.text();
      const result = await analyzeBookText({
        text,
        aiSettings: state.aiSettings || buildDefaultAiSettings(),
        title: String(input?.title || "").trim(),
        bookId: String(input?.bookId || "").trim(),
      });

      setState({
        analysisSuggestion: {
          sourceFileName: file.name,
          ...result,
        },
        analysisFeedback: {
          type: "ok",
          message: `分析完成：mode ${result.mode}，建议模块 ${Array.isArray(result.moduleSuggestions) ? result.moduleSuggestions.length : 0} 个。`,
        },
      });
      setStatus("Text analyzed");
    } catch (err) {
      setState({
        analysisFeedback: {
          type: "error",
          message: `原文分析失败：${err?.message || String(err)}`,
        },
      });
      setStatus("Analyze failed");
    }

    setState({ busy: false });
  }

  function downloadAnalysisSuggestionFlow() {
    const state = getState();
    const suggestion = state.analysisSuggestion;
    if (!suggestion) {
      setState({
        analysisFeedback: {
          type: "error",
          message: "当前没有可下载的分析结果，请先执行 Analyze Text。",
        },
      });
      return;
    }

    const report = buildAnalysisSuggestionReport({
      analysis: suggestion,
      source: {
        fileName: suggestion.sourceFileName || "",
        title: suggestion.titleCandidate || "",
        bookId: suggestion.bookIdSuggestion || "",
      },
      aiSettings: state.aiSettings || buildDefaultAiSettings(),
    });
    const filename = buildAnalysisFilename(report);
    downloadJsonFile(filename, report);
    setState({
      analysisFeedback: {
        type: "ok",
        message: `分析建议已下载：${filename}`,
      },
    });
  }

  function resolveTargetBookForSuggestion(inputBookId = "") {
    const state = getState();
    const explicit = String(inputBookId || "").trim();
    if (explicit) return explicit;
    return String(state.analysisSuggestion?.bookIdSuggestion || "").trim();
  }

  function normalizeAnalysisApplyMode(rawMode = "safe") {
    const mode = String(rawMode || "safe").trim().toLowerCase();
    return mode === "overwrite" ? "overwrite" : "safe";
  }

  function resolveSuggestionInclude(suggestion, moduleId) {
    const list = Array.isArray(suggestion?.moduleSuggestions) ? suggestion.moduleSuggestions : [];
    const found = list.find((item) => String(item?.id || "").trim() === moduleId);
    return Boolean(found?.include);
  }

  function resolveUniqueBookId(baseId, books = []) {
    const normalized = sanitizeBookId(baseId || "new-book") || "new-book";
    const used = new Set(
      (Array.isArray(books) ? books : [])
        .map((item) => String(item?.id || "").trim())
        .filter(Boolean)
    );
    if (!used.has(normalized)) return normalized;
    let idx = 1;
    while (used.has(`${normalized}-${idx}`)) idx += 1;
    return `${normalized}-${idx}`;
  }

  function buildAutoCreateBookInputFromSuggestion(state, suggestion) {
    const baseTitle = String(suggestion?.titleCandidate || "").trim() || "分析草稿书籍";
    const preferredId = String(suggestion?.bookIdSuggestion || "").trim() || baseTitle;
    const id = resolveUniqueBookId(preferredId, state?.books || []);
    return {
      id,
      title: baseTitle,
      author: "",
      description: "由文本分析助手自动生成的初始书籍草稿。",
      includeCharacters: resolveSuggestionInclude(suggestion, "characters"),
      includeThemes: resolveSuggestionInclude(suggestion, "themes"),
      includeTimeline: resolveSuggestionInclude(suggestion, "timeline"),
      includeInteractive: resolveSuggestionInclude(suggestion, "interactive"),
      templatePreset: "custom",
    };
  }

  function buildSuggestedRegistry(registry, suggestion) {
    const safeRegistry = registry && typeof registry === "object" ? registry : {};
    const currentModules = Array.isArray(safeRegistry.modules) ? safeRegistry.modules : [];
    const currentMap = new Map(
      currentModules
        .map((item) => [String(item?.id || "").trim(), item])
        .filter(([id]) => Boolean(id))
    );

    const outModules = currentModules.map((item) => ({ ...item }));
    let added = 0;
    const addedModuleIds = [];
    const skippedUnknown = [];
    const considered = Array.isArray(suggestion?.moduleSuggestions) ? suggestion.moduleSuggestions : [];
    considered.forEach((item) => {
      const id = String(item?.id || "").trim();
      if (!id || !item?.include || currentMap.has(id)) return;
      const template = MODULE_TEMPLATE_MAP[id];
      if (!template) {
        skippedUnknown.push(id);
        return;
      }
      outModules.push({ ...template });
      currentMap.set(id, template);
      added += 1;
      addedModuleIds.push(id);
    });

    return {
      registry: {
        ...safeRegistry,
        modules: outModules,
        suggestionMeta: {
          generatedAt: new Date().toISOString(),
          mode: String(suggestion?.mode || "heuristic"),
          addedModules: added,
        },
      },
      added,
      addedModuleIds,
      skippedUnknown,
    };
  }

  async function applyAnalysisSuggestionFlow({
    bookId = "",
    applyMode = "safe",
    confirmOverwrite = false,
  } = {}) {
    const state = getState();
    const suggestion = state.analysisSuggestion;
    if (!suggestion) {
      setState({
        analysisFeedback: {
          type: "error",
          message: "当前没有可应用的分析结果，请先执行 Analyze Text。",
        },
      });
      return;
    }

    let targetBookId = resolveTargetBookForSuggestion(bookId);
    let autoCreatedBookId = "";
    if (!targetBookId) {
      const draftInput = buildAutoCreateBookInputFromSuggestion(state, suggestion);
      await createBookFlow(draftInput);
      const latest = getState();
      const created = latest.books.some((book) => String(book?.id || "").trim() === draftInput.id);
      if (!created) {
        setState({
          analysisFeedback: {
            type: "error",
            message: `自动创建目标书籍失败：${draftInput.id}`,
          },
        });
        return;
      }
      targetBookId = draftInput.id;
      autoCreatedBookId = draftInput.id;
    } else {
      const bookExists = state.books.some((book) => String(book?.id || "").trim() === targetBookId);
      if (!bookExists) {
        setState({
          analysisFeedback: {
            type: "error",
            message: `未找到目标书籍：${targetBookId}`,
          },
        });
        return;
      }
    }

    const mode = normalizeAnalysisApplyMode(applyMode);
    if (mode === "overwrite" && !confirmOverwrite) {
      setState({
        analysisFeedback: {
          type: "error",
          message: "overwrite 模式需要先勾选确认项，再执行 Apply Suggestion。",
        },
      });
      return;
    }
    setState({ busy: true, analysisFeedback: null });
    setStatus(mode === "overwrite"
      ? "Applying analysis suggestion (overwrite)..."
      : "Applying analysis suggestion...");

    try {
      const registryPath = `data/${targetBookId}/registry.json`;
      const suggestedPath = `data/${targetBookId}/registry.suggested.json`;
      const registry = await fs.readJson(registryPath);
      const next = buildSuggestedRegistry(registry, suggestion);
      const skippedText = next.skippedUnknown.length
        ? `，未识别模块 ${next.skippedUnknown.join(", ")}`
        : "";
      const autoCreateText = autoCreatedBookId ? `（已自动创建书籍 ${autoCreatedBookId}）` : "";
      if (mode === "overwrite") {
        const writeResult = await fs.writeJson(registryPath, next.registry);
        const seedResult = await ensureSuggestedModuleDataFiles(targetBookId, next.addedModuleIds);
        touchPreviewAfterWrite(targetBookId);
        const backupText = writeResult?.backupPath ? `，备份：${writeResult.backupPath}` : "";
        const seedText = seedResult.created.length ? `，补齐数据模板 ${seedResult.created.length} 个` : "";
        setState({
          analysisFeedback: {
            type: "ok",
            message: `建议已覆盖写入：${registryPath}（新增 ${next.added}）${seedText}${skippedText}${backupText}${autoCreateText}`,
          },
        });
        setStatus("Suggestion applied (overwrite)");
      } else {
        await fs.writeJson(suggestedPath, next.registry);
        setState({
          analysisFeedback: {
            type: "ok",
            message: `建议已安全写入：${suggestedPath}（新增 ${next.added}）${skippedText}${autoCreateText}`,
          },
        });
        setStatus("Suggestion applied");
      }
    } catch (err) {
      setState({
        analysisFeedback: {
          type: "error",
          message: `应用建议失败：${err?.message || String(err)}`,
        },
      });
      setStatus("Apply suggestion failed");
    }

    setState({ busy: false });
  }

  async function saveAiSettingsFlow(rawSettings) {
    const state = getState();
    if (!state.projectHandle || !state.structure?.ok) return;

    const nextSettings = sanitizeAiSettings(rawSettings);
    setState({ busy: true, aiFeedback: null, newBookFeedback: null, packFeedback: null });
    setStatus("Saving AI settings...");

    try {
      await fs.writeJson(AI_SETTINGS_PATH, nextSettings);
      setState({
        aiSettings: nextSettings,
        aiFeedback: {
          type: "ok",
          message: `AI 配置已保存：${AI_SETTINGS_PATH}`,
        },
      });
      setStatus("AI settings saved");
    } catch (err) {
      setState({
        aiFeedback: {
          type: "error",
          message: `保存 AI 配置失败：${err?.message || String(err)}`,
        },
      });
      setStatus("AI settings save failed");
    }

    setState({ busy: false });
  }

  function exportAiSettingsFlow() {
    const settings = sanitizeAiSettings(getState().aiSettings || buildDefaultAiSettings());
    const payload = {
      format: "rg-ai-settings",
      version: 1,
      exportedAt: new Date().toISOString(),
      settings,
    };
    const filename = `ai-settings-${buildTimestampToken()}.json`;
    downloadJsonFile(filename, payload);
    setState({
      aiFeedback: {
        type: "ok",
        message: `AI 配置已导出：${filename}`,
      },
    });
  }

  async function importAiSettingsFlow(file) {
    if (!file) {
      setState({
        aiFeedback: {
          type: "error",
          message: "未选择 AI 配置文件。",
        },
      });
      return;
    }

    const state = getState();
    if (!state.projectHandle || !state.structure?.ok) {
      setState({
        aiFeedback: {
          type: "error",
          message: "请先打开项目后再导入 AI 配置。",
        },
      });
      return;
    }

    setState({ busy: true, aiFeedback: null });
    setStatus("Importing AI settings...");

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const settings = sanitizeAiSettings(parsed?.settings || parsed);
      await fs.writeJson(AI_SETTINGS_PATH, settings);
      setState({
        aiSettings: settings,
        aiFeedback: {
          type: "ok",
          message: `AI 配置已导入并保存：${AI_SETTINGS_PATH}`,
        },
      });
      setStatus("AI settings imported");
    } catch (err) {
      setState({
        aiFeedback: {
          type: "error",
          message: `导入 AI 配置失败：${err?.message || String(err)}`,
        },
      });
      setStatus("AI settings import failed");
    }

    setState({ busy: false });
  }

  return {
    loadAiSettingsFlow,
    downloadValidationReportFlow,
    analyzeBookTextFlow,
    downloadAnalysisSuggestionFlow,
    applyAnalysisSuggestionFlow,
    saveAiSettingsFlow,
    exportAiSettingsFlow,
    importAiSettingsFlow,
  };
}
