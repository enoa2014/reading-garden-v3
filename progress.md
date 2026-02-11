# Progress Log: Reading Garden Editor 开发实施

## Session: 2026-02-11

### Phase 1: 开发基线与结构初始化
- **Status:** complete
- **Started:** 2026-02-11
- Actions taken:
  - 将规划文件从“分析模式”切换为“开发实施模式”
  - 锁定 Sprint 1 范围：核心骨架 + 最小闭环
  - 重写 `task_plan.md` / `findings.md` / `progress.md` 作为本轮事实基线
  - 记录新增约束：允许改造原项目，但必须有回滚策略
- Files created/modified:
  - `task_plan.md` (rewritten)
  - `findings.md` (rewritten)
  - `progress.md` (rewritten)
  - `reading-garden-editor/` (created)

### Phase 2: 核心基础模块实现
- **Status:** complete
- Actions taken:
  - 实现 `state.js`（订阅式状态容器）
  - 实现 `path-resolver.js`（路径归一化、join、query剥离、bookId清洗）
  - 实现 `filesystem.js`（目录接入、结构校验、读写、写前备份）
  - 实现 `validator.js`（结构校验与 books 数据基础规则校验）
- Files created/modified:
  - `reading-garden-editor/editor/js/core/state.js` (created)
  - `reading-garden-editor/editor/js/core/path-resolver.js` (created)
  - `reading-garden-editor/editor/js/core/filesystem.js` (created)
  - `reading-garden-editor/editor/js/core/validator.js` (created)

### Phase 3: 最小 UI 与主流程打通
- **Status:** complete
- Actions taken:
  - 创建 `index.html`、`editor.css`
  - 实现 `app.js`（模式检测、打开项目、载入书架、导航）
  - 实现 `dashboard.js`（结构状态、错误、书架展示）
  - 打通最小闭环：打开项目 -> 校验结构 -> 读取 `data/books.json` -> 展示书架
- Files created/modified:
  - `reading-garden-editor/index.html` (created)
  - `reading-garden-editor/editor/css/editor.css` (created)
  - `reading-garden-editor/editor/js/core/app.js` (created)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (created)

### Phase 4: 自检与文档同步
- **Status:** complete
- Actions taken:
  - 执行 `node --check` 对编辑器核心文件进行语法检查
  - 修复 `dashboard.js` 模板字符串语法问题
  - 更新 `README.md`：新增编辑器入口、文档路径、回滚策略说明
  - 同步更新 `task_plan.md` / `findings.md` / `progress.md`
- Files created/modified:
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `README.md` (updated)
  - `index.html` (updated)
  - `reading-garden-editor/README.md` (created)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 5: 交付与 checkpoint 提交
- **Status:** complete
- Actions taken:
  - 创建 checkpoint commit：`f9d631d`（Sprint 1 骨架 + 回滚备份机制）
  - 创建 checkpoint commit：`107cb6b`（首页编辑器入口 + 子应用 README）
  - 推送到远端 `origin/master`，确保断电后可远端恢复
- Files created/modified:
  - Git commits and remote sync

### Phase 6: Sprint 2 核心功能扩展
- **Status:** complete
- Actions taken:
  - 新增 `book-template.js`，用于生成最小可运行新书模板
  - 扩展 `filesystem.js`，增加 `exists` 和 `deletePath`，支持回滚清理
  - 扩展 `validator.js`，增加新建书输入校验
  - 扩展 `app.js`，实现：
    - 书架健康检查（每本书 `registry.json` 存在性）
    - 新建书主流程（创建目录/数据/封面并写入 `books.json`）
    - 失败时逆序删除本次创建路径（事务式回滚第一版）
  - 扩展 `dashboard.js`，新增新建书表单与反馈提示
  - 新增交换包骨架模块（book/site/import-merge）
- Files created/modified:
  - `reading-garden-editor/editor/js/core/book-template.js` (created)
  - `reading-garden-editor/editor/js/core/filesystem.js` (updated)
  - `reading-garden-editor/editor/js/core/validator.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `reading-garden-editor/editor/css/editor.css` (updated)
  - `reading-garden-editor/editor/js/packaging/book-pack-service.js` (created)
  - `reading-garden-editor/editor/js/packaging/import-merge-service.js` (created)
  - `reading-garden-editor/editor/js/packaging/site-pack-service.js` (created)

### Phase 7: Sprint 2 自检与文档同步
- **Status:** complete
- Actions taken:
  - 对编辑器全部 JS 文件执行 `node --check` 语法检查并通过
  - 将计划文档切换到 Sprint 2
  - 扩展新建书模板：人物/主题模块可选
  - 扩展健康检查：`registry.modules[].entry/data` 可达性检测
  - 修复 `normalizePath` query 保留问题
  - 更新 `reading-garden-editor/README.md` 的 Sprint 2 能力说明
- Files created/modified:
  - `task_plan.md` (rewritten)
  - `findings.md` (updated)
  - `progress.md` (updated)
  - `reading-garden-editor/editor/js/core/path-resolver.js` (updated)
  - `reading-garden-editor/editor/js/core/book-template.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `reading-garden-editor/editor/css/editor.css` (updated)
  - `reading-garden-editor/README.md` (updated)

## Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| 开发基线确认 | 读取需求/设计文档与仓库结构 | 明确 Sprint 1 范围 | 已完成 | ✓ |
| JS 语法检查 | `node --check` 对编辑器核心文件 | 无语法错误 | 通过 | ✓ |
| 回滚机制检查 | `filesystem.js` 写流程审查 | 写前备份可用 | 已实现 `backupFileIfExists` | ✓ |
| 文档入口检查 | README 编辑器章节 | 可定位入口、文档、回滚策略 | 已补充 | ✓ |
| 远端备份检查 | `git push origin master` | checkpoint 可远端恢复 | 已推送 | ✓ |
| Sprint2 语法检查 | `node --check` on editor js files | 全部通过 | 通过 | ✓ |
| 模板模块化检查 | `buildNewBookArtifacts` smoke test | 按选项输出模块与模板文件 | 通过 | ✓ |
| 路径归一化检查 | `normalizePath` smoke test | 保留 `?v=` query | 通过 | ✓ |
| Sprint3 语法检查 | `node --check`（排除 vendor） | 全部通过 | 通过 | ✓ |
| 合并策略检查 | `ImportMergeService` smoke test | rename 生成新 id | 通过（`wave-imported-1`） | ✓ |
| Sprint4 语法检查 | `node --check` on `pack-utils/book-pack/site-pack/app/dashboard` | 无语法错误 | 通过 | ✓ |
| rgsite 流程接入检查 | 审查 `dashboard.js` + `app.js` 事件链路 | 可触发导出并回传反馈 | 已接入 `onExportSite` | ✓ |
| 编辑器回归脚本 | `./scripts/editor-regression.sh` | 语法 + 关键逻辑检查通过 | 通过 | ✓ |
| rgsite 子集参数链路 | 审查 `dashboard -> app -> sitePackService` | scope/selectedBookIds 可传递 | 已接入 | ✓ |
| rgbook 诊断下载链路 | 审查 `import catch -> state -> download` | 失败后可导出 JSON 报告 | 已接入 | ✓ |
| CI 工作流配置检查 | 审查 `.github/workflows/editor-regression.yml` | push/PR 可自动执行回归脚本 | 已接入 | ✓ |
| 诊断脱敏导出链路 | 审查 `dashboard -> app(redacted) -> download` | 可导出隐藏项目名和文件名的报告 | 已接入 | ✓ |
| rgsite minimal 参数链路 | 审查 `dashboard -> app -> sitePackService` | subset 可选择 balanced/minimal | 已接入 | ✓ |
| 回归报告产出检查 | `./scripts/editor-regression.sh` | 生成 `tmp/editor-regression-report.json` | 通过 | ✓ |
| CI artifact 配置检查 | 审查 workflow `upload-artifact` 步骤 | 回归报告可在 CI 下载 | 已接入 | ✓ |
| 自定义脱敏链路 | 审查 `dashboard(custom fields) -> app(custom redaction)` | 可按字段路径导出 custom 脱敏报告 | 已接入 | ✓ |
| 缺失资源报告文件检查 | 审查 `site-pack-service` 导出逻辑 | 缺失资产时包含 `MISSING-ASSETS.txt` | 已接入 | ✓ |
| 缺失资源分组检查 | 审查 `MISSING-ASSETS.txt` 生成逻辑 | 按来源输出分组清单 | 已接入 | ✓ |
| 缺失资源分类检查 | 审查 `missingAssetsByCategory` 与报告分类汇总 | 生成固定枚举分类统计 | 已接入 | ✓ |
| 最近模板复用检查 | 审查 `dashboard(localStorage) -> custom report` | 自定义脱敏字段可复用最近模板 | 已接入（最多 5 条） | ✓ |
| 最近模板清空检查 | 审查 `dashboard clear action -> app feedback` | 可一键清空历史模板并提示结果 | 已接入 | ✓ |
| 回归包体统计检查 | `tmp/editor-regression-report.json` | 产出 full/subset/minimal 体积对比 | 已接入 `packStats` | ✓ |
| 回归样本配置检查 | `EDITOR_PACK_STATS_SELECTED_BOOKS=\"wave,totto-chan\" ./scripts/editor-regression.sh` | packStats 按指定书籍抽样 | 通过（mode=env） | ✓ |
| CI 固定抽样检查 | 审查 workflow 回归步骤 env | PR/Push 采用固定 packStats 抽样 | 已接入（totto-chan,wave） | ✓ |
| workflow_dispatch 抽样覆盖检查 | 审查 workflow_dispatch inputs 与 env 表达式 | 手动触发可覆盖 packStats 抽样书籍 | 已接入 | ✓ |
| CI 摘要输出检查 | `GITHUB_STEP_SUMMARY=/tmp/pack-summary.md node ...` | 输出 packStats 关键指标与 missing IDs | 已接入 | ✓ |
| 严格抽样失败检查 | `EDITOR_PACK_STATS_SELECTED_BOOKS=\"__missing__\" EDITOR_PACK_STATS_REQUIRE_VALID_SELECTION=true node scripts/editor-regression.mjs` | 无效抽样 ID 时回归失败 | 已接入 | ✓ |
| 严格模式常规回归检查 | `EDITOR_PACK_STATS_REQUIRE_VALID_SELECTION=true ./scripts/editor-regression.sh` | 默认抽样在严格模式下可通过 | 通过 | ✓ |
| dispatch 严格开关检查 | 审查 workflow_dispatch 输入与 env 表达式 | 手动触发可切换严格校验开关 | 已接入 | ✓ |
| 抽样格式校验检查 | `EDITOR_PACK_STATS_SELECTED_BOOKS=\"bad;id\" EDITOR_PACK_STATS_REQUIRE_VALID_SELECTION=true node scripts/editor-regression.mjs` | 非法格式 ID 在严格模式下失败 | 已接入 | ✓ |
| summary 告警检查 | 审查 workflow summary 生成逻辑 | 输出 missing-assets 告警状态 | 已接入（warning/ok） | ✓ |
| missing-assets 阈值检查 | `EDITOR_PACK_STATS_MAX_MISSING_ASSETS=0 ./scripts/editor-regression.sh` | 超阈值时回归失败 | 已接入 | ✓ |
| 按模式阈值检查 | `EDITOR_PACK_STATS_MAX_MISSING_ASSETS_SUBSET_MINIMAL=0 ./scripts/editor-regression.sh` | subset-minimal 可独立阈值并触发失败 | 已接入 | ✓ |
| summary 分类统计检查 | 审查 workflow summary 生成逻辑 | 输出 missing-assets 分类统计 | 已接入 | ✓ |
| 分类阈值检查 | `EDITOR_PACK_STATS_MAX_MISSING_BOOK_MODULE=0 ./scripts/editor-regression.sh` | 模块缺失分类按阈值校验 | 已接入 | ✓ |
| 分类阈值扩展检查 | `EDITOR_PACK_STATS_MAX_MISSING_BOOK_COVER=1 EDITOR_PACK_STATS_MAX_MISSING_FILE_REF=1 ./scripts/editor-regression.sh` | 封面/文件引用分类支持独立阈值 | 已接入 | ✓ |
| 未分类阈值检查 | `EDITOR_PACK_STATS_MAX_MISSING_UNCLASSIFIED=0 ./scripts/editor-regression.sh` | 未分类缺失支持独立阈值 | 已接入 | ✓ |
| 阈值预设检查 | `EDITOR_PACK_STATS_CATEGORY_THRESHOLD_PRESET=strict ./scripts/editor-regression.sh` | strict 预设可触发更严格分类阈值失败 | 已接入 | ✓ |
| 缺失资源回退检查 | 审查 `dashboard -> app -> site-pack-service` 参数链路 | 支持 `report-only/svg-placeholder` 回退策略 | 已接入 | ✓ |
| AI 配置链路检查 | 审查 `dashboard(ai form) -> app(save/load) -> filesystem` | 支持本地保存/加载 LLM 与图片接口配置 | 已接入 | ✓ |
| AI 配置迁移检查 | 审查 `dashboard(ai import/export) -> app handlers` | 支持 AI 配置 JSON 导入/导出 | 已接入 | ✓ |
| 新建书图片策略检查 | 审查 `createBookFlow -> buildNewBookArtifacts(imageMode)` | 支持 emoji/none 封面与 prompt 文件模板 | 已接入 | ✓ |
| 新建书模块扩展检查 | 审查 `newBookForm -> buildNewBookArtifacts(includeTimeline/includeInteractive)` | 支持 timeline/interactive 模块脚手架 | 已接入 | ✓ |
| Live Preview 检查 | 审查 `dashboard(preview form) -> app(preview state/url)` | 支持预览书籍切换、设备视口切换与手动刷新 | 已接入 | ✓ |
| Live Preview 自动刷新检查 | 审查 `touchPreviewAfterWrite` 与开关链路 | 导入/建书/覆盖写入后按设置自动刷新 iframe | 已接入 | ✓ |
| 路径级校验检查 | 审查 `validator(validateBooksData/validateRegistryData)` | 输出 JSON 路径 + 原因 + 修复建议 | 已接入 | ✓ |
| 校验报告导出检查 | 审查 `downloadValidationReportFlow` | Validation Issues 可下载结构化校验报告 | 已接入 | ✓ |
| 会话快照恢复检查 | 审查 `recovery-store(indexedDB) -> app(save/restore)` | 支持防抖+周期快照并在同项目重开恢复 | 已接入 | ✓ |
| 会话快照清理检查 | 审查 `clearRecoverySnapshotFlow -> recoveryStore.clearLatest` | 支持手动清理 latest 快照且避免立即回写 | 已接入 | ✓ |
| 项目快照匹配检查 | 审查 `loadByProject -> loadLatest(fallback)` | 会话恢复优先匹配当前项目，避免跨项目干扰 | 已接入 | ✓ |
| 原文分析链路检查 | 审查 `dashboard(analysis form) -> app -> analysis assistant` | 支持原文分析与建议导出（LLM 可选 + 本地回退） | 已接入 | ✓ |
| 分析建议落盘检查 | 审查 `app(applyAnalysisSuggestionFlow)` | 支持安全写入 `registry.suggested.json` | 已接入 | ✓ |
| 分析建议自动建书检查 | 审查 `applyAnalysisSuggestionFlow -> createBookFlow(draftInput)` | 未选目标书籍时可自动创建草稿并应用建议 | 已接入 | ✓ |
| 覆盖确认检查 | 审查 `confirmOverwriteAnalysis -> confirmOverwrite` 参数链路 | overwrite 未确认时阻断写入 | 已接入 | ✓ |
| 分析建议覆盖检查 | 审查 `analysisApplyMode=overwrite` 写入链路 | 支持覆盖 `registry.json` 且返回备份路径 | 已接入 | ✓ |
| 覆盖补齐数据检查 | 审查 `ensureSuggestedModuleDataFiles` | 覆盖模式自动补齐新增模块 data 文件 | 已接入 | ✓ |
| 手动合并预检查 | 审查 `importPackFlow(strategy=manual)` | 先输出冲突计划与推荐策略，不直接导入 | 已接入 | ✓ |
| 手动合并推荐应用 | 审查 `applyManualMergeSuggestionFlow` | 支持一键应用 manual 预检查推荐策略 | 已接入 | ✓ |
| 模板导入导出链路检查 | 审查 `dashboard(import/export handlers) -> app feedback` | 最近模板可导入/导出并反馈结果 | 已接入 | ✓ |
| 模板导入模式检查 | 审查 `importTemplateMode`（replace/merge）链路 | 模板导入支持模式切换并反馈 mode | 已接入 | ✓ |
| 模板导入预览检查 | 审查 `dashboard(preview handlers) -> app feedback` | 模板导入支持差异统计预览 | 已接入 | ✓ |
| 模板预览明细检查 | 审查 `preview/import feedback` 文案拼接 | 预览与导入反馈可展示新增/移除示例 | 已接入 | ✓ |

### Phase 8: Sprint 3 rgbook 导入导出落地
- **Status:** complete
- Actions taken:
  - 引入本地 `JSZip` vendor 文件
  - 实现 `BookPackService` 的导出/导入/检查流程
  - 实现 `ImportMergeService.applyMergePlan`
  - 扩展 `FileSystemAdapter` 支持二进制读写（readBinary/writeBinary）
  - 扩展 Dashboard 与 app：接入 rgbook 导出/导入交互
  - 创建 checkpoint commit：`f04c677`（新建书流程 + 健康检查骨架）
  - 创建 checkpoint commit：`283bee7`（模板增强 + 深度健康检查）
  - 创建 checkpoint commit：`c5ec954`（rgbook 导入导出链路落地）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `reading-garden-editor/editor/js/vendor/jszip.min.js` (created)
  - `reading-garden-editor/editor/js/packaging/book-pack-service.js` (updated)
  - `reading-garden-editor/editor/js/packaging/import-merge-service.js` (updated)
  - `reading-garden-editor/editor/js/core/filesystem.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `reading-garden-editor/index.html` (updated)
  - `reading-garden-editor/README.md` (updated)

### Phase 9: Sprint 4 安全与发布打包
- **Status:** complete
- Actions taken:
  - 将 `task_plan.md` 切换到 Sprint 4（安全校验 + rgsite 导出）
  - 新增 `pack-utils.js`，统一 checksum/zip 安全/下载工具
  - 重构 `book-pack-service.js`：
    - 导出生成 `manifest.checksums`（SHA-256）
    - 导入前执行路径/白名单/文件数/体积安全门禁
    - 导入时校验 checksum，不一致即阻断
  - 实现 `site-pack-service.js`：
    - 导出前校验结构、books、registry 模块引用
    - 校验模块 `entry/data` 空配置并阻断导出
    - 打包运行时白名单文件，输出 `*.rgsite.zip`
    - 生成 `rgsite-manifest.json` 与 `DEPLOY-EDGEONE.md`
    - JSON 敏感键导出时脱敏
  - 扩展 `dashboard.js` 与 `app.js`：
    - 新增 `Export rgsite` 表单（可选包含 editor）
    - 新增导出状态反馈
  - 更新 `README.md` 与 `reading-garden-editor/README.md` 到 Sprint 4 状态
- Files created/modified:
  - `task_plan.md` (rewritten)
  - `reading-garden-editor/editor/js/packaging/pack-utils.js` (created)
  - `reading-garden-editor/editor/js/packaging/book-pack-service.js` (updated)
  - `reading-garden-editor/editor/js/packaging/site-pack-service.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `reading-garden-editor/editor/css/editor.css` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 10: Sprint 4 checkpoint 提交与推送
