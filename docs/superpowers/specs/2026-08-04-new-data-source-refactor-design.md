# 重构设计：更换数据源为 Nightreign-maps-including-dlc v0.3.3

- **日期**：2026-08-04
- **分支**：`feature/new-data-source`（从 `master` 切）
- **状态**：设计已认可，待写实现计划

## 1. 背景与目标

本项目（Elden Ring: Nightreign 地图种子识别器，纯前端）当前用自采的 CSV/JSON/内联数据驱动三个版本（基础版 / 高级版 / boss 反推）。目标是**放弃全部本地种子·POI·坐标数据，改用新数据源 `Nightreign-maps-including-dlc-v0.3.3-main` 的权威产出**，本项目只保留交互/匹配操作逻辑。

新源是一套 **Python 数据 + 地图渲染工具包**，权威产出为 4 张 CSV（`MAP_PATTERN.csv` / `坐标.csv` / `CONSTRUCT.csv` / `NAME.csv`）+ `素材/` 图标 + `output/map_{ID}.jpg` 成品地图 + `boss_data.json`。坐标系为 **1536 原生**（`坐标.csv` 的 `picX/picY`）。

### 已确认的 4 项决策

1. **结果图**：直接用新源中文 `map_{ID}.jpg`（UI 文本仍保留 i18n；英文版结果图也是中文地图）。
2. **版本范围**：三版本各自保留（`index.html` / `index-advanced.html` / `boss-reverse.html`），各自重接数据。
3. **基础版分类**：保留极简 4 类（church/mage/village/carriage + 空），从新源派生。
4. **重构方式**：Python ETL 适配，三版本 JS **一律不改**（唯一例外：`boss-reverse.html` 内嵌 `DATA` 改为 `fetch`）。

## 2. 新源 → 本项目 映射总表（已核对）

### 2.1 地形 `Special` → 本项目 map 名

| Special | 新源中文 | 本项目 map 名（`MAPS` / `seedDataMatrix` 列） |
|---|---|---|
| 0 | 常规 | Default |
| 1 | 雪山 | Mountaintop |
| 2 | 火山 | Crater |
| 3 | 腐败森林 | Rotted Woods |
| 4 | 大空洞（DLC） | Great Hollow |
| 5 | 隐城 | Noklateo |

### 2.2 夜王 `NightLord` → 本项目 key（已核对，顺序一致）

| NightLord | 中文 | 本项目英文 key（`NIGHTLORDS` / i18n） |
|---|---|---|
| 0 | 三狼 | Gladius |
| 1 | 大嘴 | Adel |
| 2 | 慧心虫 | Gnoster |
| 3 | 征兆 | Maris |
| 4 | 山羊 | Libra |
| 5 | 人马 | Fulghor |
| 6 | 冰龙 | Caligo |
| 7 | 黑夜王 | Heolstor |
| 8 | 七仙女（DLC） | Harmonia |
| 9 | 垃圾王（DLC） | Straghess |

### 2.3 种子编号 / 坐标

- 种子：`0–319` 本体 / `1000–1199` DLC（与现有方案一致，`MAP_PATTERN.csv` ID 列）。
- 坐标：新源 `picX/picY` 为 **1536 原生** → 高级版原样用；基础版 `÷2` → **768**（现 `data.js` 的 `/3.108` 换算废弃）。

## 3. 整体架构

```
新源仓库（只读，绝不改动）
  └─ 拷贝到  vendor/nightreign-data/   （4 CSV + NAME + 素材/ + output/map_*.jpg + boss_data.json）

tools/build-from-newsource.py   ← 新 ETL（取代旧 convert-csv-to-json.py），可重复执行
  ├─ 生成 data.js                         （基础版数据全局，原地重生成）
  ├─ 生成 dataset/dataset.json            （基础版 classifications）
  ├─ 生成 dataset/nightreignMapPatterns.json （高级版）
  ├─ 生成/拷贝 dataset/boss_data.json     （boss 反推）
  └─ 迁移图片到 assets/                   （结果图/底图/图标，统一 jpg）

JS 层（不改）: script.js · app-advanced.js · poi-data-advanced.js · boss-reverse.html(仅 DATA→fetch)
```

