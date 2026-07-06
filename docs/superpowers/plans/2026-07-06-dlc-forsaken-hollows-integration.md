# DLC「被遗忘的空洞」集成 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Fuwish v0.3.3 源数据（含 DLC 全量 POI）集成到本项目，使基础版与高级版都能筛选全部 200 条 DLC 种子（ID 1000-1199）并支持新地图 Great Hollow。

**Architecture:** 单一生成器 `integrate-dlc.py` 读源 4 张 CSV，经坐标变换 + 类目映射 + mapType 纠正，分两条产出：高级版（填 CSV + 扩展 `convert-csv-to-json.py` 重生成 JSON）、基础版（追加 `dataset.json` + 改 `data.js`）。类目映射混合三种方法：5xxxx DLC 结构图标视觉识别、4xxxx boss 用 NAME.csv、30xxx-43xxx 基础结构用 Rosetta（基础种子坐标自动对齐）。

**Tech Stack:** Python 3 标准库（csv/json/unittest，零依赖）、纯静态前端（无构建/打包器/框架）、浏览器手动验证。

## Global Constraints

- **CSV 是高级版种子数据的单一事实来源**：`dataset/nightreignMapPatterns.csv` → `convert-csv-to-json.py` → `dataset/nightreignMapPatterns.json`。不得手改 JSON。
- **基础版 `dataset/dataset.json` 无 CSV 中间源**：由 `integrate-dlc.py` 直接追加 DLC 键，脚本即事实来源；**仅追加 1000-1199，不动 0-319**。
- **POI→图标映射硬编码在 `convert-csv-to-json.py`**：新增 POI 类型必须同步该脚本的 `get_poi_icon_mappings()`。
- **坐标空间**：源 picXY 在 4775；高级版 1536（×0.32168）；基础版 768（×0.16084）。
- **mapType 权威**：源 `MAP_PATTERN.csv` 的 `Special` 列（0=Default,1=Mountaintop,2=Crater,3=Rotted Woods,4=Great Hollow,5=Noklateo）。
- **项目语言**：简体中文（代码注释、commit、文档）。
- **不发布 `extraction.html`**（数据收集工具，约定不变）。
- **测试**：`integrate-dlc.py` 的纯函数用 `unittest`（标准库，零安装）测；前端浏览器手动验证。
- **源数据路径**：`/Users/lixiang/Documents/AI_code/Nightreign-maps-including-dlc-v0.3.3-main`（下文记作 `$SRC`）。
- **不提交/推送除非用户明确要求**；commit 消息以 `Co-Authored-By: Claude <noreply@anthropic.com>` 结尾。

## File Structure

**新建文件**：
- `integrate-dlc.py` — 统一 DLC 集成生成器（主交付，模块化）
- `tests/__init__.py` — 空包标识
- `tests/test_integrate_dlc.py` — `unittest` 测试（纯函数）
- `dataset/dlc-params/great_hollow_calib.json` — Great Hollow 坐标标定参数（Task 0.1 产出）
- `dataset/dlc-params/type_category_icon.json` — 5xxxx 图标视觉识别映射（Task 0.2 产出）

**修改文件**：
- `convert-csv-to-json.py` — 补 Great Hollow 坐标 + DLC 图标映射（Task 2.1）
- `dataset/nightreignMapPatterns.csv` — DLC 行 POI 槽位填充 + mapType 纠正（Task 2.2）
- `dataset/nightreignMapPatterns.json` — 重生成（Task 2.2）
- `dataset/dataset.json` — 追加 classifications["1000"-"1199"]（Task 3.2）
- `data.js` — `POIS_BY_MAP["Great Hollow"]` 填充 + seedDataMatrix DLC 行 mapType 纠正（Task 3.1）
- `assets/icons/` — 新增 DLC 建筑图标（Task 4.1）
- `README.md` — 致谢/说明（Task 4.2，如需）

**模块职责**（`integrate-dlc.py` 内）：每函数单一职责、可独立测试。
- `read_source_data()` — 读 4 张源 CSV → 结构化 dict
- `transform_coord_*()` — 坐标变换（基础/Great Hollow）
- `build_maptype_fix()` — 源 Special vs 目标 mapType 对比 → 纠正表
- `build_base_type_category()` — Rosetta：基础种子坐标对齐 → 基础 type→类目
- `cluster_great_hollow_pois()` — Great Hollow 候选点聚类去重
- `build_advanced_csv_rows()` — 高级版 CSV DLC 行
- `build_basic_classifications()` — 基础版 dataset.json 分类
- `build_basic_datajs_snippets()` — 基础版 data.js 片段
- `main()` — 胶水：调上面各模块，写产出文件

---

## Phase 0 — 参数发现（人工/交互式，产出参数文件）

这两个任务产出 `integrate-dlc.py` 运行所需的、无法自动推导的参数（坐标标定系数、5xxxx 图标类目）。

### Task 0.1: Great Hollow 坐标标定

**Files:**
- Create: `dataset/dlc-params/great_hollow_calib.json`
- Create: `tools/calibrate_great_hollow.py`（一次性标定辅助脚本）

**Interfaces:**
- Produces: `great_hollow_calib.json` schema：`{"scale_x": float, "scale_y": float, "offset_x": float, "offset_y": float, "underground_offset": [dx, dy], "underground_coord_ids": [int...], "residual_max": float, "method": "str", "note": "str"}`。`integrate-dlc.py` 的 `transform_coord_great_hollow(pic_x, pic_y, coord_id, calib)` 读取此文件。

**📍 修订（执行期发现）**：原计划假设 `great_hollow.jpg` 是真实地图需标定。执行期核实发现它是**占位图**（121KB，写有 "Great Hollow / DLC - Data Coming Soon"，commit 530d938 引入）。已确认用户选择「用 background_4.png 生成真图」。新方案（已取代下方原 Step 1-4 的标定流程）：
1. 用源 `素材/background_4.png`（4775²，GH 真实数据挖掘背景）LANCZOS 缩放到 1536×1536 JPEG（quality=90）替换占位图 → 与源坐标空间同源。
2. 坐标变换 = 源 `汉化地图导出.py:51` 的 `transform_coord`（`x*1.0186-306`、`y*1.0186-260`，地底 `+862/+355`，`underground_coords={1160,1159,1107,1110,1153,1175,1174,1213}`）复合 ×(1536/4775)，**确定性常量**，写入 `great_hollow_calib.json`：
   - `scale_x=scale_y=0.327666`（=1.0186×1536/4775）
   - `offset_x=-98.433`（=-306×1536/4775）、`offset_y=-83.636`（=-260×1536/4775）
   - `underground_offset=[277.284, 114.195]`（=[862,355]×1536/4775，目标空间）
   - `underground_coord_ids=["1160","1159","1107","1110","1153","1175","1174","1213"]`
3. 下方原 Step 1-4（标定辅助脚本 + 目视定位 + 最小二乘拟合）**已被取代**，保留备查；实际执行见 Step 1'-4'。

- [ ] **Step 1: 写标定辅助脚本**

Create `tools/calibrate_great_hollow.py`：
```python
#!/usr/bin/env python3
"""一次性标定：确定 Great Hollow 源 picXY → 目标 1536 空间的仿射变换。
方法：取若干已知 Great Hollow 建筑/boss 的源坐标（经源 transform_coord），
与目标 great_hollow.jpg 上对应可见地标的像素位置做最小二乘拟合。"""
import csv, json, os

SRC = "/Users/lixiang/Documents/AI_code/Nightreign-maps-including-dlc-v0.3.3-main"
PROJ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 源 transform_coord（复制自 汉化地图导出.py:51，Special==4 分支）
def source_transform(pic_x, pic_y, is_underground):
    x, y = pic_x * 1.0186 - 306, pic_y * 1.0186 - 260
    if is_underground:
        x += 862; y += 355
    return x, y

def load_great_hollow_landmarks():
    """读 Great Hollow 种子(1005)的建筑坐标作为候选地标。返回 [(coord_id, pic_x, pic_y, type), ...]"""
    # 读 CONSTRUCT MAP=1005 的 coord_index + 坐标.csv
    constructs = {}
    with open(f"{SRC}/CONSTRUCT.csv", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            if row[1] == "1005":  # MAP=种子ID
                constructs[row[5]] = row[2]  # coord_index -> type
    coords = {}
    with open(f"{SRC}/坐标.csv", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in f:
            if len(row) >= 9 and row[0] and row[7] and row[8]:
                try: coords[row[0]] = (float(row[7]), float(row[8]))
                except ValueError: pass
    out = []
    for ci, t in constructs.items():
        if ci in coords:
            out.append((ci, coords[ci][0], coords[ci][1], t))
    return out

if __name__ == "__main__":
    lm = load_great_hollow_landmarks()
    print(f"Great Hollow 种子1005 共 {len(lm)} 个地标候选。")
    print("在目标 great_hollow.jpg 上目视定位至少 4 个地标，记录其目标像素，")
    print("然后在此脚本补 TARGET_POINTS 做最小二乘拟合（见脚本末尾注释）。")
    print("坐标(coord_id, 源picX, 源picY, type):")
    for x in lm[:12]:
        print(" ", x)
    # TARGET_POINTS = [(coord_id, target_px_x, target_px_y), ...]  # 人工填
    # 拟合 target = A*src_x + B*src_y + C (x2 维)，输出 calib.json
```

- [ ] **Step 2: 运行辅助脚本获取候选地标**

Run: `python3 tools/calibrate_great_hollow.py`
Expected: 打印 Great Hollow 种子 1005 的 ~40 个地标候选（coord_id, 源 picX/picY, type）。

