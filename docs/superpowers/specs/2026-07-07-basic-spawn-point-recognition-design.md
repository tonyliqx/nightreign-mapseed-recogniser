# 基础版出生点指认设计

**日期**：2026-07-07
**分支**：`feature/dlc-forsaken-hollows`
**状态**：已认可，待用户审查书面规范

## 一、目标与范围

### 目标
为**基础版**（`index.html` + `script.js` + `data.js`）增加出生点（spawn point）指认功能。用户在标记地标（教堂/法师塔/村庄）之前，先在 canvas 上指认自己的出生点，系统据此精确缩小候选种子。覆盖基础版全部 6 种地图（Default / Mountaintop / Crater / Rotted Woods / Noklateo / Great Hollow），共 12 个出生点（基础地图 9 个 + 大空洞 3 个）。

### 动机（已量化）
当前大空洞（Great Hollow）仅靠教堂/法师塔地标，80 条种子里只有 71% 能唯一确定（23 条种子有歧义，最坏 3 条共享同一地标组合）。加入 3 个出生点（13000/13001/13002）后唯一性提升至 95%（最坏 2 条共享）。用户报告"光靠教堂和法师塔不能最终确定地图种子"，出生点指认直接填补这一缺口。

### 范围内
- 全部 6 种基础版地图的出生点候选点坐标（12 个）。
- 全部种子（0-319 基础 + 1000-1199 DLC，共 520 条）的出生点值（Start_190）贯穿到基础版数据层。
- canvas 上出生点标记渲染 + 两阶段交互（spawn 先选，再选地标）。
- 实时筛选追加出生点条件。
- "跳过出生点"逃生口。

### 范围外（非目标）
- **不做敌人类型选择**。出生点仅指认位置，不选敌人。理由：大空洞出生点在源数据中无敌人信息（`nightreignMapPatterns.json` 里 GH 的 `coordinate={}`、`location=null`），数据不对称；位置单独已达成 95% 唯一性目标；保持基础版简洁。
- **不改高级版**。高级版已有独立的 spawn 屏幕（`app-advanced.js` 的 `spawnFilteredSeeds` / `spawnContextMenu`），本设计仅作用于基础版。
- **不触碰 0-319 现有数据**。不修改 `seedDataMatrix` 或 `POIS_BY_MAP` 的现有行；出生点数据以新增 const 形式追加。
- **不修改 `extraction.html`**（数据收集工具，不发布）。
- 不为基础地图出生点新增图标资源（沿用现有出生点视觉标记，见 §5）。

## 二、背景：基础版现状与出生点数据

