# DLC「被遗忘的空洞」集成设计

**日期**：2026-07-06
**分支**：`feature/dlc-forsaken-hollows`
**状态**：已认可，待用户审查书面规范

## 一、目标与范围

### 目标
将源数据项目（`Nightreign-maps-including-dlc-v0.3.3-main`，Fuwish v0.3.3，含 DLC 全量 POI）集成到本项目，使**基础版**与**高级版**两个应用都能对 DLC 的 200 条种子（ID 1000-1199）执行完整的种子筛选，并支持 DLC 新增地图「大空洞」（Great Hollow，源 `Special==4`）。

### 范围内
- 全部 200 条 DLC 种子的筛选数据（夜王 / 地图 / POI）。
- 新增地图 Great Hollow 的 POI 候选点坐标与分类。
- DLC 新增夜王（Harmonia、Straghess）的图标资源（框架已存在于两端）。
- mapType 纠正：按源权威将 80 条 Great Hollow 种子正确归类。

### 范围外（非目标）
- 不重建基础版 `dataset.json` 的现有 320 键（0-319）——那是仓库外 CV 流程的产物，只追加 DLC 键。
- 不为基础版补出生点筛选（基础版本就不处理出生点，保持一致）。
- 不为 DLC 结构类型补中文名（源 `NAME.csv` 不覆盖 30xxx/5xxxx 结构类型；高级版用图标驱动，基础版只看类目，均不需要名字）。
- 不修改 `extraction.html`（数据收集工具，不发布）。

## 二、背景：两端的数据模型差异

本项目有**两个独立应用版本**，数据模型根本不同：

| 维度 | 基础版（`index.html` + `script.js` + `data.js`） | 高级版（`index-advanced.html` + `app-advanced.js` + `poi-data-advanced.js`） |
|------|------|------|
| 筛选数据源 | `dataset/dataset.json` → `CV_CLASSIFICATION_DATA` | `dataset/nightreignMapPatterns.json` |
| POI 坐标 | `data.js` 的 `POIS_BY_MAP[map]`，`{id,x,y}` 在 **768 空间**，**不存类目** | JSON 的 `poiLookupByMapType[map]` + 每种子 `pois`，**1536 空间**，存完整类目 |
| 分类粒度 | 5 值：`church/mage/village/other/nothing` | 完整分类法：`majorBase/minorBase/fieldBoss/evergaol/rottedWoods` |
| CSV 来源 | `dataset.json` **无 CSV 中间源**（仓库外 CV 产物） | `dataset/nightreignMapPatterns.csv` → `convert-csv-to-json.py` → JSON |
| 出生点 | 不支持 | 支持（`filterSeedsBySpawnPoint`） |
| 现有 DLC 框架 | MAPS/NIGHTLORDS/MAP_IMAGES 含 Great Hollow/Harmonia/Straghess；`POIS_BY_MAP["Great Hollow"]=[]`（空）；seedDataMatrix 有 200 条 DLC 行 | CSV/JSON 有 200 条 DLC 种子骨架，但 `pois:{}` 全空 |

**关键事实（已验证）**：
- `convert-csv-to-json.py` **只生成** `nightreignMapPatterns.json`（高级版），**不生成** `dataset.json`。
- `dataset.json` 现有 320 个键（"000"-"319"，**含 0-99**），**不含** 1000-1199。
- 基础版筛选入口：`findRealPOITypeAtCoordinate(seedNum, x, y)` 查 `CV_CLASSIFICATION_DATA[seedNum.padStart(3,'0')]["POI"+id]`。
- 基础版 seedDataMatrix 仅 `[0]=种子号 / [1]=夜王 / [2]=地图` 三列被 `script.js` 读取。

## 三、源数据模型（Fuwish v0.3.3）

源项目是**地图图像生成器**，使用数据挖掘的**数值 ID**格式（与本项目命名式 POI 分类根本不同），需要语义转换：

