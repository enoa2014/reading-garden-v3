# Task Plan: Reading Garden Editor 开发实施（Sprint 4）

## Goal
补齐 `rgbook` 安全校验与 `rgsite` 发布包导出能力，形成可直接上传腾讯云 EdgeOne 的稳定打包链路，并保持断点恢复文档持续同步。

## Current Phase
Phase 5

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
- [ ] 提交 checkpoint commit（含回滚点）
- [ ] 推送 `origin/master`
- **Status:** in_progress

## Key Questions
1. `rgsite` 导出是否需要增加“仅当前选中书籍”子集打包模式？
2. `rgbook` 导入校验失败时是否要提供可下载的诊断报告？
3. 发布包是否需要附带 EdgeOne 缓存策略模板（如 HTML no-cache）？

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Sprint 4 先做安全再做发布 | 先降低错误导入风险，再推进部署链路 |
| `rgbook` 校验默认严格失败即阻断 | 防止脏数据进入本地书架 |
| `rgsite` 首版采用运行时白名单导出 | 先保证可部署正确性，再扩展可选内容 |
