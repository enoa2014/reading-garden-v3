# Reading Garden Editor 详细设计文档

## 1. 文档信息
- 文档名称：Reading Garden Editor 详细设计文档
- 文档版本：v1.1
- 编制日期：2026-02-11
- 对应需求文档：`reading-garden-editor-需求文档.md`
- 设计范围：纯静态本地编辑器（无后端）

## 2. 设计目标与原则

### 2.1 设计目标
1. 支持离线优先的建书、编辑、导入、导出全流程。
2. 支持图书交换包在不同用户/设备间传递与合并。
3. 支持整站发布包一键导出并部署到 EdgeOne。
4. 支持 LLM 与生图能力作为可选插件，不影响核心流程。

### 2.2 设计原则
- 离线优先：核心功能默认无网络可用。
- AI 可选：AI 是增强能力，不是业务硬依赖。
- 兼容优先：读取兼容历史异构格式，保存统一规范格式。
- 双包分离：交换包（单书）与发布包（整站）分开治理。
- 事务安全：导入合并必须支持冲突处理与失败回滚。

## 3. 总体架构设计

### 3.1 逻辑架构
```text
┌──────────────────────────────────────────────────────────────────┐
│                              UI 层                              │
│ Shelf | NewBookWizard | BookEditor | DataEditor | ImportExport │
│ ThemeEditor | Preview | AiAssistant | Settings                 │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                           应用服务层                            │
│ AppRouter | StateStore | UseCases | AutoSave | Recovery        │
└──────────────────────────────────────────────────────────────────┘
      │                    │                     │
      ▼                    ▼                     ▼
┌───────────────┐  ┌──────────────────┐  ┌─────────────────────────┐
│ 数据处理层    │  │ 校验层           │  │ 导入导出层              │
│ Normalizers   │  │ SchemaEngine     │  │ BookPackService         │
│ Migrator      │  │ RuleValidator    │  │ SitePackService         │
└───────────────┘  └──────────────────┘  └─────────────────────────┘
      │                    │                     │
      └────────────┬───────┴──────────────┬──────┘
                   ▼                      ▼
┌──────────────────────────────────────────────────────────────────┐
│                         基础设施层                               │
│ FileSystemAdapter | PathResolver | IndexedDBCache | ZipAdapter  │
│ AIProviderAdapter (optional) | ImageProviderAdapter (optional)  │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 运行模式
- `offline_manual`：默认模式，所有核心能力可用。
- `ai_assisted`：启用 LLM 文本建议与自动配置。
- `image_enhanced`：启用生图、或 prompt-only、emoji、none。

### 3.3 包类型设计
- 图书交换包：`*.rgbook.zip`（单书分享与导入合并）。
- 整站发布包：`*.rgsite.zip`（上传 EdgeOne 部署）。

## 4. 目录与模块组织

### 4.1 建议目录
```text
reading-garden-editor/
├── index.html
├── editor/
│   ├── js/
│   │   ├── core/
│   │   │   ├── app.js
│   │   │   ├── state.js
│   │   │   ├── filesystem.js
│   │   │   ├── path-resolver.js
│   │   │   ├── validator.js
│   │   │   └── errors.js
│   │   ├── normalizers/
│   │   │   ├── chapters-normalizer.js
│   │   │   ├── characters-normalizer.js
│   │   │   ├── registry-normalizer.js
│   │   │   └── index.js
│   │   ├── migrators/
│   │   │   └── format-migrator.js
│   │   ├── ai/
│   │   │   ├── provider-adapter.js
│   │   │   ├── llm-assistant.js
│   │   │   └── image-strategy.js
│   │   ├── packaging/
│   │   │   ├── book-pack-service.js
│   │   │   ├── site-pack-service.js
│   │   │   ├── import-merge-service.js
│   │   │   └── zip-adapter.js
│   │   ├── ui/
│   │   └── components/
│   ├── schemas/
│   │   ├── generated/
│   │   └── curated/
│   └── templates/
└── docs/
```

## 5. 核心数据模型

### 5.1 Canonical 模型（内部）
- `BookMeta`
- `ModuleConfig`
- `CanonicalChapter`
- `CanonicalCharacter`
- `CanonicalRelation`
- `AssetRef`
- `BookPackManifest`

### 5.2 BookPackManifest（交换包）
```json
{
  "format": "rgbook",
  "formatVersion": "1.0.0",
  "schemaVersion": "2026-02",
  "book": {
    "id": "string",
    "title": "string",
    "version": "string"
  },
  "createdAt": "2026-02-11T00:00:00Z",
  "createdBy": "string",
  "entry": "book/registry.json",
  "checksums": {
    "book/registry.json": "sha256:..."
  },
  "capabilities": {
    "llmGenerated": false,
    "imageMode": "ai_generate|prompt_only|emoji|none"
  }
}
```

### 5.3 SitePackManifest（发布包）
```json
{
  "format": "rgsite",
  "formatVersion": "1.0.0",
  "booksCount": 6,
  "entry": "index.html",
  "buildTime": "2026-02-11T00:00:00Z",
  "checks": {
    "schema": true,
    "assets": true,
    "crossRefs": true,
    "pathRewrite": true
  }
}
```

## 6. 核心模块设计

### 6.1 FileSystemAdapter（`core/filesystem.js`）
职责：目录读写、文件句柄缓存、权限恢复。

关键接口：
```js
openProject()
verifyStructure()
readJson(path)
writeJson(path, data)
readBinary(path)
writeBinary(path, blob)
list(path)
exists(path)
```

### 6.2 PathResolver（`core/path-resolver.js`）
职责：路径标准化、导出重写、引用扫描。

关键接口：
```js
normalize(path, base)
toProjectRelative(path)
rewriteForSite(path)
rewriteForBookPack(path, bookId)
collectRefsFromJson(json)
```

### 6.3 SchemaEngine + RuleValidator（`core/validator.js`）
职责：结构校验 + 业务规则校验。

规则示例：
- registry 的 `entry/data` 文件必须存在。
- 资源路径必须可解析到本地文件。
- 模块 `id` 不可重复。

### 6.4 NormalizerRegistry（`normalizers/index.js`）
职责：异构格式适配。

策略：
- 读取兼容：支持历史格式。
- 内部统一：转为 canonical。
- 写出统一：转为目标规范。

### 6.5 AiProviderAdapter（`ai/provider-adapter.js`）
职责：屏蔽不同 LLM 提供商 API 差异。

关键接口：
```js
analyzeBookText(input)
suggestModules(input)
autoConfigureModules(input)
healthCheck()
```

### 6.6 ImageStrategy（`ai/image-strategy.js`）
职责：统一图片生成策略。

策略类型：
- `ai_generate`
- `prompt_only`
- `emoji`
- `none`

关键接口：
```js
prepareImageTask(scene)
execute(task)
fallback(task)
```

### 6.7 BookPackService（`packaging/book-pack-service.js`）
职责：单书交换包导入导出。

导出内容：
- `manifest.json`
- `book/registry.json`
- `book/data/**`
- `book/assets/**`
- `book/prompts/**`（可选）
- `book/ai-meta.json`（可选）

关键接口：
```js
exportBook(bookId, options)
inspectBookPack(zipFile)
importBookPack(zipFile, mergeOptions)
```

### 6.8 ImportMergeService（`packaging/import-merge-service.js`）
职责：交换包导入冲突处理与事务回滚。

冲突维度：
- `bookId` 冲突。
- 资源路径冲突。
- 模块 id 冲突。

冲突策略：
- `overwrite`
- `rename`
- `skip`
- `manual`

### 6.9 SitePackService（`packaging/site-pack-service.js`）
职责：整站发布包导出。

关键步骤：
1. 全量校验。
2. 路径重写。
3. 清理敏感配置（API key 等）。
4. 生成 `rgsite-manifest.json`。
5. 打包下载。

### 6.10 AutoSave + Recovery
职责：防丢失与崩溃恢复。

机制：
- 500ms 防抖写盘。
- 30s 快照写 IndexedDB。
- 启动恢复向导。

## 7. 关键流程设计

### 7.1 新建书流程
```text
点击“新建书”
 -> 选择模板
 -> 输入基础信息
 -> 生成 book 目录与基础数据文件
 -> 更新 books.json
 -> 打开编辑器页签
```

### 7.2 原文分析与模块建议流程（可选）
```text
导入原文
 -> 检查 LLM 配置
 -> 调用 suggestModules
 -> 输出建议模块列表 + 理由 + 置信度
 -> 用户确认
 -> 写入 registry 初稿
```

### 7.3 图片策略流程
```text
模块需要图片
 -> 读取当前 imageMode
 -> ai_generate: 调接口生成并入库
 -> prompt_only: 生成 prompt 文件
 -> emoji: 回填 emoji 占位
 -> none: 标记无图并跳过
```

### 7.4 导出图书交换包流程
```text
选择书籍
 -> 校验单书数据完整性
 -> 收集 registry/data/assets/prompts
 -> 生成 manifest + checksums
 -> 打包 *.rgbook.zip
```

### 7.5 导入图书交换包并合并流程
```text
选择 *.rgbook.zip
 -> 安全检查（路径穿越/大小限制）
 -> manifest/schema 校验
 -> 解析冲突
 -> 用户选冲突策略
 -> 事务写入 + 更新 books.json
 -> 失败回滚
```

### 7.6 导出整站发布包流程
```text
点击“导出发布包”
 -> 全量校验（schema/assets/crossRefs）
 -> 路径重写
 -> 剔除敏感配置
 -> 打包 *.rgsite.zip
 -> 输出 EdgeOne 部署说明
```

## 8. 接口契约

### 8.1 ValidationResult
```json
{
  "valid": false,
  "errors": [
    {
      "code": "SCHEMA_REQUIRED",
      "path": "chapters[2].title",
      "message": "缺少必填字段 title",
      "suggestion": "请补全章节标题"
    }
  ]
}
```

### 8.2 MergePlan
```json
{
  "bookId": "wave",
  "conflicts": [
    {
      "type": "bookId",
      "target": "data/wave",
      "options": ["overwrite", "rename", "skip", "manual"]
    }
  ],
  "selectedStrategy": "rename"
}
```

### 8.3 AiConfig（本地配置，不入导出包）
```json
{
  "provider": "openai-compatible",
  "baseUrl": "https://...",
  "model": "...",
  "apiKeyRef": "local-only",
  "timeoutMs": 30000
}
```

## 9. 兼容性与降级
- 原生模式：Chrome/Edge 优先。
- 降级模式：Safari/Firefox 使用 ZIP 导入/导出工作流。
- AI 降级：Provider 不可用时自动切回手工模式。
- 图片降级：`ai_generate` 失败时按策略回退至 `prompt_only -> emoji -> none`。

## 10. 错误处理与安全

### 10.1 错误码
| 错误码 | 场景 | 处理 |
|--------|------|------|
| FS_PERMISSION_DENIED | 目录权限失败 | 提示授权重试 |
| SCHEMA_INVALID | 数据结构不合法 | 字段级提示与修复建议 |
| PACK_FORMAT_INVALID | 交换包格式错误 | 阻断导入 |
| PACK_SECURITY_VIOLATION | 包存在路径穿越/恶意文件 | 阻断导入并告警 |
| MERGE_CONFLICT_UNRESOLVED | 冲突未处理完成 | 阻断提交 |
| EXPORT_VALIDATION_FAILED | 发布包校验失败 | 阻断导出并生成问题清单 |
| SECRET_LEAK_DETECTED | 检测到敏感配置泄漏 | 阻断导出 |

### 10.2 安全策略
- 导入包路径白名单，拒绝 `../` 越界路径。
- 限制单文件与总包大小，防止资源耗尽。
- API Key 仅存本地安全配置，不写入任何导出包。
- UI 渲染统一转义，禁止执行导入内容中的脚本。

## 11. 性能设计
- 仅加载当前书籍与当前模块数据。
- 大数组编辑器使用虚拟滚动。
- Schema 编译缓存，增量校验优先。
- 打包时分阶段进度反馈，避免 UI 阻塞。

## 12. 测试设计

### 12.1 单元测试
- `PathResolver`：路径归一化与重写。
- `Normalizer`：异构数据读写一致性。
- `BookPackService`：manifest 生成与校验。
- `ImportMergeService`：冲突策略与回滚。
- `AiProviderAdapter`：接口超时、失败回退。

### 12.2 集成测试
- 新建书 -> 编辑 -> 本地预览。
- 导出 `rgbook` -> 导入 -> 合并 -> 浏览。
- 导出 `rgsite` -> 本地 HTTP 验证。
- AI 开启与关闭两条链路均可完成完整流程。

### 12.3 端到端测试
1. A 用户本地创建一本新书。
2. 选择 `prompt_only` 图片策略并完成内容。
3. 导出 `*.rgbook.zip`。
4. B 用户导入并选择 `rename` 合并策略。
5. B 用户本地浏览通过。
6. B 用户导出 `*.rgsite.zip` 并部署 EdgeOne。
7. 验证线上访问、无关键 404、无阻断错误。

## 13. 发布与运维建议
- 发布前必须通过“导出校验 + 本地冒烟”双闸门。
- 提供 `QA Checklist` 随包输出，包含路径、资源、模块初始化检查。
- 记录导出 manifest 与版本号，便于问题回溯。

## 14. 实施计划（建议 6 周）
1. Sprint 1：基础框架、结构校验、书架管理。
2. Sprint 2：归一化层、迁移层、通用编辑器。
3. Sprint 3：新建书向导、专用编辑器。
4. Sprint 4：图书交换包导入导出与合并。
5. Sprint 5：整站发布包与 EdgeOne 验证。
6. Sprint 6：AI 可选增强与体验优化。

## 15. 待决问题
1. `rgbook` 的版本兼容策略是否采用“向后兼容两代”。
2. 冲突处理默认策略是 `rename` 还是 `manual`。
3. `ai-meta.json` 的默认导出开关是否关闭。
4. `none` 图片模式下前端占位样式是否统一标准模板。

## 16. 交付物清单
- `reading-garden-editor-需求文档.md`
- `reading-garden-editor-详细设计文档.md`