- [ ] **Step 3: 目视定位至少 4 个地标**

用图片查看器打开 `$SRC/输出/大空洞/map_1005_1.jpg`（源渲染图，已贴图标，带坐标线索）与 `$PROJ/assets/map/great_hollow.jpg`（目标）。选取 **4-6 个**易识别的对应地标（如孤立的 boss 圈、显著建筑），在目标图上读出像素坐标（x 往右增、y 往下增，原点左上）。

- [ ] **Step 4: 补全拟合并写 calib.json**

在 `tools/calibrate_great_hollow.py` 末尾补 `TARGET_POINTS`（Step 3 的对应点）与最小二乘拟合（`numpy.linalg.lstsq` 或手写正规方程，若不愿引 numpy 则用 4 点解线性方程组），拟合 `target_x = a*src_x + b*src_y + c`、`target_y = d*src_x + e*src_y + f`。输出 `dataset/dlc-params/great_hollow_calib.json`。

若拟合质量差（残差 > 5px），回退到简化模型并记录：
```json
{
  "scale_x": 0.32168, "scale_y": 0.32168,
  "offset_x": 0.0, "offset_y": 0.0,
  "underground_offset": [0.0, 0.0], "underground_coord_ids": [],
  "residual_max": -1, "method": "fallback_uniform_scale",
  "note": "标定未完成，用 background_4.png 直接缩放假设；Great Hollow 坐标可能有系统偏差，见设计文档 §5.2 回退。"
}
```

- [ ] **Step 5: 验证 calib.json 落盘**

Run: `cat dataset/dlc-params/great_hollow_calib.json`
Expected: 合法 JSON，含全部 schema 字段，`residual_max` 反映标定残差（或 -1 表示回退）。

- [ ] **Step 6: Commit**

```bash
git add tools/calibrate_great_hollow.py dataset/dlc-params/great_hollow_calib.json
git commit -m "feat(dlc): Great Hollow 坐标标定参数与辅助脚本

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 0.2: 5xxxx DLC 图标视觉识别

**Files:**
- Create: `dataset/dlc-params/type_category_icon.json`
- Reference: `$SRC/素材/Construct_5*.png`（47 个 DLC 结构图标）

**Interfaces:**
- Produces: `type_category_icon.json` schema：`{"<type_int>": {"icon": "<icon_name>", "adv": "<majorBase|minorBase|fieldBoss|evergaol|rottedWoods>", "basic": "<church|mage|village|other>", "note": "<视觉依据>"}}`。覆盖 DLC 种子（1000-1199）实际出现的全部 5xxxx type。`integrate-dlc.py` 的 `build_advanced_csv_rows` / `build_basic_classifications` 读取此表。

**视觉判断规则**（写进每个条目的 `note`）：
- 教堂（有高耸尖顶/钟楼/彩窗）→ `adv=majorBase, basic=church, icon=cathedral_blank`
- 法师塔（细高塔楼、顶部尖/球）→ `adv=minorBase, basic=mage, icon=rise`
- 村庄/聚落（成片房屋、屋顶群）→ `adv=minorBase, basic=village, icon=township`
- 永恒牢狱（cage/牢笼结构）→ `adv=evergaol, basic=other, icon=evergaol`
- 野外 boss/怪物（生物形态）→ `adv=fieldBoss, basic=other, icon=field_boss`
- 无法明确判定 → `adv=minorBase, basic=other, icon=ruin_blank`（兜底）

- [ ] **Step 1: 提取 DLC 实际出现的 5xxxx type 列表**

Run:
```bash
SRC="/Users/lixiang/Documents/AI_code/Nightreign-maps-including-dlc-v0.3.3-main"
awk -F',' 'NR>1 && $2+0>=1000 && $2+0<=1199 && $3+0>=50000 && $3+0<54000 {print $3}' "$SRC/CONSTRUCT.csv" | sort -n | uniq
```
Expected: 打印 DLC 种子中实际出现的 5xxxx type 列表（记为待识别集合）。

- [ ] **Step 2: 逐个视觉识别图标**

对 Step 1 列出的每个 type，用 Read 工具打开 `$SRC/素材/Construct_<type>.png` 查看图像内容，按上述规则判定 `adv/basic/icon`，记录到 `note`。

（执行说明：每个图标 Read 一次，肉眼分类。这是确定性工作——图固定，类目确定。）

- [ ] **Step 3: 写 type_category_icon.json**

按 Step 2 的判定，写 `dataset/dlc-params/type_category_icon.json`，覆盖 Step 1 全部 type。示例条目：
```json
{
  "52420": {"icon": "cathedral_blank", "adv": "majorBase", "basic": "church", "note": "高耸尖顶+钟楼，教堂特征"},
  "52570": {"icon": "rise", "adv": "minorBase", "basic": "mage", "note": "细高塔楼，法师塔"}
}
```

- [ ] **Step 4: 验证覆盖完整**

Run: `python3 -c "import json; d=json.load(open('dataset/dlc-params/type_category_icon.json')); print('条目数:', len(d))"`
Expected: 条目数 == Step 1 的 type 数量（无遗漏）。

- [ ] **Step 5: Commit**

```bash
git add dataset/dlc-params/type_category_icon.json
git commit -m "feat(dlc): 5xxxx DLC 结构图标视觉识别映射

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 1 — integrate-dlc.py 核心（TDD，每模块可独立测试）

### Task 1.1: 脚手架 + 源数据读取模块

**Files:**
- Create: `integrate-dlc.py`
- Create: `tests/__init__.py`（空文件）
- Create: `tests/test_integrate_dlc.py`
- Test: `tests/test_integrate_dlc.py::TestReadSourceData`

**Interfaces:**
- Produces: `read_source_data(src_dir: str) -> dict`，返回 `{"patterns": {seed_id: {...}}, "constructs": {seed_id: [{type, coord_index}]}, "coords": {coord_id: (pic_x, pic_y)}, "names": {type_or_id: chinese_name}}`。

- [ ] **Step 1: 写失败测试**

Create `tests/test_integrate_dlc.py`：
```python
import unittest
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from integrate_dlc import read_source_data

SRC = "/Users/lixiang/Documents/AI_code/Nightreign-maps-including-dlc-v0.3.3-main"

class TestReadSourceData(unittest.TestCase):
    def test_reads_520_patterns(self):
        d = read_source_data(SRC)
        self.assertEqual(len(d["patterns"]), 520)

    def test_dlc_seed_1005_is_great_hollow(self):
        d = read_source_data(SRC)
        self.assertEqual(d["patterns"]["1005"]["special"], 4)  # Great Hollow

    def test_constructs_keyed_by_seed(self):
        d = read_source_data(SRC)
        self.assertIn("1005", d["constructs"])
        # 种子1005 有几十个建筑
        self.assertGreater(len(d["constructs"]["1005"]), 10)

    def test_coords_resolvable(self):
        d = read_source_data(SRC)
        # coord_index 1107 在坐标.csv 有效
        self.assertIn("1107", d["coords"])
        px, py = d["coords"]["1107"]
        self.assertGreater(px, 0)
        self.assertGreater(py, 0)

    def test_name_for_boss(self):
        d = read_source_data(SRC)
        # 4770 = 唤声船（boss 有中文名）
        self.assertEqual(d["names"].get("4770"), "唤声船")

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 运行测试确认失败**

Run: `python3 -m unittest tests.test_integrate_dlc -v`
Expected: FAIL（`ModuleNotFoundError: No module named 'integrate_dlc'`）。

- [ ] **Step 3: 写最小实现**

Create `integrate-dlc.py`（首版只含 `read_source_data` + 模块常量）：
```python
#!/usr/bin/env python3
"""DLC「被遗忘的空洞」统一集成生成器。
读源 4 张 CSV，经坐标变换/类目映射/mapType 纠正，产出高级版与基础版 DLC 数据。
设计文档：docs/superpowers/specs/2026-07-06-dlc-forsaken-hollows-integration-design.md"""
import csv, json, os
from typing import Dict, List, Tuple, Any

# === 常量 ===
PROJ_DIR = os.path.dirname(os.path.abspath(__file__))
PARAMS_DIR = os.path.join(PROJ_DIR, "dataset", "dlc-params")
SRC_DEFAULT = "/Users/lixiang/Documents/AI_code/Nightreign-maps-including-dlc-v0.3.3-main"
DLC_SEED_RANGE = range(1000, 1200)  # 200 条 DLC 种子
SPECIAL_TO_MAP = {0: "Default", 1: "Mountaintop", 2: "Crater",
                  3: "Rotted Woods", 4: "Great Hollow", 5: "Noklateo"}
SCALE_1536 = 1536 / 4775   # 高级版坐标空间
SCALE_768 = 768 / 4775     # 基础版坐标空间


def _read_csv_rows(path: str) -> List[List[str]]:
    with open(path, "r", encoding="utf-8") as f:
        return list(csv.reader(f))


