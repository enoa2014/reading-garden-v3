# Reading Garden Editor (WIP)

本目录是 `reading-garden-v3` 的本地可视化编辑器子应用，目标是给教师/家长提供离线优先的建书、编辑、导入导出能力。

## 当前状态
- Sprint 1 基础骨架已完成：
  - 打开项目目录
  - 结构校验（`index.html`、`data`、`js`、`css`）
  - 读取并展示 `data/books.json`
  - 显示校验错误
- Sprint 2 核心增强已完成：
  - 新建书表单（创建最小可运行新书）
  - 新建书可选模板（阅读 + 人物 + 主题模块）
  - 书架健康检查（`registry.json` 存在性）
  - 模块健康检查（`registry.modules[].entry/data` 文件可达性）
  - 新建书失败回滚（逆序删除本次创建路径）
  - `rgbook/rgsite` 交换包服务骨架接口
- Sprint 3 已完成：
  - 已接入本地 `JSZip`（`editor/js/vendor/jszip.min.js`）
  - 已支持 `rgbook` 导出（单书打包为 `*.rgbook.zip`）
  - 已支持 `rgbook` 导入（`rename/overwrite/skip` 冲突策略）
  - 已支持导入失败基础回滚（路径逆序删除 + books 索引恢复尝试）
- Sprint 4 进行中：
  - `rgbook` 增加 checksum 与压缩包安全门禁（路径/文件数/体积）
  - 新增 `rgsite` 发布包导出（`*.rgsite.zip`）
  - 新增 `rgsite` 子集导出（按选中书籍过滤 `books.json` 与书籍目录）
  - subset 支持资源策略：`balanced`（兼容优先）/`minimal`（最小资源集）
  - `minimal` 模式会输出缺失资源计数（用于上线前补齐资源）
  - 缺失资源回退支持：`report-only` / `svg-placeholder`（自动生成 SVG 占位图）
  - 若检测到缺失资源，导出包附带 `MISSING-ASSETS.txt`（固定分类汇总 + 按来源分组 + 平铺清单）
  - 导出包附带 `rgsite-manifest.json` 与 `DEPLOY-EDGEONE.md`
  - Dashboard 增加 `Export rgsite` 入口（可选包含编辑器子应用）
  - `rgbook` 导入失败可下载诊断报告（完整/脱敏/自定义脱敏 JSON）
  - 自定义脱敏字段支持“最近使用模板”本地复用（localStorage，最多 5 条）
  - 新增 AI 配置面板：本地保存/加载 LLM 与图片接口配置（`reading-garden-editor/config/ai-settings.json`）
  - 支持 AI 配置导入/导出（JSON），便于跨机器迁移配置
  - 支持原文文本分析助手：可选 LLM 自动建议，失败时回退本地启发式分析
  - 支持分析建议 JSON 导出（用于人工评审或后续自动配置）
  - 支持“未选目标书籍自动建草稿”：Apply 时按分析建议自动创建书籍并应用
  - 支持“安全应用建议”：输出 `data/<bookId>/registry.suggested.json`，不覆盖原配置
  - 支持“覆盖应用建议”：可直接写入 `data/<bookId>/registry.json`，自动备份并补齐新增模块数据模板
  - 覆盖应用需显式确认，防止误操作覆盖 `registry.json`
  - 支持 Live Preview：书籍实时预览 + desktop/tablet/mobile 设备切换 + 手动刷新
  - 支持 Live Preview 自动刷新开关：在导入/新建/覆盖写入后按设置自动刷新
  - 支持 Live Preview 自动刷新偏好“全局默认 + 项目覆盖”持久化（兼容旧版 localStorage）
  - 支持 Live Preview 自动刷新偏好当前项目一键恢复全局默认
  - 支持 Live Preview 自动刷新策略导入/导出（支持 `replace` / `merge`，merge 可选覆盖默认值）
  - 支持组合策略包导入/导出（会话快照策略 + 自动刷新策略）
  - 组合策略包导入兼容旧单策略文件（recovery/auto-refresh）
  - 数据校验增强：`books.json` 与 `registry.json` 输出路径级错误与修复建议
  - `rgbook` 导入支持 `manual` 预检查：先输出冲突与推荐策略，不直接导入
  - IndexedDB 会话快照：500ms 防抖 + 30s 周期写入，重开项目自动恢复最近建议与预览偏好
  - 支持手动清理会话快照（Preview 面板按钮）
  - 会话快照恢复按项目优先匹配（避免跨项目误恢复）
  - 会话快照支持最近 5 条历史记录，并可按时间点恢复指定快照
  - 会话快照支持删除选中历史记录（无需清空全部）
  - 会话快照历史自动清理（默认清理 30 天前记录）
  - 会话快照自动清理阈值可配置（关闭/7/30/90/180 天）
  - 会话快照清理阈值支持按项目独立配置（项目级覆盖全局默认）
  - 会话快照策略支持一键恢复全局默认（当前项目）
  - 会话快照策略显示当前来源（项目覆盖/全局默认）
  - 会话快照策略支持导入/导出（跨设备复制，支持 `replace`/`merge`，merge 可选覆盖默认值）
  - 新建书支持模板级别：`minimal/standard/teaching/custom`（可一键套用并手动切换）
  - 新建书支持自定义模板预设（保存/应用/导入/导出/清空，基于 localStorage）
  - 新建书模板支持可选 `timeline` / `interactive` 模块与对应数据模板文件
  - `manual` 导入预检查支持一键应用推荐策略（减少重复选择）
  - Validation Issues 面板支持下载结构化校验报告（JSON）
  - 新建书流程支持图片策略基础落地：
    - `emoji`：生成 emoji 风格封面
    - `none`：生成 no-image 占位封面
    - `prompt-file/api`：生成 `data/<bookId>/prompts/image-prompts.md`
  - 支持一键清空最近模板并在面板给出结果反馈
  - 支持最近模板导入/导出（JSON 文件）
  - 模板导入支持 `replace`（覆盖）/`merge`（合并去重）模式
  - 模板导入支持“预览差异”（当前/导入/结果条数 + 新增/移除/保留统计）