| 文件 | 用途 | 关键列 |
|------|------|--------|
| `MAP_PATTERN.csv` | 主种子表，520 行 | `ID, NightLord(0-9), Special(0-5), Start_190, Treasure_800, ..., Day1Boss, Day1Loc, Day2Boss, Day2Loc` |
| `CONSTRUCT.csv` | **每种子的建筑清单**（非地图模板） | `ID, MAP(=种子ID), type, is_display, _, coord_index, ...`；MAP 列与 MAP_PATTERN 的 ID **一一对应**（已验证 520=520 零差异），每种子几十个建筑、布局独立可变 |
| `坐标.csv` | 坐标索引→图片像素 | `ID, Name, areaNo, gridXNo, gridZNo, posX, posZ, picX, picY`（picX/picY 在 4775 空间，603 行**全有效**）。`CONSTRUCT.coord_index` 与 `MAP_PATTERN.Day1Loc/Day2Loc/Start` 均指向本表 ID |
| `NAME.csv` | 数值 ID→中文名 | 覆盖 boss/事件（45xx/46xx/47xx/48xx/49xx/52xx）；**4xxxx boss 有中文名**，但 5xxxx DLC 结构与 30xxx-43xxx 基础结构**均无中文名** |
| `素材/background_4.png` | Great Hollow 背景 | 4775×4775 RGBA |
| `素材/Construct_*.png` | 175 个建筑图标 | 文件名 = `Construct_{type}.png` |
| `输出/大空洞/map_1115_*.jpg` | Great Hollow 种子渲染图 | 视觉验证用 |

**Special → mapType 映射**（源权威，100% 清洁）：
- 0=Default, 1=Mountaintop, 2=Crater, 3=Rotted Woods, 4=Great Hollow, 5=Noklateo

**夜王分布**：源 0-7 各 50 种子，8-9 各 60 种子（共 520）。DLC 种子为 ID 1000-1199（200 条）。

## 四、总体架构：统一生成器

新建 `integrate-dlc.py`，读源、转换、分两条产出。**共享**源读取与坐标变换逻辑，避免重复：

```
integrate-dlc.py
│
├─ 1. 读源（MAP_PATTERN / CONSTRUCT / 坐标 / NAME）
│
├─ 2. 共享变换层
│   ├─ 坐标缩放：源 picXY(4775) → 目标空间
│   ├─ construct→类目映射（图标视觉识别 + NAME.csv，见 §6）
│   └─ mapType 纠正（Special==4 → Great Hollow，见 §7）
│
├─ 3.【高级版产出】
│   ├─ 填充 nightreignMapPatterns.csv 的 DLC 行 POI 槽位
│   ├─ 扩展 convert-csv-to-json.py：补 Great Hollow 坐标 + DLC 图标映射
│   └─ 重跑 convert-csv-to-json.py → nightreignMapPatterns.json
│
├─ 4.【基础版产出】
│   ├─ data.js：POIS_BY_MAP["Great Hollow"] = [{id,x,y}]（768 空间）
│   ├─ data.js：seedDataMatrix DLC 行 nightlord/map 纠正
│   └─ dataset.json：追加 classifications["1000"-"1199"]（4 类）
│
└─ 5. 拷贝 DLC 图标 → assets/icons/
```

脚本幂等可重跑：每次基于源 + 现有目标文件重新生成，覆盖 DLC 部分，保留基础数据不动。

## 五、坐标变换（首要验证点）

### 5.1 基础地图（已验证）
基础种子（0-319）的源建筑坐标 → 目标坐标，公式已通过种子 0 的构造对应验证：
```
target_coord = source_picXY × (1536 / 4775) = source_picXY × 0.32168
```
无偏移，误差 11-35 单位（可接受）。基础版再 ÷2 到 768 空间：`×0.16084`。

### 5.2 Great Hollow（待标定，不可直接套用基础地图公式）
源项目对 Great Hollow（`Special==4`）有**专属坐标变换** `transform_coord`：
```
所有坐标：先 ×1.0186，再平移 (-306, -260)
地底建筑（underground_coords 集合）：额外 +(862, +355)
```
源项目渲染时 background_4.png（4775×4775）整体再 ×1/5 缩小输出。

目标项目 `assets/map/great_hollow.jpg` 是 1536×1536 的真实地图。**它的来源（background_4.png 直接缩放 / 源渲染输出裁剪 / 其他）决定了变换公式**，不能假设与基础地图相同。

