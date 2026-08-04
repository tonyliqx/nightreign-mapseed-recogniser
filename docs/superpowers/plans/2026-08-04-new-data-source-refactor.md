# 新数据源重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用新数据源 `Nightreign-maps-including-dlc-v0.3.3-main` 的权威数据替换本项目全部本地数据，三个版本（基础版/高级版/boss-reverse）的交互与匹配 JS 保持不变，仅由一个新 Python ETL 生成它们消费的数据文件并迁移图片。

**Architecture:** 新源只读拷贝到 `vendor/nightreign-data/`（gitignore，可重建）。一个可导入的 Python 模块 `tools/nightreign_etl.py` 读取 4 CSV + NAME，产出 `data.js` / `dataset/dataset.json` / `dataset/nightreignMapPatterns.json` / `dataset/boss_data.json`；`tools/build-from-newsource.py` 是 CLI 入口；`tools/type_mapping.json` 是 curate 的 type→分类映射。图片迁入 `assets/`（结果图 jpg、底图转 jpg、图标按映射重命名）。JS 仅改 `boss-reverse.html` 一处（内嵌 DATA→fetch）。

**Tech Stack:** Python（pandas + Pillow），pytest（仅 ETL 单测），原生 JS/HTML（无构建）。

## Global Constraints

- **Python 解释器**：`/Users/lixiang/Documents/AI_code/venv/bin/python`（系统 python3 无 pandas）。依赖：`pandas pillow openpyxl`。
- **新源只读**：所有读取指向 `vendor/nightreign-data/`；新源原仓库 `Nightreign-maps-including-dlc-v0.3.3-main` 一行不动。
- **拷贝用 `cp -R`**（不用 rsync，曾被告警拦截）。
- **JS 不改**：`script.js` / `app-advanced.js` / `poi-data-advanced.js` 一律不改；唯一 JS 改动是 `boss-reverse.html` 内嵌 `DATA` 改 `fetch`。
- **坐标系**：新源 `picX/picY` 为 1536 原生；高级版原样用，基础版 `÷2`→768。废弃旧 `/3.108`。
- **结果图统一 jpg**：用新源 `output/map_{ID}.jpg`。
- **视觉比对**：涉及坐标/图标/底图对齐的验证，产出对照并请用户人眼确认（用户偏好，效率更高）。
- **中文为主**：结果图用新源中文地图（en 版同图）；commit 消息用中文约定式提交。
- **提交节奏**：每个 Task 末尾 commit 到 `feature/new-data-source`（执行开始前与用户确认是否按此节奏；用户未明示前不自动 push）。
- **CSV 读取约定**：`MAP_PATTERN.csv` / `坐标.csv` / `CONSTRUCT.csv` 按列名读；`NAME.csv` 无表头（`header=None`，用第 0/1 列）。

---

## File Structure

| 文件 | 职责 |
|---|---|
| `tools/nightreign_etl.py` | 可导入库：读源、映射、分类、缩放、各版本产物生成（纯函数，可单测） |
| `tools/build-from-newsource.py` | CLI 入口：编排 `nightreign_etl`，写文件、迁图、打印校验摘要 |
| `tools/type_mapping.json` | curate 的 `{type: {advCategory, basicClass, icon}}` 表（初值来自旧 `dataset/dlc-params/type_category_icon.json` + NAME/classify 校验补全） |
| `tools/setup_vendor.py` | 把新源所需文件选择性拷到 `vendor/nightreign-data/` |
| `tests/conftest.py` | 把 `tools/` 加入 sys.path；提供合成 CSV fixture |
| `tests/test_mappings.py` / `tests/test_etl.py` | ETL 纯函数单测 |
| `vendor/nightreign-data/` | 新源只读副本（gitignore） |
| `data.js` | 基础版数据全局（ETL 重生成） |
| `dataset/dataset.json` | 基础版 classifications（ETL 重生成） |
| `dataset/nightreignMapPatterns.json` | 高级版（ETL 重生成） |
| `dataset/boss_data.json` | boss 反推（新源拷贝） |
| `assets/pattern/**` `assets/map/**` `assets/icons/**` | 迁移后的图片 |

---

## Phase 0 — 分支与脚手架

### Task 0.1：建分支与目录

**Files:**
- Create: `tools/.gitkeep`, `tests/.gitkeep`
- Modify: `.gitignore`（加 `vendor/`）

- [ ] **Step 1：从 master 切分支**

```bash
git checkout master
git pull --ff-only origin master 2>/dev/null || true
git checkout -b feature/new-data-source
```

- [ ] **Step 2：建目录 + gitignore**

```bash
mkdir -p tools tests vendor/nightreign-data
touch tools/.gitkeep tests/.gitkeep
printf '\n# 新源只读副本（可由 tools/setup_vendor.py 重建）\nvendor/\n' >> .gitignore
```

- [ ] **Step 3：确认工作区干净后提交（含设计/实现文档）**

```bash
git add .gitignore tools/.gitkeep tests/.gitkeep docs/superpowers/
git commit -m "chore: 建新数据源重构分支脚手架 + 设计/实现文档"
```

> 注：从 `master` 切新分支时，当前 `feature/full-seed-export` 的未跟踪文件（如 `dataset/full_export/poi-viewer/*.jpg`、`assets/icons/unknown.png`）会随工作树带到新分支。它们与本重构无关，提交时只用具体路径 `git add`，避免 `git add -A` 误纳入。

---

### Task 0.2：拷贝新源数据到 vendor/

**Files:**
- Create: `vendor/nightreign-data/`（CSV + NAME + boss_data.json + 素材/ + output/map_*.jpg）

- [ ] **Step 1：选择性拷贝（用 cp，不用 rsync）**

```bash
SRC=/Users/lixiang/Documents/AI_code/Nightreign-maps-including-dlc-v0.3.3-main
DST=vendor/nightreign-data
mkdir -p "$DST/output"
cp "$SRC"/MAP_PATTERN.csv "$SRC"/坐标.csv "$SRC"/CONSTRUCT.csv "$SRC"/NAME.csv "$SRC"/boss_data.json "$DST"/
cp -R "$SRC"/素材 "$DST"/素材
cp "$SRC"/output/map_*.jpg "$DST"/output/
```

- [ ] **Step 2：核对数量**

```bash
DST=vendor/nightreign-data
echo "csv+json: $(ls "$DST"/*.csv "$DST"/*.json 2>/dev/null | wc -l)（期望 5）"
echo "素材: $(ls "$DST"/素材 | wc -l)（期望 ~263）"
echo "output jpg: $(ls "$DST"/output | wc -l)（期望 520）"
```

- [ ] **Step 3：记录就绪**

> `vendor/` 在 `.gitignore` 中，本任务不产生 git 提交；在 progress ledger 记录「vendor 已就绪」。

---

## Phase 1 — ETL 核心与映射表

### Task 1.1：生成并 curate `type_mapping.json`

