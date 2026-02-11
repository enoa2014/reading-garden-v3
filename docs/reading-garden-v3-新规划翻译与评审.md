# Reading Garden Editor 新规划中文翻译与评审报告

## 文档信息
- 文档类型：规划翻译 + 技术评审
- 适用项目：`reading-garden-v3`
- 编制日期：2026-02-11
- 输入材料：`./txt`（新规划英文版）、`./11`（既有中文评审意见）

## 一、文档目的
1. 将 `./txt` 的实施规划转换为正式中文版本，便于团队统一理解。
2. 结合 `./11` 的评审意见，对规划可执行性、风险点、优先级进行审查。
3. 输出可直接用于排期与立项决策的正式 Markdown 文档。

## 二、`./txt` 规划中文翻译（结构化译文）

### 2.1 背景与问题定义
`reading-garden-v3` 是面向教师/家长的纯静态互动阅读平台，当前已包含 6 本书与 14 个互动模块。平台本身设计良好，但新增图书和定制内容仍高度依赖技术能力，主要体现在：
- 需要手工维护多种 JSON 文件（如 `books.json`、`registry.json`、`chapters.json` 等）。
- 需要理解复杂数据结构（如角色关系图、章节内容多格式等）。
- 需要掌握资源路径规范和目录约定。
- 特定互动需要编写模块代码。
- 缺乏前置校验，错误常在运行期暴露。

这导致目标用户（教师/家长）在“创建新书、定制教学内容、与 AI 协作生成内容、快速部署”上的门槛较高。

### 2.2 方案目标
建设 `reading-garden-editor`（本地 Web 可视化编辑器），目标如下：
1. 降低内容制作门槛：表单驱动 + 校验，不要求直接编辑 JSON。
2. 支持 AI 协作：提供规范模板，便于通过 ChatGPT/Claude 生成内容。
3. 保持零后端架构：编辑器本地运行，导出可部署 ZIP。
4. 支持腾讯云 EdgeOne 部署：提供导出与部署指引。

### 2.3 技术路线
- 纯静态 `HTML/CSS/JS`，无构建工具，双击即可启动。
- 基于 `File System Access API` 直接读写本地 `reading-garden-v3` 目录。
- 基于 JSON Schema 生成表单与校验。
- 基于 iframe 的实时预览。
- 使用 `JSZip` 打包导出可部署站点。

### 2.4 架构总览（译）
```text
reading-garden-editor/
├── index.html
├── editor/
│   ├── css/
│   │   ├── editor.css
│   │   ├── forms.css
│   │   └── preview.css
│   ├── js/
│   │   ├── core/
│   │   │   ├── app.js
│   │   │   ├── state.js
│   │   │   ├── filesystem.js
│   │   │   └── validator.js
│   │   ├── ui/
│   │   │   ├── dashboard.js
│   │   │   ├── book-editor.js
│   │   │   ├── data-editor.js
│   │   │   ├── theme-editor.js
│   │   │   └── preview.js
│   │   ├── components/
│   │   │   ├── form-builder.js
│   │   │   ├── image-uploader.js
│   │   │   ├── color-picker.js
│   │   │   └── ai-import.js
│   │   ├── export/
│   │   │   ├── packager.js
│   │   │   └── validator.js
│   │   └── lib/
│   │       ├── jszip.min.js
│   │       └── ajv.min.js
│   └── schemas/
│       ├── books.schema.json
│       ├── registry.schema.json
│       ├── chapters.schema.json
│       ├── characters.schema.json
│       └── ...
├── templates/
│   ├── default-book/
│   └── ai-specs/
└── reading-garden-v3/
```

### 2.5 数据流（译）
用户打开编辑器 -> 选择 `reading-garden-v3` 目录 -> 加载并校验 `data/books.json` -> 在仪表盘查看图书 -> 进入图书编辑/主题编辑/AI 导入 -> 实时校验与预览 -> 一键导出 -> 上传 EdgeOne 部署。

### 2.6 实施阶段（Phase 1-10）

#### Phase 1：核心基础设施（Critical）
- 目标：完成编辑器壳层、文件系统接入、基础导航。
- 关键文件：`index.html`、`filesystem.js`、`state.js`、`app.js`。
- 交付：可打开项目目录并在各视图间导航。