def read_source_data(src_dir: str = SRC_DEFAULT) -> Dict[str, Any]:
    """读源 4 张 CSV → 结构化 dict。"""
    # MAP_PATTERN.csv: ID,NightLord,Special,Start_190,...,Day1Boss,Day1Loc,Day2Boss,Day2Loc
    patterns = {}
    for row in _read_csv_rows(os.path.join(src_dir, "MAP_PATTERN.csv"))[1:]:
        if not row or not row[0] or not row[0].strip().isdigit():
            continue
        sid = row[0].strip()
        patterns[sid] = {
            "nightlord": int(row[1]) if len(row) > 1 and row[1].strip().lstrip("-").isdigit() else 0,
            "special": int(row[2]) if len(row) > 2 and row[2].strip().isdigit() else 0,
            "start": row[3].strip() if len(row) > 3 else "",
            "day1_boss": row[10].strip() if len(row) > 10 else "",
            "day1_loc": row[11].strip() if len(row) > 11 else "",
            "day2_boss": row[12].strip() if len(row) > 12 else "",
            "day2_loc": row[13].strip() if len(row) > 13 else "",
        }

    # CONSTRUCT.csv: ID,MAP(=种子ID),type,is_display,_,coord_index,...
    constructs: Dict[str, List[Dict]] = {}
    for row in _read_csv_rows(os.path.join(src_dir, "CONSTRUCT.csv"))[1:]:
        if not row or len(row) < 6 or not row[1].strip().isdigit():
            continue
        sid = row[1].strip()
        ci = row[5].strip()
        if not ci:
            continue
        constructs.setdefault(sid, []).append(
            {"type": row[2].strip(), "coord_index": ci,
             "is_display": row[3].strip() == "1"})

    # 坐标.csv: ID,Name,...,picX,picY
    coords: Dict[str, Tuple[float, float]] = {}
    for row in _read_csv_rows(os.path.join(src_dir, "坐标.csv"))[1:]:
        if not row or len(row) < 9 or not row[0].strip():
            continue
        try:
            px, py = float(row[7]), float(row[8])
        except (ValueError, IndexError):
            continue
        if px > 0 or py > 0:  # 跳过 (0,0) 占位
            coords[row[0].strip()] = (px, py)

    # NAME.csv: ID,中文名(,英文名)
    names: Dict[str, str] = {}
    for row in _read_csv_rows(os.path.join(src_dir, "NAME.csv")):
        if not row or len(row) < 2 or not row[0].strip():
            continue
        names[row[0].strip()] = row[1].strip()

    return {"patterns": patterns, "constructs": constructs,
            "coords": coords, "names": names}


if __name__ == "__main__":
    main()  # 后续任务补全
```

Create `tests/__init__.py`（空文件）。

- [ ] **Step 4: 运行测试确认通过**

Run: `python3 -m unittest tests.test_integrate_dlc -v`
Expected: 5 个测试 PASS。

- [ ] **Step 5: Commit**

```bash
git add integrate-dlc.py tests/__init__.py tests/test_integrate_dlc.py
git commit -m "feat(dlc): integrate-dlc.py 脚手架与源数据读取模块

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 1.2: 坐标变换模块

**Files:**
- Modify: `integrate-dlc.py`（在 `read_source_data` 后追加）
- Modify: `tests/test_integrate_dlc.py`（追加 `TestTransformCoord`）

**Interfaces:**
- Consumes: `great_hollow_calib.json`（Task 0.1）的 schema。
- Produces: `transform_coord_basic(pic_x, pic_y, target_space)` 与 `transform_coord_great_hollow(pic_x, pic_y, coord_id, calib, target_space)`，返回 `(x, y)` 浮点元组；`target_space ∈ {1536, 768}`。

- [ ] **Step 1: 写失败测试**

追加到 `tests/test_integrate_dlc.py`（在 `if __name__` 之前）：
```python
from integrate_dlc import (transform_coord_basic, transform_coord_great_hollow,
                           load_great_hollow_calib, SCALE_1536, SCALE_768)

class TestTransformCoord(unittest.TestCase):
    def test_basic_1536(self):
        # 源 picXY 4775 → 1536 纯缩放
        x, y = transform_coord_basic(4775, 4775, 1536)
        self.assertAlmostEqual(x, 1536, places=1)
        self.assertAlmostEqual(y, 1536, places=1)

    def test_basic_768(self):
        x, y = transform_coord_basic(0, 0, 768)
        self.assertEqual((x, y), (0.0, 0.0))

    def test_great_hollow_uses_calib_scale(self):
        calib = {"scale_x": 0.32168, "scale_y": 0.32168,
                 "offset_x": 0.0, "offset_y": 0.0,
                 "underground_offset": [0.0, 0.0], "underground_coord_ids": []}
        # target_space=1536，calib.scale 已是到 1536 的系数
        x, y = transform_coord_great_hollow(1000.0, 1000.0, "1107", calib, 1536)
        self.assertAlmostEqual(x, 321.68, places=1)

    def test_great_hollow_underground_offset(self):
        calib = {"scale_x": 0.32, "scale_y": 0.32, "offset_x": 0, "offset_y": 0,
                 "underground_offset": [10.0, 20.0], "underground_coord_ids": ["9999"]}
        # target_space=1536 → half=1.0（见 Step 3 实现）
        # x = 100 * 0.32 * 1.0 + 0 * 1.0 = 32.0；地底再 +10.0*1.0 = 42.0
        # y = 100 * 0.32 * 1.0 + 0 * 1.0 = 32.0；地底再 +20.0*1.0 = 52.0
        x, y = transform_coord_great_hollow(100.0, 100.0, "9999", calib, 1536)
        self.assertAlmostEqual(x, 42.0, places=2)
        self.assertAlmostEqual(y, 52.0, places=2)

    def test_calib_loads_or_fallback(self):
        calib = load_great_hollow_calib()
        self.assertIn("scale_x", calib)
```

- [ ] **Step 2: 运行确认失败**

Run: `python3 -m unittest tests.test_integrate_dlc.TestTransformCoord -v`
Expected: FAIL（`ImportError: cannot import name transform_coord_basic`）。

- [ ] **Step 3: 写实现**

追加到 `integrate-dlc.py`（`read_source_data` 之后、`if __name__` 之前）：
```python
def transform_coord_basic(pic_x: float, pic_y: float, target_space: int) -> Tuple[float, float]:
    """基础地图（Special 0/1/2/3/5）：源 picXY(4775) → 目标空间，纯线性缩放，无偏移。
    设计文档 §5.1 已用基础种子 0 验证。"""
    scale = SCALE_1536 if target_space == 1536 else SCALE_768
    return (pic_x * scale, pic_y * scale)


def load_great_hollow_calib() -> Dict[str, Any]:
    """加载 Great Hollow 标定参数；缺失则回退到纯缩放假设。"""
    path = os.path.join(PARAMS_DIR, "great_hollow_calib.json")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"scale_x": 0.32168, "scale_y": 0.32168,
            "offset_x": 0.0, "offset_y": 0.0,
            "underground_offset": [0.0, 0.0], "underground_coord_ids": [],
            "residual_max": -1, "method": "fallback_missing",
            "note": "calib.json 不存在，回退纯缩放。"}


def transform_coord_great_hollow(pic_x: float, pic_y: float, coord_id: str,
                                  calib: Dict[str, Any], target_space: int) -> Tuple[float, float]:
    """Great Hollow：应用标定参数（已含源 transform_coord 的影响）。
    calib 的 scale 是「源 picXY 经 transform_coord 后 → 1536」的系数；
    若 target_space==768 再 ×0.5。地底建筑额外加 underground_offset。"""
    half = 0.5 if target_space == 768 else 1.0
    x = pic_x * calib["scale_x"] * half + calib["offset_x"] * half
    y = pic_y * calib["scale_y"] * half + calib["offset_y"] * half
    if coord_id in set(calib.get("underground_coord_ids", [])):
        uo = calib.get("underground_offset", [0.0, 0.0])
        x += uo[0] * half
        y += uo[1] * half
    return (x, y)
```

- [ ] **Step 4: 运行确认通过**

Run: `python3 -m unittest tests.test_integrate_dlc.TestTransformCoord -v`
Expected: 5 个测试 PASS。

- [ ] **Step 5: Commit**

```bash
git add integrate-dlc.py tests/test_integrate_dlc.py
git commit -m "feat(dlc): 坐标变换模块（基础地图 + Great Hollow 标定）

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 1.3: mapType 纠正表生成

**Files:**
- Modify: `integrate-dlc.py`（追加 `build_maptype_fix`）
- Modify: `tests/test_integrate_dlc.py`（追加 `TestMapTypeFix`）

**Interfaces:**
- Produces: `build_maptype_fix(source) -> Dict[str, str]`，键=DLC 种子号字符串，值=纠正后的 mapType（来自源 Special）。仅含**与目标当前值不同**的种子。

- [ ] **Step 1: 写失败测试**

```python
from integrate_dlc import build_maptype_fix, read_source_data

class TestMapTypeFix(unittest.TestCase):
    def setUp(self):
        self.source = read_source_data()

    def test_seed_1005_is_great_hollow(self):
        fix = build_maptype_fix(self.source)
        # 源 Special=4 → Great Hollow（目标当前标 Default，应在纠正表里）
        self.assertEqual(fix.get("1005"), "Great Hollow")

    def test_seed_1000_not_in_fix_if_default(self):
        fix = build_maptype_fix(self.source)
        # 种子1000 源 Special=0(Default)，目标也是 Default → 不在纠正表
        # （仅当目标当前值与源一致才排除；此处目标1000=Default，故排除）
        self.assertNotIn("1000", fix)

    def test_all_fix_values_valid(self):
        fix = build_maptype_fix(self.source)
        for sid, mt in fix.items():
            self.assertTrue(1000 <= int(sid) <= 1199)
            self.assertIn(mt, SPECIAL_TO_MAP.values())