**Files:**
- Create: `tools/type_mapping.json`
- Reference: `dataset/dlc-params/type_category_icon.json`（旧，作初值）

**Interfaces:**
- Produces: `tools/type_mapping.json`，形如 `{"38100": {"advCategory":"minorBase","basicClass":"village","icon":"village"}, ...}`，覆盖新源 NAME.csv 全部 type。

- [ ] **Step 1：写生成脚本 `tools/gen_type_mapping.py`**

```python
# tools/gen_type_mapping.py
# 初值来自旧 type_category_icon.json，用 NAME.csv + classify 规则补全未覆盖 type。
import json, csv, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VENDOR = ROOT / "vendor" / "nightreign-data"
OLD = ROOT / "dataset" / "dlc-params" / "type_category_icon.json"

# 1) 旧映射初值
old = json.loads(OLD.read_text(encoding="utf-8"))  # {"<type>": {"icon":..,"adv":..,"basic":..,...}}

# 2) 新源 NAME.csv 全量 type
names = {}
with (VENDOR / "NAME.csv").open(encoding="utf-8") as f:
    for row in csv.reader(f):
        if row and row[0].strip():
            names[int(row[0])] = row[1]

# 3) classify 规则（与新源 生成总表.py 一致）
def classify_rules(t):
    s = str(t)
    if s in ("49410","49420","49430"): return "majorBase"      # 特殊建筑/主城
    if s[:2] in ("45","46","47","52","53"): return "fieldBoss" # 野外Boss/敌人
    return "minorBase"                                          # 其余建筑设施

def basic_from_name(name):
    if "教堂" in name: return "church"
    if "法师塔" in name: return "mage"
    if "村庄" in name or "村落" in name: return "village"
    if "马车" in name: return "carriage"
    return "other"

# 4) 合并
out = {}
for t, n in names.items():
    o = old.get(str(t), {})
    adv = o.get("adv") or classify_rules(t)
    basic = o.get("basic") or basic_from_name(n)
    icon = o.get("icon") or (adv if adv != "minorBase" else basic_from_name(n))
    out[str(t)] = {"advCategory": adv, "basicClass": basic, "icon": icon, "name": n}

# 5) evergaol 不在此表（按 coord 601-607 判定），但保留提示
(ROOT / "tools" / "type_mapping.json").write_text(
    json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"写入 {len(out)} 条 type 映射；请人工校对 advCategory/icon 列。")
```

- [ ] **Step 2：跑生成脚本**

Run: `cd <repo root> && /Users/lixiang/Documents/AI_code/venv/bin/python tools/gen_type_mapping.py`
Expected: 打印 `写入 N 条 type 映射`，生成 `tools/type_mapping.json`。

- [ ] **Step 3：人工/视觉校对（用户参与）**

打开 `tools/type_mapping.json`，重点抽查：野外Boss 前缀(45/46/47/52/53)是否都 `fieldBoss`、教堂/法师塔/村庄/马车 basicClass 是否正确、icon 是否合理。列出有疑问的条目给用户确认。

- [ ] **Step 4：提交**

```bash
git add tools/gen_type_mapping.py tools/type_mapping.json
git commit -m "feat(etl): type→分类映射表 (初值旧映射+NAME/classify 补全)"
```

---

### Task 1.2：`nightreign_etl.py` 读源层（TDD）

**Files:**
- Create: `tools/nightreign_etl.py`, `tests/conftest.py`, `tests/test_etl.py`

**Interfaces:**
- Produces: `load_source(vendor_dir: str) -> SourceBundle`，其中
  `SourceBundle = namedtuple` 含 `patterns: DataFrame, coords: dict[int,(float,float)], construct: DataFrame, names: dict[int,str]`。

- [ ] **Step 1：写 conftest**

```python
# tests/conftest.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "tools"))
```

- [ ] **Step 2：写失败测试**

```python
# tests/test_etl.py
import pandas as pd
from nightreign_etl import SPECIAL_TO_MAP, NIGHTLORD_TO_KEY, load_source

def test_special_and_nightlord_maps():
    assert SPECIAL_TO_MAP[0] == "Default"
    assert SPECIAL_TO_MAP[4] == "Great Hollow"
    assert SPECIAL_TO_MAP[5] == "Noklateo"
    assert NIGHTLORD_TO_KEY[0] == "Gladius"
    assert NIGHTLORD_TO_KEY[9] == "Straghess"
    assert len(NIGHTLORD_TO_KEY) == 10

def test_load_source_reads_named_columns(tmp_path):
    # 合成最小 CSV（带表头）
    (tmp_path / "MAP_PATTERN.csv").write_text(
        "ID,NightLord,Special,Start_190,Treasure_800,Event_30*0,EventFlag,EvPat_30**,EvPatFlag,RotRew_500,Day1Boss,Day1Loc,Day2Boss,Day2Loc,extra1,extra2\n"
        "0,0,0,705,8005,3030,7724,3600,1150,0,4929,1001,4860,1011,-1,-1\n", encoding="utf-8")
    (tmp_path / "坐标.csv").write_text(
        "ID,Name,areaNo,gridXNo,gridZNo,posX,posZ,picX,picY\n705,,60,1,2,3,4,500.0,600.0\n", encoding="utf-8")
    (tmp_path / "CONSTRUCT.csv").write_text(
        "ID,MAP,type,is_display,,coord_index,,,,,,\n0,0,38100,1,126,705,0,0,0,0,0,0\n", encoding="utf-8")
    (tmp_path / "NAME.csv").write_text("38100,村庄,\n", encoding="utf-8")
    b = load_source(str(tmp_path))
    assert len(b.patterns) == 1
    assert b.coords[705] == (500.0, 600.0)
    assert b.names[38100] == "村庄"
    assert int(b.construct.iloc[0]["MAP"]) == 0
    assert int(b.construct.iloc[0]["coord_index"]) == 705
```

- [ ] **Step 3：跑测试确认失败**

Run: `cd <repo root> && /Users/lixiang/Documents/AI_code/venv/bin/python -m pytest tests/test_etl.py -v`
Expected: FAIL（`ModuleNotFoundError: No module named 'nightreign_etl'`）

- [ ] **Step 4：实现读源层**

```python
# tools/nightreign_etl.py
from collections import namedtuple
import csv
import pandas as pd

SPECIAL_TO_MAP = {0:"Default",1:"Mountaintop",2:"Crater",3:"Rotted Woods",4:"Great Hollow",5:"Noklateo"}
NIGHTLORD_TO_KEY = {0:"Gladius",1:"Adel",2:"Gnoster",3:"Maris",4:"Libra",5:"Fulghor",6:"Caligo",7:"Heolstor",8:"Harmonia",9:"Straghess"}

# 大空洞地下建筑 coord 集合（渲染层偏移，ETL 显示坐标需同步偏移以对齐 background_4）
K = 1536/4775
VOID_UNDERGROUND_COORDS = {1160,1159,1107,1110,1153,1175,1174,1213}
VOID_UNDERGROUND_OFFSET = (862*K, 355*K)  # ≈(277.3, 114.2)

SourceBundle = namedtuple("SourceBundle", ["patterns","coords","construct","names"])

def load_source(vendor_dir):
    patterns = pd.read_csv(f"{vendor_dir}/MAP_PATTERN.csv")
    coord_df = pd.read_csv(f"{vendor_dir}/坐标.csv")
    coords = {int(r.ID): (float(r.picX), float(r.picY)) for r in coord_df.itertuples()}
    construct = pd.read_csv(f"{vendor_dir}/CONSTRUCT.csv")
    names = {}
    with open(f"{vendor_dir}/NAME.csv", encoding="utf-8") as f:
        for row in csv.reader(f):
            if row and row[0].strip():
                names[int(row[0])] = row[1]
    return SourceBundle(patterns, coords, construct, names)
```

