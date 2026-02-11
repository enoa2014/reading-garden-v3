# 阅读花园 V3 — Reading Garden

> 纯静态、配置驱动的沉浸式互动阅读平台。6 本书，14 个功能模块，零构建依赖。

## 快速开始

```bash
cd /path/to/reading-garden-v3
python3 -m http.server 8080
# 打开 http://127.0.0.1:8080/
```

> 需要本地 HTTP 服务器，否则浏览器会阻止 `fetch` / `import()`。

## 编辑器开发（WIP）

`reading-garden-v3` 正在新增本地可运行的编辑器子应用：

- 路径：`reading-garden-editor/index.html`
- 当前阶段：Sprint 4（安全校验 + 发布打包）
- 已实现：打开项目、书架管理、新建书、`rgbook` 导入导出、`rgsite` 全量/子集发布包导出（subset 支持 balanced/minimal + missingAssets/MISSING-ASSETS.txt 分组+分类 + SVG 占位回退）
- 已实现：`rgbook` 导入失败诊断报告下载（完整/脱敏/自定义 + 最近模板复用/清空/导入导出/预览差异/merge导入）、编辑器回归脚本
- 当前目标：导出可上传腾讯云 EdgeOne 的稳定发布包链路

配套文档：

- 需求文档：`docs/reading-garden-editor-需求文档.md`
- 详细设计：`docs/reading-garden-editor-详细设计文档.md`
- 规划评审：`docs/reading-garden-v3-新规划翻译与评审.md`

回滚策略（开发中）：

1. 所有关键节点小步提交（checkpoint commit）
2. 编辑器文件写入默认先备份到 `.rg-editor-backups/<timestamp>/`
3. `task_plan.md` / `findings.md` / `progress.md` 持续写盘，支持断电后恢复开发上下文

回归脚本：

```bash
./scripts/editor-regression.sh
# 可选：指定 packStats 的 subset 样本书籍
EDITOR_PACK_STATS_SELECTED_BOOKS="totto-chan,wave" ./scripts/editor-regression.sh
# 可选：要求样本书籍 ID 全部有效（有缺失即失败）
EDITOR_PACK_STATS_REQUIRE_VALID_SELECTION=true ./scripts/editor-regression.sh
```

CI 门禁：

- `.github/workflows/editor-regression.yml` 已接入回归检查（push/PR 自动执行）
- CI 会上传 `editor-regression-report` artifact（报告文件：`tmp/editor-regression-report.json`）
- 报告新增 `packStats`：`full/subset-balanced/subset-minimal` 包体与体积占比对比
- CI 固定 `EDITOR_PACK_STATS_SELECTED_BOOKS=totto-chan,wave`，确保分支间报告可比
- `workflow_dispatch` 可通过 `pack_stats_selected_books` 覆盖抽样书籍
- `workflow_dispatch` 可通过 `pack_stats_require_valid_selection` 控制严格校验（默认 true）
- `workflow_dispatch` 可通过 `pack_stats_max_missing_assets` 配置 missing-assets 失败阈值（默认 1）
- `workflow_dispatch` 可通过 `pack_stats_max_missing_book_module` 配置模块缺失阈值（默认 0）
- `workflow_dispatch` 可通过 `pack_stats_max_missing_book_cover` 配置封面缺失阈值（默认禁用）
- `workflow_dispatch` 可通过 `pack_stats_max_missing_file_ref` 配置文件引用缺失阈值（默认禁用）
- `workflow_dispatch` 可通过 `pack_stats_max_missing_unclassified` 配置未分类缺失阈值（默认禁用）
- CI Job Summary 会输出 `packStats` 摘要（含 missing/invalid IDs、missing-assets 告警、分类统计）
- CI 默认开启 `EDITOR_PACK_STATS_REQUIRE_VALID_SELECTION=true`（无效抽样 ID 直接失败）
- 严格模式下会额外校验抽样 ID 格式（仅允许 `a-z0-9-`）

## 项目概览

| 指标 | 数值 |
|------|------|
| JavaScript | 5,171 行 |
| CSS | 13,673 行 |
| 总代码量 | 18,844 行 |
| 书籍数量 | 6 本 |
| 功能模块 | 14 个 |
| 图片资源 | 194 个 |
| 构建依赖 | 0（纯静态） |

## 收录书目

| 书名 | 作者 | 标签 | 模块数 |
|------|------|------|--------|
| 窗边的小豆豆 | 黑柳彻子 | 教育·童年·日本文学 | 5 |
| 浪潮 | 托德·斯特拉瑟 | 历史·社会实验·反思 | 5 |
| 你一生的故事 | 特德·姜 | 科幻·语言学·非线性叙事 | 5 |
| 奇迹男孩 | R.J. 帕拉西奥 | 成长·多视角·选择善良 | 4 |
| 一个叫欧维的男人决定去死 | 弗雷德里克·巴克曼 | 人际关系·治愈·北欧文学 | 5 |
| 蝇王 | 威廉·戈尔丁 | 人性·寓言·社会心理学 | 5 |