```

- [ ] **Step 2: 运行确认失败**

Run: `python3 -m unittest tests.test_integrate_dlc.TestMapTypeFix -v`
Expected: FAIL（`ImportError: cannot import name build_maptype_fix`）。

- [ ] **Step 3: 写实现**

追加到 `integrate-dlc.py`：
```python
def _load_target_maptypes() -> Dict[str, str]:
    """从现有 data.js 的 seedDataMatrix 读 DLC 行当前 mapType（[2]列）。
    解析 JS 数组的子集，仅取 1000-1199 行。"""
    import re
    path = os.path.join(PROJ_DIR, "data.js")
    txt = open(path, encoding="utf-8").read()
    out = {}
    for m in re.finditer(r"\[(\d{4}),\s*\"([^\"]*)\",\s*\"([^\"]*)\"", txt):
        sid, _nightlord, maptype = m.group(1), m.group(2), m.group(3)
        if 1000 <= int(sid) <= 1199:
            out[sid] = maptype
    return out


def build_maptype_fix(source: Dict[str, Any]) -> Dict[str, str]:
    """对比源 Special 与目标当前 mapType，返回需纠正的 {seed_id: correct_mapType}。"""
    target = _load_target_maptypes()
    fix = {}
    for sid, pat in source["patterns"].items():
        if not (1000 <= int(sid) <= 1199):
            continue
        correct = SPECIAL_TO_MAP.get(pat["special"], "Default")
        if target.get(sid) != correct:
            fix[sid] = correct
    return fix
```

- [ ] **Step 4: 运行确认通过**

Run: `python3 -m unittest tests.test_integrate_dlc.TestMapTypeFix -v`
Expected: 3 个测试 PASS。

- [ ] **Step 5: Commit**

```bash
git add integrate-dlc.py tests/test_integrate_dlc.py
git commit -m "feat(dlc): mapType 纠正表生成（源 Special 权威）

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 1.4: Rosetta 自动类目映射（基础 type）

**Files:**
- Modify: `integrate-dlc.py`（追加 `build_base_type_category`）
- Modify: `tests/test_integrate_dlc.py`（追加 `TestRosetta`）

**Interfaces:**
- Consumes: 基础种子（0-319）的源建筑（CONSTRUCT+坐标）+ 目标基础版 `dataset.json` 分类 + `data.js` 的 `POIS_BY_MAP` 坐标。
- Produces: `build_base_type_category(source) -> Dict[str, Dict]`，键=基础 type（30xxx-43xxx 结构 + 4xxxx boss），值=`{"adv": str, "basic": str, "count": int}`。

**算法**：对每个基础种子，取其源建筑（type+源坐标）→ 缩放到 768 → 与该种子地图的 `POIS_BY_MAP` 候选点最近邻匹配（阈值 < 30px）→ 匹配上的读 `dataset.json[种子]["POI"+id]` 得 basic 类目，记录 `type→basic`。汇总投票。高级版 `adv` 类目由 4xxxx→fieldBoss、30xxx-43xxx 按结构启发式（38xxx/41xxx→majorBase，32xxx/34xxx→minorBase 等）。

- [ ] **Step 1: 写失败测试**

```python
from integrate_dlc import build_base_type_category, read_source_data

class TestRosetta(unittest.TestCase):
    def setUp(self):
        self.source = read_source_data()

    def test_returns_nonempty_mapping(self):
        cat = build_base_type_category(self.source)
        self.assertGreater(len(cat), 20)  # 基础结构 type 至少几十种

    def test_boss_type_fieldboss(self):
        cat = build_base_type_category(self.source)
        # 任一 4xxxx boss 应归 fieldBoss
        boss_types = [t for t in cat if t.startswith("4") and len(t) == 5]
        self.assertTrue(all(cat[t]["adv"] == "fieldBoss" for t in boss_types[:5]))

    def test_each_entry_has_required_keys(self):
        cat = build_base_type_category(self.source)
        for t, v in cat.items():
            self.assertIn("adv", v)
            self.assertIn("basic", v)
            self.assertIn("count", v)
```

- [ ] **Step 2: 运行确认失败**

Run: `python3 -m unittest tests.test_integrate_dlc.TestRosetta -v`
Expected: FAIL（`ImportError`）。

- [ ] **Step 3: 写实现**

追加到 `integrate-dlc.py`：
```python
import re

def _load_basic_pois_by_map() -> Dict[str, List[Dict]]:
    """从 data.js 读 POIS_BY_MAP：{map: [{id,x,y}, ...]}（768 空间）。"""
    txt = open(os.path.join(PROJ_DIR, "data.js"), encoding="utf-8").read()
    out = {}
    for m in re.finditer(r"(\w[\w ]*):\s*\[(.*?)\]", txt, re.S):
        name, body = m.group(1), m.group(2)
        if name not in SPECIAL_TO_MAP.values():
            continue
        pois = []
        for pm in re.finditer(r"\{\s*id:\s*(\d+),\s*x:\s*([\d.]+),\s*y:\s*([\d.]+)\s*\}", body):
            pois.append({"id": int(pm.group(1)), "x": float(pm.group(2)), "y": float(pm.group(3))})
        if pois:
            out[name] = pois
    return out


def _load_basic_classifications() -> Dict[str, Dict[str, str]]:
    """读 dataset.json 的 classifications（仅基础 0-319）。"""
    with open(os.path.join(PROJ_DIR, "dataset", "dataset.json"), encoding="utf-8") as f:
        return json.load(f).get("classifications", {})


# 基础结构 type 数值范围 → 高级版 category 启发式
_STRUCTURE_ADV_HEURISTIC = [
    (38000, 39000, "majorBase"),   # 38xxx 教堂/要塞
    (41000, 44000, "majorBase"),   # 41xxx-43xxx 大型遗迹
    (32000, 33000, "minorBase"),   # 32xxx 村庄/营地的法师塔
    (34000, 35000, "minorBase"),   # 34xxx
    (30000, 32000, "minorBase"),   # 30xxx 小建筑
]


def _structure_adv(type_int: int) -> str:
    for lo, hi, cat in _STRUCTURE_ADV_HEURISTIC:
        if lo <= type_int < hi:
            return cat
    return "minorBase"  # 兜底


def build_base_type_category(source: Dict[str, Any]) -> Dict[str, Dict]:
    """Rosetta：基础种子源建筑坐标对齐目标 POI，学 type→basic 类目（投票）。
    adv 类目由启发式/NAME 推导。"""
    pois_by_map = _load_basic_pois_by_map()
    classifications = _load_basic_classifications()
    tally: Dict[str, Dict[str, int]] = {}  # type -> {class: count}

    for sid, pat in source["patterns"].items():
        if not (0 <= int(sid) <= 319):
            continue
        seed_key = sid.zfill(3)
        cls = classifications.get(seed_key)
        if not cls:
            continue
        maptype = SPECIAL_TO_MAP.get(pat["special"], "Default")
        pois = pois_by_map.get(maptype, [])
        if not pois:
            continue
        for con in source["constructs"].get(sid, []):
            coord = source["coords"].get(con["coord_index"])
            if not coord:
                continue
            bx, by = transform_coord_basic(coord[0], coord[1], 768)
            # 最近邻匹配 POI
            best, best_d = None, 1e9
            for p in pois:
                d = (p["x"] - bx) ** 2 + (p["y"] - by) ** 2
                if d < best_d:
                    best_d, best = d, p
            if best is None or best_d > 30 * 30:
                continue
            basic = cls.get(f"POI{best['id']}")
            if not basic:
                continue
            t = con["type"]
            tally.setdefault(t, {})
            tally[t][basic] = tally[t].get(basic, 0) + 1

    out = {}
    for t, votes in tally.items():
        t_int = int(t) if t.isdigit() else 0
        if 40000 <= t_int < 50000:
            adv = "fieldBoss"          # 4xxxx boss
        elif t_int >= 50000:
            continue                    # 5xxxx 由图标识别表处理
        else:
            adv = _structure_adv(t_int)
        basic = max(votes, key=votes.get)
        out[t] = {"adv": adv, "basic": basic, "count": sum(votes.values())}
    return out
```

- [ ] **Step 4: 运行确认通过**

Run: `python3 -m unittest tests.test_integrate_dlc.TestRosetta -v`
Expected: 3 个测试 PASS。

- [ ] **Step 5: Commit**

```bash
git add integrate-dlc.py tests/test_integrate_dlc.py
git commit -m "feat(dlc): Rosetta 基础 type→类目自动映射

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 1.5: Great Hollow 候选点聚类

**Files:**
- Modify: `integrate-dlc.py`（追加 `cluster_great_hollow_pois`）
- Modify: `tests/test_integrate_dlc.py`（追加 `TestCluster`）

**Interfaces:**
- Consumes: `source` + `great_hollow_calib.json`。
- Produces: `cluster_great_hollow_pois(source, calib, target_space) -> List[Dict]`，每项 `{"id": int(1..N), "x": float, "y": float, "source_coords": [(pic_x,pic_y,coord_id),...]}`，按 id 升序。

- [ ] **Step 1: 写失败测试**

```python
from integrate_dlc import cluster_great_hollow_pois, load_great_hollow_calib

class TestCluster(unittest.TestCase):
    def setUp(self):
        self.source = read_source_data()
        self.calib = load_great_hollow_calib()

    def test_returns_clustered_pois(self):
        pois = cluster_great_hollow_pois(self.source, self.calib, 768)
        self.assertGreater(len(pois), 10)   # Great Hollow 至少十几个候选点
        self.assertLess(len(pois), 100)      # 不应爆炸
        # id 连续从 1 开始
        self.assertEqual(pois[0]["id"], 1)
        self.assertEqual([p["id"] for p in pois], list(range(1, len(pois) + 1)))

    def test_all_coords_in_canvas(self):
        pois = cluster_great_hollow_pois(self.source, self.calib, 768)
        for p in pois:
            self.assertTrue(0 <= p["x"] <= 768)
            self.assertTrue(0 <= p["y"] <= 768)