- [ ] **Step 5：跑测试确认通过**

Run: `cd <repo root> && /Users/lixiang/Documents/AI_code/venv/bin/python -m pytest tests/test_etl.py -v`
Expected: 2 passed

- [ ] **Step 6：提交**

```bash
git add tools/nightreign_etl.py tests/conftest.py tests/test_etl.py
git commit -m "feat(etl): 读源层 + 地形/夜王映射常量"
```

---

### Task 1.3：坐标处理与分类函数（TDD）

**Files:**
- Modify: `tools/nightreign_etl.py`, `tests/test_etl.py`

**Interfaces:**
- Produces:
  - `apply_void_offset(coord_index, pic_xy) -> (x,y)`：地下 coord 加偏移，其余原样。
  - `to768(pic_xy) -> (x,y)`：`÷2`。
  - `category_of(type_id, coord_index, type_map, names) -> str`：5 类（majorBase/minorBase/fieldBoss/evergaol/rottedWoods）。
  - `basic_class_of(type_id, type_map, names) -> str`：church/mage/village/carriage/other。
  - `EVERGAOL_COORDS = {601..607, 2601..2607}`。

- [ ] **Step 1：写失败测试**

追加到 `tests/test_etl.py`：

```python
from nightreign_etl import (apply_void_offset, to768, category_of, basic_class_of,
                            EVERGAOL_COORDS, VOID_UNDERGROUND_COORDS)

TYPE_MAP = {
    "38100": {"advCategory":"minorBase","basicClass":"village","icon":"village","name":"村庄"},
    "41000": {"advCategory":"minorBase","basicClass":"church","icon":"church","name":"教堂"},
    "4770":  {"advCategory":"fieldBoss","basicClass":"other","icon":"fieldBoss","name":"唤声船"},
}
NAMES = {38100:"村庄", 41000:"教堂", 4770:"唤声船"}

def test_to768_halves():
    assert to768((500.0, 600.0)) == (250.0, 300.0)

def test_void_offset_only_underground():
    base = (400.0, 400.0)
    assert apply_void_offset(999, base) == base  # 非地下不动
    x,y = apply_void_offset(1160, base)          # 地下加偏移
    assert abs(x - (400.0 + 862*1536/4775)) < 1e-6
    assert abs(y - (400.0 + 355*1536/4775)) < 1e-6

def test_category_evergaol_by_coord():
    assert category_of(9999, 601, TYPE_MAP, NAMES) == "evergaol"
    assert category_of(9999, 2607, TYPE_MAP, NAMES) == "evergaol"

def test_category_from_typemap():
    assert category_of(4770, 100, TYPE_MAP, NAMES) == "fieldBoss"
    assert category_of(38100, 100, TYPE_MAP, NAMES) == "minorBase"

def test_basic_class():
    assert basic_class_of(38100, TYPE_MAP, NAMES) == "village"
    assert basic_class_of(41000, TYPE_MAP, NAMES) == "church"
    assert basic_class_of(4770, TYPE_MAP, NAMES) == "other"
```

- [ ] **Step 2：跑确认失败**

Run: `/Users/lixiang/Documents/AI_code/venv/bin/python -m pytest tests/test_etl.py -v`
Expected: FAIL（ImportError）

- [ ] **Step 3：实现**

追加到 `tools/nightreign_etl.py`：

```python
EVERGAOL_COORDS = set(range(601,608)) | set(range(2601,2608))
ROTTED_WOODS_TYPES = set()  # Task 1.1 校对后填入腐败森林独有 boss 的 type 集合

def apply_void_offset(coord_index, pic_xy):
    x, y = pic_xy
    if coord_index in VOID_UNDERGROUND_COORDS:
        dx, dy = VOID_UNDERGROUND_OFFSET
        return (x + dx, y + dy)
    return (x, y)

def to768(pic_xy):
    return (pic_xy[0]/2.0, pic_xy[1]/2.0)

def category_of(type_id, coord_index, type_map, names):
    if coord_index in EVERGAOL_COORDS:
        return "evergaol"
    t = type_map.get(str(type_id))
    if t:
        if str(type_id) in {str(x) for x in ROTTED_WOODS_TYPES}:
            return "rottedWoods"
        return t["advCategory"]
    # 兜底规则
    s = str(type_id)
    if s in ("49410","49420","49430"): return "majorBase"
    if s[:2] in ("45","46","47","52","53"): return "fieldBoss"
    return "minorBase"

def basic_class_of(type_id, type_map, names):
    t = type_map.get(str(type_id))
    if t:
        return t["basicClass"]
    n = names.get(type_id, "")
    if "教堂" in n: return "church"
    if "法师塔" in n: return "mage"
    if "村庄" in n or "村落" in n: return "village"
    if "马车" in n: return "carriage"
    return "other"
```

> 注：`ROTTED_WOODS_TYPES` 在 Task 1.1 校对后由用户确认填入（腐败森林 Special=3 上独有、属 rottedWoods 的 boss type 集合）。在此之前测试不覆盖该分支。

- [ ] **Step 4：跑确认通过**

Run: `/Users/lixiang/Documents/AI_code/venv/bin/python -m pytest tests/test_etl.py -v`
Expected: 7 passed

- [ ] **Step 5：提交**

```bash
git add tools/nightreign_etl.py tests/test_etl.py
git commit -m "feat(etl): 坐标缩放/大空洞偏移/分类函数 (含单测)"
```

---

## Phase 2 — boss-reverse（快速胜、独立）

### Task 2.1：boss-reverse 接入新源 boss_data.json

**Files:**
- Copy: `vendor/.../boss_data.json` → `dataset/boss_data.json`
- Modify: `boss-reverse.html`（内嵌 `DATA` 改 `fetch`）

- [ ] **Step 1：拷贝并比对 schema**

```bash
cp vendor/nightreign-data/boss_data.json dataset/boss_data.json
```

比对两份 boss_data 的键与样本：新源 `nightlords/day1Bosses(18)/day2Bosses(17)/combos(90)` 与旧内嵌 DATA 同形（已确认）。逐字段抽查 `locked`、`candidates`、`combos` 键格式 `"d1_d2"`。

