export function createImportExportManager(deps = {}) {
  const {
    getState,
    setState,
    setStatus,
    bookPackService,
    mergeService,
    sitePackService,
    sanitizeBookId,
    refreshProjectData,
    touchPreviewAfterWrite,
  } = deps;

  async function exportPackFlow(bookId) {
    if (!bookId) {
      setState({
        packFeedback: {
          type: "error",
          message: "请选择要导出的书籍。",
        },
      });
      return;
    }

    setState({ busy: true, packFeedback: null, packDiagnostic: null });
    setStatus("Exporting rgbook...");

    try {
      const state = getState();
      const result = await bookPackService.exportBookPack({
        bookId,
        books: state.books,
      });

      setState({
        packFeedback: {
          type: "ok",
          message: `导出成功：${result.filename}（data ${result.dataFiles}，assets ${result.assets}，checksum ${result.checksums}）`,
        },
      });
      setStatus("rgbook exported");
    } catch (err) {
      setState({
        packFeedback: {
          type: "error",
          message: `导出失败：${err?.message || String(err)}`,
        },
      });
      setStatus("Export failed");
    }

    setState({ busy: false });
  }

  async function importPackFlow(file, strategy) {
    if (!file) {
      setState({
        packFeedback: {
          type: "error",
          message: "请选择要导入的 rgbook 文件。",
        },
      });
      return;
    }

    setState({ busy: true, packFeedback: null, packDiagnostic: null, packManualPlan: null });
    setStatus("Importing rgbook...");

    try {
      const state = getState();
      if (strategy === "manual") {
        const inspected = await bookPackService.inspectBookPack(file);
        const incomingBookId = sanitizeBookId(
          inspected?.book?.id || inspected?.manifest?.book?.id || ""
        );
        if (!incomingBookId) throw new Error("PACK_BOOK_ID_INVALID");
        const plan = mergeService.planMerge({
          incomingBookId,
          existingBooks: state.books,
        });

        if (!plan.hasConflict) {
          setState({
            packManualPlan: {
              file,
              incomingBookId,
              hasConflict: false,
              recommendedStrategy: "overwrite",
              recommendedTargetBookId: incomingBookId,
              options: "overwrite/rename",
            },
            packFeedback: {
              type: "ok",
              message: `manual 预检查：未发现冲突（bookId=${incomingBookId}），可直接使用 rename/overwrite 导入。`,
            },
          });
        } else {
          const renameDecision = mergeService.applyMergePlan({
            plan,
            existingBooks: state.books,
            strategy: "rename",
          });
          const options = Array.isArray(plan?.conflicts?.[0]?.options)
            ? plan.conflicts[0].options.join("/")
            : "overwrite/rename/skip";
          setState({
            packManualPlan: {
              file,
              incomingBookId,
              hasConflict: true,
              recommendedStrategy: "rename",
              recommendedTargetBookId: renameDecision.targetBookId,
              options,
            },
            packFeedback: {
              type: "ok",
              message: `manual 预检查：检测到 bookId 冲突（${incomingBookId}），可选策略 ${options}；推荐 rename -> ${renameDecision.targetBookId}`,
            },
          });
        }
        setStatus("Manual merge plan ready");
        setState({ busy: false });
        return;
      }

      const result = await bookPackService.importBookPack({
        file,
        existingBooks: state.books,
        strategy,
      });

      await refreshProjectData();

      if (result.skipped) {
        setState({
          packFeedback: {
            type: "ok",
            message: "导入已跳过（skip 策略）。",
          },
          packDiagnostic: null,
          packManualPlan: null,
        });
        setStatus("Import skipped");
      } else {
        touchPreviewAfterWrite(result.targetBookId);
        setState({
          packFeedback: {
            type: "ok",
            message: `导入成功：${result.targetBookId}（${result.strategy}）`,
          },
          packDiagnostic: null,
          packManualPlan: null,
        });
        setStatus("rgbook imported");
      }
    } catch (err) {
      const diagnostic = buildPackImportDiagnostic({
        file,
        strategy,
        error: err,
        mode: getState().mode,
        projectName: getState().projectName,
      });
      setState({
        packFeedback: {
          type: "error",
          message: `导入失败：${err?.message || String(err)}（可下载诊断报告）`,
        },
        packDiagnostic: diagnostic,
        packManualPlan: null,
      });
      setStatus("Import failed");
    }

    setState({ busy: false });
  }

  async function applyManualMergeSuggestionFlow() {
    const state = getState();
    const plan = state.packManualPlan;
    if (!plan?.file) {
      setState({
        packFeedback: {
          type: "error",
          message: "当前没有可应用的 manual 预检查结果。",
        },
      });
      return;
    }
    await importPackFlow(plan.file, String(plan.recommendedStrategy || "rename"));
  }

  function inferErrorCode(err) {
    const message = String(err?.message || err || "UNKNOWN_ERROR");
    const direct = message.match(/\b[A-Z][A-Z0-9_]{3,}\b/);
    return direct ? direct[0] : "UNKNOWN_ERROR";
  }

  function buildPackImportDiagnostic({ file, strategy, error, mode, projectName }) {
    const now = new Date().toISOString();
    const fileName = file?.name || "(unknown)";
    const fileSize = Number(file?.size || 0);
    const errorMessage = String(error?.message || error || "UNKNOWN_ERROR");

    return {
      type: "rgbook-import-diagnostic",
      generatedAt: now,
      project: {
        name: projectName || "",
        mode: mode || "",
      },
      input: {
        fileName,
        fileSize,
        strategy: strategy || "rename",
      },
      error: {
        code: inferErrorCode(error),
        message: errorMessage,
        stack: String(error?.stack || "").slice(0, 4000),
      },
      hints: [
        "确认压缩包为本工具导出的 .rgbook.zip",
        "检查 manifest/checksum 是否被二次修改",
        "若为路径或大小限制错误，建议重新导出并避免手工改包",
      ],
    };
  }

  function buildRedactedDiagnostic(report) {
    if (!report) return null;
    return {
      ...report,
      project: {
        name: "***REDACTED***",
        mode: report?.project?.mode || "",
      },
      input: {
        ...report.input,
        fileName: "***REDACTED***",
        fileSize: Number(report?.input?.fileSize || 0),
        strategy: report?.input?.strategy || "rename",
      },
    };
  }

  function setDeepRedacted(target, path) {
    const parts = String(path || "").split(".").map((item) => item.trim()).filter(Boolean);
    if (!parts.length) return false;

    let cursor = target;
    for (let i = 0; i < parts.length; i += 1) {
      const key = parts[i];
      if (cursor == null || typeof cursor !== "object" || !(key in cursor)) {
        return false;
      }
      if (i === parts.length - 1) {
        cursor[key] = "***REDACTED***";
        return true;
      }
      cursor = cursor[key];
    }
    return false;
  }

  function buildCustomRedactedDiagnostic(report, customFields = []) {
    if (!report) return null;
    const cloned = JSON.parse(JSON.stringify(report));
    let matched = 0;
    customFields.forEach((field) => {
      if (setDeepRedacted(cloned, field)) matched += 1;
    });

    cloned.redaction = {
      mode: "custom",
      fields: customFields,
      matched,
    };

    return cloned;
  }

  function downloadDiagnosticReport(report, mode = "full", customFields = []) {
    if (!report) return;
    const stamp = String(report.generatedAt || new Date().toISOString()).replace(/[:.]/g, "-");
    let output = report;
    let suffix = "full";
    if (mode === "redacted") {
      output = buildRedactedDiagnostic(report);
      suffix = "redacted";
    } else if (mode === "custom") {
      output = buildCustomRedactedDiagnostic(report, customFields);
      suffix = "custom";
    }
    const filename = `rgbook-import-diagnostic-${suffix}-${stamp}.json`;
    const text = `${JSON.stringify(output, null, 2)}\n`;
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadImportReportFlow(mode = "full", customFields = []) {
    const state = getState();
    if (!state.packDiagnostic) {
      setState({
        packFeedback: {
          type: "error",
          message: "当前没有可导出的诊断报告。",
        },
      });
      return;
    }

    downloadDiagnosticReport(state.packDiagnostic, mode, customFields);
    let label = "完整诊断报告";
    if (mode === "redacted") label = "脱敏诊断报告";
    if (mode === "custom") label = "自定义脱敏诊断报告";
    setState({
      packFeedback: {
        type: "ok",
        message: `${label}已下载。`,
      },
    });
  }

  function clearRedactionTemplatesFlow(removedCount = 0) {
    const count = Number(removedCount || 0);
    setState({
      packFeedback: {
        type: "ok",
        message: count > 0 ? `最近模板已清空（${count} 条）。` : "最近模板已为空。",
      },
    });
  }

  function exportRedactionTemplatesFlow(count = 0) {
    const total = Number(count || 0);
    setState({
      packFeedback: {
        type: "ok",
        message: total > 0 ? `模板文件已导出（${total} 条）。` : "模板文件已导出（当前为空列表）。",
      },
    });
  }

  function summarizeTemplateExamples(list = [], max = 2) {
    const normalized = (Array.isArray(list) ? list : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean);
    if (!normalized.length) return "";
    const picked = normalized.slice(0, max);
    const text = picked.map((item) => `"${item}"`).join("、");
    if (normalized.length > max) {
      return `${text} 等 ${normalized.length} 条`;
    }
    return text;
  }

  function previewRedactionTemplatesFlow(result) {
    if (!result?.ok) {
      setState({
        packFeedback: {
          type: "error",
          message: result?.error || "预览模板失败。",
        },
      });
      return;
    }

    const mode = result.mode === "merge" ? "merge" : "replace";
    const currentCount = Number(result.currentCount || 0);
    const importedCount = Number(result.importedCount || 0);
    const nextCount = Number(result.nextCount || 0);
    const addedCount = Number(result.addedCount || 0);
    const removedCount = Number(result.removedCount || 0);
    const unchangedCount = Number(result.unchangedCount || 0);
    const addedExamples = summarizeTemplateExamples(result.addedTemplates);
    const removedExamples = summarizeTemplateExamples(result.removedTemplates);
    const detailParts = [];
    if (addedExamples) detailParts.push(`新增示例：${addedExamples}`);
    if (removedExamples) detailParts.push(`移除示例：${removedExamples}`);
    const detailText = detailParts.length ? `（${detailParts.join("；")}）` : "";
    const truncated = result.truncated ? "，超出上限部分将被截断" : "";

    setState({
      packFeedback: {
        type: "ok",
        message: `模板导入预览（mode ${mode}）：当前 ${currentCount} 条，导入 ${importedCount} 条，结果 ${nextCount} 条（新增 ${addedCount}，移除 ${removedCount}，保留 ${unchangedCount}）${detailText}${truncated}。`,
      },
    });
  }

  function importRedactionTemplatesFlow(result) {
    if (!result?.ok) {
      setState({
        packFeedback: {
          type: "error",
          message: result?.error || "导入模板失败。",
        },
      });
      return;
    }
    const count = Number(result.count || 0);
    const mode = result.mode === "merge" ? "merge" : "replace";
    const addedCount = Number(result.addedCount || 0);
    const removedCount = Number(result.removedCount || 0);
    const unchangedCount = Number(result.unchangedCount || 0);
    const addedExamples = summarizeTemplateExamples(result.addedTemplates);
    const removedExamples = summarizeTemplateExamples(result.removedTemplates);
    const detailParts = [];
    if (addedExamples) detailParts.push(`新增示例：${addedExamples}`);
    if (removedExamples) detailParts.push(`移除示例：${removedExamples}`);
    const detailText = detailParts.length ? `，${detailParts.join("；")}` : "";
    const truncated = result.truncated ? "，超出上限部分已截断" : "";
    setState({
      packFeedback: {
        type: "ok",
        message: `模板导入完成（${count} 条，mode ${mode}，新增 ${addedCount}，移除 ${removedCount}，保留 ${unchangedCount}${detailText}${truncated}）。`,
      },
    });
  }

  async function exportSiteFlow(options = {}) {
    const scope = String(options.scope || "all");
    const selectedBookIds = Array.isArray(options.selectedBookIds) ? options.selectedBookIds : [];
    const subsetAssetMode = String(options.subsetAssetMode || "balanced");
    const missingAssetFallbackMode = String(options.missingAssetFallbackMode || "report-only");
    if (scope === "selected" && !selectedBookIds.length) {
      setState({
        packFeedback: {
          type: "error",
          message: "请选择至少一本书用于子集导出。",
        },
      });
      return;
    }

    setState({ busy: true, packFeedback: null, packDiagnostic: null });
    setStatus("Exporting rgsite...");

    try {
      const result = await sitePackService.exportSitePack({
        includeEditor: Boolean(options.includeEditor),
        selectedBookIds: scope === "selected" ? selectedBookIds : [],
        subsetAssetMode: scope === "selected" ? subsetAssetMode : "balanced",
        missingAssetFallbackMode: scope === "selected" ? missingAssetFallbackMode : "report-only",
      });

      const scopeText = result.scope === "subset"
        ? `subset(${result.selectedBookIds.length}本/${result.subsetAssetMode})`
        : "full";
      const missingText = Array.isArray(result.missingAssets) && result.missingAssets.length
        ? `，missingAssets ${result.missingAssets.length}`
        : "";
      const missingGroupCount = result.missingAssetsByGroup
        ? Object.keys(result.missingAssetsByGroup).length
        : 0;
      const groupText = missingGroupCount ? `，groups ${missingGroupCount}` : "";
      const missingCategoryCount = result.missingAssetsByCategory
        ? Object.keys(result.missingAssetsByCategory).filter(
          (key) => Number(result.missingAssetsByCategory[key] || 0) > 0
        ).length
        : 0;
      const categoryText = missingCategoryCount ? `，categories ${missingCategoryCount}` : "";
      const fallbackText = result.missingAssetFallbackMode && result.missingAssetFallbackMode !== "report-only"
        ? `，fallback ${result.missingAssetFallbackMode}`
        : "";
      const fallbackGenerated = Number(result.generatedFallbackAssets || 0);
      const fallbackGeneratedText = fallbackGenerated > 0 ? `，generated ${fallbackGenerated}` : "";
      const reportText = result.missingAssetsReportAdded ? "，含 MISSING-ASSETS.txt" : "";
      setState({
        packFeedback: {
          type: "ok",
          message: `发布包导出成功：${result.filename}（scope ${scopeText}，files ${result.files}，books ${result.books}${missingText}${groupText}${categoryText}${fallbackText}${fallbackGeneratedText}${reportText}）`,
        },
      });
      setStatus("rgsite exported");
    } catch (err) {
      setState({
        packFeedback: {
          type: "error",
          message: `发布包导出失败：${err?.message || String(err)}`,
        },
      });
      setStatus("rgsite export failed");
    }

    setState({ busy: false });
  }

  return {
    exportPackFlow,
    importPackFlow,
    applyManualMergeSuggestionFlow,
    downloadImportReportFlow,
    clearRedactionTemplatesFlow,
    exportRedactionTemplatesFlow,
    previewRedactionTemplatesFlow,
    importRedactionTemplatesFlow,
    exportSiteFlow,
  };
}
