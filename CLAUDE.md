# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Nightreign Map Seed Recogniser — 埃尔登法环：黑夜君临（Elden Ring: Nightreign）的地图种子识别器。纯前端 Web 应用，用户在 Canvas 地图上标记兴趣点（POI），系统通过消除算法匹配可能的种子。无构建工具、无打包器、无框架依赖。

## Development Commands

### 启动开发服务器

```bash
# Node.js（端口 8000）
node server.js

# 或 Python
python server.py
```

服务器启动后本机访问 `http://localhost:8000`，同时打印局域网 IP 供移动设备测试。

### 数据转换

```bash
# 将 dataset/nightreignMapPatterns.csv 转为 dataset/nightreignMapPatterns.json
python convert-csv-to-json.py
```

CSV 是种子数据的原始来源；JSON 由此脚本生成。修改种子数据时先改 CSV，再运行转换。

### 部署

```bash
./publish.sh    # 将 master 分支部署到 gh-pages（自动排除 extraction.html）
```

## Architecture

### 两个独立的应用版本

| 版本 | 入口 | 逻辑 | 说明 |
|------|------|------|------|
| 基础版（中文为主） | `index.html` | `script.js` — `NightreignMapRecogniser` 类 | 简化的 POI 分类（教堂/法师塔/村庄/空） |
| 高级版（英文为主） | `index-advanced.html` | `app-advanced.js` — `NightreignApp` 类 | 完整 POI 分类体系（major base/minor base/field boss/evergaol/rotted woods），支持出生点筛选 |

两个版本共享 `data.js`（基础版 POI 坐标）、`i18n/` 目录和 `dataset/` 数据，但各自有独立的样式文件和翻译文件。

### 数据流

1. `dataset/nightreignMapPatterns.csv` → `convert-csv-to-json.py` → `dataset/nightreignMapPatterns.json`（高级版加载此文件）
2. `data.js` 内联定义基础版的 POI 坐标（`POIS_BY_MAP`）和种子分类映射（`CLASSIFICATIONS`），约 16k 行
3. `dataset/dataset.json` 是基础版可选的 CV 分类数据

### 关键模块

- **`i18n/language-manager.js`** — `LanguageManager` 类：通过 URL 参数 > Cookie > localStorage > 浏览器语言检测，派发 `languageChanged` 事件
- **`i18n/translations.js`** / **`translations-advanced.js`** — 两套独立的翻译字典（zh/en）
- **`extraction.html`** — 独立的 POI 提取工具，用于数据收集阶段，不发布到生产

### Canvas 交互模式

- **桌面端**：左键选择/取消 POI，右键弹出类型选择菜单
- **移动端**：点击选择教堂，长按选择法师塔/村庄，再次点击取消标记
- 用户每标记一个 POI，系统实时过滤种子列表（消除法）

### 地图与夜之领主

- 5 种地图类型：Default、Mountaintop、Crater、Rotted Woods、Noklateo
- 8 种夜之领主（如三狼、大嘴等），可选筛选条件
- 地图图片位于 `assets/map/`

## Key Conventions

- 所有 UI 文本通过 `data-i18n` 属性绑定翻译，新增可见文本必须同时更新 `translations.js` 和 `translations-advanced.js`
- 种子数据以 CSV 为单一数据源，不要直接编辑生成的 JSON
- 基础版和高级版是并行维护的独立应用，改动需确认影响的是哪个版本还是两者都需要同步
- PWA 支持：`manifest.json` 配置了离线能力，部署时需要 `.nojekyll` 文件
- 项目使用简体中文作为主要语言（代码注释、commit 消息、README 均为中文）