```

- [ ] **Step 2: 运行确认失败**

Run: `python3 -m unittest tests.test_integrate_dlc.TestCluster -v`
Expected: FAIL（`ImportError`）。

- [ ] **Step 3: 写实现**

追加到 `integrate-dlc.py`：
```python
def cluster_great_hollow_pois(source: Dict[str, Any], calib: Dict[str, Any],
                              target_space: int, merge_threshold: float = 25.0) -> List[Dict]:
    """收集 80 条 Great Hollow 种子的全部建筑坐标（目标空间），近邻聚类去重。
    merge_threshold 单位=目标空间像素（768 空间下 25px ≈ 源 155px）。"""
    # 收集所有 Great Hollow 种子的建筑目标坐标
    points = []  # [(tx, ty, coord_id, pic_x, pic_y, type)]
    for sid, pat in source["patterns"].items():
        if not (1000 <= int(sid) <= 1199) or pat["special"] != 4:
            continue
        for con in source["constructs"].get(sid, []):
            coord = source["coords"].get(con["coord_index"])
            if not coord:
                continue
            tx, ty = transform_coord_great_hollow(coord[0], coord[1], con["coord_index"], calib, target_space)
            points.append((tx, ty, con["coord_index"], coord[0], coord[1], con["type"]))

    # 贪心聚类：按 x 排序，距离 < threshold 合并
    points.sort()
    clusters = []  # 每个: {"coords": [...], "cx": , "cy": }
    for tx, ty, ci, px, py, t in points:
        merged = False
        for cl in clusters:
            if (cl["cx"] - tx) ** 2 + (cl["cy"] - ty) ** 2 <= merge_threshold ** 2:
                cl["coords"].append((px, py, ci, t))
                # 更新质心
                n = len(cl["coords"])
                cl["cx"] = ((n - 1) * cl["cx"] + tx) / n
                cl["cy"] = ((n - 1) * cl["cy"] + ty) / n
                merged = True
                break
        if not merged:
            clusters.append({"coords": [(px, py, ci, t)], "cx": tx, "cy": ty})

    # 按 (cx, cy) 排序后分配 id
    clusters.sort(key=lambda c: (c["cy"], c["cx"]))
    out = []
    for i, cl in enumerate(clusters, 1):
        out.append({"id": i, "x": round(cl["cx"], 1), "y": round(cl["cy"], 1),
                    "source_coords": cl["coords"]})
    return out
```

- [ ] **Step 4: 运行确认通过**

Run: `python3 -m unittest tests.test_integrate_dlc.TestCluster -v`
Expected: 2 个测试 PASS。

- [ ] **Step 5: Commit**

```bash
git add integrate-dlc.py tests/test_integrate_dlc.py
git commit -m "feat(dlc): Great Hollow 候选点聚类去重

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 1.6: 高级版 CSV DLC 行生成

**Files:**
- Modify: `integrate-dlc.py`（追加 `build_advanced_csv_rows`）
- Modify: `tests/test_integrate_dlc.py`（追加 `TestAdvancedRows`）

**Interfaces:**
- Consumes: `source` + `type_category_icon.json`（Task 0.2）+ Rosetta 基础映射（Task 1.4）+ Great Hollow 候选点（Task 1.5，1536 空间）+ mapType 纠正（Task 1.3）。
- Produces: `build_advanced_csv_rows(source, ...) -> Dict[str, Dict]`，键=DLC 种子号，值=`{"mapType": str, "nightlord": str, "major_base": {location: value}, "minor_base": {...}, "evergaol": {...}, "field_boss": {...}}`，供 Task 2.2 合并进 CSV。

**说明**：CSV 槽位按类别×地名组织。DLC Great Hollow 的 POI 地名用程序化标识 `greatHollow_<category>_<n>`（因 NAME.csv 不覆盖）。基础 5 地图的 DLC 种子复用现有地名槽位（POI 坐标在 `get_poi_coordinates()` 已有），其建筑通过 Rosetta 类目回填。

- [ ] **Step 1: 写失败测试**

```python
from integrate_dlc import build_advanced_csv_rows, load_type_category_icon

class TestAdvancedRows(unittest.TestCase):
    def setUp(self):
        self.source = read_source_data()
        self.icon = load_type_category_icon()

    def test_dlc_seed_count(self):
        rows = build_advanced_csv_rows(self.source, self.icon)
        self.assertEqual(len(rows), 200)

    def test_great_hollow_seed_has_pois(self):
        rows = build_advanced_csv_rows(self.source, self.icon)
        gh = [r for r in rows.values() if r["mapType"] == "Great Hollow"]
        self.assertGreater(len(gh), 0)
        # Great Hollow 种子应有非空 POI
        total = sum(len(r["major_base"]) + len(r["minor_base"]) +
                    len(r["evergaol"]) + len(r["field_boss"]) for r in gh)
        self.assertGreater(total, 0)

    def test_maptype_corrected(self):
        rows = build_advanced_csv_rows(self.source, self.icon)
        self.assertEqual(rows["1005"]["mapType"], "Great Hollow")
```

- [ ] **Step 2: 运行确认失败**

Run: `python3 -m unittest tests.test_integrate_dlc.TestAdvancedRows -v`
Expected: FAIL（`ImportError`）。

- [ ] **Step 3: 写实现**

追加到 `integrate-dlc.py`：
```python
# 夜王编号→名称（与 data.js NIGHTLORDS / CSV 一致）
NIGHTLORD_NAMES = {
    0: "Gladius", 1: "Gaping Maw", 2: "Augur", 3: "Sentient Pest",
    4: "Caligo", 5: "Centipede Demon", 6: "Ice Dragon", 7: "Night Lord",
    8: "Harmonia", 9: "Straghess",
}


def load_type_category_icon() -> Dict[str, Dict]:
    path = os.path.join(PARAMS_DIR, "type_category_icon.json")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return {}


def _classify_type(type_str: str, source: Dict, icon_map: Dict, base_map: Dict) -> Dict:
    """单个 type → {adv, basic, icon}。优先级：图标识别表(5xxxx) > Rosetta基础 > NAME(boss) > 兜底。"""
    t = type_str.strip()
    if t in icon_map:                       # 5xxxx DLC 结构
        return icon_map[t]
    if t in base_map:                       # 基础结构/boss（Rosetta）
        bm = base_map[t]
        return {"adv": bm["adv"], "basic": bm["basic"],
                "icon": _adv_default_icon(bm["adv"])}
    ti = int(t) if t.isdigit() else 0
    if 40000 <= ti < 50000 and t in source["names"]:  # 4xxxx boss 有 NAME
        return {"adv": "fieldBoss", "basic": "other", "icon": "field_boss"}
    return {"adv": "minorBase", "basic": "other", "icon": "ruin_blank"}  # 兜底


def _adv_default_icon(adv: str) -> str:
    return {"majorBase": "ruin_blank", "minorBase": "church",
            "fieldBoss": "field_boss", "evergaol": "evergaol",
            "rottedWoods": "elite"}.get(adv, "ruin_blank")


def build_advanced_csv_rows(source: Dict, icon_map: Dict,
                             base_map: Dict = None, gh_pois_1536: List[Dict] = None,
                             calib: Dict = None) -> Dict[str, Dict]:
    """生成 200 条 DLC 种子的高级版 CSV 行数据。"""
    if base_map is None:
        base_map = build_base_type_category(source)
    if calib is None:
        calib = load_great_hollow_calib()
    if gh_pois_1536 is None:
        gh_pois_1536 = cluster_great_hollow_pois(source, calib, 1536)

    # Great Hollow 候选点 → 程序化地名
    gh_locations = {p["id"]: f"greatHollow_{p['id']}" for p in gh_pois_1536}

    rows = {}
    for sid, pat in source["patterns"].items():
        if not (1000 <= int(sid) <= 1199):
            continue
        maptype = SPECIAL_TO_MAP.get(pat["special"], "Default")
        row = {"mapType": maptype, "nightlord": NIGHTLORD_NAMES.get(pat["nightlord"], "Gladius"),
               "major_base": {}, "minor_base": {}, "evergaol": {}, "field_boss": {}}

        for con in source["constructs"].get(sid, []):
            cls = _classify_type(con["type"], source, icon_map, base_map)
            cat_key = {"majorBase": "major_base", "minorBase": "minor_base",
                       "fieldBoss": "field_boss", "evergaol": "evergaol",
                       "rottedWoods": "field_boss"}[cls["adv"]]
            if maptype == "Great Hollow":
                # 匹配到最近的 Great Hollow 候选点地名
                coord = source["coords"].get(con["coord_index"])
                if not coord:
                    continue
                loc = _nearest_gh_location(coord, gh_pois_1536, calib)
                if loc is None:
                    continue
            else:
                loc = f"dlc_{maptype}_{con['coord_index']}"  # 基础地图：坐标索引标识
            structure = source["names"].get(con["type"], con["type"])
            boss = source["names"].get(con["type"], "") if cls["adv"] == "fieldBoss" else ""
            value = f"{structure} - {boss}" if boss else structure
            row[cat_key][loc] = value
        rows[sid] = row
    return rows


def _nearest_gh_location(coord, gh_pois_1536, calib) -> str:
    tx, ty = transform_coord_great_hollow(coord[0], coord[1], "", calib, 1536)
    best, best_d = None, 1e9
    for p in gh_pois_1536:
        d = (p["x"] - tx) ** 2 + (p["y"] - ty) ** 2
        if d < best_d:
            best_d, best = d, f"greatHollow_{p['id']}"
    return best
```

- [ ] **Step 4: 运行确认通过**