- [ ] **Step 2：改 boss-reverse.html 为 fetch**

找到 `boss-reverse.html:119` 的 `const DATA = {...};` 整行，替换为异步加载：

```html
<script>
let DATA = null;
async function init() {
  const res = await fetch('dataset/boss_data.json');
  DATA = await res.json();
  if (typeof onLoadData === 'function') onLoadData();
}
init();
</script>
```

然后把原先 `DOMContentLoaded` 后直接调用渲染的逻辑包进 `onLoadData()`（或确保渲染在 `DATA` 就绪后执行）。具体：搜索 `boss-reverse.html` 内对 `DATA` 的首次使用处，将其调用移入 `init().then(...)` 或 `onLoadData`。

- [ ] **Step 3：浏览器验证**

Run: `node server.js`，打开 `http://localhost:8000/boss-reverse.html`。
Expected: 无 console 报错；选「咒剑士」直出夜王 8（七仙女）；选「唤声船」给出候选 2/4/6/7。

- [ ] **Step 4：提交**

```bash
git add dataset/boss_data.json boss-reverse.html
git commit -m "feat(boss-reverse): 接入新源 boss_data.json (内嵌DATA改fetch)"
```

---

## Phase 3 — 图片迁移

### Task 3.1：结果图迁移

**Files:**
- Create: `assets/pattern/zh/NNN.jpg`, `assets/pattern/en/NNN.jpg`, `assets/pattern/dlc/<ID>.jpg`

**Interfaces:**
- Consumes: `vendor/nightreign-data/output/map_{ID}.jpg`（ID 0–319 本体，1000–1199 DLC）。

- [ ] **Step 1：清旧图后拷贝**

```bash
rm -rf assets/pattern && mkdir -p assets/pattern/zh assets/pattern/en assets/pattern/dlc
SRC=vendor/nightreign-data/output
for id in $(seq 0 319); do
  nnn=$(printf "%03d" $id)
  [ -f "$SRC/map_${id}.jpg" ] && cp "$SRC/map_${id}.jpg" "assets/pattern/zh/${nnn}.jpg" && cp "$SRC/map_${id}.jpg" "assets/pattern/en/${nnn}.jpg"
done
for id in $(seq 1000 1199); do
  [ -f "$SRC/map_${id}.jpg" ] && cp "$SRC/map_${id}.jpg" "assets/pattern/dlc/${id}.jpg"
done
echo "zh: $(ls assets/pattern/zh | wc -l) en: $(ls assets/pattern/en | wc -l) dlc: $(ls assets/pattern/dlc | wc -l)"
```
Expected: `zh: 320 en: 320 dlc: 200`。

- [ ] **Step 2：用户视觉抽查**

请用户打开 `assets/pattern/zh/000.jpg` 与 `assets/pattern/dlc/1000.jpg`，确认是带中文标注的完整地图。

- [ ] **Step 3：提交**

```bash
git add assets/pattern
git commit -m "feat(assets): 结果图换用新源 map_{ID}.jpg (中文,jpg)"
```

---

### Task 3.2：底图迁移（PNG→JPG）+ `MAP_IMAGES` 后缀

**Files:**
- Create: `assets/map/*.jpg`（高级版）、`assets/images/*-POI.jpg`（基础版）
- Modify: `tools/nightreign_etl.py`（生成 data.js 时 `MAP_IMAGES` 用 `.jpg`）

**Interfaces:**
- Consumes: `vendor/nightreign-data/素材/background_{0..5}.png`。
- Produces: `assets/map/{default,crater,mountaintop,noklateo,rotted_wood,great_hollow}.jpg`、`assets/images/{Default,Mountaintop,Crater,Noklateo,RottedWoods,GreatHollow}-POI.jpg`。

- [ ] **Step 1：转换脚本**