### 基础版当前筛选流程
1. 用户选地图（`chosenMap`）与可选夜王（`chosenNightlord`）。
2. `possibleSeeds = seedDataMatrix.filter(row => row[2] === chosenMap [&& row[1] === chosenNightlord])`（[script.js:1194](script.js#L1194)）。
3. 用户在 canvas 上点 POI 候选点（`POIS_BY_MAP[map]`，768 空间），循环切换类型（教堂/法师塔/村庄/空）。
4. 每标记一个 POI，`findRealPOITypeAtCoordinate` 查 `CV_CLASSIFICATION_DATA` 实时过滤种子。

### `seedDataMatrix` 行格式（已验证）
```
[seedNum, nightlord, mapType, "", ...POI分类列...]
   [0]      [1]       [2]    [3]
```
- `script.js` 仅读 `row[0]`（种子号）、`row[1]`（夜王）、`row[2]`（地图）。
- `row[3]` 当前空置。**本设计不使用 row[3]**（不动现有行），改用独立的新 const。

### 出生点数据现状
- **源 `MAP_PATTERN.csv`**：第 4 列 `Start_190` 是出生点值（基础地图 700-708，GH 13000-13002）。`integrate_dlc.py` 的 `read_source_data` **已经读取**该列到 `patterns[sid]["start"]`，只差贯穿到基础版。
- **基础地图出生点**（700-708）：`nightreignMapPatterns.json` 有完整数据（位置名 + 坐标 + 敌人），但坐标在 1536（高级版）空间。
- **大空洞出生点**（13000-13002）：JSON 里 `coordinate={}`、`location=null`，坐标缺失。**坐标来源 = 源目录 `素材/Start_*.png`**（见 §3）。

### 高级版 spawn UI（可借鉴，不复用）
高级版有独立 spawn 屏幕：`startRecognition()` → `loadAvailableSpawnPoints()` → `showScreen('spawn')` → 独立 spawn canvas + 上下文菜单选敌人。本设计**不照搬**（基础版是单 canvas + 实时筛选哲学），但借鉴其"出生点作为强筛选维度先行"的思路。

## 三、出生点坐标标定

### 来源
源目录 `素材/Start_*.png`，12 个文件：
- `Start_700.png` … `Start_708.png`（基础地图 9 个）
- `Start_13000.png` / `Start_13001.png` / `Start_13002.png`（大空洞 3 个）

均为 **4775×4775** 全尺寸透明 PNG，蓝色箭头（`alpha_composite` 合成到背景的产物）标记出生位置。非透明像素质心 = 出生点在 4775 源空间的坐标 (px, py)。

### 标定算法（一次性 dev 分析）
用 **Pillow**（仅 dev 时，不进生产依赖）对每个 PNG：
1. 加载 RGBA，扫描非透明像素（alpha > 0）。
2. 取这些像素的边界框或质心 → (px, py)（4775 空间）。
3. 转换到 **768 空间**：
   - 基础地图（700-708）：`transform_coord_basic(px, py, 768)` = 线性缩放 `px * 768/4775`。
   - 大空洞（13000-13002）：`transform_coord_great_hollow`，用 `load_great_hollow_calib()` 的 scale 转 768（出生点在地面，**无 underground offset** —— underground_offset 仅对特定 coord_id 生效，出生点无 coord_id）。

### 产物
12 个 (value, x768, y768) 标定结果，作为 `integrate_dlc.py` 内部的标定数据（Python dict，命名 `_SPAWN_CALIB`）：
```python
# 标定原始数据（dev 时一次性产出，硬编码）
_SPAWN_CALIB = {
    "Default":        [("700", x768, y768), ...],   # 该地图实际出现的出生点子集
    "Great Hollow":   [("13000", x768, y768), ("13001", ...), ("13002", ...)],
    ...
}
```
`build_basic_spawn_snippets()`（§4）读取 `_SPAWN_CALIB`，序列化为 JS const `SPAWN_POINTS_BY_MAP` 追加到 `data.js`。即：**Python 端 `_SPAWN_CALIB`（标定数据）→ 序列化 → JS 端 `SPAWN_POINTS_BY_MAP`（运行时 const）**，两端不同名以避免混淆。

**注意**：不是每个基础地图都用到全部 9 个出生点（700-708）。`_SPAWN_CALIB[map]` 只收录该地图实际出现的出生点（从 `MAP_PATTERN.csv` 该地图种子的 Start_190 去重得出），避免 canvas 上出现永远不会命中的死标记。

生产脚本（`integrate_dlc.py`）保持纯 Python 3 标准库；Pillow 仅用于 dev 时一次性标定，结果落常量，与现有 `load_great_hollow_calib` 模式一致。

### 验证
标定后用 MCP 视觉工具核对 1-2 个出生点坐标是否落在 pattern 图（`assets/pattern/dlc/10xx.jpg`）的蓝色箭头上，确保变换正确。

## 四、数据管线

### 新增数据结构（追加到 `data.js`，不动现有行）

**1. `SEED_SPAWN`**：种子号 → 出生点值，覆盖全部 520 条种子。
```javascript
const SEED_SPAWN = {
  0: "700", 1: "702", ..., 319: "708",     // 基础种子（0-319）
  1000: "700", ..., 1005: "13001", ...,    // DLC 种子（1000-1199）
};
```
由 `integrate_dlc.py` 从 `MAP_PATTERN.csv` 的 `Start_190` 生成。**这是新增 const，不修改 `seedDataMatrix` 任何现有行** —— 尊重"不触碰 0-319"约束。

**2. `SPAWN_POINTS_BY_MAP`**：地图 → 出生点候选点列表（768 空间）。
```javascript
const SPAWN_POINTS_BY_MAP = {
  "Default":      [{ value: "700", x: ..., y: ..., label: "出生点①" }, ...],
  "Great Hollow": [{ value: "13000", x: ..., y: ..., label: "出生点①" },
                   { value: "13001", x: ..., y: ..., label: "出生点②" },
                   { value: "13002", x: ..., y: ..., label: "出生点③" }],
  ...
};
```
`label` 统一用"出生点①/②/③…"序号（基础地图出生点虽有地名，但基础版简化哲学下用序号更一致；GH 无地名只能用序号）。

### `integrate_dlc.py` 改动
1. 标定常量 `SPAWN_POINTS_BY_MAP`（§3 产物）。
2. 新增 `build_basic_spawn_snippets(source)`：生成 `SEED_SPAWN` 与 `SPAWN_POINTS_BY_MAP` 两个 JS 片段字符串。
3. `main()` 把这两个片段追加到 `data.js`（在现有 `seed_matrix_fixes` 追加点附近），与现有"片段追加"模式一致。
4. 新增单测（见 §8）。

### 数据流
```
MAP_PATTERN.csv (Start_190) ─┐
素材/Start_*.png (箭头坐标) ─┤
                             ├─ integrate_dlc.py ─┬─ SEED_SPAWN (新 const) ──┐
load_great_hollow_calib ─────┘                     └─ SPAWN_POINTS_BY_MAP ──┴─ data.js
                                                                            │
                                                              script.js 读取 ─┘
```

## 五、UI 交互设计

### 画布渲染
canvas 上同时渲染两类标记：
- **出生点标记 `△`**（来自 `SPAWN_POINTS_BY_MAP[chosenMap]`）：蓝色三角或旗帜图标，与地标视觉强区分。
- **地标标记 `⊕`**（现有 `POIS_BY_MAP[chosenMap]`）：保持现状。

### 两阶段流程（用户决策：首个强制 spawn）
**状态机**：`spawnPhase`（出生点阶段）→ `landmarkPhase`（地标阶段）。

**阶段 1 — 出生点阶段（进入地图后默认）**：
- `△` 高亮、可点击；`⊕` 变灰（半透明）且点击无效。
- 顶部提示文案（`data-i18n`）："请先选择你的出生点（蓝色三角），再标记地标"。
- 交互：点击 `△` → 单选选中（高亮填充）；再点同一 `△` 取消；点别的 `△` 换选。
- 选定后自动进入阶段 2（或需用户确认——见决策，**默认自动切换**）。
- "跳过出生点"按钮：直接进入阶段 2，不设 spawn 筛选条件。

**阶段 2 — 地标阶段**：
- `⊕` 激活，按现有方式循环切换教堂/法师塔/村庄/空。
- `△` 仍可见（显示已选 spawn），可再次点击修改（回到阶段 1 重选）。

### 实时筛选
`possibleSeeds` 过滤追加出生点条件：
```javascript
possibleSeeds = seedDataMatrix.filter(row => {
  const mapOk = row[2] === this.chosenMap;
  const nightlordOk = !this.chosenNightlord || row[1] === this.chosenNightlord;
  const spawnOk = !this.selectedSpawn || SEED_SPAWN[row[0]] === this.selectedSpawn;
  return mapOk && nightlordOk && spawnOk;
});
```
- `selectedSpawn === null`（跳过或未选）时 `spawnOk` 恒真，不影响筛选。
- 选定 spawn 后立即收紧候选；叠加地标筛选进一步缩小。

### 移动端
现有移动端交互（点击选教堂、长按选法师塔/村庄）保持不变。出生点阶段：点击 `△` 即选中（单选，无需长按）。阶段切换逻辑与桌面一致。

### 视觉资源
出生点标记图标：**默认用 canvas 原生绘制蓝色实心三角 `△`**（无需新增图片资源，与地标圆点强区分）。实现时若发现 `assets/icons/` 有更合适的旗帜/出生图标可复用，可在该任务内替换，但不作为前置依赖。

## 六、关键决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 敌人类型 | 不做 | GH 出生点无敌人数据（不对称）；位置单独达 95% 目标；保持基础版简洁 |
| 强制方式 | 引导式强制（默认锁地标，可跳过） | 防误触优先 spawn（最大区分度），但留逃生口避免卡死 |
| 阶段切换 | 选定 spawn 后自动进入地标阶段 | 减少点击，符合"实时筛选"流畅感 |
| 0-319 数据 | 新增 `SEED_SPAWN` dict，不改现有行 | 遵守"不触碰 0-319"约束 |
| 出生点命名 | 统一序号"出生点①/②/③" | GH 无地名只能用序号；基础版简化哲学下全地图一致用序号 |
| 坐标空间 | 768（基础版 canvas） | 与现有 `POIS_BY_MAP` 一致 |
| `row[3]` | 不使用 | 不动现有 `seedDataMatrix` 行；用独立 const 更清晰 |

## 七、文件改动清单

| 文件 | 改动 |
|------|------|
| `integrate_dlc.py` | 新增标定数据 `_SPAWN_CALIB`；新增 `build_basic_spawn_snippets()`；`main()` 追加片段到 `data.js`；新增单测 |
| `data.js` | 追加 `SEED_SPAWN` 与 `SPAWN_POINTS_BY_MAP` 两个 const（不动现有 `seedDataMatrix` / `POIS_BY_MAP`） |
| `script.js` | 新增 `selectedSpawn`/`spawnPhase` 状态；渲染 `△` 标记；两阶段点击处理；筛选追加 `spawnOk`；"跳过出生点"按钮逻辑 |
| `index.html` | 新增"跳过出生点"按钮元素；出生点阶段提示文案（`data-i18n`） |
| `i18n/translations.js` | 新增出生点相关文案（中/英）：提示、按钮、标记 label |

**不改动**：`app-advanced.js`、`index-advanced.html`、`poi-data-advanced.js`、`extraction.html`、`dataset.json` 现有 320 键、`seedDataMatrix`/`POIS_BY_MAP` 现有行。

## 八、测试

### `integrate_dlc.py` 单测（`tests/test_integrate_dlc.py` 追加）
1. `test_seed_spawn_covers_all_seeds`：`SEED_SPAWN` 片段覆盖 520 条种子（0-319 + 1000-1199）。
2. `test_seed_spawn_values_valid`：所有出生点值在合法集合 {700-708, 13000-13002} 内。
3. `test_spawn_points_by_map_great_hollow_has_3`：GH 恰好 3 个出生点（13000/13001/13002）。
4. `test_spawn_points_coords_in_canvas`：所有出生点坐标在 [0, 768] 内。
5. `test_spawn_points_per_map_subset_of_used`：`SPAWN_POINTS_BY_MAP[map]` 是该地图种子实际出现的 Start_190 去重子集（无死标记）。

### 手动验证（浏览器）
- 选 GH，确认 3 个 `△` 出现在 pattern 图蓝色箭头位置。
- 选定一个 spawn，确认候选种子数从地标歧义态收紧。
- "跳过出生点"能进入地标阶段且不报错。
- 桌面/移动端两阶段交互正常。

## 九、量化预期

| 场景 | 当前（仅地标） | 加入出生点后 |
|------|--------------|------------|
| Great Hollow 唯一性 | 71%（23/80 歧义，最坏 3 共享） | 95%（最坏 2 共享） |
| 基础地图 | 待 spawn 数据贯穿后量化（基础地图出生点数据完整，预期提升明显） | — |

基础地图的歧义改善幅度在实现后用同一方法（每地标的种子集合并集大小分布）重新量化，写入 `progress.md`。

## 十、风险与缓解

| 风险 | 缓解 |
|------|------|
| Pillow 不可用（标定阶段） | dev 环境装 Pillow；若装不了，回退用 MCP 视觉工具人工读箭头坐标 |
| 箭头质心偏离实际出生点（PNG 含其他非透明元素） | 标定后用 MCP 视觉核对 pattern 图；必要时改用边界框中心或最大连通域质心 |
| 基础地图某些出生点地名缺失 | 全地图统一用序号命名，规避地名依赖 |
| `SEED_SPAWN` 与现有 `seedDataMatrix` 行数不一致 | 单测 `test_seed_spawn_covers_all_seeds` 强制覆盖 520 条 |
| 强制 spawn 导致用户卡死 | "跳过出生点"逃生口 |