Run: `python3 -m unittest tests.test_integrate_dlc.TestAdvancedRows -v`
Expected: 3 个测试 PASS。

- [ ] **Step 5: Commit**

```bash
git add integrate-dlc.py tests/test_integrate_dlc.py
git commit -m "feat(dlc): 高级版 CSV DLC 行生成（图标+Rosetta+NAME 混合分类）

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 1.7: 基础版 dataset.json 分类生成

**Files:**
- Modify: `integrate-dlc.py`（追加 `build_basic_classifications`）
- Modify: `tests/test_integrate_dlc.py`（追加 `TestBasicClassifications`）

**Interfaces:**
- Produces: `build_basic_classifications(source, ...) -> Dict[str, Dict[str, str]]`，键=零填充种子号（"1000"-"1199"），值=`{"POI1": "church", ...}`，值 ∈ {church,mage,village,other,nothing}。

- [ ] **Step 1: 写失败测试**

```python
from integrate_dlc import build_basic_classifications

class TestBasicClassifications(unittest.TestCase):
    def setUp(self):
        self.source = read_source_data()

    def test_200_dlc_seeds(self):
        cls = build_basic_classifications(self.source)
        self.assertEqual(len(cls), 200)
        for sid in cls:
            self.assertTrue(1000 <= int(sid) <= 1199)

    def test_great_hollow_has_pois(self):
        cls = build_basic_classifications(self.source)
        # 种子1005(Great Hollow) 应有候选点分类
        self.assertGreater(len(cls["1005"]), 0)

    def test_values_in_taxonomy(self):
        cls = build_basic_classifications(self.source)
        valid = {"church", "mage", "village", "other", "nothing"}
        for sid, pois in cls.items():
            for v in pois.values():
                self.assertIn(v, valid)
```

- [ ] **Step 2: 运行确认失败**

Run: `python3 -m unittest tests.test_integrate_dlc.TestBasicClassifications -v`
Expected: FAIL。

- [ ] **Step 3: 写实现**

追加到 `integrate-dlc.py`：
```python
def build_basic_classifications(source: Dict, icon_map: Dict = None,
                                 base_map: Dict = None, gh_pois_768: List[Dict] = None,
                                 calib: Dict = None, existing_pois_by_map: Dict = None) -> Dict[str, Dict[str, str]]:
    """生成 200 条 DLC 种子的基础版 4 类分类。"""
    if icon_map is None:
        icon_map = load_type_category_icon()
    if base_map is None:
        base_map = build_base_type_category(source)
    if calib is None:
        calib = load_great_hollow_calib()
    if gh_pois_768 is None:
        gh_pois_768 = cluster_great_hollow_pois(source, calib, 768)
    if existing_pois_by_map is None:
        existing_pois_by_map = _load_basic_pois_by_map()

    out = {}
    for sid, pat in source["patterns"].items():
        if not (1000 <= int(sid) <= 1199):
            continue
        maptype = SPECIAL_TO_MAP.get(pat["special"], "Default")

        if maptype == "Great Hollow":
            pois = gh_pois_768
        else:
            pois = existing_pois_by_map.get(maptype, [])

        # 初始化全部候选点为 nothing
        cls = {f"POI{p['id']}": "nothing" for p in pois}

        # 遍历该种子建筑，匹配候选点，填类目
        for con in source["constructs"].get(sid, []):
            coord = source["coords"].get(con["coord_index"])
            if not coord:
                continue
            if maptype == "Great Hollow":
                bx, by = transform_coord_great_hollow(coord[0], coord[1], con["coord_index"], calib, 768)
            else:
                bx, by = transform_coord_basic(coord[0], coord[1], 768)
            best, best_d = None, 1e9
            for p in pois:
                d = (p["x"] - bx) ** 2 + (p["y"] - by) ** 2
                if d < best_d:
                    best_d, best = d, p
            if best is None or best_d > 40 * 40:  # 基础版查询容差 40px
                continue
            c = _classify_type(con["type"], source, icon_map, base_map)
            cls[f"POI{best['id']}"] = c["basic"]
        out[sid.zfill(4)] = cls
    return out
```

注：种子号零填充——`dataset.json` 现有键是 3 位（"000"），但 DLC 种子号 1000-1199 是 4 位。验证现有基础版 `findRealPOITypeAtCoordinate` 用 `padStart(3,'0')`：对 4 位数 `padStart(3)` 不变（已是 4 位）。故 DLC 键用 4 位字符串（"1000"）。在 Task 3.2 需确认 `script.js` 的查找逻辑兼容（若 `padStart(3)` 对 "1000" 仍为 "1000" 则 OK）。

- [ ] **Step 4: 运行确认通过**

Run: `python3 -m unittest tests.test_integrate_dlc.TestBasicClassifications -v`
Expected: 3 个测试 PASS。

- [ ] **Step 5: Commit**

```bash
git add integrate-dlc.py tests/test_integrate_dlc.py
git commit -m "feat(dlc): 基础版 dataset.json 分类生成

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 1.8: 基础版 data.js 片段生成 + main 胶水

**Files:**
- Modify: `integrate-dlc.py`（追加 `build_basic_datajs_snippets` + `main`）
- Modify: `tests/test_integrate_dlc.py`（追加 `TestDataJsSnippets`）

**Interfaces:**
- Produces: `build_basic_datajs_snippets(source, ...) -> Dict[str, str]`，含 `"pois_by_map_gh"`（JS 数组字面量片段）、`"seed_matrix_fixes"`（`{seed_id: maptype}`）。

- [ ] **Step 1: 写失败测试**

```python
from integrate_dlc import build_basic_datajs_snippets

class TestDataJsSnippets(unittest.TestCase):
    def setUp(self):
        self.source = read_source_data()

    def test_pois_by_map_gh_nonempty(self):
        snip = build_basic_datajs_snippets(self.source)
        self.assertIn("pois_by_map_gh", snip)
        self.assertIn("{ id: 1", snip["pois_by_map_gh"])

    def test_seed_matrix_fixes_great_hollow(self):
        snip = build_basic_datajs_snippets(self.source)
        self.assertEqual(snip["seed_matrix_fixes"].get("1005"), "Great Hollow")
```

- [ ] **Step 2: 运行确认失败**

Run: `python3 -m unittest tests.test_integrate_dlc.TestDataJsSnippets -v`
Expected: FAIL。

- [ ] **Step 3: 写实现**

追加到 `integrate-dlc.py`：
```python
def build_basic_datajs_snippets(source: Dict, calib: Dict = None,
                                gh_pois_768: List[Dict] = None) -> Dict[str, Any]:
    if calib is None:
        calib = load_great_hollow_calib()
    if gh_pois_768 is None:
        gh_pois_768 = cluster_great_hollow_pois(source, calib, 768)

    # POIS_BY_MAP["Great Hollow"] 的 JS 数组字面量
    lines = []
    for p in gh_pois_768:
        lines.append(f"    {{ id: {p['id']}, x: {p['x']}, y: {p['y']} }}")
    pois_js = ",\n".join(lines)

    return {
        "pois_by_map_gh": pois_js,
        "seed_matrix_fixes": build_maptype_fix(source),
    }


def main():
    """主流程：读源 → 算各产出 → 写文件。幂等可重跑。"""
    print("🔄 DLC 集成生成器启动...")
    source = read_source_data()
    calib = load_great_hollow_calib()
    icon_map = load_type_category_icon()
    base_map = build_base_type_category(source)

    gh_1536 = cluster_great_hollow_pois(source, calib, 1536)
    gh_768 = cluster_great_hollow_pois(source, calib, 768)

    # 高级版 CSV 行
    adv_rows = build_advanced_csv_rows(source, icon_map, base_map, gh_1536, calib)
    _write_advanced_csv_patch(adv_rows, gh_1536)
    print(f"✅ 高级版 CSV 补丁写出（{len(adv_rows)} 种子）")

    # 基础版
    basic_cls = build_basic_classifications(source, icon_map, base_map, gh_768, calib)
    _append_basic_dataset_json(basic_cls)
    print(f"✅ dataset.json 追加 {len(basic_cls)} DLC 种子分类")

    snip = build_basic_datajs_snippets(source, calib, gh_768)
    _write_datajs_snippet_file(snip)
    print("✅ data.js 片段写出（见 dataset/dlc-params/datajs_snippet.txt，Task 3.1 人工应用）")

    print("🎉 集成生成完成。后续：Task 2.2 重跑 convert-csv-to-json.py；Task 3.1/3.2 应用基础版改动。")


# 以下为写文件辅助函数（main 的依赖，一并实现）
def _write_advanced_csv_patch(adv_rows, gh_1536):
    """把 adv_rows 序列化为 CSV 补丁指令文件，供 Task 2.2 合并。
    同时写出 Great Hollow 地名坐标表，供 Task 2.1 补 get_poi_coordinates()。"""
    patch = {"rows": adv_rows,
             "great_hollow_coords": {f"greatHollow_{p['id']}": [p["x"], p["y"]] for p in gh_1536}}
    with open(os.path.join(PARAMS_DIR, "advanced_csv_patch.json"), "w", encoding="utf-8") as f:
        json.dump(patch, f, ensure_ascii=False, indent=2)


def _append_basic_dataset_json(basic_cls):
    """读现有 dataset.json，追加 DLC 键，写回。不动 0-319。"""
    path = os.path.join(PROJ_DIR, "dataset", "dataset.json")
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    data.setdefault("classifications", {}).update(basic_cls)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _write_datajs_snippet_file(snip):
    """把 data.js 片段写到文本文件，供 Task 3.1 人工应用（避免脚本误改 17k 行 JS）。"""
    txt = (f"// === POIS_BY_MAP[\"Great Hollow\"] 替换 [] 存根 ===\n{snip['pois_by_map_gh']}\n\n"
           f"// === seedDataMatrix mapType 纠正（{len(snip['seed_matrix_fixes'])} 条）===\n"
           + "\n".join(f"{sid}: \"{mt}\"" for sid, mt in snip["seed_matrix_fixes"].items()))
    with open(os.path.join(PARAMS_DIR, "datajs_snippet.txt"), "w", encoding="utf-8") as f:
        f.write(txt)
```