- **Status:** complete
- Actions taken:
  - 同步 `task_plan.md`/`findings.md`/`progress.md` 阶段状态
  - 创建 checkpoint commit：`cfa3ac4`（rgbook 安全校验 + rgsite 导出链路）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `reading-garden-editor/editor/js/packaging/pack-utils.js` (created)
  - `reading-garden-editor/editor/js/packaging/book-pack-service.js` (updated)
  - `reading-garden-editor/editor/js/packaging/site-pack-service.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `reading-garden-editor/editor/css/editor.css` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 11: Sprint 4 文档收口（post-push）
- **Status:** complete
- Actions taken:
  - 将计划状态切换到“checkpoint 已完成”
  - 创建 docs-only commit：`ae83f90`（同步 checkpoint 状态）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `task_plan.md` (updated)
  - `progress.md` (updated)

### Phase 12: Sprint 4 增量能力（subset + 诊断 + 回归）
- **Status:** complete
- Actions taken:
  - `site-pack-service.js` 增加 `selectedBookIds` 子集导出
  - subset 模式下重写导出包内 `data/books.json`
  - 新增 `rgbook` 导入失败诊断对象与下载能力
  - Dashboard 增加：
    - `rgsite` 导出范围（full/subset）与书籍多选
    - 诊断报告下载按钮
  - 新增回归脚本：
    - `scripts/editor-regression.sh`
    - `scripts/editor-regression.mjs`
  - 更新 `README.md` / `reading-garden-editor/README.md`
- Files created/modified:
  - `reading-garden-editor/editor/js/packaging/site-pack-service.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `reading-garden-editor/editor/js/core/state.js` (updated)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `reading-garden-editor/editor/css/editor.css` (updated)
  - `scripts/editor-regression.sh` (created)
  - `scripts/editor-regression.mjs` (created)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 13: Sprint 4 checkpoint（增量）
- **Status:** complete
- Actions taken:
  - 完成语法检查与回归脚本执行
  - 创建 checkpoint commit：`625526d`（subset 导出 + 诊断报告 + 回归脚本）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `reading-garden-editor/editor/js/packaging/site-pack-service.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `reading-garden-editor/editor/js/core/state.js` (updated)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `reading-garden-editor/editor/css/editor.css` (updated)
  - `scripts/editor-regression.sh` (created)
  - `scripts/editor-regression.mjs` (created)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 14: Sprint 4 文档收口（post-push）
- **Status:** complete
- Actions taken:
  - 将计划状态切换到“增量 checkpoint 已完成”
  - 创建 docs-only commit：`654f003`（同步增量 checkpoint 状态）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `task_plan.md` (updated)
  - `progress.md` (updated)

### Phase 15: Sprint 4 CI 门禁接入
- **Status:** complete
- Actions taken:
  - 新增 `.github/workflows/editor-regression.yml`
  - 配置 push/pull_request/workflow_dispatch 触发条件
  - 将 `scripts/editor-regression.sh` 作为 CI 执行入口
  - 本地复跑回归脚本确认通过
- Files created/modified:
  - `.github/workflows/editor-regression.yml` (created)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 16: Sprint 4 checkpoint（CI 增量）
- **Status:** complete
- Actions taken:
  - 完成 CI 门禁接入与文档同步
  - 创建 checkpoint commit：`9a2e032`（editor regression CI gate）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `.github/workflows/editor-regression.yml` (created)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 17: Sprint 4 文档收口（CI post-push）
- **Status:** complete
- Actions taken:
  - 同步阶段状态到“CI 增量已推送”
  - 创建 docs-only commit：`558bbb8`（同步 CI checkpoint 状态）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `progress.md` (updated)

### Phase 18: Sprint 4 诊断脱敏导出
- **Status:** complete
- Actions taken:
  - Dashboard 增加完整/脱敏双按钮下载
  - `app.js` 增加诊断脱敏转换逻辑（隐藏项目名/文件名）
  - 优化按钮布局样式（`actions-row` gap/wrap）
  - 本地执行回归脚本并通过
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `reading-garden-editor/editor/css/editor.css` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 19: Sprint 4 checkpoint（脱敏导出增量）
- **Status:** complete
- Actions taken:
  - 完成功能与文档同步
  - 创建 checkpoint commit：`c85e610`（诊断脱敏导出）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `reading-garden-editor/editor/css/editor.css` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 20: Sprint 4 文档收口（脱敏 post-push）
- **Status:** complete
- Actions taken:
  - 同步阶段状态到“脱敏导出增量已推送”
  - 创建 docs-only commit：`c3a6453`（同步脱敏导出 checkpoint 状态）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `progress.md` (updated)

### Phase 21: Sprint 4 subset 最小资源集
- **Status:** complete
- Actions taken:
  - `site-pack-service.js` 增加 `subsetAssetMode`（`balanced`/`minimal`）
  - minimal 模式增加文本资产引用扫描（`assets/...`）并仅打包可解析引用资源
  - 导出 manifest 增加 `subsetAssetMode` 字段
  - `dashboard.js` 增加 subset 资源策略选择器
  - `app.js` 透传 `subsetAssetMode` 并在反馈文案展示
  - 回归脚本增加 `subsetAssetMode` 关键标记断言
  - 本地回归脚本复跑通过
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/packaging/site-pack-service.js` (updated)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 22: Sprint 4 checkpoint（minimal 增量）
- **Status:** complete
- Actions taken:
  - 完成功能、回归与文档同步
  - 创建 checkpoint commit：`0b9a87c`（subset minimal 资源模式）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `reading-garden-editor/editor/js/packaging/site-pack-service.js` (updated)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 23: Sprint 4 文档收口（minimal post-push）
- **Status:** complete
- Actions taken:
  - 同步阶段状态到“minimal 增量已推送”
  - 创建 docs-only commit：`6f12297`（同步 minimal checkpoint 状态）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `progress.md` (updated)

### Phase 24: Sprint 4 回归报告与 CI artifacts
- **Status:** complete
- Actions taken:
  - `editor-regression.mjs` 增加结构化报告输出
  - `editor-regression.sh` 支持 `EDITOR_REGRESSION_REPORT` 路径参数
  - 新增 `.gitignore` 规则忽略本地报告文件
  - `editor-regression.yml` 增加 `upload-artifact`（always）
  - 本地执行回归并验证报告文件生成
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `scripts/editor-regression.mjs` (updated)
  - `scripts/editor-regression.sh` (updated)
  - `.github/workflows/editor-regression.yml` (updated)
  - `.gitignore` (created)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 25: Sprint 4 checkpoint（CI artifacts 增量）
- **Status:** complete
- Actions taken:
  - 完成功能、回归与文档同步
  - 创建 checkpoint commit：`feb4939`（回归报告 + CI artifacts）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `.github/workflows/editor-regression.yml` (updated)
  - `.gitignore` (created)
  - `scripts/editor-regression.mjs` (updated)
  - `scripts/editor-regression.sh` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 26: Sprint 4 文档收口（CI artifacts post-push）
- **Status:** complete
- Actions taken:
  - 同步阶段状态到“CI artifacts 增量已推送”
  - 创建 docs-only commit：`52af4f8`（同步 CI artifacts checkpoint 状态）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `progress.md` (updated)

### Phase 27: Sprint 4 minimal 缺失资源提示
- **Status:** complete
- Actions taken:
  - `site-pack-service.js` 在 subset 导出中增加 `missingAssets` 收集
  - manifest 增加 `missingAssets` 字段
  - `app.js` 导出成功提示增加 `missingAssets` 计数
  - 回归脚本增加 `missingAssets` 关键标记断言
  - 本地回归脚本复跑通过
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/packaging/site-pack-service.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 28: Sprint 4 checkpoint（missingAssets 增量）
- **Status:** complete
- Actions taken:
  - 完成功能、回归与文档同步
  - 创建 checkpoint commit：`35859e0`（minimal 缺失资源提示）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `reading-garden-editor/editor/js/packaging/site-pack-service.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 29: Sprint 4 文档收口（missingAssets post-push）
- **Status:** complete
- Actions taken:
  - 同步阶段状态到“missingAssets 增量已推送”
  - 创建 docs-only commit：`3a30827`（同步 missingAssets checkpoint 状态）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `progress.md` (updated)

### Phase 30: Sprint 4 自定义脱敏字段
- **Status:** complete
- Actions taken:
  - `dashboard.js` 新增 custom 字段输入与 `Download Custom` 按钮
  - `app.js` 新增按路径脱敏逻辑（如 `project.name,input.fileName`）
  - 回归脚本增加 custom 诊断能力关键标记断言
  - 本地回归脚本复跑通过
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `reading-garden-editor/editor/css/editor.css` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 31: Sprint 4 checkpoint（custom redaction 增量）
- **Status:** complete
- Actions taken:
  - 完成功能、回归与文档同步
  - 创建 checkpoint commit：`8abdcbf`（自定义脱敏字段）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `reading-garden-editor/editor/css/editor.css` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 32: Sprint 4 文档收口（custom post-push）
- **Status:** complete
- Actions taken:
  - 同步阶段状态到“custom redaction 增量已推送”
  - 创建 docs-only commit：`4b2b33e`（同步 custom checkpoint 状态）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `progress.md` (updated)

### Phase 33: Sprint 4 缺失资源清单文件
- **Status:** complete
- Actions taken:
  - `site-pack-service.js` 增加 `MISSING-ASSETS.txt` 生成
  - `app.js` 导出反馈增加“含 MISSING-ASSETS.txt”提示
  - 回归脚本增加 `MISSING-ASSETS.txt` 关键标记断言
  - 本地回归脚本复跑通过
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/packaging/site-pack-service.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 34: Sprint 4 checkpoint（missing-assets report 增量）
- **Status:** complete
- Actions taken:
  - 完成功能、回归与文档同步
  - 创建 checkpoint commit：`acc47e3`（missing-assets report file）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `reading-garden-editor/editor/js/packaging/site-pack-service.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 35: Sprint 4 最近模板复用
- **Status:** complete
- Actions taken:
  - `dashboard.js` 增加自定义脱敏字段最近模板持久化（localStorage）
  - 增加最近模板下拉回填与输入归一化
  - 回归脚本增加最近模板能力关键标记断言
  - 本地回归脚本复跑通过
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 36: Sprint 4 checkpoint（recent-template 增量）
- **Status:** complete
- Actions taken:
  - 完成功能、回归与文档同步
  - 创建 checkpoint commit：`5719322`（recent redaction templates）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 37: Sprint 4 回归包体统计
- **Status:** complete
- Actions taken:
  - `editor-regression.mjs` 增加 `pack-size-stats` 检查
  - 生成 `packStats`（full/subset-balanced/subset-minimal）并写入回归报告
  - 回归中增加体积合理性断言（minimal <= balanced）
  - 本地回归脚本复跑通过并验证报告内容
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 38: Sprint 4 checkpoint（pack-stats 增量）
- **Status:** complete
- Actions taken:
  - 完成功能、回归与文档同步
  - 创建 checkpoint commit：`fe22d95`（pack size stats in regression report）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 39: Sprint 4 最近模板清空能力
