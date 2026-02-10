# 阅读花园 V3（纯静态 / 配置驱动）

本目录是根据 `reading-garden/docs/UI_UX_DESIGN_REQUIREMENTS.md`（2026-02-10）重新实现的一版“阅读花园”。

## 运行

这是纯静态站点（无构建步骤），需要用本地静态服务器打开（否则 `fetch` / `import()` 会被浏览器限制）。

方式 A（推荐）：以 `reading-garden-v3/` 作为站点根目录

```bash
cd /home/ctyun/work/read/reading-garden-v3
python3 -m http.server 8010
```

打开 `http://127.0.0.1:8010/`。

方式 B：以 `/home/ctyun/work/read/` 作为站点根目录

```bash
cd /home/ctyun/work/read
python3 -m http.server 8010
```

打开 `http://127.0.0.1:8010/reading-garden-v3/`。

## 结构

- `index.html`：首页（Hero + 书单卡片 + 书脊书架 + 阅读进度）
- `book.html`：单书页（`book.html?book=<id>`），运行时根据 `registry.json` 动态装配模块
- `data/books.json`：书单
- `data/<bookId>/registry.json`：单书模块注册表（模块入口 `entry` + 数据文件 `data`）
- `js/core/`：Shell/Runtime/Modal/Icons/Storage
- `js/modules/`：功能模块（`init/render/destroy`）
- `assets/`：图片等静态资源（从原项目拷贝）

