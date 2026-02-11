# Findings: Reading Garden Editor 开发实施

## Requirements Source
- `docs/reading-garden-editor-需求文档.md`（v1.1）
- `docs/reading-garden-editor-详细设计文档.md`（v1.1）

## 当前任务目标
- 在 Sprint 3 已完成基础上推进 Sprint 4：`rgbook` 安全校验增强 + `rgsite` 可部署导出链路。
- 强制执行“关键节点写盘”策略：`task_plan.md`、`findings.md`、`progress.md` 同步更新。
- 用户已批准对 `reading-garden-v3` 本体进行改造，但要求必须具备清晰回滚策略。

## Sprint 1 约束
- 纯静态站点，禁止引入后端与强依赖构建链。
- 先实现基础模块：filesystem/state/path-resolver/validator/app/dashboard。
- 先打通“打开项目 -> 校验结构 -> 读取 books.json -> 显示书架”闭环。
- AI/图片策略/交换包先留接口位，不在本阶段重实现完整能力。

## 技术决策
| Decision | Rationale |
|----------|-----------|
| 在 `reading-garden-v3/reading-garden-editor/` 新建独立编辑器子应用 | 与运行时站点解耦，便于渐进集成 |
| 使用 ES Modules + 浏览器原生 API | 保持零构建、易分发、离线可运行 |
| 校验层先做“基础规则校验”，后续接入完整 schema | Sprint 1 聚焦打通主链路 |
| 所有文件操作经统一 filesystem/path-resolver 层 | 为后续导入导出、路径重写做基础 |
| 写操作设计“备份优先” | 满足用户对回滚策略的要求 |
| `rgbook` 导入默认“严格校验失败即阻断” | 防止异常包污染本地书架 |
| `rgsite` 导出采用运行时白名单 | 优先保证 EdgeOne 可部署正确性 |

## 已完成实现（当前节点）
- 已创建独立子应用：`reading-garden-editor/`
- 已落地核心模块：
  - `editor/js/core/state.js`
  - `editor/js/core/path-resolver.js`
  - `editor/js/core/filesystem.js`
  - `editor/js/core/validator.js`
  - `editor/js/core/app.js`
  - `editor/js/ui/dashboard.js`
- 已打通最小链路：
  - 打开本地目录
  - 校验项目结构（`index.html/data/js/css`）
  - 读取并校验 `data/books.json`
  - 在仪表盘展示书架和错误信息
- 回滚策略已落地第一版：
  - `writeText` 默认先备份旧文件到 `.rg-editor-backups/<timestamp>/...`
  - 写入成功返回 `backupPath` 供后续恢复流程使用
- 项目入口文档已同步：
  - `README.md` 新增“编辑器开发（WIP）”章节
  - 包含编辑器入口、关联文档与回滚策略说明
- 站点入口已同步：
  - `index.html` 导航新增 `Editor` 链接，指向 `reading-garden-editor/index.html`
  - `reading-garden-editor/README.md` 新增独立运行与回滚说明
- Sprint 2 已完成实现：
  - 新增 `editor/js/core/book-template.js`（最小书籍模板生成）
  - 扩展 `editor/js/core/filesystem.js`：新增 `exists` 与 `deletePath`
  - 扩展 `editor/js/core/validator.js`：新增新建书输入校验
  - 扩展 `editor/js/core/app.js`：新建书流程、书架健康检查、失败回滚
    - 新建书支持可选模板：阅读 + 人物 + 主题模块
    - 健康检查扩展到 `registry.modules[].entry/data` 可达性
    - 失败回滚扩展：尝试恢复 `data/books.json` 备份
  - 扩展 `editor/js/ui/dashboard.js`：新建书表单、创建反馈、健康面板
  - 新增交换包骨架模块：
    - `editor/js/packaging/book-pack-service.js`
    - `editor/js/packaging/import-merge-service.js`
    - `editor/js/packaging/site-pack-service.js`