- **Status:** complete
- Actions taken:
  - `dashboard.js` 增加最近模板一键清空按钮
  - 增加清空后的默认字段回填与空模板状态处理
  - `app.js` 增加清空结果反馈（清空 N 条/已为空）
  - 回归脚本增加 clear-template 能力关键标记断言
  - 本地回归脚本复跑通过
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 40: Sprint 4 checkpoint（template-clear 增量）
- **Status:** complete
- Actions taken:
  - 完成功能、回归与文档同步
  - 创建 checkpoint commit：`9453519`（clear action for recent templates）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 41: Sprint 4 缺失资源分组
- **Status:** complete
- Actions taken:
  - `site-pack-service.js` 为缺失资源增加来源追踪并分组
  - `MISSING-ASSETS.txt` 增加分组区块（Groups）与平铺清单
  - manifest/result 增加 `missingAssetsByGroup`
  - `app.js` 导出反馈增加缺失分组数量
  - 回归脚本增加分组能力关键标记断言
  - 本地回归脚本复跑通过
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/packaging/site-pack-service.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 42: Sprint 4 checkpoint（missing-group 增量）
- **Status:** complete
- Actions taken:
  - 完成功能、回归与文档同步
  - 创建 checkpoint commit：`f451398`（missing assets grouped by source）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `reading-garden-editor/editor/js/packaging/site-pack-service.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 43: Sprint 4 packStats 样本可配置
- **Status:** complete
- Actions taken:
  - `editor-regression.mjs` 支持 `EDITOR_PACK_STATS_SELECTED_BOOKS` 覆盖 subset 抽样
  - 回归报告新增 `selection` 元数据（mode/requested/missing）
  - 保持默认“前 2 本书”自动抽样策略
  - 本地执行默认模式与 env 模式回归均通过
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 44: Sprint 4 checkpoint（pack-sample-config 增量）
- **Status:** complete
- Actions taken:
  - 完成功能、回归与文档同步
  - 创建 checkpoint commit：`522984d`（packStats sample books via env）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 45: Sprint 4 CI 固定 packStats 抽样
- **Status:** complete
- Actions taken:
  - `.github/workflows/editor-regression.yml` 固定 `EDITOR_PACK_STATS_SELECTED_BOOKS=totto-chan,wave`
  - 本地按相同 env 执行回归脚本并验证通过
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `.github/workflows/editor-regression.yml` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 46: Sprint 4 checkpoint（ci-pack-sample 增量）
- **Status:** complete
- Actions taken:
  - 完成功能、回归与文档同步
  - 创建 checkpoint commit：`842da3b`（fix packStats sample in workflow）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `.github/workflows/editor-regression.yml` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 47: Sprint 4 workflow_dispatch 抽样覆盖
- **Status:** complete
- Actions taken:
  - workflow 增加 `pack_stats_selected_books` 输入
  - 回归步骤环境变量按事件类型切换（dispatch 可覆盖，PR/Push 保持固定值）
  - 本地回归脚本复跑通过
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `.github/workflows/editor-regression.yml` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 48: Sprint 4 checkpoint（dispatch-pack-sample 增量）
- **Status:** complete
- Actions taken:
  - 完成功能、回归与文档同步
  - 创建 checkpoint commit：`6bf053d`（workflow_dispatch override for packStats）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `.github/workflows/editor-regression.yml` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 49: Sprint 4 CI packStats 摘要
- **Status:** complete
- Actions taken:
  - workflow 增加 `Summarize packStats` 步骤
  - Job Summary 输出抽样模式、书籍、missing IDs 与体积关键指标
  - 本地模拟 `GITHUB_STEP_SUMMARY` 生成并校验摘要内容
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `.github/workflows/editor-regression.yml` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 50: Sprint 4 checkpoint（ci-pack-summary 增量）
- **Status:** complete
- Actions taken:
  - 完成功能、回归与文档同步
  - 创建 checkpoint commit：`aacb621`（packStats summary in workflow）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `.github/workflows/editor-regression.yml` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 51: Sprint 4 严格抽样失败策略
- **Status:** complete
- Actions taken:
  - `editor-regression.mjs` 增加 `EDITOR_PACK_STATS_REQUIRE_VALID_SELECTION` 开关
  - 严格模式下检测到无效抽样 ID 时直接失败
  - 回归新增 `pack-size-strict-selection` 检查
  - workflow 默认开启严格抽样校验
  - summary 增加 `require valid selection` 字段
  - 本地验证严格失败与严格通过两种路径
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `scripts/editor-regression.mjs` (updated)
  - `.github/workflows/editor-regression.yml` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 52: Sprint 4 checkpoint（strict-pack-selection 增量）
- **Status:** complete
- Actions taken:
  - 完成功能、回归与文档同步
  - 创建 checkpoint commit：`4ff2f16`（strict validation for packStats sample ids）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `.github/workflows/editor-regression.yml` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 53: Sprint 4 模板导入导出
- **Status:** complete
- Actions taken:
  - `dashboard.js` 增加模板导入/导出按钮与文件选择
  - 新增模板 JSON 导入解析、去重、归一化与覆盖写入
  - `app.js` 增加导入/导出结果反馈
  - 回归脚本增加模板导入/导出能力关键标记断言
  - 本地回归脚本复跑通过
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 54: Sprint 4 checkpoint（template-import-export 增量）
- **Status:** complete
- Actions taken:
  - 完成功能、回归与文档同步
  - 创建 checkpoint commit：`7ebd5d7`（import/export redaction templates）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 55: Sprint 4 缺失资源固定分类
- **Status:** complete
- Actions taken:
  - `site-pack-service.js` 增加 `missingAssetsByCategory`（4 类固定枚举）
  - `MISSING-ASSETS.txt` 增加 `Category Summary` 区块
  - manifest/result 增加 `missingAssetsByCategory`
  - `app.js` 导出反馈增加分类数量（categories）
  - 回归脚本增加分类能力关键标记断言
  - 本地回归脚本复跑通过
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/packaging/site-pack-service.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 56: Sprint 4 checkpoint（missing-category 增量）
- **Status:** complete
- Actions taken:
  - 完成功能、回归与文档同步
  - 创建 checkpoint commit：`b50e72e`（categorized missing-asset summaries）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `reading-garden-editor/editor/js/packaging/site-pack-service.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 57: Sprint 4 模板导入模式
- **Status:** complete
- Actions taken:
  - `dashboard.js` 模板导入新增 `replace/merge` 模式选择
  - 导入逻辑支持覆盖或合并去重
  - `app.js` 导入反馈显示 `mode`
  - 回归脚本增加导入模式能力关键标记断言
  - 本地回归脚本复跑通过
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 58: Sprint 4 checkpoint（template-import-mode 增量）
- **Status:** complete
- Actions taken:
  - 完成功能、回归与文档同步
  - 创建 checkpoint commit：`b4654b8`（merge mode for template imports）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 59: Sprint 4 dispatch 严格开关
- **Status:** complete
- Actions taken:
  - workflow_dispatch 增加 `pack_stats_require_valid_selection` 输入
  - 回归执行环境按输入切换严格校验，默认 true
  - 本地回归脚本复跑通过
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `.github/workflows/editor-regression.yml` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 60: Sprint 4 checkpoint（dispatch-strict-toggle 增量）
- **Status:** complete
- Actions taken:
  - 完成功能、回归与文档同步
  - 创建 checkpoint commit：`0d3659c`（strict-validation toggle for workflow_dispatch）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `.github/workflows/editor-regression.yml` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 61: Sprint 4 抽样格式校验
- **Status:** complete
- Actions taken:
  - `editor-regression.mjs` 增加抽样 ID 格式校验（`a-z0-9-`）
  - 严格模式下非法格式 ID 直接失败
  - 回归新增 `pack-size-strict-format` 检查
  - workflow summary 增加 `invalid format IDs` 字段
  - 本地验证失败路径与常规回归路径
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `scripts/editor-regression.mjs` (updated)
  - `.github/workflows/editor-regression.yml` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 62: Sprint 4 checkpoint（strict-format-validation 增量）
- **Status:** complete
- Actions taken:
  - 完成功能、回归与文档同步
  - 创建 checkpoint commit：`17baf5a`（validate packStats sample id format）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `.github/workflows/editor-regression.yml` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 63: Sprint 4 summary missing-assets 告警
- **Status:** complete
- Actions taken:
  - workflow summary 增加 `missing assets (subset-minimal)` 告警字段
  - 本地模拟 summary 输出并校验 warning/ok 标识
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `.github/workflows/editor-regression.yml` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 64: Sprint 4 checkpoint（summary-missing-alert 增量）
- **Status:** complete
- Actions taken:
  - 完成功能、回归与文档同步
  - 创建 checkpoint commit：`232ac37`（missing-assets alert indicator）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `.github/workflows/editor-regression.yml` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 65: Sprint 4 missing-assets 阈值策略
- **Status:** complete
- Actions taken:
  - `editor-regression.mjs` 增加 `EDITOR_PACK_STATS_MAX_MISSING_ASSETS`
  - 支持阈值解析与超阈值失败
  - workflow_dispatch 增加 `pack_stats_max_missing_assets` 输入
  - workflow summary 增加阈值显示
  - 本地验证阈值通过（1）与失败（0）路径
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `scripts/editor-regression.mjs` (updated)
  - `.github/workflows/editor-regression.yml` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 66: Sprint 4 checkpoint（missing-assets-threshold 增量）
- **Status:** complete
- Actions taken:
  - 完成功能、回归与文档同步
  - 创建 checkpoint commit：`6224b54`（missing-assets threshold for packStats）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `.github/workflows/editor-regression.yml` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 67: Sprint 4 summary 分类统计
- **Status:** complete
- Actions taken:
  - `editor-regression.mjs` 的 packStats 增加 `missingAssetsByCategory`
  - workflow summary 输出 `missing assets by category`
  - 本地模拟 summary 输出并校验分类字段
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `scripts/editor-regression.mjs` (updated)
  - `.github/workflows/editor-regression.yml` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 68: Sprint 4 checkpoint（summary-category 增量）