**实施时必须标定**，方法（按优先级）：
1. 取目标 `great_hollow.jpg`（1536）与源 `素材/background_4.png`（4775）做图像配准，确认是否为纯缩放（1536/4775=0.32168）。
2. 取若干已知 Great Hollow 地标（如固定 boss 圈、固定建筑），分别在源渲染图 `输出/大空洞/map_1115_1.jpg` 与目标 `great_hollow.jpg` 上定位，反推仿射变换（缩放 + 平移）参数。
3. 用标定参数将源 picXY（经 `transform_coord`）映射到目标 1536 空间；基础版再 ÷2 到 768。

**容差**：高级版 `findPOIInSeed` 坐标匹配公差 ±2（1536 空间），基础版点击半径 28.5px、查询容差 40px（768 空间）。标定残差应控制在该公差内，否则候选点定位失准。

**回退**：若无法精确标定，按「background_4.png 直接 ×0.32168 缩放至 1536」假设处理，并在已知局限中声明 Great Hollow 坐标可能存在系统性偏差。

## 六、construct→类目映射（图标驱动 + NAME.csv）

源建筑只有数值 `type`，本项目两端都需要语义类目。验证发现 **type 空间分层**——DLC 独有结构（5xxxx）在基础地图从未出现，Rosetta 对其**不可行**（无基础对照）。故按 type 来源分三种方法：

| type 类别 | 数值范围 | 出现位置 | 分类方法 |
|-----------|----------|----------|----------|
| DLC 独有结构 | 5xxxx（约 18 种，如 52420/52570） | 仅 Great Hollow | **图标视觉识别**：视觉模型分析源 `素材/Construct_5xxxx.png` 图像内容判定 |
| boss | 4xxxx（如 46540/49172） | 基础 + DLC | **NAME.csv 识别**（4xxxx boss 有中文名）→ 高级版 `fieldBoss`；基础版 `other` |
| 基础结构 | 30xxx-43xxx | 基础地图（DLC 一般不含，若出现则同图标识别） | 图标视觉识别 |

### 6.1 图标视觉识别（核心，路线 A 本意）
- 对 DLC 涉及的全部结构 type（5xxxx 约 18 种 + 若干基础结构），逐个查看源 `素材/Construct_{type}.png` 图标。
- 视觉判定其在高级版分类法中的类目（majorBase/minorBase/fieldBoss/evergaol/rottedWoods）与基础版 5 值类（church/mage/village/other/nothing）。
- 产出**硬编码映射表**（Python 字典），存入 `integrate-dlc.py`：
  ```python
  TYPE_CATEGORY = {
      52420: {"adv": "majorBase", "basic": "village"},   # 示例，实际由视觉判定
      # ...约 18 条 5xxxx + 若干基础结构
  }
  ```
- 视觉判断依据：教堂尖顶→church/majorBase、法师塔造型→mage/minorBase、聚落房屋群→village、野外 boss→fieldBoss、永恒牢狱 cage→evergaol。无法明确判定 → 结构兜底 `minorBase`/`other`，boss 兜底 `fieldBoss`/`other`。

### 6.2 boss 处理（NAME.csv）
Great Hollow 种子的 boss（`Day1Boss`/`Day2Boss` + CONSTRUCT 中的 4xxxx）：
- NAME.csv 提供中文名 → 高级版归 `fieldBoss`（带 boss 名/图标）。
- 基础版归 `other`（基础版不区分 boss 类型，boss 非 church/mage/village）。

### 6.3 应用阶段（DLC，每种子每建筑）
- 结构 type → 查 `TYPE_CATEGORY` 映射表得双版类目。
- boss type（4xxxx）→ NAME.csv 识别，归 fieldBoss / other。
- 候选点该种子无建筑 → `nothing`。

### 6.4 图标资源（高级版）
高级版 POI 的 `icon` 字段由 `convert-csv-to-json.py` 的 `get_poi_icon_mappings()` 决定。需扩展该字典，为 DLC `type` 补图标名（从源 `素材/Construct_{type}.png` 文件名取，拷贝到 `assets/icons/`）。缺失时警告并跳过（不阻塞），符合现有容错约定。

### 6.5 可选：Rosetta 交叉验证
对 4xxxx boss（基础与 DLC 共有、NAME.csv 有名、坐标两端均有效），可用 Rosetta（基础种子源建筑坐标 ↔ 目标分类坐标对齐）交叉验证 boss 归类。非主路径，仅增强可信度，失败不影响交付。

