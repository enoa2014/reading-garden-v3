# Task Plan: Reading Garden Editor 开发实施（Sprint 4）

## Goal
补齐 `rgbook` 安全校验与 `rgsite` 发布包导出能力，形成可直接上传腾讯云 EdgeOne 的稳定打包链路，并保持断点恢复文档持续同步。

## Current Phase
Phase 9

## Phases
### Phase 1: Sprint 3 收尾同步
- [x] 核对 Sprint 3 已推送 checkpoint 状态
- [x] 更新计划文件到 Sprint 4 基线
- [x] 在 `progress.md` 标记 Sprint 3 完结并开启 Sprint 4 记录
- **Status:** complete

### Phase 2: rgbook 安全校验增强
- [x] 导出时生成 `manifest.checksums`（SHA-256）
- [x] 导入时校验 checksum 一致性
- [x] 增加压缩包安全限制（路径穿越/文件数量/体积上限）
- [x] 错误分层（格式错误 vs 安全错误）并输出可读提示
- **Status:** complete

### Phase 3: rgsite 导出链路实现
- [x] 实现 `SitePackService.exportSitePack`
- [x] 发布白名单收集（运行时必需文件）
- [x] 导出前校验（结构、书籍索引、关键引用）
- [x] 生成 `rgsite-manifest.json` + 下载 `*.rgsite.zip`
- **Status:** complete

### Phase 4: UI 接入与自检
- [x] Dashboard 增加 rgsite 导出入口
- [x] `app.js` 接入导出流程与反馈
- [x] JS 语法检查与模块级 smoke test
- **Status:** complete

### Phase 5: 文档同步与 checkpoint
- [x] 同步 `findings.md` / `progress.md` / `reading-garden-editor/README.md`
- [x] 提交 checkpoint commit（含回滚点）
- [x] 推送 `origin/master`
- **Status:** complete

### Phase 6: 下一迭代规划
- [x] 增加 `rgbook` 导入失败诊断报告导出
- [x] 增加 `rgsite` 子集导出（按书籍筛选）
- [x] 增加导入导出自动化回归脚本
- **Status:** complete

### Phase 7: 文档同步与 checkpoint
- [x] 同步 `task_plan.md` / `findings.md` / `progress.md`
- [x] 提交 checkpoint commit
- [x] 推送 `origin/master`
- **Status:** complete

### Phase 8: 下一迭代规划
- [x] 为 subset 导出增加“最小资源集”模式
- [x] 为诊断报告增加脱敏导出选项
- [x] 规划并接入 CI 门禁（回归脚本接入）
- **Status:** complete

### Phase 9: 下一迭代规划（持续）
- [x] 诊断报告支持“自定义脱敏字段”配置
- [x] CI 门禁增加 artifacts（回归输出）上传
- [x] `rgsite minimal` 增加缺失资源回退提示
- [x] `MISSING-ASSETS.txt` 支持按来源分组输出
- [x] 缺失资源支持固定分类统计（`missingAssetsByCategory`）
- [x] 自定义脱敏字段支持“最近模板”本地复用
- [x] 最近模板支持一键清空与结果反馈
- [x] 最近模板支持导入/导出
- [x] 最近模板导入支持 `replace/merge` 模式
- [x] 回归报告增加 `packStats`（full/subset/minimal 对比）
- [x] `packStats` 支持通过环境变量指定 subset 样本书籍
- [x] CI 固定 `packStats` 样本（`totto-chan,wave`）
- [x] `workflow_dispatch` 支持输入覆盖 `packStats` 抽样
- [x] CI Job Summary 输出 `packStats` 摘要
- [x] 无效 `packStats` 抽样 ID 支持严格失败策略
- [x] `workflow_dispatch` 支持输入覆盖严格校验开关
- [x] 严格模式增加抽样 ID 格式校验
- **Status:** in_progress

## Key Questions
1. 缺失资源告警是否需要从 summary 升级为“可配置 fail 阈值”？
2. 最近模板导入模式是否需要支持“预览差异”？
3. missing-assets 告警是否需要细化到分类级别（book-cover/book-module/...）？

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Sprint 4 先做安全再做发布 | 先降低错误导入风险，再推进部署链路 |
| `rgbook` 校验默认严格失败即阻断 | 防止脏数据进入本地书架 |
| `rgsite` 首版采用运行时白名单导出 | 先保证可部署正确性，再扩展可选内容 |
| 缺失资源报告先按“book/module/cover/file-ref”来源分组 | 保留排障上下文，同时维持导出链路简单 |
| 缺失资源新增固定分类统计（4 类） | 提供稳定可比较维度，不破坏详细分组 |
| 自定义脱敏字段先落地“最近 5 条模板”本地存储 | 在不引入后端配置的前提下提升复用效率 |
| 最近模板先支持“一键清空”，不做二次确认弹窗 | 操作可逆（重新下载自定义报告会再写入），优先减少交互阻塞 |
| 最近模板导入默认 `replace`，并新增 `merge` 可选 | 兼顾简单默认路径与增量迁移场景 |
| 回归报告内置包体统计并固定抽样前 2 本书 | 低成本提供趋势对比，先满足 CI 可观测性 |
| `packStats` 抽样支持环境变量覆盖 | 兼容不同书籍组合的针对性回归分析 |
| CI 默认固定 `packStats` 抽样为 `totto-chan,wave` | 提升跨分支、跨时间段报告对比稳定性 |
| 手动触发回归支持输入覆盖抽样书籍 | 方便在不改代码情况下做针对性对比分析 |
| CI summary 固定输出 packStats 关键指标与 missing IDs | 降低排查成本，提升输入错误可见性 |
| CI 默认启用严格抽样校验（invalid ID fail） | 尽早暴露输入错误，避免产出误导性对比结果 |
| workflow_dispatch 允许按需关闭严格校验 | 兼容探索性分析场景，默认仍保持严格 |
| 严格模式补充抽样 ID 格式校验 | 提前拦截输入错误，减少“误判为缺失书籍”噪声 |
| CI summary 增加 missing-assets 告警状态 | 先提供可见性，再评估是否升级为 fail 阈值 |
