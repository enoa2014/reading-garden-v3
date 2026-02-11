export function createBookManager(deps = {}) {
  const {
    fs,
    getState,
    setState,
    setStatus,
    resolveCreateBookModuleIncludes,
    sanitizeBookId,
    validateNewBookInput,
    buildNewBookArtifacts,
    refreshProjectData,
    buildPreviewStatePatch,
    formatTemplatePresetForFeedback,
  } = deps;

  async function createBookFlow(rawInput) {
    const state = getState();
    if (!state.projectHandle || !state.structure?.ok) return;

    const includeInput = resolveCreateBookModuleIncludes(rawInput);
    const normalizedInput = {
      ...rawInput,
      ...includeInput,
      id: sanitizeBookId(rawInput?.id || rawInput?.title),
      imageMode: String(state.aiSettings?.image?.mode || "disabled"),
    };

    const inputCheck = validateNewBookInput(normalizedInput, state.books);
    if (!inputCheck.valid) {
      setState({
        newBookFeedback: {
          type: "error",
          message: inputCheck.errors.join("；"),
        },
      });
      return;
    }

    const artifacts = buildNewBookArtifacts(normalizedInput);
    const nextBooks = [...state.books, artifacts.booksItem];

    const createdPaths = [];
    let booksWriteResult = null;

    const ensureDirWithTrack = async (path) => {
      const exists = await fs.exists(path);
      if (!exists) {
        await fs.ensureDirectory(path);
        createdPaths.push({ path, recursive: true });
      }
    };

    const writeFileWithTrack = async (path, content, isJson = false) => {
      const existed = await fs.exists(path);
      if (isJson) {
        await fs.writeJson(path, content);
      } else {
        await fs.writeText(path, content);
      }
      if (!existed) createdPaths.push({ path, recursive: false });
    };

    setState({ busy: true, newBookFeedback: null, packFeedback: null, packDiagnostic: null });
    setStatus("Creating new book...");

    try {
      await ensureDirWithTrack(`data/${artifacts.bookId}`);
      await ensureDirWithTrack(`assets/images/${artifacts.bookId}`);
      await ensureDirWithTrack(`assets/images/${artifacts.bookId}/covers`);

      await writeFileWithTrack(`data/${artifacts.bookId}/registry.json`, artifacts.registry, true);
      await writeFileWithTrack(`data/${artifacts.bookId}/chapters.json`, artifacts.chapters, true);
      await writeFileWithTrack(
        `assets/images/${artifacts.bookId}/covers/${artifacts.coverFileName || "cover.svg"}`,
        artifacts.coverSvg,
        false
      );

      if (artifacts.includeCharacters) {
        await ensureDirWithTrack(`assets/images/${artifacts.bookId}/characters`);
        await writeFileWithTrack(`data/${artifacts.bookId}/characters.json`, artifacts.characters, true);
        await writeFileWithTrack(
          `assets/images/${artifacts.bookId}/characters/protagonist.svg`,
          artifacts.protagonistSvg,
          false
        );
      }

      if (artifacts.includeThemes) {
        await writeFileWithTrack(`data/${artifacts.bookId}/themes.json`, artifacts.themes, true);
      }

      if (artifacts.includeTimeline) {
        await writeFileWithTrack(`data/${artifacts.bookId}/timeline.json`, artifacts.timeline, true);
      }

      if (artifacts.includeInteractive) {
        await writeFileWithTrack(`data/${artifacts.bookId}/scenarios.json`, artifacts.scenarios, true);
      }

      if (artifacts.promptTemplateText) {
        await ensureDirWithTrack(`data/${artifacts.bookId}/prompts`);
        await writeFileWithTrack(
          `data/${artifacts.bookId}/prompts/image-prompts.md`,
          artifacts.promptTemplateText,
          false
        );
      }

      booksWriteResult = await fs.writeJson("data/books.json", { books: nextBooks });

      await refreshProjectData();
      const previewPatch = buildPreviewStatePatch(getState(), getState().books, {
        previewBookId: artifacts.bookId,
        previewRefreshToken: Date.now(),
      });
      setState(previewPatch);
      const presetText = `，模板：${formatTemplatePresetForFeedback(normalizedInput.templatePreset)}`;
      const promptText = artifacts.promptTemplateText ? "，已生成 prompts/image-prompts.md" : "";

      setState({
        newBookFeedback: {
          type: "ok",
          message: `书籍已创建：${artifacts.bookId}${presetText}${promptText}`,
        },
      });

      setStatus("Book created");
    } catch (err) {
      if (booksWriteResult?.backupPath) {
        try {
          const backupText = await fs.readText(booksWriteResult.backupPath);
          await fs.writeText("data/books.json", backupText, { skipBackup: true });
        } catch {
          // best-effort restore
        }
      }

      for (let i = createdPaths.length - 1; i >= 0; i -= 1) {
        const item = createdPaths[i];
        try {
          // eslint-disable-next-line no-await-in-loop
          await fs.deletePath(item.path, { recursive: item.recursive });
        } catch {
          // keep best-effort rollback
        }
      }

      setState({
        newBookFeedback: {
          type: "error",
          message: `创建失败，已尝试回滚：${err?.message || String(err)}`,
        },
      });
      setStatus("Create failed");
    }

    setState({ busy: false });
  }

  function newBookPresetFeedbackFlow(feedback = {}) {
    const type = String(feedback?.type || "ok").trim() === "error" ? "error" : "ok";
    const message = String(feedback?.message || "").trim();
    if (!message) return;
    setState({
      newBookFeedback: {
        type,
        message,
      },
    });
  }

  return {
    createBookFlow,
    newBookPresetFeedbackFlow,
  };
}