- [ ] **Step 4: 运行确认通过**

Run: `python3 -m unittest tests.test_integrate_dlc.TestDataJsSnippets -v`
Expected: 2 个测试 PASS。

- [ ] **Step 5: Commit**

```bash
git add integrate-dlc.py tests/test_integrate_dlc.py
git commit -m "feat(dlc): 基础版 data.js 片段生成与 main 胶水

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 2 — 高级版集成

### Task 2.1: 扩展 convert-csv-to-json.py

**Files:**
- Modify: `convert-csv-to-json.py:102-181`（`get_poi_coordinates` 补 `great_hollow`）
- Modify: `convert-csv-to-json.py:14-100`（`get_poi_icon_mappings` 补 DLC structure/boss）

**Interfaces:**
- Consumes: `dataset/dlc-params/advanced_csv_patch.json`（Task 1.8 产出，含 `great_hollow_coords`）。

- [ ] **Step 1: 补 Great Hollow 坐标到 get_poi_coordinates()**

读 `dataset/dlc-params/advanced_csv_patch.json` 的 `great_hollow_coords`，把每个 `greatHollow_<n>` 坐标填入 `convert-csv-to-json.py` 的 `get_poi_coordinates()` 中 `"great_hollow": {}`（179-180 行）。

Edit `convert-csv-to-json.py`，把：
```python
        "great_hollow": {
        }
```
替换为从 patch 读取的实际坐标字典（手动复制 patch 的 great_hollow_coords 到此处，保持硬编码风格与现有一致）：
```python
        "great_hollow": {
            "greatHollow_1": (x1, y1),
            "greatHollow_2": (x2, y2),
            # ... 全部候选点
        }
```

- [ ] **Step 2: 补 DLC 图标映射到 get_poi_icon_mappings()**

对 `type_category_icon.json` 中每个 type 的 `icon` 与 `adv`，在 `get_poi_icon_mappings()` 对应 category 字典补条目。键用 `source["names"].get(type, type)`（中文名）或 type 字符串。

Edit `convert-csv-to-json.py:14-100`，在对应 category 字典追加 DLC 条目（如 major_base 加 Great Hollow 教堂结构、field_boss 加 DLC boss）。

- [ ] **Step 3: 验证语法**

Run: `python3 -c "import convert_csv_to_json" 2>&1 || python3 -c "exec(open('convert-csv-to-json.py').read())" 2>&1 | head -5`

（注：文件名含连字符无法直接 import；用 `python3 -c "exec(...)"` 或重命名验证。最简：运行 `python3 convert-csv-to-json.py` 看是否报语法错——但此时 CSV 尚未填充，DLC pois 仍空，输出应为现有行为。）

Run: `python3 convert-csv-to-json.py`
Expected: 无语法错，正常生成 JSON（DLC 部分此时仍空，Task 2.2 填 CSV 后才有数据）。

- [ ] **Step 4: Commit**

```bash
git add convert-csv-to-json.py
git commit -m "feat(dlc): convert-csv-to-json.py 补 Great Hollow 坐标与 DLC 图标映射

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2.2: 运行生成器 + 填充 CSV + 重生成 JSON

**Files:**
- Modify: `dataset/nightreignMapPatterns.csv`（DLC 行 POI 槽位填充 + mapType 纠正）
- Modify: `dataset/nightreignMapPatterns.json`（重生成）
- Create: `tools/apply_advanced_csv_patch.py`（把 patch 合并进 CSV）

**Interfaces:**
- Consumes: `dataset/dlc-params/advanced_csv_patch.json`。

- [ ] **Step 1: 写 CSV 补丁应用脚本**

Create `tools/apply_advanced_csv_patch.py`：
```python
#!/usr/bin/env python3
"""把 advanced_csv_patch.json 的 DLC 行数据合并进 nightreignMapPatterns.csv。
- 填充 DLC 行(1000-1199)的 POI 槽位（按类别×地名）。
- mapType 纠正（改 'Shifting Earth' 列）。
幂等：以 CSV 第1行表头为准，重写 DLC 行的 POI 列。"""
import csv, json, os

PROJ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(PROJ, "dataset", "nightreignMapPatterns.csv")
PATCH_PATH = os.path.join(PROJ, "dataset", "dlc-params", "advanced_csv_patch.json")

CATEGORY_TO_HEADER = {"major_base": "Major Base", "minor_base": "Minor Base",
                      "evergaol": "Evergaol", "field_boss": "Field Boss"}

def _append_column(rows, h1_val, h2_val):
    """在两行表头与全部数据行末尾追加一列，返回新列索引。"""
    new_c = len(rows[0])
    rows[0].append(h1_val)
    rows[1].append(h2_val)
    for r in rows[2:]:
        r.append("")
    return new_c


def main():
    with open(PATCH_PATH, encoding="utf-8") as f:
        patch = json.load(f)
    with open(CSV_PATH, encoding="utf-8") as f:
        rows = list(csv.reader(f))
    header1, header2 = rows[0], rows[1]

    # 行宽归一化：DLC 行（如 1000）当前可能只有少量字段，需补齐到表头宽度，否则追加列会错位
    width = len(header1)
    for r in rows:
        while len(r) < width:
            r.append("")

    # 建 (header1, header2_location) → col_index 索引
    col_idx = {}
    for c in range(width):
        h1 = header1[c].strip()
        h2 = header2[c].strip() if c < len(header2) else ""
        if h1 in CATEGORY_TO_HEADER.values() and h2:
            col_idx[(h1, h2)] = c

    # 收集 patch 涉及的全部 (category, location) 槽位
    needed = set()
    for r in patch["rows"].values():
        for cat, header in CATEGORY_TO_HEADER.items():
            for loc in r.get(cat, {}):
                needed.add((header, loc))

    # 缺失的槽位追加新列（两行表头同步扩展）
    added = 0
    for (header, loc) in sorted(needed):
        if (header, loc) not in col_idx:
            col_idx[(header, loc)] = _append_column(rows, header, loc)
            added += 1
    print(f"新增槽位列：{added}")

    # 定位 Shifting Earth / Nightlord 列
    def find_col(name):
        for c in range(len(rows[0])):
            if rows[0][c].strip() == name:
                return c
        return None
    c_maptype = find_col("Shifting Earth")
    c_nightlord = find_col("Nightlord")

    # 逐 DLC 行填值（mapType + nightlord + POI 槽位）
    updated = 0
    for r in rows[2:]:
        if not r or not r[0].strip().isdigit():
            continue
        sid = r[0].strip()
        if sid not in patch["rows"]:
            continue
        pr = patch["rows"][sid]
        if c_maptype is not None:
            r[c_maptype] = pr["mapType"]
        if c_nightlord is not None:
            r[c_nightlord] = pr["nightlord"]
        for cat, header in CATEGORY_TO_HEADER.items():
            for loc, val in pr.get(cat, {}).items():
                c = col_idx.get((header, loc))
                if c is not None:
                    r[c] = val
        updated += 1

    with open(CSV_PATH, "w", encoding="utf-8", newline="") as f:
        csv.writer(f).writerows(rows)
    print(f"✅ CSV 更新：{updated} DLC 行")

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 运行 integrate-dlc.py 生成 patch**

Run: `python3 integrate-dlc.py`
Expected: 打印各产出完成；`dataset/dlc-params/advanced_csv_patch.json` 生成。

- [ ] **Step 3: 应用 CSV 补丁**

Run: `python3 tools/apply_advanced_csv_patch.py`
Expected: 打印 DLC 行更新数；`nightreignMapPatterns.csv` 的 DLC 行 POI 槽位被填。

- [ ] **Step 4: 重生成 JSON**

Run: `python3 convert-csv-to-json.py`
Expected: 无错；统计显示 Great Hollow 有 POI。

- [ ] **Step 5: 验证 JSON**

Run:
```bash
python3 -c "
import json
d=json.load(open('dataset/nightreignMapPatterns.json'))
s=d['seeds']['1005']
print('1005 mapType:', s['mapType'], '| pois:', len(s['pois']))
print('Great Hollow lookup:', len(d['poiLookupByMapType']['Great Hollow']))
"
```
Expected: `1005 mapType: Great Hollow`，pois > 0；Great Hollow lookup > 0。

- [ ] **Step 6: Commit**

```bash
git add dataset/nightreignMapPatterns.csv dataset/nightreignMapPatterns.json tools/apply_advanced_csv_patch.py
git commit -m "feat(dlc): 高级版 CSV 填充与 JSON 重生成（200 DLC 种子）

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2.3: 高级版浏览器验证

**Files:** 无（验证任务）

- [ ] **Step 1: 启动服务器**

Run: `python3 server.py`（后台）或 `node server.js`
Expected: 打印本机与局域网地址。

- [ ] **Step 2: 打开高级版**

浏览器开 `http://localhost:8000/index-advanced.html`。

- [ ] **Step 3: 验证 Great Hollow 地图**

切换地图到 Great Hollow：
- 确认 POI 候选点显示在地图合理位置（对齐可见地标，不偏出/重叠）。
- 标记一个 POI，确认候选种子列表收敛（Great Hollow 种子被筛选）。
- 选地图=Great Hollow + 不限夜王，确认候选含 ~80 条 Great Hollow 种子。

