# Task Plan: Reading Garden Editor 开发实施（Sprint 2）

## Goal
在 Sprint 1 骨架基础上继续推进：实现“新建书向导 + 规则校验增强 + 交换包服务骨架”，并保持可回滚与可恢复开发流程。

## Current Phase
Phase 4

## Phases
### Phase 1: Sprint 2 目标收敛
- [x] 明确本轮核心目标（建书、校验、交换包骨架）
- [x] 对齐离线优先与回滚策略要求
- **Status:** complete

### Phase 2: 核心能力扩展
- [x] 新增 `book-template.js` 生成最小书籍模板
- [x] 扩展 `filesystem.js`（`exists`/`deletePath`）
- [x] 扩展 `validator.js`（新建书输入校验）
- **Status:** complete

### Phase 3: 主流程增强
- [x] 扩展 `app.js`：新建书流程、健康检查、回滚清理
- [x] 扩展 `dashboard.js`：新建书表单、反馈信息、健康面板
- [x] 扩展样式：表单与状态反馈样式
- **Status:** complete

### Phase 4: 交换包骨架落地与验证
- [x] 新增 `packaging/book-pack-service.js` 骨架
- [x] 新增 `packaging/import-merge-service.js` 骨架
- [x] 新增 `packaging/site-pack-service.js` 骨架
- [x] 通过语法检查
- [x] 更新运行文档与开发日志
- [ ] checkpoint 提交与推送
- **Status:** in_progress

### Phase 5: 下一轮规划
- [ ] 规划 Sprint 3（交换包真实导入导出 + 新建书向导增强）
- **Status:** pending

## Key Questions
1. 新建书流程是否已具备“失败自动回滚”最低保障？
2. 交换包骨架接口是否足够支持下一轮直接填充实现？
3. 文档是否能保证断电后继续开发无需口头补充？

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Sprint 2 先做最小可用建书而不等待完整交换包实现 | 先提高内容生产效率，保持迭代速度 |
| 新建书失败采用“已创建路径逆序删除”回滚 | 避免产生半成品目录污染 |
| 交换包先落接口骨架（manifest/merge plan） | 为 Sprint 3 减少设计反复 |