- **Status:** complete
- Actions taken:
  - 完成功能、回归与文档同步
  - 创建 checkpoint commit：`9158d48`（summary category stats）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `.github/workflows/editor-regression.yml` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 69: Sprint 4 分类阈值（book-module）
- **Status:** complete
- Actions taken:
  - `editor-regression.mjs` 增加 `EDITOR_PACK_STATS_MAX_MISSING_BOOK_MODULE`
  - 严格校验 `missingAssetsByCategory.book-module` 超阈值失败
  - workflow_dispatch 增加 `pack_stats_max_missing_book_module` 输入
  - workflow summary 增加模块阈值与模块缺失告警字段
  - 本地回归脚本复跑通过
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `scripts/editor-regression.mjs` (updated)
  - `.github/workflows/editor-regression.yml` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 70: Sprint 4 checkpoint（category-threshold 增量）
- **Status:** complete
- Actions taken:
  - 完成功能、回归与文档同步
  - 创建 checkpoint commit：`a2a7f22`（book-module category threshold）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `.github/workflows/editor-regression.yml` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 71: Sprint 4 分类阈值扩展（book-cover/file-ref）
- **Status:** complete
- Actions taken:
  - `editor-regression.mjs` 将分类阈值读取改为映射驱动（module/cover/file-ref）
  - 新增 `EDITOR_PACK_STATS_MAX_MISSING_BOOK_COVER` / `EDITOR_PACK_STATS_MAX_MISSING_FILE_REF`
  - workflow_dispatch 增加对应输入，并向回归步骤注入环境变量
  - workflow summary 增加 cover/file-ref 阈值与缺失告警输出
  - 回归测试增加分类阈值解析与 env-name 错误提示校验
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `scripts/editor-regression.mjs` (updated)
  - `.github/workflows/editor-regression.yml` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 72: Sprint 4 checkpoint（category-threshold-extension 增量）
- **Status:** complete
- Actions taken:
  - 完成功能、回归与文档同步
  - 创建 checkpoint commit：`9058724`（cover/file-ref category thresholds）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `scripts/editor-regression.mjs` (updated)
  - `.github/workflows/editor-regression.yml` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 73: Sprint 4 模板导入预览差异
- **Status:** complete
- Actions taken:
  - `dashboard.js` 增加模板导入“Preview Import”按钮与文件选择流程
  - 抽象模板导入计划逻辑，预览与实际导入共用同一差异计算
  - 预览结果输出当前/导入/结果数量与新增/移除/保留统计
  - 导入反馈补充差异统计与截断提示
  - 回归脚本增加 preview 功能标记断言
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 74: Sprint 4 checkpoint（template-preview-diff 增量）
- **Status:** complete
- Actions taken:
  - 完成功能、回归与文档同步
  - 创建 checkpoint commit：`fb67d03`（template import preview diff）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 75: Sprint 4 分类阈值扩展（unclassified）
- **Status:** complete
- Actions taken:
  - `editor-regression.mjs` 增加 `EDITOR_PACK_STATS_MAX_MISSING_UNCLASSIFIED`
  - 分类阈值映射扩展到 `unclassified`
  - workflow_dispatch 增加 `pack_stats_max_missing_unclassified` 输入
  - workflow summary 增加 unclassified 阈值与缺失告警输出
  - 本地回归脚本复跑通过（含 `EDITOR_PACK_STATS_MAX_MISSING_UNCLASSIFIED=0`）
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `scripts/editor-regression.mjs` (updated)
  - `.github/workflows/editor-regression.yml` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 76: Sprint 4 checkpoint（unclassified-threshold 增量）
- **Status:** complete
- Actions taken:
  - 完成功能、回归与文档同步
  - 创建 checkpoint commit：`38e247f`（unclassified threshold）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `scripts/editor-regression.mjs` (updated)
  - `.github/workflows/editor-regression.yml` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 77: Sprint 4 缺失资源回退（svg-placeholder）
- **Status:** complete
- Actions taken:
  - `site-pack-service.js` 新增缺失资源回退策略：`report-only` / `svg-placeholder`
  - `svg-placeholder` 会为缺失的 `.svg` 资源生成占位文件并打入发布包
  - manifest/result 增加 `missingAssetFallback` 相关字段
  - `MISSING-ASSETS.txt` 增加 fallback 摘要区块
  - Dashboard 导出表单增加“缺失资源回退”选项，app 导出反馈增加 fallback 信息
  - 回归脚本增加 fallback 能力关键标记断言
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/packaging/site-pack-service.js` (updated)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 78: Sprint 4 checkpoint（svg-fallback 增量）
- **Status:** complete
- Actions taken:
  - 完成功能、回归与文档同步
  - 创建 checkpoint commit：`11c5d57`（svg placeholder fallback）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `reading-garden-editor/editor/js/packaging/site-pack-service.js` (updated)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 79: Sprint 4 预览示例明细
- **Status:** complete
- Actions taken:
  - `dashboard.js` 模板预览结果增加 `addedTemplates/removedTemplates`
  - `app.js` 预览与导入反馈增加示例明细（最多 2 条）
  - 回归脚本增加预览明细关键标记断言
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 80: Sprint 4 checkpoint（preview-detail 增量）
- **Status:** complete
- Actions taken:
  - 完成功能、回归与文档同步
  - 创建 checkpoint commit：`8e32f81`（template preview detail examples）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 81: Sprint 4 分类阈值预设（custom/balanced/strict）
- **Status:** complete
- Actions taken:
  - `editor-regression.mjs` 增加 `EDITOR_PACK_STATS_CATEGORY_THRESHOLD_PRESET`
  - 分类阈值支持 `custom/balanced/strict` 预设并保留 env 覆盖优先级
  - workflow_dispatch 增加 `pack_stats_category_threshold_preset` 输入
  - workflow summary 增加 `category threshold preset` 字段
  - 本地验证 strict 预设失败路径与默认路径通过
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `scripts/editor-regression.mjs` (updated)
  - `.github/workflows/editor-regression.yml` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 82: Sprint 4 checkpoint（category-threshold-preset 增量）
- **Status:** complete
- Actions taken:
  - 完成功能、回归与文档同步
  - 创建 checkpoint commit：`ae4ac7a`（category threshold presets）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `scripts/editor-regression.mjs` (updated)
  - `.github/workflows/editor-regression.yml` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 83: Sprint 4 missing-assets 按模式阈值
- **Status:** complete
- Actions taken:
  - `editor-regression.mjs` 增加 `EDITOR_PACK_STATS_MAX_MISSING_ASSETS_SUBSET_BALANCED` / `..._SUBSET_MINIMAL`
  - 回归报告新增 `missingAssetsThresholdsByMode`
  - workflow_dispatch 增加按模式阈值输入
  - workflow summary 增加 balanced/minimal 阈值展示
  - 本地验证 minimal 独立阈值失败路径与默认路径通过
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `scripts/editor-regression.mjs` (updated)
  - `.github/workflows/editor-regression.yml` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 84: Sprint 4 checkpoint（mode-threshold 增量）
- **Status:** complete
- Actions taken:
  - 完成功能、回归与文档同步
  - 创建 checkpoint commit：`d08d940`（mode-specific thresholds）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `scripts/editor-regression.mjs` (updated)
  - `.github/workflows/editor-regression.yml` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 85: Sprint 4 本地 AI 配置面板
- **Status:** complete
- Actions taken:
  - `dashboard.js` 增加 AI 配置面板（LLM/图片接口 + 分析/图片模式）
  - `app.js` 增加 AI 配置本地保存/加载流程
  - 新增本地配置文件路径：`reading-garden-editor/config/ai-settings.json`
  - `state.js` 增加 `aiSettings` / `aiFeedback` 状态
  - 回归脚本增加 AI 配置能力关键标记断言
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/core/state.js` (updated)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 86: Sprint 4 checkpoint（ai-settings-foundation 增量）
- **Status:** complete
- Actions taken:
  - 完成功能、回归与文档同步
  - 创建 checkpoint commit：`b3dbb57`（ai settings foundation）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `reading-garden-editor/editor/js/core/state.js` (updated)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 87: Sprint 4 AI 配置导入导出
- **Status:** complete
- Actions taken:
  - `dashboard.js` 增加 AI 配置导入/导出按钮与文件选择事件
  - `app.js` 增加 `exportAiSettingsFlow/importAiSettingsFlow`
  - 导入配置支持落盘到 `reading-garden-editor/config/ai-settings.json`
  - 回归脚本增加 AI 配置导入导出关键标记断言
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 88: Sprint 4 checkpoint（ai-settings-transfer 增量）
- **Status:** complete
- Actions taken:
  - 完成功能、回归与文档同步
  - 创建 checkpoint commit：`972da52`（ai settings import/export）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 89: Sprint 4 原文分析助手（LLM 可选）
- **Status:** complete
- Actions taken:
  - 新增 `analysis-assistant.js`：支持 LLM 建议 + 本地启发式回退
  - `dashboard.js` 增加文本分析表单与建议下载入口
  - `app.js` 增加分析执行与建议报告导出流程
  - `state.js` 增加 `analysisFeedback` / `analysisSuggestion` 状态
  - 回归脚本增加分析助手关键标记断言
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/core/analysis-assistant.js` (created)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `reading-garden-editor/editor/js/core/state.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 90: Sprint 4 checkpoint（analysis-assistant 增量）
- **Status:** complete
- Actions taken:
  - 完成功能、回归与文档同步
  - 创建 checkpoint commit：`45364db`（analysis suggestion safe apply）
  - 推送到远端 `origin/master`