## 七、mapType 纠正

源 `Special==4`（Great Hollow）共 80 条种子，但目标项目只标了 40 条为 Great Hollow（`{1115-1134} ∪ {1175-1194}`），另有 40 条被错误归入其他地图。

**纠正原则**：源 `Special` 列为唯一权威。逐条 DLC 种子比对源 `Special` 与目标当前 mapType，不一致则以源为准修正。

**影响两处**：
- 高级版：在 `nightreignMapPatterns.csv` 的 DLC 行修正地图字段，再走 `convert-csv-to-json.py`。
- 基础版：在 `data.js` 的 `seedDataMatrix` 修正 DLC 行第 `[2]` 列（地图）；同时核实 `[1]` 列（夜王）是否已正确填入（若 DLC 行仅有 `[3]` 出生方向而缺夜王/地图，需一并补齐）。

## 八、高级版产出详述

### 8.1 CSV 填充
`nightreignMapPatterns.csv` 的 DLC 行（1000-1199）POI 槽位当前全空，导致空 POI 的 DLC 种子无法被消除（筛选污染）。`integrate-dlc.py` 按 CSV 的槽位结构（第 1 行类别表头、第 2 行槽位地名、第 3 行起数据）填入：
- 每个种子的 Great Hollow 建筑 → 对应 POI 槽位的 `location/structure/boss/category`。
- 夜王、地图字段修正（§7）。

**地名处理**：基础地图的 CSV 槽位用命名式地名（Groveside、Gatefront…），但源 `NAME.csv` 不覆盖 DLC 结构类型（无中文名）。因此 Great Hollow 的 POI 槽位采用**程序化标识**命名（如 `greatHollow_1`、`greatHollow_2`…），`get_poi_coordinates()["great_hollow"]` 字典键与之间一一对应。高级版 UI 上该 POI 的地名显示用此标识或坐标占位（用户已认可"粗粒度 DLC 结构菜单"）。图标（`icon` 字段）由 `type` 经扩展后的 `get_poi_icon_mappings()` 驱动，是用户实际辨认 POI 的主要视觉依据。

### 8.2 convert-csv-to-json.py 扩展
- `get_poi_coordinates()`：补 `"great_hollow": {<地名>: (x, y)}`（当前为空 `{}`）。
- `get_poi_icon_mappings()`：补 DLC `type` → 图标名。
- `get_poi_icon()`：确保 DLC type 走通映射。
- 确认 `Special/mapType` 派生逻辑对 DLC（含 Great Hollow）正确。

### 8.3 JSON 重生成
重跑 `convert-csv-to-json.py`，`nightreignMapPatterns.json` 的 DLC 种子 `pois` 字段被填满，`poiLookupByMapType["Great Hollow"]` 非空。

## 九、基础版产出详述

### 9.1 POIS_BY_MAP["Great Hollow"]（data.js）
- 从源 Great Hollow 建筑取所有坐标：源 `MAP_PATTERN.csv` 中 `Special==4` 的 80 条种子，每条在 `CONSTRUCT.csv`（MAP 列 = 种子 ID）有几十个建筑，每个建筑的 `coord_index` → `坐标.csv` 的 picX/picY（4775 空间）。
- **聚类去重**：80 条种子的全部建筑坐标做近邻聚类（阈值见实施），物理上相同的候选点合并为一个 slot，分配 `id`（复用现有 1-N 命名空间，与其它地图 id 并行，因分类按种子键查，不会冲突）。
- 坐标经 Great Hollow 标定（§5.2）后缩放到 768 空间。
- 写入 `data.js` 的 `POIS_BY_MAP["Great Hollow"]`（替换当前 `[]` 存根）。

### 9.2 dataset.json 追加 DLC 分类
- 对每个 Great Hollow 候选点 × 每条 DLC 种子：该种子此处有建筑 → 查 `type→basic_class`（§6）；无建筑 → `"nothing"`。
- 键格式与现有一致：`classifications["1000"]["POI1"] = "church"`（种子号零填充 3 位字符串）。
- **仅追加** 1000-1199 键，不动现有 0-319 键。
- 由 `integrate-dlc.py` 直接写 `dataset.json`（该文件无 CSV 中间源，直接脚本生成是唯一可复现路径；脚本即其事实来源）。