- 新源只读拷贝到 `vendor/nightreign-data/`；ETL 只读该目录，新源原仓库一行不动。
- ETL 幂等：新源更新后重新拷贝 + 重跑即可。

## 4. 基础版（index.html，重点）数据管线

### 4.1 ETL 原地重生成 `data.js` 的数据全局

`script.js` 零改动。ETL 重写以下全局（结构不变，值换新源）：

| 全局 | 来源 |
|---|---|
| `MAPS` / `NIGHTLORDS` / `CANVAS_SIZE` | 常量保持（见 §2） |
| `seedDataMatrix` | `MAP_PATTERN.csv` 派生（种子 / 夜王 / 地形列；其余列按现有列位填占位或留空，匹配只用 0/1/2 列 + `SEED_SPAWN`） |
| `POIS_BY_MAP` | 新源共享位置池（见 §4.2）`picX/picY ÷2` → 768 |
| `SPAWN_POINTS_BY_MAP` | `Start_190` → `坐标.csv` 查像素 `÷2` |
| `SEED_SPAWN` | `MAP_PATTERN.csv` 的 `Start_190` 列（seed → spawn 值字符串） |
| `MAP_IMAGES` / `ICON_ASSETS` | 新图片路径（§7） |
| `GH_DISAMBIG` / `GH_DISAMBIG_POINTS` | §4.4 |

### 4.2 `POIS_BY_MAP` 候选槽位（关键 UX 决策）

基础版只对 4 类（church/mage/village/carriage）做消除匹配。为保持现有点位聚焦的 UX：

- **候选槽位集合 = 在该地形任一种子里出现过 4 类建筑的位置**（`CONSTRUCT.csv` 的 `is_display=1`，且 type 落入 4 类映射），取并集，`÷2` → 768，按现有方式分配 `id`。
- 每槽位在每种子下的取值由 `dataset.json` classifications 给出（可为 4 类之一或 `nothing`）。
- 验证项：核对槽位数与现有 `POIS_BY_MAP`（约 44–52/地形）量级一致；若差异大需在 ETL 内 curate。

### 4.3 `dataset/dataset.json` 的 `classifications`

每种子每槽位 → `church | mage | village | carriage | other | nothing`，键 `POI<id>`（id 与 `POIS_BY_MAP` 一致）。`findRealPOITypeAtCoordinate` 的 40px 容差依赖两者同源，ETL 统一生成即可保证。

**type → 基础类** 映射（按 `NAME.csv` 中文名关键词）：

| NAME 关键词 | 基础类 |
|---|---|
| 教堂 | church |
| 法师塔 | mage |
| 村庄 | village |
| 马车 | carriage |
| 其余有建筑 | other |
| 该槽位该种子无建筑 | nothing |

### 4.4 大空洞（Great Hollow）消歧

保留 `script.js` 的 `detectDisambigPair` 逻辑。ETL：

1. 对 Great Hollow（Special=4）全部种子，按 4.2/4.3 算出各槽分类；
2. 找出「所有槽位分类完全相同」的种子对/组（即现有 5 对碰撞的新源等价物）；
3. 若存在 → 在这些种子里找能区分的额外点位（boss/废墟类），重生成 `GH_DISAMBIG` + `GH_DISAMBIG_POINTS`；
4. 若新源更细的数据（如额外 boss 字段）已能天然区分全部种子 → 丢弃消歧逻辑（但倾向保留，行为更稳）。

## 5. 高级版（index-advanced.html）数据管线

ETL 生成 `dataset/nightreignMapPatterns.json`，**schema 与现有完全一致**，`app-advanced.js` / `poi-data-advanced.js` 不动：