#### Phase 2：Schema 与校验（Critical）
- 目标：建立 JSON Schema 校验体系。
- 关键文件：`books.schema.json` 及其他 schema、`validator.js`。
- 交付：可加载并校验 JSON，输出可读错误信息。

#### Phase 3：图书编辑器（High）
- 目标：可编辑图书元数据与模块配置。
- 能力：Schema 动态表单、图片上传、模块启停与排序、自动保存。
- 交付：可编辑 `registry.json` 并管理模块。

#### Phase 4：数据编辑器（High）
- 目标：编辑章节、人物、主题、时间线等模块数据。
- 能力：通用 JSON 表单 + 专用编辑器（章节/人物等）。
- 交付：支持主要数据类型编辑，并在保存时做格式归一化处理。

#### Phase 5：主题可视化编辑（Medium）
- 目标：无需编码即可调整主题。
- 能力：解析 `tokens.css`、变量可视化调色、实时预览、生成覆盖样式。
- 交付：主题编辑器可用。

#### Phase 6：实时预览系统（Medium）
- 目标：在编辑器内实时预览阅读平台。
- 能力：iframe 预览、设备视口切换、刷新控制、错误兜底。
- 交付：数据变更后可即时预览。

#### Phase 7：AI 导入系统（High）
- 目标：支持 AI 生成内容的规范导入。
- 能力：下载规格模板、粘贴/上传 JSON、Schema 校验、冲突检测、合并策略。
- 交付：可安全导入 AI 内容。

#### Phase 8：导出与打包（Critical）
- 目标：一键生成可部署 ZIP。
- 能力：导出前全量校验、复制核心文件、生成部署说明、输出 EdgeOne 配置。
- 交付：可下载并部署的完整包。

#### Phase 9：体验打磨（Medium）
- 目标：提升易用性与生产可用性。
- 能力：新手引导、快捷键、撤销重做、进度状态、异常恢复。
- 交付：交互完整、可持续使用。

#### Phase 10：文档体系（High）
- 目标：形成非技术用户可读的完整文档。
- 范围：README、用户手册、AI 协作指南、可选视频教程。
- 交付：可用于培训与推广的文档包。

### 2.7 验证与测试要求（译）
- 分阶段手工测试（核心、编辑、主题、AI 导入、导出）。
- 跨浏览器验证（Chrome/Edge/Safari/Firefox 降级流程）。
- 端到端工作流验证（建书 -> AI 导入 -> 预览 -> 导出 -> 本地部署）。
- 性能指标：加载、预览刷新、导出、保存延迟需满足目标阈值。

### 2.8 风险与缓解（译）
- 浏览器兼容性：特性检测 + 降级上传/下载工作流。
- 数据丢失：自动保存到 IndexedDB + 重载恢复。
- 导出无效：阻断式校验 + 预检清单 + 测试部署。
- 大项目性能：惰性加载、虚拟列表、分页、图片体积告警。
- 学习曲线：引导流程、上下文帮助、模板与视频教程。

### 2.9 成功标准（译）
- 非技术教师可在 10 分钟内创建新书。
- 可成功导入 AI 生成角色数据。
- 可视化主题调整与实时预览可用。
- 可导出并部署为可运行站点。
- 保持纯静态、零后端、低门槛、可验证的技术目标。

### 2.10 下一步（译）
1. 评审规划并确认路线。
2. 明确阶段优先级。
3. 启动 Phase 1 核心基础设施。
4. 采用“构建 -> 测试 -> 修正”快速迭代。

## 三、结合 `./11` 的评审结论

### 3.1 总体结论
该规划方向正确、阶段划分清晰，具备落地基础；但在“现有数据异构程度、Schema 基线建设、模块类型覆盖、路径重写与导出可用性”方面估计偏乐观。建议在启动开发前进行一次“数据归一化与约束基线”补强，否则中后期返工风险较高。