## 运行方式

1. 在项目根目录启动本地静态服务：

```bash
cd /path/to/reading-garden-v3
python3 -m http.server 8080
```

2. 打开编辑器：

- `http://127.0.0.1:8080/reading-garden-editor/index.html`

3. 运行回归脚本（可选）：

```bash
./scripts/editor-regression.sh
# 可选：指定 packStats 的 subset 样本书籍
EDITOR_PACK_STATS_SELECTED_BOOKS="totto-chan,wave" ./scripts/editor-regression.sh
# 可选：要求样本书籍 ID 全部有效（有缺失即失败）
EDITOR_PACK_STATS_REQUIRE_VALID_SELECTION=true ./scripts/editor-regression.sh
# 可选：对导出的 rgsite 包做发布前预检
./scripts/edgeone-preflight.sh /path/to/reading-garden-*.rgsite.zip
# 可选：执行预检自测（最小样例 + 真实资产样例 + 失败样例断言）
./scripts/edgeone-preflight-selftest.sh
```

4. CI 门禁：

- 已接入 GitHub Actions：`.github/workflows/editor-regression.yml`
- 当 `reading-garden-editor/**` 或回归脚本变更时，PR/Push 会自动执行回归检查
- CI 会上传 `editor-regression-report` artifact（来源 `tmp/editor-regression-report.json`）
- 回归报告含 `packStats`（`full/subset-balanced/subset-minimal` 体积对比）
- CI 固定 `EDITOR_PACK_STATS_SELECTED_BOOKS=totto-chan,wave` 用于稳定对比
- `workflow_dispatch` 支持输入 `pack_stats_selected_books` 覆盖抽样
- `workflow_dispatch` 支持输入 `pack_stats_require_valid_selection` 控制严格校验
- `workflow_dispatch` 支持输入 `pack_stats_max_missing_assets` 设置 missing-assets 全局阈值
- `workflow_dispatch` 支持输入 `pack_stats_max_missing_assets_subset_balanced` 设置 subset-balanced 阈值
- `workflow_dispatch` 支持输入 `pack_stats_max_missing_assets_subset_minimal` 设置 subset-minimal 阈值
- `workflow_dispatch` 支持输入 `pack_stats_max_missing_book_module` 设置模块缺失阈值
- `workflow_dispatch` 支持输入 `pack_stats_max_missing_book_cover` 设置封面缺失阈值（默认禁用）
- `workflow_dispatch` 支持输入 `pack_stats_max_missing_file_ref` 设置文件引用缺失阈值（默认禁用）
- `workflow_dispatch` 支持输入 `pack_stats_max_missing_unclassified` 设置未分类缺失阈值（默认禁用）
- `workflow_dispatch` 支持输入 `pack_stats_category_threshold_preset` 使用分类阈值预设（custom/balanced/strict）
- CI Job Summary 会输出 `packStats` 摘要（含 missing/invalid IDs、missing-assets 告警、分类统计）
- CI 默认开启 `EDITOR_PACK_STATS_REQUIRE_VALID_SELECTION=true`（无效抽样 ID 直接失败）
- 严格模式下会校验抽样 ID 格式（仅允许 `a-z0-9-`）
- CI 新增 EdgeOne 预检脚本自测（最小样例 + 真实资产样例 + 失败样例断言）

5. EdgeOne 手动发布验收与回滚清单：

- `docs/edgeone-手动部署验收与回滚清单.md`

## 回滚策略（第一版）

1. 关键开发节点采用小步提交（checkpoint commit）。
2. 编辑器写文件时默认写前备份到：
   - `.rg-editor-backups/<timestamp>/<original-path>`
3. 若写入出现问题，可根据备份路径手动恢复。

## 下个迭代目标（Sprint 4 后续）

- 细化 `rgsite` 导出前校验（跨文件引用全扫描）
- 增加导入导出失败场景的端到端回归样例
- 增加导入导出过程日志面板（可追踪、可复制）