- `seeds["<num>"].pois["<i>"] = { location, structure, boss, category, coordinates{x,y}, icon, index }`
- `poiLookupByMapType[map][i] = { id, location, category, index, coordinates{x,y} }`
- 顶层 `extractedTime`

坐标 `picX/picY` 原样 1536（高级版内部 `÷2` 显示、`×2` 匹配，天然对齐）。

### 5.1 `type → {category, icon, structure, boss}` 映射（高级版核心难点）

新源 `classify()` 给三桶（特殊建筑 / 野外Boss / 建筑设施）+ evergaol（coord 601–607 / 2601–2607）+ 红点（2xxxx），需映射到现有 5 类：

| 新源判定 | → category |
|---|---|
| coord ∈ {601–607, 2601–2607} | evergaol |
| classify 野外Boss（prefix 45/46/47/52/53），且为腐败森林独有 8 boss | rottedWoods |
| classify 野外Boss（其余） | fieldBoss |
| 建筑设施中「大」类（废墟/堡垒/营地/大教堂/城） | majorBase |
| 建筑设施中「小」类（教堂/法师塔/村庄/马车） | minorBase |
| 特殊建筑（49410/49420/49430） | majorBase |

- **icon**（layer-1 菜单分组用）：取「建筑类名」（如 `church`/`mage_tower`/`village`/`ruin`/`fort`/`camp`/`carriage`…），由 ETL 内 `type→icon` 映射表给出，保证二级菜单 UX 与现状一致（不要直接用数字 type 当 icon，否则菜单显示数字）。
- **structure** / **boss**：取 `NAME.csv` 中文名（建筑取 structure、野外Boss/evergaol 取 boss）。
- **映射表来源**：ETL 内维护一张 `type → {advCategory, basicClass, icon}` 表，**初值从现有 `dataset/dlc-params/type_category_icon.json` 导入**（仅作初值/校对，不作运行时数据源），再用 `NAME.csv` + `classify()` 全量校验补全。
- 图标资产：`素材/Construct_{type}.png` 拷贝到 `assets/icons/`（命名见 §6.3）。

> 风险项：`majorBase` vs `minorBase` 的拆分、`rottedWoods` 与 `fieldBoss` 的拆分依赖上表，需在实现时抽样校对几颗种子对照现有 JSON。

### 5.2 icon 渲染兼容

`getIconPath` 有 fallback `assets/icons/<name>.png`，新 icon 名只要文件存在即可渲染；`buildIconPaths` 硬编码白名单可选扩展（不改也能跑）。

## 6. boss-reverse 数据管线