## 功能模块

### 通用模块（多本书共享）

| 模块 | 说明 |
|------|------|
| **reading** | 章节阅读器：目录导航、字体调节、笔记、进度追踪、多视角切换 |
| **characters** | 人物图鉴：头像卡片 + Cytoscape 关系图谱 |
| **themes** | 主题探索：翻转卡片式主题展示 |
| **timeline** | 时间线：事件卡片、分类筛选 |
| **interactive** | 互动情境：场景式学习与反馈 |

### 专属模块

| 模块 | 所属书籍 | 说明 |
|------|---------|------|
| **map** | 窗边的小豆豆 | 巴学园互动地图，热点探索 |
| **philosophy** | 窗边的小豆豆 | 教育理念对比展示 |
| **scenes** | 浪潮 | 场景图库与解读 |
| **linguistics** | 你一生的故事 | 七肢桶文字动画系统（双 Canvas） |
| **precepts** | 奇迹男孩 | 布朗先生每月格言墙 |
| **suicide** | 一个叫欧维的男人 | 敏感内容（含内容警告） |
| **symbols** | 蝇王 | 象征物分析（海螺、火、眼镜） |
| **discussion** | 蝇王 | 讨论题与道德困境 |
| **teaching** | 蝇王 | 课堂教学资源 |

## 架构

```
index.html ──── 首页（书单卡片 + 书脊书架）
                  │
                  ▼
book.html?book=<id> ──── 单书阅读页
                  │
     ┌────────────┼────────────┐
     ▼            ▼            ▼
 registry.json  BookRuntime  modules/
 (模块配置)    (运行时引擎)   (功能模块)
     │            │            │
     ▼            ▼            ▼
 data/*.json   动态 import   render(ctx, payload)
```

### 核心运行时

**BookRuntime**（`js/core/book-runtime.js`）是应用核心：

1. 读取 `registry.json` 获取模块配置
2. 渲染 Tab 导航和面板容器
3. 用户点击 Tab → 动态 `import()` 模块 JS
4. 调用 `ctx.fetchJSON()` 加载数据
5. 调用 `module.render(ctx, payload)` 渲染内容

**模块生命周期**：
- `init(ctx)` — 一次性初始化（可选）
- `render(ctx, payload)` — 渲染/更新 UI
- `destroy(ctx)` — 清理资源（可选）

**上下文对象 `ctx`** 提供：
- `panelEl` — DOM 面板容器
- `modal` — 全局弹窗系统
- `fetchJSON(path)` — 数据加载（带超时）
- `resolvePath(path)` — 资源路径解析
- `activateModule(id)` — 跨模块导航
- `setSharedState / getSharedState / subscribeSharedState` — 跨模块通信

### 目录结构

```
reading-garden-v3/
├── index.html              # 首页
├── book.html               # 单书阅读页（动态）
├── css/
│   ├── tokens.css          # 设计令牌（颜色、字体、间距）
│   ├── base.css            # 重置与基础样式
│   ├── components.css      # 通用组件（按钮、标签、弹窗）
│   ├── book.css            # 阅读页布局
│   ├── bookshelf.css       # 首页样式
│   └── modules.css         # 所有模块样式（3000+ 行）
├── js/
│   ├── app/
│   │   ├── book.js         # 阅读页入口
│   ├── core/
│   │   ├── book-runtime.js # 运行时引擎
│   │   ├── dom.js          # DOM 工具函数
│   │   ├── icons.js        # SVG 图标映射
│   │   ├── modal.js        # 弹窗管理
│   │   └── storage.js      # localStorage 封装
│   ├── modules/            # 14 个功能模块
│   │   ├── reading-module.js
│   │   ├── characters-module.js
│   │   ├── themes-module.js
│   │   ├── timeline-module.js
│   │   ├── interactive-module.js
│   │   ├── linguistics-module.js
│   │   ├── precepts-module.js
│   │   ├── symbols-module.js
│   │   ├── discussion-module.js
│   │   ├── teaching-module.js
│   │   ├── suicide-module.js
│   │   ├── map-module.js
│   │   ├── philosophy-module.js
│   │   └── scenes-module.js
│   ├── vendor/
│   │   └── cytoscape.min.js  # 图谱可视化库
│   └── bookshelf.js        # 首页书架交互
├── data/
│   ├── books.json          # 书单主配置
│   ├── totto-chan/          # 窗边的小豆豆
│   ├── wave/               # 浪潮
│   ├── story-of-your-life/ # 你一生的故事
│   ├── wonder/             # 奇迹男孩
│   ├── a-man-called-ove/   # 一个叫欧维的男人
│   └── lord-of-the-flies/  # 蝇王
└── assets/images/          # 194 个图片资源
```