### 9.3 seedDataMatrix 纠正（data.js）
DLC 行（约 :16753-16952）修正 `[1]` 夜王、`[2]` 地图（§7）。其余列 `[3]-[49]` 不被读取，保持原样。

## 十、图标资源

- 源 `素材/Construct_*.png` 中，DLC 涉及的图标拷贝到本项目 `assets/icons/`（命名遵循本项目约定）。
- DLC 夜王 Harmonia、Straghess 图标（`assets/icons/Harmonia.png`、`Straghess.png`）已存在（占位），核实是否需替换为正式素材。
- 缺失图标不阻塞（现有容错：警告 + 跳过）。

## 十一、验证策略

无自动化测试套件，全部手动验证（浏览器开 `index.html` / `index-advanced.html`）：

1. **坐标正确性**：切换到 Great Hollow 地图，确认 POI 候选点落在地图合理位置（对齐可见地标），不偏出地图、不重叠错位。
2. **筛选可用性**：
   - 标记一个 Great Hollow POI 为某类目，确认候选种子列表收敛（DLC 种子能被消除）。
   - 组合夜王 + 地图 + 多 POI 标记，确认交集筛选正确。
3. **mapType 纠正**：选 Great Hollow 地图 + 不限夜王，确认候选数含全部 80 条 Great Hollow 种子（而非 40）。
4. **基础/高级一致性**：同一 DLC 种子在两版本的夜王、地图一致；POI 位置肉眼吻合（类目粒度不同属正常）。
5. **回归**：基础种子 0-319 的筛选行为不变（`dataset.json` 仅追加、`data.js` 基础部分不动）。
6. **源交叉校验**：抽查若干 DLC 种子，将本项目的 Great Hollow POI 分布与源渲染图 `输出/大空洞/map_<id>.jpg` 肉眼比对。

## 十二、已知局限与风险

1. **Rosetta 不完美**：基础地图训练的 `type→类目` 映射套用到 Great Hollow，少数建筑可能误分（如某教堂被归 `other`）。影响：削弱该 POI 筛选力，不破坏功能。基础版因有 `other` 兜底，冲击更小。
2. **Great Hollow 坐标变换**：源有专属 `transform_coord`，目标地图图来源未明，须实施时标定（§5.2）。标定不准则候选点系统性偏移。
3. **DLC 独有建筑类型**：Rosetta 未覆盖的 `type`，高级版按图标启发式 + 兜底类目，基础版归 `other`。无法精确分类，符合路线 A 粗粒度约定。
4. **建筑中文名缺失**：源 `NAME.csv` 不含结构类型名。高级版用图标驱动可接受；基础版不看名字无影响。
5. **基础版无出生点**：DLC 不补出生点筛选，与基础版整体能力一致。

## 十三、交付物清单

实施完成后应产出/改动：

- **新增** `integrate-dlc.py`（统一 DLC 集成生成器，幂等可重跑）。
- **改动** `convert-csv-to-json.py`（补 Great Hollow 坐标、DLC 图标映射、mapType 派生）。
- **改动** `dataset/nightreignMapPatterns.csv`（DLC 行 POI 槽位填充 + mapType 纠正）。
- **重生成** `dataset/nightreignMapPatterns.json`（高级版，DLC pois 填满）。
- **改动** `dataset/dataset.json`（追加 classifications["1000"-"1199"]）。
- **改动** `data.js`（`POIS_BY_MAP["Great Hollow"]` 填充 + seedDataMatrix DLC 行纠正）。
- **新增** `assets/icons/` 下若干 DLC 建筑图标。
- **更新** `README.md` 致谢/说明（如需）。
- 不发布 `extraction.html`（约定不变）。

## 十四、决策记录

- **范围**：全部 200 条 DLC 种子（用户选）。
- **路线**：A —— 全自动、图标驱动、启发式分类、接受粗粒度 DLC 结构菜单（用户选）。
- **mapType 权威**：源 `Special` 列（用户同意）。
- **基础版必做**：基础版是主用版本，高级版用于特殊事件（地图缺失事件）（用户明确）。
- **`dataset.json` 直接脚本追加**：该文件无 CSV 中间源，脚本即事实来源（用户认可）。
