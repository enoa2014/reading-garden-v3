# Findings: Reading Garden Editor 开发实施

## Requirements Source
- `docs/reading-garden-editor-需求文档.md`（v1.1）
- `docs/reading-garden-editor-详细设计文档.md`（v1.1）

## 当前任务目标
- 在 Sprint 1 基础上推进 Sprint 2：新建书向导 + 校验增强 + 交换包骨架。
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

## Risks & Watchpoints
- 浏览器不支持 File System Access API 时需要明确降级提示。
- `books.json`/目录结构异常时要给出可理解错误，避免静默失败。
- 状态管理若无订阅机制，后续 UI 扩展会快速失控。
- 新建书回滚当前仅处理“本次新建路径”删除，尚未实现“基于备份自动恢复覆盖文件”流程。
- 交换包服务目前是接口骨架，导入导出真实链路需在 Sprint 3 落地。

## Sprint 3 预规划
- 目标 1：将 `rgbook` 从骨架接口升级为可导出/可导入链路（先 JSON bundle，再接 ZIP）。
- 目标 2：落地 `ImportMergeService.applyMergePlan` 事务化合并。
- 目标 3：补充导入安全检查（路径穿越/文件大小）与失败回滚日志。

## Resources
- `reading-garden-v3/`
- `docs/reading-garden-editor-需求文档.md`
- `docs/reading-garden-editor-详细设计文档.md`
- `task_plan.md`
- `progress.md`
