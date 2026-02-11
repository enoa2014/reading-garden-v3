export function createProjectManager(deps = {}) {
  const {
    fs,
    getState,
    setState,
    setStatus,
    setNavEnabled,
    render,
    validateBooksData,
    validateProjectStructure,
    validateErrorList,
    validateRegistryData,
    normalizePath,
    buildPreviewStatePatch,
    buildDefaultAiSettings,
    applyRecoveryHistoryPolicyForProject,
    applyPreviewAutoRefreshPreferenceForProject,
    loadAiSettingsFlow,
    restoreRecoverySnapshotForProject,
  } = deps;

  function resolveFromBookDir(bookId, relativePath) {
    return normalizePath(`data/${bookId}/${String(relativePath || "")}`);
  }

  async function inspectBookHealth(book) {
    const id = String(book?.id || "").trim();
    const registryPath = `data/${id}/registry.json`;
    const registryExists = await fs.exists(registryPath);
    const moduleIssues = [];

    if (registryExists) {
      try {
        const registry = await fs.readJson(registryPath);
        const registryCheck = validateRegistryData(registry);
        moduleIssues.push(...registryCheck.errors);
        const modules = Array.isArray(registry?.modules) ? registry.modules : [];

        for (const mod of modules) {
          const modId = String(mod?.id || "(unknown)");
          const entryRaw = String(mod?.entry || "").trim();
          const dataRaw = String(mod?.data || "").trim();

          if (!entryRaw || !dataRaw) {
            continue;
          }

          const entryPath = resolveFromBookDir(id, entryRaw);
          const dataPath = resolveFromBookDir(id, dataRaw);

          // eslint-disable-next-line no-await-in-loop
          const entryExists = await fs.exists(entryPath);
          // eslint-disable-next-line no-await-in-loop
          const dataExists = await fs.exists(dataPath);

          if (!entryExists) moduleIssues.push(`模块 ${modId} 缺失 entry: ${entryPath}`);
          if (!dataExists) moduleIssues.push(`模块 ${modId} 缺失 data: ${dataPath}`);
        }
      } catch (err) {
        moduleIssues.push(`registry 解析失败：${err?.message || String(err)}`);
      }
    }

    return {
      id,
      registryPath,
      registryExists,
      moduleIssues,
    };
  }

  async function collectBookHealth(books) {
    const health = [];
    for (const book of books) {
      const id = String(book?.id || "").trim();
      if (!id) continue;
      // eslint-disable-next-line no-await-in-loop
      health.push(await inspectBookHealth(book));
    }
    return health;
  }

  async function loadBooksAndHealth() {
    try {
      const booksData = await fs.readJson("data/books.json");
      const check = validateBooksData(booksData);
      const books = Array.isArray(booksData?.books) ? booksData.books : [];
      const health = await collectBookHealth(books);

      health.forEach((item) => {
        if (!item.registryExists) {
          check.errors.push(`书籍 ${item.id} 缺失 ${item.registryPath}`);
        }
        item.moduleIssues.forEach((msg) => {
          check.errors.push(`书籍 ${item.id} -> ${msg}`);
        });
      });

      return {
        books,
        bookHealth: health,
        errors: check.errors,
      };
    } catch (err) {
      return {
        books: [],
        bookHealth: [],
        errors: [`读取 books.json 失败：${err.message || String(err)}`],
      };
    }
  }

  async function refreshProjectData() {
    const booksResult = await loadBooksAndHealth();
    const state = getState();
    const previewPatch = buildPreviewStatePatch(state, booksResult.books);
    setState({
      books: booksResult.books,
      bookHealth: booksResult.bookHealth,
      errors: validateErrorList(booksResult.errors),
      ...previewPatch,
    });
  }

  async function openProjectFlow() {
    setStatus("Opening project...");
    setState({
      busy: true,
      newBookFeedback: null,
      packFeedback: null,
      packDiagnostic: null,
      packManualPlan: null,
      validationFeedback: null,
      aiFeedback: null,
      recoveryFeedback: null,
      recoveryHistory: [],
      analysisFeedback: null,
      analysisSuggestion: null,
    });

    try {
      const handle = await fs.openProject();
      const projectName = String(handle?.name || "").trim();
      const recoveryPolicy = applyRecoveryHistoryPolicyForProject(projectName);
      const previewAutoRefreshPolicy = applyPreviewAutoRefreshPreferenceForProject(projectName);
      setState({
        projectHandle: handle,
        projectName: handle?.name || "",
        recoveryHistoryMaxAgeDays: recoveryPolicy.maxAgeDays,
        recoveryHistoryPolicyScope: recoveryPolicy.scope,
        previewAutoRefresh: previewAutoRefreshPolicy.enabled,
        previewAutoRefreshPolicyScope: previewAutoRefreshPolicy.scope,
      });

      setStatus("Verifying project structure...");
      const structure = await fs.verifyStructure();
      const structureCheck = validateProjectStructure(structure);
      setState({ structure });

      const allErrors = [...structureCheck.errors];

      if (structureCheck.valid) {
        setStatus("Loading bookshelf...");
        const booksResult = await loadBooksAndHealth();
        const previewPatch = buildPreviewStatePatch(getState(), booksResult.books);
        allErrors.push(...booksResult.errors);
        setState({
          books: booksResult.books,
          bookHealth: booksResult.bookHealth,
          ...previewPatch,
        });
        await loadAiSettingsFlow();
        await restoreRecoverySnapshotForProject(booksResult.books);
      } else {
        setState({
          books: [],
          bookHealth: [],
          validationFeedback: null,
          aiSettings: buildDefaultAiSettings(),
          recoveryFeedback: null,
          recoveryHistory: [],
          previewBookId: "",
          previewDevice: "desktop",
          previewRefreshToken: 0,
          previewUrl: "",
        });
      }

      setState({
        errors: validateErrorList(allErrors),
      });

      setNavEnabled(structureCheck.valid);
      setStatus(structureCheck.valid ? "Project loaded" : "Project loaded with issues");
    } catch (err) {
      const recoveryPolicy = applyRecoveryHistoryPolicyForProject("");
      const previewAutoRefreshPolicy = applyPreviewAutoRefreshPreferenceForProject("");
      const msg = err?.message === "BROWSER_UNSUPPORTED"
        ? "当前浏览器不支持 File System Access API"
        : `打开项目失败：${err?.message || String(err)}`;

      setState({
        projectHandle: null,
        projectName: "",
        structure: { ok: false, missing: [] },
        books: [],
        bookHealth: [],
        errors: [msg],
        validationFeedback: null,
        aiSettings: buildDefaultAiSettings(),
        aiFeedback: null,
        recoveryFeedback: null,
        recoveryHistory: [],
        recoveryHistoryMaxAgeDays: recoveryPolicy.maxAgeDays,
        recoveryHistoryPolicyScope: recoveryPolicy.scope,
        previewAutoRefresh: previewAutoRefreshPolicy.enabled,
        previewAutoRefreshPolicyScope: previewAutoRefreshPolicy.scope,
        analysisFeedback: null,
        analysisSuggestion: null,
        packManualPlan: null,
        previewBookId: "",
        previewDevice: "desktop",
        previewRefreshToken: 0,
        previewUrl: "",
      });

      setNavEnabled(false);
      setStatus("Open failed");
    }

    setState({ busy: false });
    render();
  }

  return {
    resolveFromBookDir,
    loadBooksAndHealth,
    refreshProjectData,
    openProjectFlow,
  };
}
