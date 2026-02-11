# EdgeOne 手动部署验收与回滚清单（rgsite）

## 1. 目的与适用范围
本清单用于 `reading-garden-v3` 的手动发布流程，目标是确保：

1. 导出的 `*.rgsite.zip` 可在本地和 EdgeOne 正常运行。
2. 发布前有统一验收门禁，发布后有固定回归检查点。
3. 发生异常时可快速回滚到上一个稳定版本。

适用对象：前端开发、测试、运维协作人员（教师/家长可按简化步骤执行）。

## 2. 发布输入物
每次发布必须保存以下文件（同一版本目录）：

1. `reading-garden-*.rgsite.zip`
2. `rgsite-manifest.json`（来自压缩包内）
3. `DEPLOY-EDGEONE.md`（来自压缩包内）
4. `MISSING-ASSETS.txt`（若存在，必须评估后再发布）
5. 回归报告：`tmp/editor-regression-report.json`

推荐版本目录结构：

```text
releases/
  2026-02-11-rgsite-vXXX/
    reading-garden-20260211-xxxx.rgsite.zip
    editor-regression-report.json
    notes.md
```

## 3. 发布前验收（本地）

### 3.1 必过门禁
以下项必须全部通过：

| 检查项 | 命令/动作 | 通过标准 |
|---|---|---|
| 编辑器回归 | `./scripts/editor-regression.sh` | 输出 `editor-regression: ok` |
| 生成发布包 | 编辑器 `Export rgsite` | 成功下载 `*.rgsite.zip` |
| Manifest 校验 | 解压后检查 `rgsite-manifest.json` | `format` 为 `rgsite`，字段完整 |
| 缺失资源评估 | 检查 `MISSING-ASSETS.txt`（若存在） | 已确认可接受或已修复 |

### 3.2 本地冒烟
执行建议：

```bash
cd /tmp
rm -rf rgsite-smoke
mkdir -p rgsite-smoke
cd rgsite-smoke
unzip /path/to/reading-garden-*.rgsite.zip
python3 -m http.server 8090
# 浏览器打开 http://127.0.0.1:8090/
```

最小冒烟点：

1. 首页可打开，书籍列表可见。
2. 任意 2 本书可进入 `book.html?book=<id>`。
3. 模块切换无白屏、无明显 404。
4. 若启用 `subset/minimal`，重点检查被选书籍的封面与核心模块。

## 4. EdgeOne 手动上传步骤

1. 在 EdgeOne 控制台进入目标站点。
2. 选择静态站点上传，上传本次 `*.rgsite.zip`。
3. 等待构建/分发完成后记录发布版本号与时间。
4. 将版本信息写入发布记录（见第 7 节模板）。

注意：

1. 发布路径需与站点根一致（压缩包根目录即站点根）。
2. 禁止覆盖未备案的临时环境；先发布到预发域名再切正式域名。

## 5. 发布后验收（线上）

发布后 10 分钟内完成以下检查：

1. 首页访问：`https://<domain>/`
2. 书籍页面：`https://<domain>/book.html?book=totto-chan`
3. 书籍页面：`https://<domain>/book.html?book=wave`
4. 浏览器控制台：无阻断型错误（模块加载失败、JSON 解析失败）。
5. 抽查静态资源：封面图、关键模块数据文件可加载。

若任一失败，按第 6 节执行回滚。

## 6. 回滚策略（手动上传场景）

### 6.1 回滚触发条件
任一条件满足即回滚：

1. 首页或书籍主路径不可用（持续 3 分钟以上）。
2. 核心模块无法加载，影响主流程阅读。
3. 大面积静态资源 404，影响教学演示。

### 6.2 回滚步骤
1. 在 EdgeOne 重新上传“上一稳定版本”的 `*.rgsite.zip`。
2. 等待分发完成后复测第 5 节的线上检查项。
3. 在发布记录中标记“已回滚”，记录问题版本与原因。
4. 回到本地按问题类型修复后再重新走第 3 节。

### 6.3 版本保留建议
1. 至少保留最近 3 个稳定发布包。
2. 每个发布包保留对应回归报告与变更摘要。

## 7. 发布记录模板
建议每次发布在 `notes.md` 记录：

```markdown
# 发布记录 - 2026-02-11

- 版本目录：`releases/2026-02-11-rgsite-vXXX`
- 包文件：`reading-garden-20260211-xxxx.rgsite.zip`
- 发布环境：`staging` / `production`
- 发布人：`<name>`
- 回归结果：`editor-regression: ok`
- missing-assets 结论：`none` / `accepted` / `fixed`
- 上线后验收：`pass` / `fail`
- 是否回滚：`no` / `yes (to <version>)`
- 备注：
```

## 8. 与现有流程的对应关系

1. 编辑器发布导出：`reading-garden-editor` -> `Export rgsite`
2. 回归门禁脚本：`scripts/editor-regression.sh`
3. 导出元信息：`rgsite-manifest.json` / `DEPLOY-EDGEONE.md` / `MISSING-ASSETS.txt`

---

结论：在当前“手动上传 EdgeOne”的前提下，使用本清单即可形成稳定、可追溯、可回滚的发布闭环。
