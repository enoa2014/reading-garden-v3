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
  - `rgbook/rgsite` 交换包服务骨架接口（待下一轮填充实现）

- Sprint 3 早期实现（进行中）：
  - 已接入本地 `JSZip`（`editor/js/vendor/jszip.min.js`）
  - 已支持 `rgbook` 导出（单书打包为 `*.rgbook.zip`）
  - 已支持 `rgbook` 导入（`rename/overwrite/skip` 冲突策略）

## 运行方式

1. 在项目根目录启动本地静态服务：

```bash
cd /path/to/reading-garden-v3
python3 -m http.server 8080
```

2. 打开编辑器：

- `http://127.0.0.1:8080/reading-garden-editor/index.html`

## 回滚策略（第一版）

1. 关键开发节点采用小步提交（checkpoint commit）。
2. 编辑器写文件时默认写前备份到：
   - `.rg-editor-backups/<timestamp>/<original-path>`
3. 若写入出现问题，可根据备份路径手动恢复。

## 下个迭代目标（Sprint 2）

- 新建书向导（最小模板）
- 更完整的规则校验（交叉引用、资源路径）
- 降级模式（ZIP 导入导出）入口占位
- 交换包（`rgbook`）的数据结构与导入事务骨架