## 设计系统

### 视觉风格："Botanical Journal"

植物学期刊风格 — 温润典雅，有机纹理与锐利排版的结合。

### 字体

| 用途 | 字体 |
|------|------|
| 标题/展示 | Playfair Display |
| 正文/导航 | Source Serif 4 |
| 中文回退 | Noto Serif SC / Georgia |

### 配色

| 令牌 | 浅色模式 | 暗色模式 | 用途 |
|------|---------|---------|------|
| `--bg-primary` | `#f6f1ea` | `#181612` | 页面背景 |
| `--text-primary` | `#1a1a1a` | `#e8e0d4` | 主文字 |
| `--text-secondary` | `#6b6156` | `#9e9488` | 辅助文字 |
| `--accent-forest` | `#2d4a3e` | — | 主按钮、品牌色 |
| `--accent-warm` | `#c8a45a` | — | 金色强调 |
| `--accent-sage` | `#5a8a7a` | — | 章节标签 |

### 每本书独立主题色

通过 `data-book` 属性自动切换：

| 书籍 | `--book-primary` | `--book-secondary` |
|------|-----------------|-------------------|
| 窗边的小豆豆 | `#d4a843` (暖金) | `#7a5c2e` |
| 浪潮 | `#2a6f8a` (深蓝) | `#8a3a3a` |
| 你一生的故事 | `#4a3a6e` (紫) | `#9e7e2e` |
| 奇迹男孩 | `#4a8eb0` (天蓝) | `#c4a032` |
| 一个叫欧维的男人 | `#4e6a4a` (森绿) | `#b06a3a` |
| 蝇王 | `#2a4a1a` (深绿) | `#b08020` |

## 添加新书指南

添加一本新书只需 3 步，**无需修改任何代码**：

### 1. 创建数据目录

```
data/your-book-id/
├── registry.json     # 模块配置（必须）
├── chapters.json     # 章节索引
├── chapters/
│   ├── 1.json
│   ├── 2.json
│   └── ...
└── characters.json   # 人物数据（可选）
```

### 2. 编写 registry.json

```json
{
  "book": {
    "id": "your-book-id",
    "title": "书名",
    "author": "作者",
    "icon": "book"
  },
  "modules": [
    {
      "id": "reading",
      "title": "阅读",
      "icon": "book-open",
      "entry": "../../js/modules/reading-module.js",
      "data": "chapters.json",
      "active": true
    },
    {
      "id": "characters",
      "title": "人物",
      "icon": "users",
      "entry": "../../js/modules/characters-module.js",
      "data": "characters.json"
    }
  ]
}
```

### 3. 注册到书单

在 `data/books.json` 中添加条目：

```json
{
  "id": "your-book-id",
  "title": "书名",
  "author": "作者",
  "cover": "assets/images/your-book-id/cover.webp",
  "description": "简介",
  "page": "book.html?book=your-book-id",
  "tags": ["标签1", "标签2"]
}
```

## 特性

- **零构建** — 纯 HTML/CSS/JS，直接部署
- **配置驱动** — 通过 JSON 注册表定义模块，无需写代码
- **动态加载** — ES Module `import()` 按需加载，首屏快速
- **主题系统** — 浅色/深色切换 + 每本书独立配色
- **教师模式** — 放大字体，适合课堂投影
- **移动优先** — 底部 Tab 栏（手机）/ 顶部 Tab 栏（桌面）
- **无障碍** — 键盘导航、ARIA 标签、`aria-live` 动态区域、焦点管理
- **阅读进度** — LocalStorage 保存章节进度和笔记
- **敏感内容** — 内容警告机制（如《欧维》自杀情节）

## 部署

### 方式 A：项目根目录（推荐）

```bash
# 整个 reading-garden-v3/ 作为站点根
# 适用于 Nginx、Caddy、GitHub Pages 等
```

### 方式 B：子目录

```bash
# 作为父目录的子文件夹
# 路径解析系统会自动适配
```

### 静态资源服务器要求

- 支持 `application/javascript` MIME 类型
- 支持 ES Module 的 `import` 语句
- 无需 SSR 或 Node.js

## 技术栈

| 类别 | 技术 |
|------|------|
| 语言 | HTML5 / CSS3 / ES2022+ |
| 字体 | Google Fonts (Playfair Display + Source Serif 4) |
| 图谱 | Cytoscape.js (人物关系网络) |
| 存储 | LocalStorage (进度/笔记/偏好) |
| 图标 | 内联 SVG (运行时映射) |
| 构建 | 无 |

## 许可

&copy; 2026 Reading Garden. Designed for Deep Reading.