- 新源 `boss_data.json` 拷为 `dataset/boss_data.json`（探索显示与现有内嵌 `DATA` 同形：`nightlords/day1Bosses/day2Bosses/combos`）。
- `boss-reverse.html`：把内嵌 `const DATA = {...};`（[boss-reverse.html:119](boss-reverse.html#L119)）改为 `fetch('dataset/boss_data.json')` 后初始化。这是本次唯一一处 JS 改动。
- 验证项：逐字段比对两份 `boss_data.json`，确认 `combos` 键、`locked` 标志、`candidates` 数组语义一致；若新源缺字段则 ETL 补齐。

## 7. 图片迁移（统一 jpg）

### 7.1 结果图（每种子一张）

- 拷 `vendor/.../output/map_{ID}.jpg` → `assets/pattern/`：
  - 本体（ID 0–319）：同时写入 `assets/pattern/zh/NNN.jpg` 与 `assets/pattern/en/NNN.jpg`（同一张中文图，因中文-only；`script.js` 路径逻辑不改）。
  - DLC（ID 1000–1199）：写入 `assets/pattern/dlc/<ID>.jpg`。
- 零填充 3 位与现有 `script.js:2125` 一致。

### 7.2 底图（每地形一张）

- 新源 `素材/background_{0..5}.png` → 转 **jpg** →
  - 高级版：`assets/map/{default,crater,mountaintop,noklateo,rotted_wood,great_hollow}.jpg`（文件名按 `getMapFileName` 现有约定）。
  - 基础版：`assets/images/{Default,Mountaintop,Crater,Noklateo,RottedWoods,GreatHollow}-POI.jpg`，`MAP_IMAGES` 后缀随 `data.js` 重生成一并改 `.jpg`。
- ⚠️ 验证项：确认基础版现 `*-POI.png` 是纯地形（橙点由运行时 `drawPOI` 绘制）。若有 baked 点位，则改由 `background_*` 重生成纯地形底图。

### 7.3 图标

- 拷 `素材/Construct_*.png` → `assets/icons/`，**文件名按 §5.1 的 `type→icon` 映射表重命名**（与 JSON 里 `icon` 字段取值一致，`getIconPath` 即可解析）。
- 同步拷 `treasure_*` / `Start_*` / `nightlord_*` / `Frenzy_*` / `RotRew_*` / `day2_*` 等高级版可能引用的图标。

## 8. 旧资产清理

废弃（归档到 `legacy/` 或删除，ETL 接管后不再需要）：

- `dataset/nightreignMapPatterns.csv`（旧单一数据源）
- `convert-csv-to-json.py`（被 `tools/build-from-newsource.py` 取代）
- `extraction.html`（数据采集工具，本就不发布）
- 旧 `assets/pattern/**` 图片、旧 `assets/images/*-POI.png`、旧 `assets/map/*.jpg`（被新图替换）
- `dataset/full_export/`、`dataset/dataset.json` 旧内容（被 ETL 重生成）

保留：`publish.sh`（部署）、`server.js`/`server.py`、`manifest.json`、`i18n/`、`dataset/dlc-params/type_category_icon.json`（作 ETL 映射初值参考，可移入 `tools/`）。

## 9. 验证计划

每个版本浏览器打开（`node server.js`），抽查种子 **0 / 100 / 1000 / 1120**：

1. **基础版**：6 地形底图正确；点击 POI 出现橙点；标记后消除法收敛到正确种子；唯一种子时显示对应 `map_{ID}.jpg`；大空洞消歧流程正常。
2. **高级版**：四屏流程（选择→出生→识别→结果）正常；POI 位置与底图对齐；二级菜单 icon/boss 正确；唯一种子时画结果图。
3. **boss-reverse**：fetch 成功；选第一夜 Boss 能收敛夜王；锁定型 Boss 直出。
4. **坐标抽查**：新源某 construct `picX/picY ÷2` 落在基础版画布合理位置（与结果图标注点视觉一致）。

## 10. 范围外（Out of Scope）

- 不改任何版本的交互/匹配算法逻辑。
- 不做新功能（如新筛选条件、新 UI）。
- 不处理新源 `output/` 的重新渲染（直接用现有成品；若日后新源重新渲染，重拷即可）。
- 不保留英文结果图（决策 1：中文-only）。
- 不动新源原仓库。

## 11. 风险与开放项（实现时逐项落实）

| 项 | 风险 | 处理 |
|---|---|---|
| `type → advCategory`（major/minor、field/rotted 拆分） | 映射不准会错判 POI 类别 | 用 `type_category_icon.json` 作初值 + 抽样校对 |
| 基础版 `POIS_BY_MAP` 槽位数 | 与现有 UX 量级偏离 | ETL 内 curate，对照现有 44–52/地形 |
| 基础版底图是否有 baked 点位 | 若有，替换后丢点 | 实现首步验证，必要时由 `background_*` 重生成 |
| boss_data 两源 schema 差异 | 字段缺失致反推失效 | 逐字段比对、ETL 补齐 |
| 大空洞消歧碰撞对变化 | 旧种子号失效 | ETL 重扫碰撞对、重生成数据 |
| `seedDataMatrix` 列位 | 现有约 49 列，多数不用 | 保持列结构，仅填匹配用列，其余占位 |