- [ ] **Step 4: 验证 DLC 夜王**

选夜王 Harmonia / Straghess，确认候选种子含对应 DLC 种子。

- [ ] **Step 5: 验证基础 5 地图 DLC 种子**

选地图=Default，确认候选种子含 DLC Default 种子（1000 等），POI 标记能筛选。

- [ ] **Step 6: 记录问题并修复**

若 POI 位置偏差大 → 回 Task 0.1 重新标定坐标。若筛选不收敛 → 检查分类映射（Task 0.2 / 1.4）。修复后重跑 Task 2.2。

- [ ] **Step 7: Commit（如有修复）**

```bash
git add -A && git commit -m "fix(dlc): 高级版验证修复

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 3 — 基础版集成

### Task 3.1: 应用 data.js 改动

**Files:**
- Modify: `data.js:63-65`（`POIS_BY_MAP["Great Hollow"]` 替换 `[]`）
- Modify: `data.js:16753-16952`（seedDataMatrix DLC 行 mapType 纠正）

**Interfaces:**
- Consumes: `dataset/dlc-params/datajs_snippet.txt`（Task 1.8 产出）。

- [ ] **Step 1: 替换 POIS_BY_MAP["Great Hollow"]**

读 `dataset/dlc-params/datajs_snippet.txt` 的 POIS_BY_MAP 片段。Edit `data.js`，把：
```javascript
  Great Hollow: []
```
（约 63-65 行）替换为：
```javascript
  Great Hollow: [
    { id: 1, x: ..., y: ... },
    ...
  ]
```

- [ ] **Step 2: 纠正 seedDataMatrix mapType**

读 snippet 的 `seed_matrix_fixes`。对每个 `{seed_id: maptype}`，Edit `data.js` 中对应行（如 `[1005, "Gladius", "Default", ...` → `[1005, "Gladius", "Great Hollow", ...`）。

用脚本批量替换更安全：
```bash
python3 -c "
import json, re
path='data.js'
txt=open(path,encoding='utf-8').read()
fix=json.load(open('dataset/dlc-params/advanced_csv_patch.json'))  # 或专用 fix 文件
# 对每个需纠正的种子，正则替换 [sid, nightlord, \"oldmap\" -> \"newmap\"
"
```
（实际：从 `datajs_snippet.txt` 读 fixes，逐条正则替换 `(\[<sid>, \"[^\"]*\", )\"[^\"]*\"` → `\1\"<newmap>\"`。）

- [ ] **Step 3: 验证 JS 语法**

Run: `node --check data.js` 或浏览器开发者工具加载 `index.html` 看无报错。
Expected: 无语法错。

- [ ] **Step 4: Commit**

```bash
git add data.js
git commit -m "feat(dlc): 基础版 POIS_BY_MAP Great Hollow 填充与 mapType 纠正

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3.2: 应用 dataset.json 追加

**Files:**
- Modify: `dataset/dataset.json`（已在 Task 1.8 main 里由 `_append_basic_dataset_json` 追加）

**说明**：Task 1.8 运行 `integrate-dlc.py` 时已追加 DLC 分类到 `dataset.json`。本任务验证。

- [ ] **Step 1: 验证 script.js 兼容 4 位种子键**

确认 `script.js` 的 `findRealPOITypeAtCoordinate` 用 `seedNum.padStart(3,'0')`：
- 对种子号 1005（字符串 "1005"），`padStart(3)` 不变 → 查 `"1005"`。
- `dataset.json` 键是 `"1005"`（4 位）→ 匹配 ✓。

若 `script.js` 用其他键变换，需调整。读 `script.js` 确认。

- [ ] **Step 2: 验证 dataset.json 含 DLC 键**

Run:
```bash
python3 -c "
import json
d=json.load(open('dataset/dataset.json'))
c=d['classifications']
print('总键数:', len(c), '| 含1005:', '1005' in c, '| 含1115:', '1115' in c)
print('1005 POI数:', len(c.get('1005',{})))
"
```
Expected: 总键数 = 320 + 200 = 520；含 1005/1115；1005 有候选点分类。

- [ ] **Step 3: Commit（若 integrate-dlc.py 已写则 dataset.json 已改，此步确认）**

```bash
git add dataset/dataset.json
git commit -m "feat(dlc): 基础版 dataset.json 追加 200 DLC 种子分类

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3.3: 基础版浏览器验证

**Files:** 无（验证任务）

- [ ] **Step 1: 打开基础版**

浏览器开 `http://localhost:8000/index.html`（服务器需运行）。

- [ ] **Step 2: 验证 Great Hollow**

切地图 Great Hollow：
- POI 候选点（教堂/法师塔等圆点）显示在合理位置。
- 左键标记教堂、右键/长按选法师塔/村庄，确认候选种子收敛。
- 选地图=Great Hollow 不限夜王，候选含 ~80 种子。

- [ ] **Step 3: 验证 DLC 夜王 + 基础地图 DLC 种子**

- 选夜王 Harmonia/Straghess，候选含对应 DLC 种子。
- 选地图 Default，候选含 DLC Default 种子（1000 等），POI 标记筛选正常。

- [ ] **Step 4: 回归测试基础种子**

选地图 Default + 种子范围含 0-319，标记 POI，确认基础种子筛选行为**与改动前一致**（dataset.json 0-319 未动）。

- [ ] **Step 5: 修复并 commit**

发现问题 → 回相应 Task 修复。重跑 `integrate-dlc.py` + Task 3.1。

```bash
git add -A && git commit -m "fix(dlc): 基础版验证修复

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 4 — 收尾

### Task 4.1: DLC 图标资源拷贝

**Files:**
- Create: `assets/icons/<dlc_icons>.png`（从源拷贝）

- [ ] **Step 1: 拷贝 DLC 图标**

把 `type_category_icon.json` 涉及的 `$SRC/素材/Construct_5*.png` 拷贝到 `assets/icons/`，按本项目命名约定重命名（若需）。同时确认 Harmonia/Straghess 夜王图标是否需替换。

```bash
SRC="/Users/lixiang/Documents/AI_code/Nightreign-maps-including-dlc-v0.3.3-main"
# 拷贝 5xxxx 图标（按 type_category_icon.json 涉及的）
cp "$SRC/素材/Construct_52420.png" assets/icons/  # 等
```

- [ ] **Step 2: 验证图标在高级版显示**

浏览器开高级版，Great Hollow POI 图标正常渲染（无缺失警告）。

- [ ] **Step 3: Commit**

```bash
git add assets/icons/
git commit -m "feat(dlc): 新增 DLC 建筑图标资源

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4.2: 回归测试 + README

**Files:**
- Modify: `README.md`（致谢/说明，如需）

- [ ] **Step 1: 全量回归**

- 高级版 + 基础版各跑一遍 Task 2.3 / 3.3 的验证清单。
- 确认基础种子 0-319 两版筛选不变。
- 确认全部 200 DLC 种子可被筛选（夜王/地图/POI 组合）。

- [ ] **Step 2: 跑全部单元测试**

Run: `python3 -m unittest tests.test_integrate_dlc -v`
Expected: 全部 PASS。

- [ ] **Step 3: 更新 README（如需）**

在 README 致谢/数据来源处补 Fuwish v0.3.3 DLC 数据说明（若原文未覆盖）。

- [ ] **Step 4: 清理工作区**

确认 `distnr/`、`__pycache__/` 已被 `.gitignore` 忽略（已提交 03a6770）。

- [ ] **Step 5: 最终 commit**

```bash
git add README.md
git commit -m "docs(dlc): README 补充 DLC 数据来源说明

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Self-Review（计划自检结果）

**Spec 覆盖**：
- §1 目标（200 DLC 种子 + Great Hollow + 两版）→ 全部 Task 覆盖。
- §5 坐标变换（基础+GH标定）→ Task 0.1, 1.2。
- §6 类目映射（5xxxx图标 + 4xxxx NAME + 30xxx-43xxx Rosetta）→ Task 0.2, 1.4, 1.6。
- §7 mapType 纠正 → Task 1.3, 2.2, 3.1。
- §8 高级版产出（CSV + convert 扩展 + JSON）→ Task 1.6, 2.1, 2.2。
- §9 基础版产出（POIS_BY_MAP + dataset.json + seedDataMatrix）→ Task 1.7, 1.8, 3.1, 3.2。
- §10 图标 → Task 4.1。
- §11 验证 → Task 2.3, 3.3, 4.2。

**占位符**：参数发现任务（0.1/0.2）的产出值由运行/视觉判定产生（数据发现，非代码占位符），给了 schema + 方法 + 验证。其余代码完整。

**类型一致性**：`read_source_data` 返回结构在各 Task 一致；`_classify_type` 返回 `{adv, basic, icon}` 统一；坐标变换函数签名一致。

**已知风险（实施时关注）**：
1. Great Hollow 坐标标定（Task 0.1）质量直接决定 POI 位置准确性，残差需 < 5px。
2. Rosetta（Task 1.4）对齐阈值 30px 可能需调；基础建筑坐标对齐率影响基础 5 地图 DLC 分类质量。
3. CSV 表头扩展（Task 2.2）：`apply_advanced_csv_patch.py` 已正确处理「两行表头同步追加新列 + DLC 短行行宽归一化」，但实施时仍需跑 Step 5 验证 JSON 中 Great Hollow lookup 计数合理（避免列错位未被发现）。
4. `dataset.json` DLC 键 4 位 vs `script.js` padStart(3) 兼容性（Task 3.2 Step 1 需确认）。