- Files created/modified:
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 91: Sprint 4 分析建议覆盖应用（自动备份）
- **Status:** complete
- Actions taken:
  - `dashboard.js` 增加 `analysisApplyMode`（safe/overwrite）选择
  - `app.js` 扩展 `applyAnalysisSuggestionFlow`：支持覆盖写入 `registry.json`
  - 覆盖模式默认触发 `fs.writeJson` 备份，并在反馈中返回 `backupPath`
  - 回归脚本增加覆盖模式与备份路径关键标记断言
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 92: Sprint 4 覆盖应用自动补齐模块数据
- **Status:** complete
- Actions taken:
  - `app.js` 新增 `buildSuggestedModuleDataSeed/ensureSuggestedModuleDataFiles`
  - 覆盖应用时自动创建新增模块缺失的 data 文件（reading/characters/themes/timeline/interactive）
  - `dashboard.js` 同步补充覆盖模式说明文案
  - 回归脚本增加“补齐数据模板”关键标记断言
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 93: Sprint 4 新建书图片策略基础落地
- **Status:** complete
- Actions taken:
  - `book-template.js` 增加 `imageMode` 处理：`emoji`/`none`/`prompt-file`/`api`
  - 新建书封面支持 `cover-emoji.svg` 与 `cover-none.svg`
  - 新建书在 `prompt-file/api` 模式下自动生成 `data/<bookId>/prompts/image-prompts.md`
  - `dashboard.js` 新建书面板显示当前图片策略
  - 回归脚本增加图片策略关键标记断言
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/core/book-template.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 94: Sprint 4 分析建议自动建书闭环
- **Status:** complete
- Actions taken:
  - `app.js` 新增 `buildAutoCreateBookInputFromSuggestion`
  - `applyAnalysisSuggestionFlow` 在未选目标书籍时自动触发 `createBookFlow`
  - 自动建书后继续执行 safe/overwrite 应用路径并反馈自动创建信息
  - `dashboard.js` 更新目标书籍默认选项说明
  - 回归脚本增加自动建书关键标记断言
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 95: Sprint 4 覆盖应用显式确认
- **Status:** complete
- Actions taken:
  - `dashboard.js` 分析面板新增 `confirmOverwriteAnalysis` 确认项
  - `app.js` 在 `overwrite` 模式下强制校验 `confirmOverwrite`
  - 未确认时阻断写入并给出可读错误反馈
  - 回归脚本增加覆盖确认关键标记断言
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 96: Sprint 4 Live Preview 设备切换与刷新
- **Status:** complete
- Actions taken:
  - `state.js` 增加 preview 状态字段（book/device/url/refreshToken）
  - `app.js` 新增预览 URL 生成、预览状态切换与手动刷新流程
  - 项目加载/刷新书架时自动同步预览默认书籍
  - `dashboard.js` 新增 Live Preview 面板（预览书籍、设备视口、刷新、新标签打开）
  - `editor.css` 新增 desktop/tablet/mobile 预览样式
  - 回归脚本增加 preview 关键标记断言（app/dashboard/state/css）
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/core/state.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `reading-garden-editor/editor/css/editor.css` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 97: Sprint 4 Live Preview 自动刷新开关
- **Status:** complete
- Actions taken:
  - `state.js` 增加 `previewAutoRefresh` 状态
  - `dashboard.js` 预览面板新增“写入后自动刷新预览”开关
  - `app.js` 新增 `touchPreviewAfterWrite`，在建书/导入/覆盖写入后按需刷新
  - 回归脚本增加自动刷新关键标记断言
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/core/state.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 98: Sprint 4 路径级校验提示增强
- **Status:** complete
- Actions taken:
  - `validator.js` 新增路径级错误格式（path + reason + suggestion）
  - `validateBooksData` 增加结构化路径提示与页面参数校验
  - 新增 `validateRegistryData`（book/modules 基础结构、重复 ID、entry/data 格式）
  - `app.js` 在书籍健康检查中接入 `validateRegistryData`
  - 回归脚本增加 validator 关键标记断言
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/core/validator.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 99: Sprint 4 rgbook manual 冲突预检查
- **Status:** complete
- Actions taken:
  - `dashboard.js` 导入策略新增 `manual (preview plan only)`
  - `app.js` 在 `strategy=manual` 时执行包检查与冲突计划分析，不写盘
  - 冲突时输出推荐 rename 目标 ID，便于用户二次选择导入策略
  - 回归脚本增加 manual 策略关键标记断言
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 100: Sprint 4 IndexedDB 会话快照恢复
- **Status:** complete
- Actions taken:
  - 新增 `core/recovery-store.js`（IndexedDB latest 快照存取）
  - `app.js` 增加 500ms 防抖 + 30s 周期快照保存
  - 项目打开成功后按 `projectName` 自动恢复会话快照
  - 恢复内容包含预览偏好与最近分析建议
  - 回归脚本增加 recovery-store 与 app 接入关键标记断言
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/core/recovery-store.js` (created)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 101: Sprint 4 会话快照手动清理入口
- **Status:** complete
- Actions taken:
  - `recovery-store.js` 增加 `clearLatest`
  - `app.js` 增加 `clearRecoverySnapshotFlow` 并接入渲染 handlers
  - 清理后短暂抑制自动快照，避免“清理后立即回写”
  - `dashboard.js` 预览面板增加 “Clear Recovery Snapshot” 按钮与反馈显示
  - 回归脚本增加 clear snapshot 关键标记断言
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/core/recovery-store.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `reading-garden-editor/editor/js/core/state.js` (updated)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 102: Sprint 4 会话快照按项目优先恢复
- **Status:** complete
- Actions taken:
  - `recovery-store.js` 新增 `loadByProject/clearByProject`
  - `saveLatest` 同步写入 `project:<name>` 快照键
  - `app.js` 恢复逻辑改为“先按项目恢复，再 fallback latest”
  - 清理逻辑改为优先清理当前项目键并兼容清理 latest
  - 回归脚本增加 project-scoped recovery 关键标记断言
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/core/recovery-store.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 103: Sprint 4 新建书模板扩展（timeline/interactive）
- **Status:** complete
- Actions taken:
  - `book-template.js` 新增 `includeTimeline/includeInteractive` 模板分支
  - 新建书流程支持写入 `timeline.json` / `scenarios.json`
  - 分析自动建书支持将 timeline/interactive 建议映射到创建输入
  - `dashboard.js` 新建书表单新增 timeline/interactive 复选项
  - 回归脚本增加新模板选项关键标记断言
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/core/book-template.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 104: Sprint 4 manual 预检查一键推荐导入
- **Status:** complete
- Actions taken:
  - `state.js` 增加 `packManualPlan` 状态
  - `importPackFlow(strategy=manual)` 保存推荐策略与目标 ID
  - `app.js` 新增 `applyManualMergeSuggestionFlow` 复用预检查结果执行导入
  - `dashboard.js` 新增 Manual Merge Preview 区块与 Apply Recommended 按钮
  - 回归脚本增加 manual 推荐导入关键标记断言
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/core/state.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 105: Sprint 4 Validation 报告下载
- **Status:** complete
- Actions taken:
  - `state.js` 增加 `validationFeedback`
  - `app.js` 新增 `buildValidationReport/downloadValidationReportFlow`
  - `dashboard.js` Validation Issues 面板新增下载按钮与反馈
  - 回归脚本增加 validation report 关键标记断言
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/core/state.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 106: Sprint 4 会话快照历史恢复（最近 5 条）
- **Status:** complete
- Actions taken:
  - `recovery-store.js` 新增项目级历史键空间（`project-history:<name>`）与 `loadProjectHistory`
  - `saveLatest` 扩展为同步写入最近 5 条历史快照（按 `savedAt` 去重）
  - `app.js` 在项目恢复时加载 `recoveryHistory`，并新增 `restoreRecoveryHistorySnapshotFlow`
  - `dashboard.js` Preview 面板新增历史快照下拉与 `Restore Selected Snapshot` 按钮
  - `state.js` 新增 `recoveryHistory` 状态
  - 回归脚本新增历史恢复相关标记断言，并通过 `./scripts/editor-regression.sh`
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/core/state.js` (updated)
  - `reading-garden-editor/editor/js/core/recovery-store.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 107: Sprint 4 新建书模板级别（minimal/standard/teaching/custom）
- **Status:** complete
- Actions taken:
  - `dashboard.js` 新建书表单新增模板级别下拉（`minimal/standard/teaching/custom`）
  - 选择预设时自动套用模块勾选；手动调整模块时自动切回 `custom`
  - `app.js` 新增模板级别解析与统一归一化（`resolveCreateBookModuleIncludes`）
  - 新建成功反馈增加模板级别提示，便于回溯本次建书配置
  - `validator.js` 增加模板级别合法性校验
  - 回归脚本补充模板级别相关标记断言，并通过 `./scripts/editor-regression.sh`
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `reading-garden-editor/editor/js/core/validator.js` (updated)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 108: Sprint 4 会话快照删除选中历史
- **Status:** complete
- Actions taken:
  - `recovery-store.js` 新增 `removeProjectHistorySnapshot`（删除指定 `savedAt`）
  - 删除时同步维护 `project:<name>` 与 `latest` 指针，避免历史游离快照
  - `app.js` 新增 `removeRecoveryHistorySnapshotFlow` 并接入渲染 handlers
  - `dashboard.js` Preview 面板新增 `Delete Selected Snapshot` 操作按钮
  - 回归脚本增加“删除历史快照”相关标记断言，并通过 `./scripts/editor-regression.sh`
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/core/recovery-store.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 109: Sprint 4 会话快照自动清理（30 天）
- **Status:** complete
- Actions taken:
  - `recovery-store.js` 新增历史清理规则：默认仅保留最近 30 天快照
  - 新增 `pruneRecoveryHistory` 与 `sameHistoryOrder`，统一处理去重/排序/过期过滤
  - `loadProjectHistory` 自动落库清理结果，避免脏历史重复加载
  - `saveLatest`/`removeProjectHistorySnapshot` 接入统一清理逻辑，维持历史窗口稳定
  - 回归脚本增加历史过期清理相关标记断言，并通过 `./scripts/editor-regression.sh`
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/core/recovery-store.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 110: Sprint 4 会话快照清理阈值可配置
- **Status:** complete
- Actions taken:
  - `recovery-store.js` 新增 `setHistoryPolicy/getHistoryPolicy`，支持运行时更新历史清理策略
  - `app.js` 新增清理阈值策略读写（localStorage）与更新流程（`updateRecoveryHistoryPolicyFlow`）
  - `dashboard.js` Preview 面板新增“快照自动清理”下拉（关闭/7/30/90/180 天）
  - 阈值修改后即时生效，并自动刷新当前项目历史快照列表
  - `state.js` 新增 `recoveryHistoryMaxAgeDays` 状态
  - 回归脚本补充策略配置相关标记断言，并通过 `./scripts/editor-regression.sh`
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/core/recovery-store.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `reading-garden-editor/editor/js/core/state.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 111: Sprint 4 会话快照阈值按项目独立配置
- **Status:** complete
- Actions taken:
  - `app.js` 将阈值存储升级为 `defaultMaxAgeDays + projects` 结构（兼容旧 `maxAgeDays`）
  - 项目打开时按 `projectName` 读取并应用项目级阈值，未命中则回退全局默认
  - 阈值更新流程改为“当前项目优先写入项目配置”，并保留全局默认路径
  - `boot` 阶段加载全局默认策略，确保未打开项目时行为稳定
  - 回归脚本增加项目级策略关键标记断言，并通过 `./scripts/editor-regression.sh`
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 112: Sprint 4 项目快照策略一键回退全局默认
- **Status:** complete
- Actions taken:
  - `app.js` 新增 `clearProjectRecoveryHistoryPolicyInStorage` 与 `resetRecoveryHistoryPolicyFlow`
  - 支持当前项目一键移除覆盖策略，并立即回退全局默认阈值
  - `dashboard.js` Preview 面板新增 `Use Global Default` 操作按钮
  - 回归脚本新增策略回退相关标记断言，并通过 `./scripts/editor-regression.sh`
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 113: Sprint 4 会话快照策略来源可见化
- **Status:** complete
- Actions taken:
  - `state.js` 新增 `recoveryHistoryPolicyScope`（`project/global`）
  - `app.js` 增加策略来源解析逻辑，并在 boot / open / update / reset 流程同步写入状态
  - `dashboard.js` 快照策略下拉新增“当前来源：项目覆盖/全局默认”提示
  - 回归脚本新增策略来源相关标记断言，并通过 `./scripts/editor-regression.sh`
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/core/state.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 114: Sprint 4 新建书自定义模板预设
- **Status:** complete
- Actions taken:
  - `dashboard.js` 新增新建书模板预设管理（保存/应用/导入/导出/清空）
  - 自定义模板预设采用 localStorage 持久化（上限 12 条，按名称去重）
  - 导入采用 merge 语义（同名优先导入版本），支持 JSON 文件迁移
  - `app.js` 新增 `newBookPresetFeedbackFlow`，统一反馈到 New Book 面板
  - 回归脚本新增模板预设相关标记断言，并通过 `./scripts/editor-regression.sh`
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 115: Sprint 4 Live Preview 自动刷新偏好持久化
- **Status:** complete
- Actions taken:
  - `app.js` 新增 `PREVIEW_AUTO_REFRESH_STORAGE_KEY` 与读写函数
  - 自动刷新开关变更时写入 localStorage，重启后保持用户偏好
  - 会话快照恢复/历史恢复时同步写回自动刷新偏好，避免状态分裂
  - 回归脚本新增自动刷新偏好持久化关键标记断言，并通过 `./scripts/editor-regression.sh`
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 116: Sprint 4 会话快照策略导入导出
- **Status:** complete
- Actions taken:
  - `app.js` 新增 `exportRecoveryHistoryPolicyFlow/importRecoveryHistoryPolicyFlow`
  - 支持导出策略文件（含 default + projects），并支持导入后即时应用到当前项目
  - `dashboard.js` Preview 面板新增 `Export Policy` / `Import Policy` 操作
  - 导入兼容旧版 `maxAgeDays` 字段格式，保持向后兼容
  - 回归脚本新增策略导入导出关键标记断言，并通过 `./scripts/editor-regression.sh`
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 117: Sprint 4 会话快照策略导入模式增强（replace/merge）
- **Status:** complete
- Actions taken:
  - `app.js` 新增 `normalizeRecoveryPolicyImportMode/mergeRecoveryHistoryPolicyPayload`
  - `importRecoveryHistoryPolicyFlow` 支持 `mode` 参数（`replace/merge`）并在反馈中输出 mode + imported projects
  - `dashboard.js` Preview 面板新增“策略导入模式”下拉，并在导入时透传到 `onImportRecoveryHistoryPolicy(file, mode)`
  - 回归脚本新增恢复策略导入模式相关关键标记断言
  - 运行 `node --check`（`app.js/dashboard.js/editor-regression.mjs`）与 `./scripts/editor-regression.sh`，均通过
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 118: Sprint 4 Live Preview 自动刷新偏好按项目独立配置
- **Status:** complete
- Actions taken:
  - `app.js` 将预览自动刷新偏好升级为 `defaultEnabled + projects` 存储结构，并兼容旧版 `1/0` 值
  - 新增项目级解析流程：项目打开时应用 `applyPreviewAutoRefreshPreferenceForProject(projectName)`
  - 自动刷新开关变更、会话快照恢复、历史快照恢复均改为写入当前项目策略（非全局覆盖）
  - `state.js` 新增 `previewAutoRefreshPolicyScope`，统一表达偏好来源（`project/global`）
  - `dashboard.js` 在自动刷新开关下显示来源标签（自动刷新来源：项目覆盖/全局默认）
  - 回归脚本补充项目级自动刷新策略关键标记断言
  - 运行 `node --check`（`app.js/state.js/dashboard.js/editor-regression.mjs`）与 `./scripts/editor-regression.sh`，均通过
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `reading-garden-editor/editor/js/core/state.js` (updated)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 119: Sprint 4 Live Preview 自动刷新偏好一键恢复全局默认
- **Status:** complete
- Actions taken:
  - `app.js` 新增 `clearProjectPreviewAutoRefreshPreferenceInStorage` 与 `resetPreviewAutoRefreshPreferenceFlow`
  - 在项目上下文支持一键清除自动刷新项目覆盖策略并回退全局默认
  - `dashboard.js` Preview 面板新增 `Auto Refresh Global` 操作按钮
  - 自动刷新回退结果写入 `previewAutoRefreshPolicyScope` 并复用 `recoveryFeedback` 回显
  - 回归脚本新增自动刷新策略回退关键标记断言
  - 运行 `node --check`（`app.js/dashboard.js/editor-regression.mjs`）与 `./scripts/editor-regression.sh`，均通过
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 120: Sprint 4 Live Preview 自动刷新策略导入导出（replace/merge）
- **Status:** complete
- Actions taken:
  - `app.js` 新增 `exportPreviewAutoRefreshPolicyFlow/importPreviewAutoRefreshPolicyFlow`
  - 自动刷新策略支持单文件导入/导出，并兼容旧值解析
  - 导入支持 `replace/merge` 模式，`merge` 保留本地 `defaultEnabled` 仅合并项目映射
  - `dashboard.js` Preview 面板新增 `Export AutoRefresh` / `Import AutoRefresh` 操作与文件选择
  - 自动刷新策略导入复用统一导入模式选择器，与会话快照策略保持一致交互
  - 回归脚本补充自动刷新策略导入导出关键标记断言
  - 运行 `node --check`（`app.js/dashboard.js/editor-regression.mjs`）与 `./scripts/editor-regression.sh`，均通过
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 121: Sprint 4 组合策略包导入导出（恢复策略 + 自动刷新策略）
- **Status:** complete
- Actions taken:
  - `app.js` 新增 `exportEditorPolicyBundleFlow/importEditorPolicyBundleFlow`
  - 组合策略包支持一次导入/导出会话快照策略与自动刷新策略
  - 组合包导入支持 `replace/merge`，并按当前项目即时应用两类策略
  - `dashboard.js` Preview 面板新增 `Export All Policies` / `Import All Policies` 操作
  - 回归脚本新增组合策略包关键标记断言
  - 运行 `node --check`（`app.js/dashboard.js/editor-regression.mjs`）与 `./scripts/editor-regression.sh`，均通过
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 122: Sprint 4 组合策略包导入兼容旧单策略文件
- **Status:** complete
- Actions taken:
  - `app.js` 增强 `readEditorPolicyBundleSections`，支持识别旧格式单策略文件
  - 支持 `rg-recovery-history-policy` 与 `rg-preview-auto-refresh-policy` 文件通过组合包入口导入
  - 支持直接策略对象与 `policy` 包装对象的兼容解析，降低迁移门槛
  - 回归脚本新增旧格式兼容标记断言
  - 运行 `node --check`（`app.js/editor-regression.mjs`）与 `./scripts/editor-regression.sh`，均通过
  - 同步 README / findings / task_plan / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 123: Sprint 4 需求决策同步与导入反馈澄清
