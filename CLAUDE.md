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

**本项目没有构建步骤、没有打包器、没有 linter、没有测试套件。** 改完代码直接在浏览器（双击 HTML 或走上面的开发服务器）打开 `index.html` / `index-advanced.html` 手动验证即可。不要浪费时间寻找 `package.json` 脚本或测试命令——它们不存在。

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

## Architecture

### 两个独立的应用版本

| 版本 | 入口 | 逻辑类 | 加载的脚本（按顺序） |
|------|------|--------|----------------------|
| 基础版（中文为主） | `index.html` | `script.js` — `NightreignMapRecogniser` | `i18n/translations.js` → `i18n/language-manager.js` → `data.js` → `script.js` |
| 高级版（英文为主） | `index-advanced.html` | `app-advanced.js` — `NightreignApp` | `i18n/translations-advanced.js` → `i18n/language-manager.js` → `poi-data-advanced.js` → `app-advanced.js` |

基础版 POI 分类简化（教堂/法师塔/村庄/空）；高级版为完整分类体系（major base / minor base / field boss / evergaol / rotted woods），并支持出生点筛选。两个版本共享 `i18n/language-manager.js` 和 `dataset/` 数据，但样式文件与翻译字典各自独立。

### 数据流

1. `dataset/nightreignMapPatterns.csv` → `convert-csv-to-json.py` → `dataset/nightreignMapPatterns.json`。高级版由 **`poi-data-advanced.js` 的 `loadPOIData()`** 通过 `fetch` 加载该 JSON（不是 `app-advanced.js` 直接加载）。
2. `data.js` 内联定义基础版的 POI 坐标（`POIS_BY_MAP`）和种子分类映射（`CLASSIFICATIONS`），约 16k 行 / 190KB。
3. `dataset/dataset.json` 是基础版可选的 CV 分类数据。
4. `dataset/POI_locations.txt` 是 POI 坐标的原始采集来源，配合 `extraction.html` 在数据收集阶段使用。

### 关键模块

- **`i18n/language-manager.js`** — `LanguageManager` 类：通过 URL 参数 > Cookie > localStorage > 浏览器语言检测，派发 `languageChanged` 事件
- **`i18n/translations.js`** / **`translations-advanced.js`** — 两套独立的翻译字典（zh/en），分别服务两个版本
- **`poi-data-advanced.js`** — 高级版数据层：`fetch` JSON、构建 `POI_DATA` / `SEED_DATA` 全局结构供 `app-advanced.js` 消费
- **`extraction.html`** — 独立的 POI 提取工具，仅用于数据收集阶段，**不发布到生产**（`publish.sh` 会显式删除）

### Canvas 交互模式

- **桌面端**：左键选择/取消 POI，右键弹出类型选择菜单
- **移动端**：点击选择教堂，长按选择法师塔/村庄，再次点击取消标记
- 用户每标记一个 POI，系统实时过滤种子列表（消除法）

### 地图与夜之领主

- 5 种地图类型（Shifting Earth）：Default、Mountaintop、Crater、Rotted Woods、Noklateo
- 8 种夜之领主（如三狼、大嘴等），可选筛选条件
- 地图图片位于 `assets/map/`，POI 图标位于 `assets/icons/`

### 进行中的分支与数据导入

- `feature/dlc-forsaken-hollows` 分支正在为 DLC「被遗忘的空洞」添加支持框架，含一个额外的 `convert-fuwishx-to-csv.py`：把 Fuwish 提供的汉化版地图种子（见 README 致谢）导入成规范的 CSV，再走标准 `convert-csv-to-json.py` 流程。在 master 上目前看不到该脚本。

## Key Conventions

- 所有 UI 文本通过 `data-i18n` 属性绑定翻译，新增可见文本必须同时更新 `translations.js` 和 `translations-advanced.js`
- 种子数据以 CSV 为单一数据源；新增 POI 类型时记得同步 `convert-csv-to-json.py` 里的 `get_poi_icon_mappings()` 图标映射
- 基础版和高级版是并行维护的独立应用，改动需确认影响的是哪个版本，还是两者都需要同步
- PWA 支持：`manifest.json` 配置了离线能力，部署时 `.nojekyll` 文件不可少
- 项目使用简体中文作为主要语言（代码注释、commit 消息、README 均为中文）