```bash
SRC=vendor/nightreign-data/素材
MAP_JPG=(default:0 crater:2 mountaintop:1 noklateo:5 rotted_wood:3 great_hollow:4)
for pair in "${MAP_JPG[@]}"; do
  name="${pair%%:*}"; idx="${pair##*:}"
  /Users/lixiang/Documents/AI_code/venv/bin/python -c "
from PIL import Image
im=Image.open('$SRC/background_${idx}.png').convert('RGB')
im.save('assets/map/${name}.jpg', quality=92)
"
done
# 基础版底图（同图，命名按 MAP_IMAGES 约定）
declare -A BM=( [Default]=0 [Mountaintop]=1 [Crater]=2 [Noklateo]=5 [RottedWoods]=3 [GreatHollow]=4 )
for n in "${!BM[@]}"; do
  /Users/lixiang/Documents/AI_code/venv/bin/python -c "
from PIL import Image
im=Image.open('$SRC/background_${BM[$n]}.png').convert('RGB')
im.save('assets/images/${n}-POI.jpg', quality=92)
"
done
ls assets/map assets/images/*-POI.jpg
```
Expected: 6 张 assets/map/*.jpg + 6 张 assets/images/*-POI.jpg。

- [ ] **Step 2：验证基础版底图是否纯地形（关键风险项）**

打开旧 `assets/images/Default-POI.png`（git 历史里）与新 `assets/images/Default-POI.jpg` 并排，请用户确认：旧图若是纯地形（无 baked POI 点），则新图可直接用；若旧图含 baked 点，则基础版点由运行时 `drawPOI` 绘制（已确认如此），新纯地形底图正确。

- [ ] **Step 3：删旧底图**

```bash
rm -f assets/map/*.jpg.bak assets/images/*-POI.png 2>/dev/null
# 注意：仅删被替换的 *-POI.png；保留 church/mage-tower 等标记图标（Task 3.3 处理）
```

- [ ] **Step 4：提交（data.js 的 MAP_IMAGES 改 jpg 在 Task 4.3 一并生成）**

```bash
git add assets/map assets/images
git commit -m "feat(assets): 底图由新源 background_* 转 jpg"
```

---

### Task 3.3：图标迁移（按映射重命名）

**Files:**
- Create: `assets/icons/*.png`（按 `type_mapping.json` 的 icon 字段重命名自 `素材/Construct_*.png`，并补 treasure/Start/nightlord 等）

- [ ] **Step 1：写图标迁移函数（并入 nightreign_etl 或独立脚本）**

追加到 `tools/nightreign_etl.py`：

```python
import shutil
from pathlib import Path

ICON_EXTRA_PREFIXES = ("treasure_", "Start_", "nightlord_", "Frenzy_", "RotRew_", "day2_")

def migrate_icons(vendor_dir, out_dir, type_map):
    src = Path(vendor_dir) / "素材"
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    # 1) Construct_{type}.png -> {icon}.png（按映射；同 icon 多 type 只拷一次）
    seen = set()
    for p in src.glob("Construct_*.png"):
        t = p.stem.replace("Construct_", "")
        icon = type_map.get(t, {}).get("icon")
        if not icon:
            continue
        if icon not in seen:
            shutil.copyfile(p, out / f"{icon}.png")
            seen.add(icon)
    # 2) 其余前缀图标原样拷
    for p in src.iterdir():
        if any(p.name.startswith(pre) for pre in ICON_EXTRA_PREFIXES):
            shutil.copyfile(p, out / p.name)
    return len(seen)
```

- [ ] **Step 2：CLI 调用（在 Task 4.3 的 build 脚本里统一调），先单独验证拷贝结果**

```bash
/Users/lixiang/Documents/AI_code/venv/bin/python -c "
import sys; sys.path.insert(0,'tools')
from nightreign_etl import migrate_icons
import json
tm=json.load(open('tools/type_mapping.json'))
n=migrate_icons('vendor/nightreign-data','assets/icons',tm)
print('icon 类数:',n,'文件数:',len(__import__('os').listdir('assets/icons')))
"
```
Expected: 打印 icon 类数与文件数。

- [ ] **Step 3：用户视觉抽查**

请用户确认 `assets/icons/` 下 church/mage/village/fieldBoss 等图标正确。

- [ ] **Step 4：提交**

```bash
git add tools/nightreign_etl.py assets/icons
git commit -m "feat(assets): 图标按 type→icon 映射迁移自新源 素材/"
```

---

## Phase 4 — 基础版（index.html，重点）

### Task 4.1：基础版 POIS_BY_MAP / SPAWN 生成（TDD）

**Files:**
- Modify: `tools/nightreign_etl.py`, `tests/test_etl.py`

**Interfaces:**
- Produces:
  - `build_basic_pois(src, type_map) -> dict[str, list[{id,x,y}]]`（键为 6 地形名；x/y 为 768 空间）。
  - `build_spawn_points(src) -> dict[str, list[{value,x,y,label}]]`、`build_seed_spawn(src) -> dict[int,str]`。
- 候选槽位定义：在该地形任一种子里、`is_display==1`、且 `basic_class_of ∈ {church,mage,village,carriage}` 的位置并集。

- [ ] **Step 1：写失败测试**

追加到 `tests/test_etl.py`：

```python
from nightreign_etl import build_basic_pois, build_seed_spawn
import pandas as pd

def _src_with_one_building(tmp_path):
    (tmp_path/"MAP_PATTERN.csv").write_text(
        "ID,NightLord,Special,Start_190,Treasure_800,Event_30*0,EventFlag,EvPat_30**,EvPatFlag,RotRew_500,Day1Boss,Day1Loc,Day2Boss,Day2Loc,extra1,extra2\n"
        "0,0,0,705,8005,3030,7724,3600,1150,0,4929,1001,4860,1011,-1,-1\n",encoding="utf-8")
    (tmp_path/"坐标.csv").write_text(
        "ID,Name,areaNo,gridXNo,gridZNo,posX,posZ,picX,picY\n705,,60,1,2,3,4,500,600\n100,,60,5,6,7,8,200,300\n",encoding="utf-8")
    (tmp_path/"CONSTRUCT.csv").write_text(
        "ID,MAP,type,is_display,,coord_index,,,,,,\n0,0,38100,1,100,100,0,0,0,0,0,0\n",encoding="utf-8")
    (tmp_path/"NAME.csv").write_text("38100,村庄,\n41000,教堂,\n",encoding="utf-8")
    from nightreign_etl import load_source
    return load_source(str(tmp_path))

def test_build_basic_pois(tmp_path):
    src=_src_with_one_building(tmp_path)
    pois=build_basic_pois(src, {"38100":{"advCategory":"minorBase","basicClass":"village","icon":"village","name":"村庄"}})
    assert "Default" in pois
    slot=pois["Default"][0]
    assert set(slot.keys())>={"id","x","y"}
    assert slot["x"]==100.0 and slot["y"]==150.0  # 200/2,300/2

def test_seed_spawn(tmp_path):
    src=_src_with_one_building(tmp_path)
    ss=build_seed_spawn(src)
    assert ss[0]=="705"
```

- [ ] **Step 2：跑确认失败** — `pytest tests/test_etl.py -v` → ImportError。

- [ ] **Step 3：实现**

追加到 `tools/nightreign_etl.py`：

```python
MATCHABLE = {"church","mage","village","carriage"}

def _seed_map_of(patterns):
    # seed -> (nightlord_key, map_name)
    out={}
    for r in patterns.itertuples():
        out[int(r.ID)] = (NIGHTLORD_TO_KEY[int(r.NightLord)], SPECIAL_TO_MAP[int(r.Special)])
    return out

def build_basic_pois(src, type_map):
    smap=_seed_map_of(src.patterns)
    slots={m:{} for m in SPECIAL_TO_MAP.values()}  # map -> {coord_index: (picx,picy)}
    for r in src.construct.itertuples():
        if int(r.is_display)!=1: continue
        seed=int(r.MAP); ci=int(r.coord_index); t=int(r.type)
        if seed not in smap: continue
        m=smap[seed][1]
        if basic_class_of(t, type_map, src.names) in MATCHABLE:
            if ci in src.coords and ci not in slots[m]:
                slots[m][ci]=apply_void_offset(ci, src.coords[ci])
    out={}
    for m, d in slots.items():
        items=sorted(d.items(), key=lambda kv:(kv[1][1], kv[1][0]))  # 按 y 升序
        out[m]=[{"id":i+1, "x":round(to768(xy)[0],1), "y":round(to768(xy)[1],1)}
                for i,(ci,xy) in enumerate(items)]
    return out

def build_seed_spawn(src):
    return {int(r.ID): str(int(r.Start_190)) for r in src.patterns.itertuples()}

def build_spawn_points(src):
    # Start_190 -> 坐标 picX/picY ÷2，按地形分组
    smap=_seed_map_of(src.patterns)
    bymap={m:{} for m in SPECIAL_TO_MAP.values()}  # map -> {spawn_value:(x,y)}
    for r in src.patterns.itertuples():
        seed=int(r.ID); sv=int(r.Start_190); m=smap[seed][1]
        if sv in src.coords and sv not in bymap[m]:
            x,y=to768(src.coords[sv]); bymap[m][sv]=(x,y)
    out={}
    for m,d in bymap.items():
        items=sorted(d.items(), key=lambda kv:(kv[1][1],kv[1][0]))
        out[m]=[{"value":str(sv),"x":round(x,1),"y":round(y,1),"label":f"出生点{i+1}"}
                for i,(sv,(x,y)) in enumerate(items)]
    return out
```

- [ ] **Step 4：跑确认通过** — `pytest tests/test_etl.py -v` → passed（含新 2 条）。

- [ ] **Step 5：提交**

```bash
git add tools/nightreign_etl.py tests/test_etl.py
git commit -m "feat(etl): 基础版 POIS_BY_MAP/出生点生成 (含单测)"
```

---

### Task 4.2：基础版 classifications + seedDataMatrix（TDD）

**Files:**
- Modify: `tools/nightreign_etl.py`, `tests/test_etl.py`

**Interfaces:**
- Produces:
  - `build_basic_classifications(src, basic_pois, type_map) -> dict[str, dict[str,str]]`（键=seed 补零 3 位字符串；值=`{"POI<id>": "church|mage|village|carriage|other|nothing"}`）。
  - `build_seed_matrix(src) -> list[list]`（列 0=seed,1=nightlord key,2=map name；保持与现有同列数，其余 ""）。

- [ ] **Step 1：写失败测试**

```python
from nightreign_etl import build_basic_classifications, build_seed_matrix, build_basic_pois

def test_classifications(tmp_path):
    src=_src_with_one_building(tmp_path)
    tm={"38100":{"advCategory":"minorBase","basicClass":"village","icon":"village","name":"村庄"}}
    pois=build_basic_pois(src, tm)
    cls=build_basic_classifications(src, pois, tm)
    assert "000" in cls
    # seed 0 在 coord 100 有村庄 -> 对应 POI<id> 应为 village
    assert any(v=="village" for v in cls["000"].values())

def test_seed_matrix_columns(tmp_path):
    src=_src_with_one_building(tmp_path)
    m=build_seed_matrix(src)
    assert m[0][0]==0 and m[0][1]=="Gladius" and m[0][2]=="Default"
```

- [ ] **Step 2：跑确认失败**

- [ ] **Step 3：实现**

追加到 `tools/nightreign_etl.py`：

```python
def _seed_map_of(patterns): ...  # 已在 Task 4.1 定义

def build_basic_classifications(src, basic_pois, type_map):
    # 建 map -> coord_index -> poi_id 反查
    coord_to_poi={}
    smap=_seed_map_of(src.patterns)
    # 先按 pois 的 (x,y)(768) 反推 coord：直接按生成时同序重建 coord->id
    # 为稳健，按每地形重新枚举 MATCHABLE coord 并分配与 pois 相同 id
    slot_ids={m:{} for m in basic_pois}
    for m in basic_pois:
        d={}
        items=[]
        for r in src.construct.itertuples():
            if int(r.is_display)!=1: continue
            seed=int(r.MAP)
            if seed not in smap or smap[seed][1]!=m: continue
            ci=int(r.coord_index); t=int(r.type)
            if basic_class_of(t,type_map,src.names) in MATCHABLE and ci in src.coords:
                if ci not in d:
                    d[ci]=apply_void_offset(ci, src.coords[ci])
        ordered=sorted(d.items(), key=lambda kv:(kv[1][1],kv[1][0]))
        for i,(ci,xy) in enumerate(ordered):
            slot_ids[m][ci]=i+1
    # 每种子每槽
    out={}
    for r in src.patterns.itertuples():
        seed=int(r.ID); m=smap[seed][1]; key=f"{seed:03d}"
        out[key]={}
        # 初始化全部 nothing
        for pid in range(1, len(basic_pois[m])+1):
            out[key][f"POI{pid}"]="nothing"
    for r in src.construct.itertuples():
        seed=int(r.MAP)
        if seed not in smap: continue
        m=smap[seed][1]; ci=int(r.coord_index); t=int(r.type)
        if int(r.is_display)!=1: continue
        if ci in slot_ids.get(m,{}) :
            pid=slot_ids[m][ci]
            out[f"{seed:03d}"][f"POI{pid}"]=basic_class_of(t,type_map,src.names)
    return out

def build_seed_matrix(src):
    out=[]
    for r in src.patterns.itertuples():
        seed=int(r.ID)
        row=[seed, NIGHTLORD_TO_KEY[int(r.NightLord)], SPECIAL_TO_MAP[int(r.Special)]]
        row+=[""]*(49-len(row))  # 占位到现有列数
        out.append(row)
    return out
```

- [ ] **Step 4：跑确认通过**

- [ ] **Step 5：提交**

```bash
git add tools/nightreign_etl.py tests/test_etl.py
git commit -m "feat(etl): 基础版 classifications + seedDataMatrix (含单测)"
```

---

### Task 4.3：组装 data.js + dataset.json + 大空洞消歧 + 浏览器验证

**Files:**
- Create: `tools/build-from-newsource.py`
- Generate: `data.js`, `dataset/dataset.json`

**Interfaces:**
- Consumes: Task 1.x/4.x 全部函数。
- Produces: 完整可用的 `data.js`（含 `MAP_IMAGES` 用 `.jpg`）、`dataset/dataset.json`。

- [ ] **Step 1：确认 script.js 对 seedDataMatrix 列的依赖**

```bash
grep -nE "seedDataMatrix|\[row\[" script.js | head -40
```
确认只读 `row[0]/row[1]/row[2]`（与 SEED_SPAWN）。若读其他列，记录并在 build 里补。

- [ ] **Step 2：写 build-from-newsource.py**

```python
# tools/build-from-newsource.py
import json, sys
sys.path.insert(0, __import__('os').path.dirname(__file__))
from nightreign_etl import (load_source, SPECIAL_TO_MAP, NIGHTLORD_TO_KEY,
    build_basic_pois, build_spawn_points, build_seed_spawn,
    build_basic_classifications, build_seed_matrix, migrate_icons)

VENDOR="vendor/nightreign-data"
src=load_source(VENDOR)
tm=json.load(open("tools/type_mapping.json",encoding="utf-8"))

pois=build_basic_pois(src, tm)
spawns=build_spawn_points(src)
seed_spawn=build_seed_spawn(src)
cls=build_basic_classifications(src, pois, tm)
matrix=build_seed_matrix(src)

# 大空洞消歧（探测碰撞对）
# 略：调用 detect_basic_collisions(cls, pois) -> {seedA_seedB:...}；见 Step 4
from nightreign_etl import detect_basic_collisions
gh_disambig, gh_points = detect_basic_collisions(src, pois, cls, tm)

MAP_IMAGES={m:f"assets/images/{{'Default':'Default','Mountaintop':'Mountaintop','Crater':'Crater','Rotted Woods':'RottedWoods','Noklateo':'Noklateo','Great Hollow':'GreatHollow'}[m]}-POI.jpg" for m in pois}
ICON_ASSETS={"church":"assets/images/church.png","mage":"assets/images/mage-tower.png",
             "village":"assets/images/village.png","empty":"assets/images/empty.png",
             "carriage":"assets/images/carriage.png"}

# 生成 data.js
js=[]
js.append("// 由 tools/build-from-newsource.py 生成，勿手改")
js.append(f"const CANVAS_SIZE=768;")
js.append("const NIGHTLORDS="+json.dumps(list(NIGHTLORD_TO_KEY.values()),ensure_ascii=False)+";")
js.append("const MAPS="+json.dumps(list(SPECIAL_TO_MAP.values()),ensure_ascii=False)+";")
js.append("const POIS_BY_MAP="+json.dumps(pois,ensure_ascii=False)+";")
js.append("const SPAWN_POINTS_BY_MAP="+json.dumps(spawns,ensure_ascii=False)+";")
js.append("const SEED_SPAWN="+json.dumps(seed_spawn,ensure_ascii=False)+";")
js.append("const MAP_IMAGES="+json.dumps(MAP_IMAGES,ensure_ascii=False)+";")
js.append("const ICON_ASSETS="+json.dumps(ICON_ASSETS,ensure_ascii=False)+";")
js.append("const GH_DISAMBIG_POINTS="+json.dumps(gh_points,ensure_ascii=False)+";")
js.append("const GH_DISAMBIG="+json.dumps(gh_disambig,ensure_ascii=False)+";")
js.append("let seedDataMatrix="+json.dumps(matrix,ensure_ascii=False)+";")
open("data.js","w",encoding="utf-8").write("\n".join(js)+"\n")

# 生成 dataset.json
import json as _j
try: old=_j.load(open("dataset/dataset.json",encoding="utf-8"))
except: old={}
old["classifications"]=cls
open("dataset/dataset.json","w",encoding="utf-8").write(_j.dumps(old,ensure_ascii=False))

# 图标迁移
migrate_icons(VENDOR,"assets/icons",tm)

print("data.js / dataset.json / icons 已生成")
print("POIS_BY_MAP 槽位数:",{m:len(p) for m,p in pois.items()})
print("大空洞碰撞对:",len(gh_disambig))
```

- [ ] **Step 3：实现 detect_basic_collisions（大空洞消歧探测）**

追加到 `tools/nightreign_etl.py`：

```python
def detect_basic_collisions(src, basic_pois, cls, type_map):
    # 仅 Great Hollow：找所有槽分类完全相同的种子对/组
    gh="Great Hollow"
    if gh not in basic_pois: return {}, {}
    seeds=[int(k) for k,v in _seed_map_of(src.patterns).items() if v[1]==gh]
    sig={}
    for s in seeds:
        key=",".join(cls.get(f"{s:03d}",{}).get(f"POI{i}","nothing") for i in range(1,len(basic_pois[gh])+1))
        sig.setdefault(key,[]).append(s)
    pairs={}
    for key,group in sig.items():
        if len(group)>=2:
            for s in group: pairs[s]=group  # 简化：记录同组
    # 额外区分点：取这些种子里能区分的 boss/废墟类 construct（other 但 type 不同）
    # 这里产出占位 GH_DISAMBIG_POINTS（A/B 两点）与 GH_DISAMBIG {seed:{bossA,ruinB}}
    # 具体点位由用户视觉确认后定（见 Step 5）
    gh_points={}  # Task 4.3 Step 5 填
    gh_disambig={}
    return gh_disambig, gh_points
```

> 说明：碰撞组的「额外区分点」需结合新源该地形可区分的 boss type 位置人工选定（输出候选给用户）。若新源数据已能自然区分全部种子（pairs 为空），则返回空、消歧不触发。

- [ ] **Step 4：跑 build**

Run: `cd <repo root> && /Users/lixiang/Documents/AI_code/venv/bin/python tools/build-from-newsource.py`
Expected: 打印槽位数（与现有 44–52/地形量级相近）、碰撞对数。

- [ ] **Step 5：用户视觉确认槽位 + 消歧点**

请用户打开 `index.html`（`node server.js`），选 Default 与 Great Hollow：
- 确认橙点位置与底图地形/参照图视觉一致；
- 若大空洞有碰撞组：把候选区分点坐标（picX/picY÷2）标出，请用户选 A/B 两点，回填 `gh_points`，重跑 build。

- [ ] **Step 6：浏览器端到端验证（基础版）**

`http://localhost:8000/`：选 Default + 三狼 → 标记几个 POI → 收敛到正确种子 → 显示 `map_{ID}.jpg`。重复抽查种子 0 / 100。

- [ ] **Step 7：提交**

```bash
git add tools/build-from-newsource.py tools/nightreign_etl.py data.js dataset/dataset.json
git commit -m "feat(基础版): 接入新源数据 (data.js/dataset.json 重生成)"
```

---

## Phase 5 — 高级版（index-advanced.html）

### Task 5.1：确认 app-advanced.js 读取的字段 + 生成 advanced JSON（TDD）

**Files:**
- Modify: `tools/nightreign_etl.py`, `tests/test_etl.py`
- Generate: `dataset/nightreignMapPatterns.json`

**Interfaces:**
- Produces: `build_advanced(src, type_map) -> dict`，schema：
  `{extractedTime, seeds: {"<n>": {seedNumber, nightlord, mapType, spawnPoint{location,coordinate{x,y},enemy}, specialEvent, night1{...}, night2{...}, castle{...}, pois: {"<i>": {location, structure, boss, index, category, coordinates{x,y}, icon}}, rotBlessing, frenzyTower, scaleBearingMerchant}}, poiLookupByMapType: {<map>: [{id,location,category,index,coordinates{x,y}}]}}`。

- [ ] **Step 1：确认 app-advanced.js 实际读取的 seed 字段**

```bash
grep -nE "night1|night2|castle|specialEvent|rotBlessing|frenzyTower|scaleBearingMerchant|\.pois\b|spawnPoint|\.icon|\.boss|\.structure|\.category" app-advanced.js | head -60
```
记录被读取的字段集合 F。未被读取的填 `null`/`""` 即可。

- [ ] **Step 2：写失败测试（schema 形状）**

```python
from nightreign_etl import build_advanced

def test_advanced_schema(tmp_path):
    src=_src_with_one_building(tmp_path)
    tm={"38100":{"advCategory":"minorBase","basicClass":"village","icon":"village","name":"村庄"}}
    d=build_advanced(src, tm, extracted_time="T")
    assert "seeds" in d and "poiLookupByMapType" in d
    s=d["seeds"]["0"]
    for k in ("seedNumber","nightlord","mapType","spawnPoint","pois"):
        assert k in s
    p=list(s["pois"].values())[0]
    for k in ("location","structure","boss","index","category","coordinates","icon"):
        assert k in p
    assert "Default" in d["poiLookupByMapType"]
```

- [ ] **Step 3：跑确认失败**

- [ ] **Step 4：实现 build_advanced**

追加到 `tools/nightreign_etl.py`：

```python
def build_advanced(src, type_map, extracted_time=""):
    smap=_seed_map_of(src.patterns)
    # 先建每地形的共享候选池（coord -> {id,index,category,coord_xy,location}）
    pools={m:{} for m in SPECIAL_TO_MAP.values()}
    for r in src.construct.itertuples():
        if int(r.is_display)!=1: continue
        seed=int(r.MAP)
        if seed not in smap: continue
        m=smap[seed][1]; ci=int(r.coord_index); t=int(r.type)
        if ci in src.coords and ci not in pools[m]:
            xy=apply_void_offset(ci, src.coords[ci])
            pools[m][ci]={"category":category_of(t,ci,type_map,src.names),
                          "xy":xy,"location":src.names.get(t,"")}
    poiLookup={}
    for m,d in pools.items():
        ordered=sorted(d.items(), key=lambda kv:(kv[1]["xy"][1],kv[1]["xy"][0]))
        poiLookup[m]=[{"id":str(i),"location":d[ci]["location"],"category":d[ci]["category"],
                       "index":i,"coordinates":{"x":round(d[ci]["xy"][0],1),"y":round(d[ci]["xy"][1],1)}}
                      for i,(ci,_) in enumerate(ordered)]
    # 每种子 pois
    seeds={}
    for r in src.patterns.itertuples():
        seed=int(r.ID); nl=NIGHTLORD_TO_KEY[int(r.NightLord)]; m=SPECIAL_TO_MAP[int(r.Special)]
        sv=int(r.Start_190)
        sp={"location":"","coordinate":{"x":round(src.coords[sv][0],1) if sv in src.coords else 0,
                                        "y":round(src.coords[sv][1],1) if sv in src.coords else 0},"enemy":None}
        pois={}
        idx=0
        for cr in src.construct.itertuples():
            if int(cr.MAP)!=seed or int(cr.is_display)!=1: continue
            ci=int(cr.coord_index); t=int(cr.type)
            if ci not in src.coords: continue
            xy=apply_void_offset(ci,src.coords[ci])
            nm=src.names.get(t,"")
            cat=category_of(t,ci,type_map,src.names)
            tm=type_map.get(str(t),{})
            pois[str(idx)]={"location":nm,"structure":nm if cat in("majorBase","minorBase") else "",
                            "boss":nm if cat in("fieldBoss","evergaol","rottedWoods") else "",
                            "index":idx,"category":cat,
                            "coordinates":{"x":round(xy[0],1),"y":round(xy[1],1)},
                            "icon":tm.get("icon",cat)}
            idx+=1
        seeds[str(seed)]={"seedNumber":seed,"nightlord":nl,"mapType":m,"spawnPoint":sp,
                           "specialEvent":None,"night1":None,"night2":None,"castle":None,
                           "pois":pois,"rotBlessing":None,"frenzyTower":None,"scaleBearingMerchant":None}
    return {"extractedTime":extracted_time,"seeds":seeds,"poiLookupByMapType":poiLookup}
```

> 若 Step 1 发现 app 读取 night1/night2/castle 等，则在此用 `MAP_PATTERN` 的 Day1Boss/Day2Boss/extra + NAME 与 construct 的 castle 类（49410/49420/49430）补全这些字段；否则保持 null。

- [ ] **Step 5：跑 build 写盘 + 单测通过**

在 `build-from-newsource.py` 末尾追加：

```python
from nightreign_etl import build_advanced
adv=build_advanced(src, tm, extracted_time="generated-by-newsource-etl")
json.dump(adv, open("dataset/nightreignMapPatterns.json","w",encoding="utf-8"), ensure_ascii=False)
```

Run: `/Users/lixiang/Documents/AI_code/venv/bin/python tools/build-from-newsource.py && /Users/lixiang/Documents/AI_code/venv/bin/python -m pytest tests/test_etl.py -v`
Expected: 单测 passed；生成 JSON。

- [ ] **Step 6：用户视觉 + 浏览器端到端验证（高级版）**

`http://localhost:8000/index-advanced.html`：四屏流程跑通（选择→出生→识别→结果）。抽查种子 0 / 1000。
请用户确认：POI 橙点与底图对齐；二级菜单 icon/boss 正确；唯一种子时画结果图。

- [ ] **Step 7：提交**

```bash
git add tools/nightreign_etl.py tools/build-from-newsource.py tests/test_etl.py dataset/nightreignMapPatterns.json
git commit -m "feat(高级版): 接入新源数据 (nightreignMapPatterns.json 重生成)"
```

---

## Phase 6 — 清理与回归

### Task 6.1：清理旧资产

**Files:**
- Remove: `convert-csv-to-json.py`、`dataset/nightreignMapPatterns.csv`、`extraction.html`、旧 `dataset/full_export/`、`dataset/dataset.json` 旧非 classifications 内容（若重建则保留 classifications）。

- [ ] **Step 1：归档/删除**

```bash
mkdir -p legacy
git mv convert-csv-to-json.py legacy/ 2>/dev/null || rm -f convert-csv-to-json.py
git mv extraction.html legacy/ 2>/dev/null || rm -f extraction.html
rm -f dataset/nightreignMapPatterns.csv
rm -rf dataset/full_export
# type_category_icon.json 已迁入 tools/ 参考；如未迁，保留原位
```

> `publish.sh` 保留（部署用，且其会删 extraction.html——删除后该步无副作用）。

- [ ] **Step 2：更新 CLAUDE.md（数据流说明）**

把 CLAUDE.md 中「CSV 是单一数据源 / convert-csv-to-json.py」段落改为：数据源=新源 `vendor/nightreign-data/`，由 `tools/build-from-newsource.py` 生成。

- [ ] **Step 3：提交**

```bash
git add -A
git commit -m "chore: 清理旧数据管线，更新数据源说明"
```

---

### Task 6.2：全量回归（三版本 × 抽样种子）

- [ ] **Step 1：三版本手工回归**

Run: `node server.js`，对 `index.html` / `index-advanced.html` / `boss-reverse.html` 各跑种子 **0 / 100 / 1000 / 1120**：
- 基础版：消除法收敛 + 结果图正确。
- 高级版：四屏流程 + 结果图正确。
- boss-reverse：第一夜 Boss 反推正确。

- [ ] **Step 2：用户最终视觉确认**

请用户过一遍三版本，确认无回归。

- [ ] **Step 3：跑全量 ETL 单测**

Run: `/Users/lixiang/Documents/AI_code/venv/bin/python -m pytest tests/ -v`
Expected: all passed。

- [ ] **Step 4：提交（若 Step 2 有修正）**

```bash
git add -A
git commit -m "test: 全量回归通过 (三版本 × 种子 0/100/1000/1120)"
```

---

## Self-Review 笔记（写计划后核对 spec）

- **Spec §2 映射** → Task 1.2（SPECIAL_TO_MAP / NIGHTLORD_TO_KEY 已核对）✅
- **Spec §4 基础版** → Task 4.1/4.2/4.3 ✅（含 GH 消歧 §4.4）
- **Spec §5 高级版** → Task 5.1（type→5 类映射、icon、坐标）✅
- **Spec §6 boss-reverse** → Task 2.1 ✅
- **Spec §7 图片** → Task 3.1/3.2/3.3 ✅
- **Spec §8 清理** → Task 6.1 ✅
- **Spec §9 验证** → Task 4.3/5.1/6.2 + 各视觉确认 ✅
- **Spec §11 风险**：type 映射(Task 1.1 校对)、槽位数(Task 4.3 抽查)、底图 baked 点(Task 3.2 已确认运行时绘制)、boss_data schema(Task 2.1 同形)、消歧(Task 4.3 重扫)、seedDataMatrix 列(Task 4.3 grep 确认)、Void 偏移(Task 1.3 apply_void_offset) ✅