- **Status:** complete
- Actions taken:
  - 根据用户确认更新规划：新建书模板预设按项目隔离暂不做；组合策略包加密/脱敏暂不做
  - `app.js` 导入反馈文案增强：在 `replace/merge` 结果中显式标注默认策略来源（`default(s)=local/imported`）
  - 回归脚本新增导入反馈关键标记断言
  - 运行 `node --check`（`app.js/editor-regression.mjs`）与 `./scripts/editor-regression.sh`，均通过
  - 同步 task_plan / findings / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 124: Sprint 4 merge 导入可选覆盖默认值
- **Status:** complete
- Actions taken:
  - `app.js` 新增共享导入选项解析（`normalizePolicyImportOptions`）
  - `mergeRecoveryHistoryPolicyPayload/mergePreviewAutoRefreshPolicyPayload` 支持 `includeDefaultOnMerge`
  - Recovery / AutoRefresh / Bundle 三类导入流程接入“merge 可选覆盖默认值”
  - `dashboard.js` 新增“merge 时覆盖默认值（default）”勾选项并贯通导入参数
  - `state.js` 新增 `recoveryPolicyImportIncludeDefaultOnMerge` 状态
  - 回归脚本新增导入选项与状态标记断言
  - 运行 `node --check`（`app.js/state.js/dashboard.js/editor-regression.mjs`）与 `./scripts/editor-regression.sh`，均通过
  - 同步 README / task_plan / findings / progress
- Files created/modified:
  - `reading-garden-editor/editor/js/core/app.js` (updated)
  - `reading-garden-editor/editor/js/core/state.js` (updated)
  - `reading-garden-editor/editor/js/ui/dashboard.js` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 125: Sprint 4 EdgeOne 发布验收与回滚清单文档化
- **Status:** complete
- Actions taken:
  - 新增 `docs/edgeone-手动部署验收与回滚清单.md`
  - 固化发布输入物、发布前门禁、本地冒烟、上线后验收与回滚触发条件
  - 增加发布记录模板，确保手动上传场景可追溯
  - `README.md` 与 `reading-garden-editor/README.md` 接入清单文档入口
  - `task_plan.md` / `findings.md` 同步新增“清单文档化”决策
