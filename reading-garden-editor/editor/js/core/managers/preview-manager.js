export function createPreviewManager(deps = {}) {
  const {
    getState,
    setState,
    setStatus,
    writePreviewAutoRefreshPreference,
    clearProjectPreviewAutoRefreshPreferenceInStorage,
    applyPreviewAutoRefreshPreferenceForProject,
    readPreviewAutoRefreshPolicyPayloadFromStorage,
    normalizePolicyImportOptions,
    normalizePreviewAutoRefreshPolicyPayload,
    mergePreviewAutoRefreshPolicyPayload,
    writePreviewAutoRefreshPolicyPayloadToStorage,
    buildTimestampToken,
    downloadJsonFile,
  } = deps;

  function normalizePreviewDevice(rawDevice = "desktop") {
    const device = String(rawDevice || "").trim().toLowerCase();
    if (["desktop", "tablet", "mobile"].includes(device)) return device;
    return "desktop";
  }

  function resolveSiteBasePath() {
    const pathname = String(window.location.pathname || "/");
    const marker = "/reading-garden-editor/";
    const markerIndex = pathname.indexOf(marker);
    if (markerIndex >= 0) {
      return pathname.slice(0, markerIndex + 1);
    }
    const slashIndex = pathname.lastIndexOf("/");
    if (slashIndex >= 0) return pathname.slice(0, slashIndex + 1);
    return "/";
  }

  function buildPreviewUrl(bookId, refreshToken = 0) {
    const safeBookId = String(bookId || "").trim();
    if (!safeBookId) return "";
    const basePath = resolveSiteBasePath();
    const params = new URLSearchParams();
    params.set("book", safeBookId);
    if (Number.isFinite(refreshToken) && refreshToken > 0) {
      params.set("rg_preview_ts", String(Math.trunc(refreshToken)));
    }
    return `${basePath}book.html?${params.toString()}`;
  }

  function resolvePreviewBookId(books, preferredBookId = "") {
    const list = Array.isArray(books) ? books : [];
    const preferred = String(preferredBookId || "").trim();
    if (!list.length) return "";
    if (preferred && list.some((book) => String(book?.id || "").trim() === preferred)) {
      return preferred;
    }
    return String(list[0]?.id || "").trim();
  }

  function buildPreviewStatePatch(state, books, overrides = {}) {
    const currentState = state && typeof state === "object" ? state : {};
    const refreshRaw = Object.prototype.hasOwnProperty.call(overrides, "previewRefreshToken")
      ? overrides.previewRefreshToken
      : currentState.previewRefreshToken;
    const refreshToken = Number.isFinite(Number(refreshRaw))
      ? Math.max(0, Math.trunc(Number(refreshRaw)))
      : 0;
    const previewDeviceRaw = Object.prototype.hasOwnProperty.call(overrides, "previewDevice")
      ? overrides.previewDevice
      : currentState.previewDevice;
    const previewBookRaw = Object.prototype.hasOwnProperty.call(overrides, "previewBookId")
      ? overrides.previewBookId
      : currentState.previewBookId;
    const previewDevice = normalizePreviewDevice(previewDeviceRaw);
    const previewBookId = resolvePreviewBookId(books, previewBookRaw);
    return {
      previewBookId,
      previewDevice,
      previewRefreshToken: refreshToken,
      previewUrl: buildPreviewUrl(previewBookId, refreshToken),
    };
  }

  function updateRecoveryPolicyImportOptionsFlow({ includeDefaultOnMerge = false } = {}) {
    setState({
      recoveryPolicyImportIncludeDefaultOnMerge: includeDefaultOnMerge === true,
    });
  }

  function updatePreviewStateFlow({ bookId = "", device = "", autoRefresh } = {}) {
    const state = getState();
    const patch = buildPreviewStatePatch(state, state.books, {
      previewBookId: String(bookId || "").trim(),
      previewDevice: String(device || state.previewDevice || "desktop"),
    });
    if (typeof autoRefresh === "boolean") {
      const previewAutoRefreshPolicy = writePreviewAutoRefreshPreference(
        autoRefresh,
        String(state.projectName || "").trim()
      );
      patch.previewAutoRefresh = previewAutoRefreshPolicy.enabled;
      patch.previewAutoRefreshPolicyScope = previewAutoRefreshPolicy.scope;
    }
    setState(patch);
  }

  function resetPreviewAutoRefreshPreferenceFlow() {
    const state = getState();
    const projectName = String(state.projectName || "").trim();
    if (!projectName) {
      setState({
        recoveryFeedback: {
          type: "error",
          message: "当前未打开项目，无法恢复预览自动刷新全局默认。",
        },
      });
      return;
    }
    const cleared = clearProjectPreviewAutoRefreshPreferenceInStorage(projectName);
    const previewPolicy = applyPreviewAutoRefreshPreferenceForProject(projectName, cleared.policyPayload);
    setState({
      previewAutoRefresh: previewPolicy.enabled,
      previewAutoRefreshPolicyScope: previewPolicy.scope,
      recoveryFeedback: {
        type: "ok",
        message: cleared.existed
          ? `已恢复预览自动刷新全局默认：${projectName}`
          : `当前项目未设置预览自动刷新覆盖，保持全局默认（${previewPolicy.enabled ? "on" : "off"}）。`,
      },
    });
    setStatus("Preview auto-refresh policy reset");
  }

  function exportPreviewAutoRefreshPolicyFlow() {
    const payload = readPreviewAutoRefreshPolicyPayloadFromStorage();
    const filename = `preview-auto-refresh-policy-${buildTimestampToken()}.json`;
    downloadJsonFile(filename, {
      format: "rg-preview-auto-refresh-policy",
      version: 1,
      exportedAt: new Date().toISOString(),
      policy: payload,
    });
    setState({
      recoveryFeedback: {
        type: "ok",
        message: `预览自动刷新策略已导出：${filename}`,
      },
    });
    setStatus("Preview auto-refresh policy exported");
  }

  async function importPreviewAutoRefreshPolicyFlow(file, mode = "replace", rawOptions = {}) {
    if (!file) {
      setState({
        recoveryFeedback: {
          type: "error",
          message: "未选择预览自动刷新策略文件。",
        },
      });
      return;
    }

    setState({ busy: true, recoveryFeedback: null });
    setStatus("Importing preview auto-refresh policy...");
    try {
      const options = normalizePolicyImportOptions(rawOptions);
      const text = await file.text();
      const parsed = JSON.parse(text);
      const current = readPreviewAutoRefreshPolicyPayloadFromStorage();
      const incoming = normalizePreviewAutoRefreshPolicyPayload(parsed?.policy || parsed);
      const merged = mergePreviewAutoRefreshPolicyPayload(current, incoming, mode, options);
      writePreviewAutoRefreshPolicyPayloadToStorage(merged.payload);
      const state = getState();
      const projectName = String(state.projectName || "").trim();
      const applied = applyPreviewAutoRefreshPreferenceForProject(projectName, merged.payload);
      const importedProjects = Object.keys(incoming.projects || {}).length;
      const defaultBehaviorText = merged.mode === "merge"
        ? (options.includeDefaultOnMerge ? "default=imported" : "default=local")
        : "default=imported";
      setState({
        previewAutoRefresh: applied.enabled,
        previewAutoRefreshPolicyScope: applied.scope,
        recoveryFeedback: {
          type: "ok",
          message: projectName
            ? `预览自动刷新策略已导入（mode=${merged.mode}, ${defaultBehaviorText}, projects=${importedProjects}）并应用到项目：${projectName}`
            : `预览自动刷新策略已导入（mode=${merged.mode}, ${defaultBehaviorText}, projects=${importedProjects}）。`,
        },
      });
      setStatus("Preview auto-refresh policy imported");
    } catch (err) {
      setState({
        recoveryFeedback: {
          type: "error",
          message: `导入预览自动刷新策略失败：${err?.message || String(err)}`,
        },
      });
      setStatus("Preview auto-refresh policy import failed");
    }
    setState({ busy: false });
  }

  function refreshPreviewFlow() {
    const state = getState();
    if (!state.previewBookId) {
      setStatus("Preview unavailable");
      return;
    }
    const patch = buildPreviewStatePatch(state, state.books, {
      previewRefreshToken: Date.now(),
    });
    setState(patch);
    setStatus("Preview refreshed");
  }

  function touchPreviewAfterWrite(changedBookId = "") {
    const state = getState();
    if (!state.previewAutoRefresh) return;
    const currentPreviewBookId = String(state.previewBookId || "").trim();
    const targetBookId = String(changedBookId || "").trim();
    if (targetBookId && currentPreviewBookId && targetBookId !== currentPreviewBookId) return;
    const patch = buildPreviewStatePatch(state, state.books, {
      previewRefreshToken: Date.now(),
    });
    setState(patch);
  }

  return {
    buildPreviewStatePatch,
    updateRecoveryPolicyImportOptionsFlow,
    updatePreviewStateFlow,
    resetPreviewAutoRefreshPreferenceFlow,
    exportPreviewAutoRefreshPolicyFlow,
    importPreviewAutoRefreshPolicyFlow,
    refreshPreviewFlow,
    touchPreviewAfterWrite,
  };
}
