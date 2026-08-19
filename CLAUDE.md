# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Nightreign Map Seed Recogniser — 埃尔登法环：黑夜君临（Elden Ring: Nightreign）的地图种子识别器。纯前端 Web 应用，用户在 Canvas 地图上标记兴趣点（POI），系统通过消除算法匹配可能的种子。无构建工具、无打包器、无框架依赖。

## Development Commands

### 启动开发服务器

```bash
# Node.js（端口 8000）
node server.js

# 或 Python（功能等价）
python server.py
```

服务器启动后本机访问 `http://localhost:8000`，同时打印局域网 IP 供移动设备测试。`server.js` 对所有请求开启 CORS（调试 fetch 跨域时注意）。

### 测试 / 代码检查

**本项目没有构建步骤、没有打包器、没有 linter。** 前端改动直接在浏览器（双击 HTML 或走上面的开发服务器）打开 `index.html` 手动验证。Python 管线（`integrate_dlc.py` 等）有单元测试：

```bash
.venv/bin/python -m unittest discover tests   # 47 用例；test_etl 为已知基建问题（跑不了）
```

没有 `package.json` 脚本，不要寻找 npm 命令。**Python 一律用 `.venv/bin/python`**（系统 python3 无 pandas）。

### 数据转换

```bash
# 将 dataset/nightreignMapPatterns.csv 转为 dataset/nightreignMapPatterns.json
python convert-csv-to-json.py
```

CSV 是种子数据的**单一数据源**；JSON 由脚本生成，不要手改 JSON。CSV 布局比较特殊，编辑前务必了解：

- **第 1 行**是 POI 类别表头（`Major Base`、`Minor Base`、`Evergaol`、`Field Boss`、`Rotted Woods` …），第一列为空；
- **第 2 行**是每个 POI 槽位的具体地名（如 `Groveside`、`Gatefront`）；
- **第 3 行起**才是种子数据，第一列是种子编号；
- **POI → 图标的映射写死在 `convert-csv-to-json.py` 的 `get_poi_icon_mappings()` 里**，不在 JS 端。新增一种 POI 类型时，除了改 CSV，还要去这个 Python 字典里补对应图标名，否则图标渲染会缺失。

生成的 JSON 顶层结构为 `{ extractedTime, seeds: {"<编号>": {...}}, poiLookupByMapType: {...} }`。

### 部署

```bash
./publish.sh    # 将 master 的文件树发布到 gh-pages
```

`publish.sh` **不是**常规的构建部署：它会切到一个孤立的 `gh-pages` 分支，把 master 的所有文件 checkout 过去，**删除 `extraction.html`**（该工具仅用于数据收集，不发布），添加 `.nojekyll`（PWA 必需，否则 `_` 开头等资源会被 Jekyll 忽略），然后提交并 `git push origin gh-pages`，最后切回原分支。运行前必须先提交干净的工作区。

### 同步 gitee 远程仓库（重要工作流）

本地仓库与 gitee `origin`（lixiangzj/nightreign-mapseed-recogniser-master）是**无共同祖先的平行历史**（NAS 工作流所致），**不能直接 `git push origin master`（会因 unrelated histories 被拒）**，也不要 force push。正确流程（2026-08 首次实践于 `f90e656`）：

```bash
git fetch origin
# 生成"远程→本地 master"的全量差异补丁，必须排除 pattern 图（gitee 仓库刻意不放，641M）
git diff --binary origin/master master -- ':!assets/pattern' > /tmp/sync-gitee.patch
git checkout -b sync-gitee origin/master
git apply --binary /tmp/sync-gitee.patch
git add -A && git commit -m "feat: <同步说明>"
git push origin sync-gitee:master    # fast-forward，远程历史完整保留
```

**执行完毕后必须 `git checkout master` 切回开发分支**——sync-gitee 分支不含 `assets/pattern/`（zh/en 各 520 张种子图），停在 sync-gitee 上会让工作目录里的 pattern 图"消失"（用户已被吓到过一次）。切回 master 后图即恢复。

发版时在远程打 tag（如 `android-v2.4.24`）并推送，Release 记录与 APK 附件由用户在 gitee 网页手动创建。gitee 仓库体积已超 919MB 建议值（819MB），历史大文件勿再推。