- Sprint 3 已完成实现：
  - 引入本地依赖：`editor/js/vendor/jszip.min.js`
  - `BookPackService` 已支持：
    - 导出 `*.rgbook.zip`（book.json / registry / data / assets / manifest）
    - 导入 `*.rgbook.zip`（冲突策略：rename/overwrite/skip）
    - 导入失败时基础回滚（新建路径逆序删除 + books 索引恢复尝试）
  - `ImportMergeService` 已支持 `applyMergePlan`
  - `FileSystemAdapter` 已支持二进制读写（用于资产打包导入）
  - Dashboard 已接入 rgbook 导入导出入口
- Sprint 4 已完成实现（本轮）：
  - 新增 `editor/js/packaging/pack-utils.js`（checksum、ZIP 安全路径校验、下载工具）
  - `BookPackService` 增强：
    - 导出写入 `manifest.checksums`（SHA-256）
    - 导入前执行压缩包安全门禁（路径合法性、前缀白名单、文件数/体积限制）
    - 导入时校验 manifest checksum，一致性失败即阻断
  - `SitePackService` 从骨架升级为可用导出：
    - 导出前校验结构、书架、registry/module 关键引用
    - 校验模块 `entry/data` 空配置并阻断导出
    - 按运行时白名单收集站点文件并打包为 `*.rgsite.zip`
    - subset 增加资源策略：`balanced` / `minimal`（最小资源集）
    - subset minimal 增加 `missingAssets` 清单输出（manifest + UI 计数提示）
    - 当存在缺失资源时，导出包附带 `MISSING-ASSETS.txt`
    - 生成 `rgsite-manifest.json` 与 `DEPLOY-EDGEONE.md`
    - 对 JSON 中潜在敏感键做导出时脱敏
  - Dashboard 与应用流程：
    - 新增 `Export rgsite` 表单（可选包含 `reading-garden-editor`）
    - `app.js` 新增发布包导出流与反馈信息
    - `rgsite` 新增 `full/subset` 导出模式（subset 支持按书籍筛选）
    - `rgbook` 导入失败新增诊断报告下载（完整/脱敏）
    - 诊断脱敏策略：隐藏项目名与原始文件名，保留错误码/策略/大小用于排障
    - 诊断支持自定义脱敏字段（按路径，如 `project.name,input.fileName`）
    - 自定义脱敏字段支持“最近模板”本地复用（localStorage，最多 5 条）
  - 自动化回归：
    - 新增 `scripts/editor-regression.sh`
    - 新增 `scripts/editor-regression.mjs`
    - 覆盖语法检查、pack-utils 关键规则、merge 关键策略、site-pack 关键标记
    - 生成 `tmp/editor-regression-report.json` 报告
    - 回归报告新增 `packStats`（full/subset-balanced/subset-minimal 体积对比）
    - 新增 `.github/workflows/editor-regression.yml` 接入 CI 门禁
    - CI 自动上传 `editor-regression-report` artifact（失败场景也保留）
  - 文档同步：
    - `README.md` 与 `reading-garden-editor/README.md` 已更新到 Sprint 4 状态

## Risks & Watchpoints
- 浏览器不支持 File System Access API 时需要明确降级提示。
- `books.json`/目录结构异常时要给出可理解错误，避免静默失败。
- 状态管理若无订阅机制，后续 UI 扩展会快速失控。
- 新建书回滚当前仅处理“本次新建路径”删除，尚未实现“基于备份自动恢复覆盖文件”流程。
- `rgbook` 安全校验加入后需注意性能：大包 checksum 可能导致导入等待变长。
- `rgsite` 首版白名单若漏文件会造成线上 404，需要补充分层校验与提示。
- `rgsite subset` 仍可能包含未使用共享资源，后续可增加“最小资源集”模式降低包体。
- `rgsite minimal` 依赖文本引用扫描，遇到动态拼接路径时可能漏收资源。

## Sprint 4 后续建议
- 目标 1：补充 `rgsite` 引用扫描深度（静态资源跨文件依赖、死链清单）。
- 目标 2：增加导入导出自动化回归测试（安全门禁、回滚路径、manifest 一致性）。
- 目标 3：增加“导入/导出步骤日志面板”便于教学场景问题排查。

## Resources
- `reading-garden-v3/`
- `docs/reading-garden-editor-需求文档.md`
- `docs/reading-garden-editor-详细设计文档.md`
- `task_plan.md`
- `progress.md`