### 3.2 关键发现（含 `./11` 与实仓核对）
| 发现 | 证据 | 影响 | 建议 | 优先级 |
|------|------|------|------|--------|
| 人物数据结构存在双轨制 | `totto-chan/characters.json` 使用 `nodes[].data`；`wave/characters.json` 使用扁平 `nodes[]`，`edges` 字段名为 `relation` | 编辑器与校验器若按单一 schema 实现将直接失效 | 增加读取兼容层 + 保存归一化层 + 首次迁移向导 | Critical |
| 章节数据格式不统一 | `totto-chan` 为对象根且 `content` 为字符串；`wave` 为对象根但 `content` 为数组；`wonder` 为数组根；`lord-of-the-flies` 章节内容策略不同 | 通用章节编辑器难以一次性覆盖 | 先抽象章节适配器（root/entry/content 三维）再做 UI | Critical |
| 模块数据类型覆盖不足 | 实际存在 `map-hotspots.json`、`philosophies.json`、`scenarios.json`、`logograms.json`、`precepts.json` 等多类型 | 仅实现示例中的 4-6 类会导致编辑能力缺口 | 以 `registry.json` 的 `modules[].data` 自动发现并分层支持（通用 + 专用） | High |
| 路径规范混用 | 资源路径同时出现 `assets/...` 与 `../assets/...`；模块入口常见 `../../js/modules/*.js` | 导出后路径易失效，运行期 404 风险高 | 在 Phase 1 即建立路径归一化器；Phase 8 增加路径重写与完整性扫描 | Critical |
| 主题编辑复杂度较高 | `tokens.css` 约 63 项变量，含全局/书籍/动态变量 | 一次性可视化覆盖成本高 | 先做分层编辑（基础色 -> 进阶变量），后续再扩展全量变量 | Medium |
| Schema 文件需要从零建立 | 当前仓库未提供完整现成 schema 体系 | 若直接开发 UI，后续校验规则回填成本高 | 将“Schema 逆向生成 + 人工修订”前置到 Phase 2 | Critical |

### 3.3 优先级调整建议（对原 10 阶段）
1. 保持 Phase 1-2 为 Critical。
2. 在 Phase 3 与 Phase 4 之间新增“Phase 3.5：数据归一化与迁移层”（Critical）。
3. 将 Phase 7（AI 导入）提升为 Critical，因其直接关系目标用户效率。
4. 将 Phase 5（主题可视化）下调为 Medium/Low，分批实现。

### 3.4 建议新增的硬性交付物
- `docs/data-format-analysis.md`：各书数据结构差异、兼容策略、迁移规则。
- `editor/js/core/normalizers/`：按数据类型的读写归一化器。
- `editor/js/core/path-resolver.js`：路径标准化、重写、死链检测。
- `editor/schemas/generated/`：扫描生成的初版 schema（人工校验后转正式版）。

### 3.5 验收标准补充（建议纳入 Phase 8）
- 导出包在全新 Linux/Windows/macOS 环境可直接运行。
- 本地 `python -m http.server` 或 `http-server` 访问无白屏。
- 关键页面无 404 资源。
- 模块初始化无错误。
- 浏览器控制台无阻断级报错。

### 3.6 最终评审结论
- 结论：**有条件通过**。
- 通过条件：
  1. 在正式开发前完成数据格式盘点与归一化设计。
  2. 将路径重写与导出可用性验证前置为刚性验收门槛。
  3. 先实现“通用可用”再做“主题高级可视化”，避免资源分散。

## 四、执行建议（面向立刻落地）
1. 本周完成 Phase 1-2 与“数据差异盘点文档”。
2. 下周实现归一化层（读取兼容 + 保存统一）并完成最小可用数据编辑器。
3. 第三周集中完成 AI 导入与导出验证闭环。
4. 第四周进入体验打磨与文档收口。

---

## 附录：本次评审涉及的关键路径
- `txt`
- `11`
- `reading-garden-v3/data/totto-chan/characters.json`
- `reading-garden-v3/data/wave/characters.json`
- `reading-garden-v3/data/totto-chan/chapters.json`
- `reading-garden-v3/data/wave/chapters.json`
- `reading-garden-v3/data/wonder/chapters.json`
- `reading-garden-v3/data/totto-chan/registry.json`
- `reading-garden-v3/data/wonder/registry.json`
- `reading-garden-v3/css/tokens.css`