- Files created/modified:
  - `docs/edgeone-手动部署验收与回滚清单.md` (created)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 126: Sprint 4 EdgeOne 发布包预检脚本化
- **Status:** complete
- Actions taken:
  - 新增 `scripts/edgeone-preflight.sh`（zip 解压 + 预检入口）与 `scripts/edgeone-preflight.mjs`（结构与 manifest 校验）
  - 预检覆盖：核心文件结构、`books.json`、`registry.json`、`rgsite-manifest.json`、`MISSING-ASSETS.txt` 一致性检查
  - `editor-regression.mjs` 新增预检脚本关键标记断言，避免脚本回归
  - 对脚本执行本地样例包自测，输出 `edgeone-preflight: ok`
  - 运行 `node --check`（`edgeone-preflight.mjs/editor-regression.mjs`）与 `./scripts/editor-regression.sh`，均通过
  - 同步 README / editor README / task_plan / findings / progress
- Files created/modified:
  - `scripts/edgeone-preflight.sh` (created)
  - `scripts/edgeone-preflight.mjs` (created)
  - `scripts/editor-regression.mjs` (updated)
  - `docs/edgeone-手动部署验收与回滚清单.md` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 127: Sprint 4 CI 接入 EdgeOne 预检脚本自测
- **Status:** complete
- Actions taken:
  - `.github/workflows/editor-regression.yml` 触发路径新增 `scripts/edgeone-preflight.*`
  - CI 新增 `Run EdgeOne Preflight Self-Test` 步骤，生成最小 `rgsite.zip` 样例并执行预检
  - `README.md` 与 `reading-garden-editor/README.md` 同步 CI 新增预检自测说明
  - `task_plan.md` / `findings.md` / `progress.md` 同步“CI 接入预检脚本”决策与状态
- Files created/modified:
  - `.github/workflows/editor-regression.yml` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 128: Sprint 4 EdgeOne 预检 checksum 校验落地
- **Status:** complete
- Actions taken:
  - `scripts/edgeone-preflight.mjs` 新增 `sha256File` 与 `manifest.checksumMode=sha256` 分支校验
  - 预检新增错误覆盖：`checksums` 缺失、unsafe 路径（`../`/绝对路径）、checksum 目标文件缺失、checksum mismatch
  - `scripts/editor-regression.mjs` 新增预检源码标记断言（`checksumMode` / `sha256`）
  - 运行 `node --check`（`scripts/edgeone-preflight.mjs`、`scripts/editor-regression.mjs`）通过
  - 运行 `./scripts/editor-regression.sh` 回归通过
  - 本地构造 checksum 样例目录验证：
    - 正常样例：`edgeone-preflight: ok`
    - 篡改样例：`edgeone-preflight: fail` + `checksum mismatch: index.html`
    - 越界路径样例：`edgeone-preflight: fail` + `invalid checksum target path: ../outside.txt`
  - 同步 `task_plan.md` / `findings.md` / `progress.md`
- Files created/modified:
  - `scripts/edgeone-preflight.mjs` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 129: Sprint 4 EdgeOne 预检自测扩展（真实资产样例）
- **Status:** complete
- Actions taken:
  - 新增 `scripts/edgeone-preflight-selftest.sh`，统一执行 EdgeOne 预检自测
  - 自测覆盖场景：
    - 最小样例正向通过
    - checksum mismatch 反例失败断言
    - unsafe checksum path（`../`）反例失败断言
    - 基于仓库真实 `index.html/book.html/css/js` 与书籍 registry 的样例正向通过
  - `.github/workflows/editor-regression.yml` 改为直接调用 `./scripts/edgeone-preflight-selftest.sh`
  - `scripts/editor-regression.mjs` 新增 selftest 脚本关键标记断言，防止 CI 自测回退
  - 运行 `bash -n scripts/edgeone-preflight-selftest.sh`、`./scripts/edgeone-preflight-selftest.sh`、`./scripts/editor-regression.sh` 均通过
  - 同步 `README.md` / `reading-garden-editor/README.md` / `docs/edgeone-手动部署验收与回滚清单.md` / `task_plan.md` / `findings.md` / `progress.md`
- Files created/modified:
  - `scripts/edgeone-preflight-selftest.sh` (created)
  - `.github/workflows/editor-regression.yml` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `docs/edgeone-手动部署验收与回滚清单.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 130: Sprint 4 EdgeOne checksum 规则收口（required + format）
- **Status:** complete
- Actions taken:
  - `scripts/edgeone-preflight.mjs` 新增 `sha256` 模式下关键文件 checksum 必填校验（`index.html/book.html/data/books.json/DEPLOY-EDGEONE.md`）
  - `scripts/edgeone-preflight.mjs` 新增 checksum 哈希格式校验（必须为 64 位十六进制）
  - 当 `checksumMode=none` 或缺失时输出显式告警；未知模式输出 unsupported 告警
  - `scripts/edgeone-preflight-selftest.sh` 新增两类失败断言：
    - `checksum missing for required file`
    - `invalid checksum format`
  - `scripts/editor-regression.mjs` 新增预检与 selftest 源码标记断言，防止规则退化
  - 运行 `node --check`（`edgeone-preflight.mjs` / `editor-regression.mjs`）通过
  - 运行 `bash -n scripts/edgeone-preflight-selftest.sh`、`./scripts/edgeone-preflight-selftest.sh`、`./scripts/editor-regression.sh` 均通过
  - 同步 `task_plan.md` / `findings.md` / `progress.md`
- Files created/modified:
  - `scripts/edgeone-preflight.mjs` (updated)
  - `scripts/edgeone-preflight-selftest.sh` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 131: Sprint 4 EdgeOne 预检报告输出（`--report`）
- **Status:** complete
- Actions taken:
  - `scripts/edgeone-preflight.mjs` 新增 CLI 参数 `--report <path>`，输出结构化 JSON 报告
  - 报告统一字段：`status/checkedAt/siteRoot/scope/books/files/totalBytes/missingAssets/warnings/error`
  - `scripts/edgeone-preflight.sh` 透传附加参数到 node 预检脚本，支持 `--report`
  - `scripts/edgeone-preflight-selftest.sh` 新增报告断言：
    - 正向样例 `status=ok`
    - 失败样例（checksum mismatch）`status=fail`
  - `scripts/editor-regression.mjs` 新增 `--report` 与 report 输出关键标记断言
  - 运行 `node --check`（`edgeone-preflight.mjs` / `editor-regression.mjs`）通过
  - 运行 `bash -n`（`edgeone-preflight.sh` / `edgeone-preflight-selftest.sh`）通过
  - 运行 `./scripts/edgeone-preflight-selftest.sh` 与 `./scripts/editor-regression.sh` 均通过
  - 同步 `README.md` / `reading-garden-editor/README.md` / `docs/edgeone-手动部署验收与回滚清单.md` / `task_plan.md` / `findings.md` / `progress.md`
- Files created/modified:
  - `scripts/edgeone-preflight.mjs` (updated)
  - `scripts/edgeone-preflight.sh` (updated)
  - `scripts/edgeone-preflight-selftest.sh` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `docs/edgeone-手动部署验收与回滚清单.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 132: Sprint 4 EdgeOne 自测报告 artifact 化
- **Status:** complete
- Actions taken:
  - `scripts/edgeone-preflight-selftest.sh` 支持环境变量 `EDGEONE_PREFLIGHT_SELFTEST_REPORT`
  - 自测脚本新增 `record_case` 与 `write_selftest_report`，输出结构化用例结果（`status + cases`）
  - `.github/workflows/editor-regression.yml` 为 EdgeOne 自测步骤注入 `EDGEONE_PREFLIGHT_SELFTEST_REPORT=tmp/edgeone-preflight-selftest-report.json`
  - CI artifact 上传路径扩展：除 `editor-regression-report.json` 外，新增 `edgeone-preflight-selftest-report.json`
  - `scripts/editor-regression.mjs` 新增自测报告相关关键标记断言
  - 运行 `node --check scripts/editor-regression.mjs`、`bash -n scripts/edgeone-preflight-selftest.sh`、`EDGEONE_PREFLIGHT_SELFTEST_REPORT=tmp/edgeone-preflight-selftest-report.json ./scripts/edgeone-preflight-selftest.sh`、`./scripts/editor-regression.sh` 均通过
  - 同步 `README.md` / `reading-garden-editor/README.md` / `task_plan.md` / `findings.md` / `progress.md`
- Files created/modified:
  - `scripts/edgeone-preflight-selftest.sh` (updated)
  - `.github/workflows/editor-regression.yml` (updated)
  - `scripts/editor-regression.mjs` (updated)
  - `README.md` (updated)
  - `reading-garden-editor/README.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

## Error Log
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-02-11 | `apply_patch` 上下文不匹配（`progress.md` 片段更新失败） | 1 | 使用 `nl -ba progress.md` 定位准确行后重试补丁成功 |
| 2026-02-11 | `git commit` 在并行执行中先于 `git add` 触发“no changes added” | 1 | 改为顺序执行 `git add && git commit` 并成功提交 |
| 2026-02-11 | 首版 checksum 自测样例触发预检失败（缺少 `css/js`、manifest 必填字段不完整） | 1 | 按预检规则补齐目录与 manifest 字段后重测通过，并补充 checksum mismatch 反例验证 |
| 2026-02-12 | checksum 自测 unsafe-path 用例首次断言失败（被 required-checksum/format 校验提前拦截） | 1 | 调整用例为“先保留合法 required checksums，再注入 `../` 路径”后断言通过 |

## 5-Question Reboot Check
| Question | Answer |
|----------|--------|
| Where am I? | Phase 132 |
| Where am I going? | Phase 132 -> checkpoint commit -> push -> 下一轮导出链路可观测性增强 |
| What's the goal? | 形成可上传 EdgeOne 的发布打包链路 |
| What have I learned? | 自测结果若不落盘，CI 历史难以审计；artifact 化能显著提升排障与回归追踪效率 |
| What have I done? | 已完成自测报告输出、CI 注入与 artifact 上传，并通过本地验证 |