## Architecture

### 单一应用 + 地图缺失模式

2026-08-11 起原「高级版」已并入 `index.html` 的**地图缺失模式**开关（`?advanced=1` 或导航栏 toggle，`script.js` 的 `advancedMode`），不再是独立应用：

- 入口 `index.html`，逻辑类 `script.js` — `NightreignMapRecogniser`
- 加载顺序：`i18n/translations.js` → `i18n/language-manager.js` → `data.js` → `pattern-cache.js` → `script.js`
- 常规模式 POI 分类简化（教堂/法师塔/村庄/空）；地图缺失模式额外用野外 BOSS / 要塞据点 BOSS / 持秤商人定位
- `index-advanced.html` 仅是重定向跳板（旧链接兼容），原高级版四件套 `app-advanced.js` / `poi-data-advanced.js` / `i18n/translations-advanced.js` / `styles-advanced.css` 已于 2026-08-19 确认零引用后删除

### 数据流

1. `data.js` 内联定义 POI 坐标（`POIS_BY_MAP`）、出生点（`SEED_SPAWN` / `SPAWN_POINTS_BY_MAP`）和种子分类映射（`seedDataMatrix`），约 17k 行；坐标为 **1536 口径**（2026-08 全链路迁移，Python 管线 `integrate_dlc.py` 同口径）。
2. `dataset/dataset.json` 是基础版分类数据（`classifications`，Rosetta 验证链依赖；DLC 1000-1199 由 `integrate_dlc.py` 产出）。
3. `dataset/nightreignMapPatterns.csv` → `convert-csv-to-json.py` → `dataset/nightreignMapPatterns.json`（DLC「被遗忘的空洞」数据导入链，见进行中的分支）。
4. `dataset/POI_locations.txt` 是 POI 坐标的原始采集来源，配合 `extraction.html` 在数据收集阶段使用。

### 关键模块

- **`i18n/language-manager.js`** — `LanguageManager` 类：通过 URL 参数 > Cookie > localStorage > 浏览器语言检测，派发 `languageChanged` 事件
- **`i18n/translations.js`** — 翻译字典（zh/en）
- **`pattern-cache.js`** — 种子图按需下载与缓存（`assets/pattern/zh|en/`）
- **`extraction.html`** — 独立的 POI 提取工具，仅用于数据收集阶段，**不发布到生产**（`publish.sh` 会显式删除）

### Canvas 交互模式

- **桌面端**：左键选择/取消 POI，右键弹出类型选择菜单
- **移动端**：点击选择教堂，长按选择法师塔/村庄，再次点击取消标记
- 用户每标记一个 POI，系统实时过滤种子列表（消除法）

### 地图与夜之领主

- 6 种地图类型（Shifting Earth）：Default、Mountaintop、Crater、Rotted Woods、Noklateo、Great Hollow（DLC，坐标含地底展示区偏移）
- 8 种夜之领主（如三狼、大嘴等），可选筛选条件
- 地图图片位于 `assets/map/`，POI 图标位于 `assets/icons/`

### 进行中的分支与数据导入

- `feature/dlc-forsaken-hollows` 分支正在为 DLC「被遗忘的空洞」添加支持框架，含一个额外的 `convert-fuwishx-to-csv.py`：把 Fuwish 提供的汉化版地图种子（见 README 致谢）导入成规范的 CSV，再走标准 `convert-csv-to-json.py` 流程。在 master 上目前看不到该脚本。

## Key Conventions

- 所有 UI 文本通过 `data-i18n` 属性绑定翻译，新增可见文本须同步更新 `i18n/translations.js`
- 种子数据以 CSV 为单一数据源；新增 POI 类型时记得同步 `convert-csv-to-json.py` 里的 `get_poi_icon_mappings()` 图标映射
- 常规模式与地图缺失模式共用 `script.js`，改动需确认两种模式下的行为（状态切换见 `updateGameState`：换维度只重置画布不清另一维度）
- PWA 支持：`manifest.json` 配置了离线能力，部署时 `.nojekyll` 文件不可少
- 项目使用简体中文作为主要语言（代码注释、commit 消息、README 均为中文）
