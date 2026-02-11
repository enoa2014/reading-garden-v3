# Task Plan: Reading Garden Editor 开发实施（Sprint 3）

## Goal
把 `rgbook` 从骨架升级为可用能力：支持单书导出/导入、冲突策略合并、基础回滚，并继续保持文档可恢复。

## Current Phase
Phase 4

## Phases
### Phase 1: Sprint 3 设计落地准备
- [x] 选择本地打包方案（JSZip 本地 vendor）
- [x] 明确导入冲突策略（rename/overwrite/skip）
- **Status:** complete

### Phase 2: 打包服务实现
- [x] 实现 `BookPackService.exportBookPack`
- [x] 实现 `BookPackService.inspectBookPack`
- [x] 实现 `BookPackService.importBookPack`
- [x] 扩展 `FileSystemAdapter` 二进制读写能力
- **Status:** complete

### Phase 3: UI 流程接入
- [x] Dashboard 增加 rgbook 导出表单
- [x] Dashboard 增加 rgbook 导入表单 + 冲突策略
- [x] `app.js` 接入导出/导入处理流程
- **Status:** complete

### Phase 4: 校验与文档同步
- [x] JS 语法检查（编辑器代码）
- [x] 模块级 smoke test（merge/path）
- [ ] 同步 `findings.md` / `progress.md` 记录
- [ ] checkpoint 提交与推送
- **Status:** in_progress

### Phase 5: 下一迭代规划
- [ ] 规划 `rgsite` 真正导出链路
- [ ] 规划 rgbook 校验增强（checksum、恶意包检测）
- [ ] 规划自动化回归测试
- **Status:** pending

## Key Questions
1. 当前 `rgbook` 导入回滚策略是否覆盖主要失败路径？
2. 下一步应先做 `rgsite` 还是先补 `rgbook` 安全校验？
3. 是否需要把导入过程可视化为步骤日志面板？

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| 引入本地 `JSZip` vendor 文件 | 保持离线可用，避免运行时 CDN 依赖 |
| 先实现 rgbook，再推进 rgsite | 优先满足“教师互相分享书籍”场景 |
| 导入冲突默认推荐 `rename` | 最大限度降低覆盖风险 |
