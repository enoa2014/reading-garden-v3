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
  - 支持“安全应用建议”：输出 `data/<bookId>/registry.suggested.json`，不覆盖原配置
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

## 回滚策略（第一版）

1. 关键开发节点采用小步提交（checkpoint commit）。
2. 编辑器写文件时默认写前备份到：
   - `.rg-editor-backups/<timestamp>/<original-path>`
3. 若写入出现问题，可根据备份路径手动恢复。

## 下个迭代目标（Sprint 4 后续）

- 细化 `rgsite` 导出前校验（跨文件引用全扫描）
- 增加导入导出失败场景的端到端回归样例
- 增加导入导出过程日志面板（可追踪、可复制）
