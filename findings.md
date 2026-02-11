# Findings: Reading Garden Editor 开发实施

## Requirements Source
- `docs/reading-garden-editor-需求文档.md`（v1.1）
- `docs/reading-garden-editor-详细设计文档.md`（v1.1）

## 当前任务目标
- 启动 Sprint 1 开发，先实现离线手工模式下的最小可运行编辑器骨架。
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

## Risks & Watchpoints
- 浏览器不支持 File System Access API 时需要明确降级提示。
- `books.json`/目录结构异常时要给出可理解错误，避免静默失败。
- 状态管理若无订阅机制，后续 UI 扩展会快速失控。

## Resources
- `reading-garden-v3/`
- `docs/reading-garden-editor-需求文档.md`
- `docs/reading-garden-editor-详细设计文档.md`
- `task_plan.md`
- `progress.md`
