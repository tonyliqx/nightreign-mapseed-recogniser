# 基础版出生点指认 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为基础版（`index.html` + `script.js` + `data.js`）增加出生点指认：用户在标记地标前先在 canvas 选出生点（蓝色三角），系统按 Start_190 精确筛选种子，覆盖全部 6 种地图 12 个出生点。

**Architecture:** dev 时用 Pillow+numpy 从 `素材/Start_*.png` 标定出生点箭头坐标 → `spawn_calib.json`；`integrate_dlc.py`（纯标准库）读该 JSON + 源 `Start_190`，生成 `SEED_SPAWN`（种子→值）与 `SPAWN_POINTS_BY_MAP`（地图→候选点）JS 片段，写到 `datajs_snippet.txt`；人工追加到 `data.js`。`script.js` 加两阶段交互（spawn 先选，锁地标；选定或跳过后进地标阶段）+ spawn 筛选条件。

**Tech Stack:** Python 3 标准库（生产脚本 `integrate_dlc.py`：csv/json/unittest/typing/re/os/pathlib）；Pillow+numpy（仅 dev 标定脚本 `calibrate_spawn.py`，非生产路径）；原生 JS Canvas（无框架）；i18n 双语字典。

## Global Constraints

- **简体中文**：所有代码注释、commit 消息、README 均用简体中文。
- **提交规范**：每条 commit 消息以 `Co-Authored-By: Claude <noreply@anthropic.com>` 结尾；本地提交，**不远程推送**（除非用户明确要求）。
- **生产脚本纯标准库**：`integrate_dlc.py` 仅用 csv/json/unittest/typing/re/os/pathlib/importlib，**无第三方依赖**。`calibrate_spawn.py` 是 dev 时一次性工具，可用 Pillow/numpy，不进生产路径。
- **不触碰 0-319**：不修改 `data.js` 的 `seedDataMatrix` 或 `POIS_BY_MAP` 任何现有行；出生点数据以**新增 const**（`SEED_SPAWN` / `SPAWN_POINTS_BY_MAP`）追加到 `data.js` 末尾。
- **CSV 是高级版真源**：本计划不改高级版 CSV/JSON/JS，不动 `dataset.json` 现有 320 键。
- **仅基础版**：不改 `app-advanced.js` / `index-advanced.html` / `poi-data-advanced.js`；高级版已有独立 spawn 屏幕。
- **`extraction.html` 不发布**（`publish.sh` 显式删除）；本计划不碰它。
- **坐标空间**：出生点坐标在 **768 空间**（基础版 canvas），与 `POIS_BY_MAP` 一致；源 PNG 箭头在 4775 空间，经现有 `transform_coord_basic`（基础地图）/ `transform_coord_great_hollow`（GH，coord_id 传 `""`，无 underground offset）转换。
- **测试**：Python 部分用 `unittest`（`tests/test_integrate_dlc.py` 追加）；UI 部分手动浏览器验证（项目无构建/无 linter/无测试套件，开 `node server.js` 在浏览器验证）。
- **数据流锚点**：`integrate_dlc.py` 不直接改 `data.js`，片段写到 `dataset/dlc-params/datajs_snippet.txt` 供人工应用（避免脚本误改 17k 行 JS）——本计划沿用此机制。

---

## File Structure

| 文件 | 责任 | 本计划改动 |
|------|------|-----------|
| `calibrate_spawn.py`（新建，项目根） | dev 时一次性标定：Pillow+numpy 扫 `Start_*.png` 箭头质心 → 768 空间 → 写 `spawn_calib.json` | Task 1 创建 |
| `dataset/dlc-params/spawn_calib.json`（新建） | 出生点坐标表 `{value: [x768, y768]}`，12 个 | Task 1 产出 |
| `integrate_dlc.py` | DLC/spawn 数据生成器（纯标准库） | Task 1 加 `load_spawn_calib()`；Task 2 加 `build_basic_spawn_snippets()` + 扩展 `_write_datajs_snippet_file()` + `main()` 调用 |
| `tests/test_integrate_dlc.py` | Python 单测 | Task 1 加 `TestSpawnCalib`；Task 2 加 `TestSpawnSnippets` |
| `dataset/dlc-params/datajs_snippet.txt` | 人工应用片段 | Task 2 重跑 `integrate_dlc.py` 后含 spawn 片段 |
| `data.js` | 基础版数据（POIS_BY_MAP / seedDataMatrix） | Task 3 末尾追加 `SEED_SPAWN` + `SPAWN_POINTS_BY_MAP` 两个 const |
| `script.js` | 基础版 `NightreignMapRecogniser` 类 | Task 4 加 spawn 状态 + 筛选；Task 5 加渲染 + 两阶段点击 |
| `index.html` | 基础版入口 | Task 6 加"跳过出生点"按钮 + spawn 阶段提示 |
| `i18n/translations.js` | 基础版 zh/en 翻译 | Task 6 加 spawn 相关文案 |
| `.superpowers/sdd/progress.md` | SDD 进度账本 | Task 7 更新 |

**不改动**：`app-advanced.js`、`index-advanced.html`、`poi-data-advanced.js`、`translations-advanced.js`、`extraction.html`、`dataset.json`、`nightreignMapPatterns.{csv,json}`、`data.js` 现有 `seedDataMatrix`/`POIS_BY_MAP` 行。

---

### Task 1: 标定出生点坐标 → spawn_calib.json + load_spawn_calib()

**Files:**
- Create: `calibrate_spawn.py`（项目根，dev 工具）
- Create: `dataset/dlc-params/spawn_calib.json`（标定产物）
- Modify: `integrate_dlc.py`（加 `load_spawn_calib()`，在 `load_great_hollow_calib` 附近）
- Test: `tests/test_integrate_dlc.py`（加 `TestSpawnCalib`）

**Interfaces:**
- Consumes: `integrate_dlc.py` 的 `transform_coord_basic(px, py, target)`、`transform_coord_great_hollow(px, py, coord_id, calib, target)`、`load_great_hollow_calib()`、`SRC_DEFAULT`、`PARAMS_DIR`
- Produces: `load_spawn_calib() -> Dict[str, List[float]]`（`{出生点值: [x768, y768]}`，12 键）；`spawn_calib.json` 文件

**背景**：源目录 `素材/Start_*.png`（700-708 + 13000-13002，共 12 个）是 4775×4775 透明 PNG，蓝色箭头（`alpha_composite` 产物）标记出生点。非透明像素质心 = 4775 空间坐标。

- [ ] **Step 1: 写标定脚本 `calibrate_spawn.py`**

```python
"""一次性标定：从源目录 Start_*.png 提取出生点箭头坐标，转 768 空间，
写 dataset/dlc-params/spawn_calib.json。

dev 时工具（用 numpy + Pillow，非生产路径）。生产端 integrate_dlc.py 用
标准库 json.load 读取产物，无第三方依赖。

每张 PNG 是 4775×4775 透明底，蓝色箭头标记出生点。取非透明像素质心 = 4775 空间坐标，
经 transform_coord_basic（基础地图 700-708）/ transform_coord_great_hollow（GH 13000-13002，
coord_id 传空串，无 underground offset）转到 768 空间。

运行：python calibrate_spawn.py
"""
import os, sys, json
import numpy as np
from PIL import Image

PROJ = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, PROJ)
from integrate_dlc import (transform_coord_basic, transform_coord_great_hollow,
                           load_great_hollow_calib, SRC_DEFAULT)

SRC = os.path.join(SRC_DEFAULT, "素材")
OUT = os.path.join(PROJ, "dataset", "dlc-params", "spawn_calib.json")

BASIC_VALUES = [str(v) for v in range(700, 709)]   # 700-708，基础地图
GH_VALUES = ["13000", "13001", "13002"]            # 大空洞


def centroid_4775(png_path: str):
    """非透明像素质心 (px, py)，4775 空间。numpy 向量化加速（纯 Python 循环 22M 像素太慢）。"""
    arr = np.array(Image.open(png_path).convert("RGBA"))
    alpha = arr[:, :, 3]
    ys, xs = np.where(alpha > 0)
    if len(xs) == 0:
        raise ValueError(f"{png_path} 无非透明像素")
    return float(xs.mean()), float(ys.mean())


def main():
    calib = load_great_hollow_calib()
    out = {}
    for v in BASIC_VALUES:
        px, py = centroid_4775(os.path.join(SRC, f"Start_{v}.png"))
        bx, by = transform_coord_basic(px, py, 768)
        out[v] = [round(bx, 1), round(by, 1)]
    for v in GH_VALUES:
        px, py = centroid_4775(os.path.join(SRC, f"Start_{v}.png"))
        gx, gy = transform_coord_great_hollow(px, py, "", calib, 768)
        out[v] = [round(gx, 1), round(gy, 1)]
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"✅ 标定写出 {OUT}（{len(out)} 个出生点）")
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 运行标定脚本，产出 spawn_calib.json**

Run: `python3 calibrate_spawn.py`
Expected: 打印 12 个出生点的 `{value: [x, y]}`，并写出 `dataset/dlc-params/spawn_calib.json`。记下打印的 3 个 GH 坐标（13000/13001/13002），供 Step 7 核对。

- [ ] **Step 3: 写失败测试 `TestSpawnCalib`**

在 `tests/test_integrate_dlc.py` 末尾（`if __name__ == "__main__"` 之前）追加：

```python
from integrate_dlc import load_spawn_calib

class TestSpawnCalib(unittest.TestCase):
    def test_has_12_spawn_points(self):
        calib = load_spawn_calib()
        self.assertEqual(len(calib), 12)

    def test_values_are_expected_set(self):
        calib = load_spawn_calib()
        expected = {str(v) for v in range(700, 709)} | {"13000", "13001", "13002"}
        self.assertEqual(set(calib.keys()), expected)

    def test_coords_in_768_canvas(self):
        calib = load_spawn_calib()
        for v, (x, y) in calib.items():
            self.assertTrue(0 <= x <= 768, f"{v} x={x} 越界")
            self.assertTrue(0 <= y <= 768, f"{v} y={y} 越界")
```

- [ ] **Step 4: 运行测试，确认失败**

Run: `python3 -m unittest tests.test_integrate_dlc.TestSpawnCalib -v`
Expected: FAIL，`ImportError: cannot import name 'load_spawn_calib'`（函数尚未定义）。

- [ ] **Step 5: 实现 `load_spawn_calib()`**

在 `integrate_dlc.py` 的 `load_great_hollow_calib` 函数之后追加：

```python
def load_spawn_calib() -> Dict[str, List[float]]:
    """加载 dataset/dlc-params/spawn_calib.json：{出生点值: [x768, y768]}（12 键）。

    由 dev 时 calibrate_spawn.py（Pillow+numpy）从源素材 Start_*.png 标定产出；
    生产端纯 json.load，无第三方依赖。与 load_great_hollow_calib 同模式。"""
    path = os.path.join(PARAMS_DIR, "spawn_calib.json")
    with open(path, encoding="utf-8") as f:
        return json.load(f)
```

- [ ] **Step 6: 运行测试，确认通过**

Run: `python3 -m unittest tests.test_integrate_dlc.TestSpawnCalib -v`
Expected: PASS（3 个测试）。

- [ ] **Step 7: MCP 视觉核对 GH 出生点坐标**

用图像分析工具核对 `assets/pattern/dlc/1005.jpg`（或任一 GH 种子图）上的蓝色箭头位置是否与 Step 2 打印的 GH 坐标（转成图片百分比：`x/768*100%`、`y/768*100%`）一致。若偏差明显（>10%），回到 Step 1 检查 `centroid_4775`（箭头 PNG 是否含其他非透明元素干扰质心），必要时改用 `Image.getbbox()` 中心。

- [ ] **Step 8: 提交**

```bash
git add calibrate_spawn.py dataset/dlc-params/spawn_calib.json integrate_dlc.py tests/test_integrate_dlc.py
git commit -m "$(cat <<'EOF'
feat: 标定基础版出生点坐标 (spawn_calib.json)

从源素材 Start_*.png（4775 箭头质心）标定 12 个出生点坐标到 768 空间，
落 dataset/dlc-params/spawn_calib.json；integrate_dlc 加 load_spawn_calib()。
calibrate_spawn.py 为 dev 工具（Pillow+numpy），生产端纯 json.load。

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: 生成 SEED_SPAWN / SPAWN_POINTS_BY_MAP 片段

**Files:**
- Modify: `integrate_dlc.py`（加 `build_basic_spawn_snippets()` + `_circled()` 辅助；扩展 `_write_datajs_snippet_file()`；`main()` 调用）
- Test: `tests/test_integrate_dlc.py`（加 `TestSpawnSnippets`）

**Interfaces:**
- Consumes: Task 1 的 `load_spawn_calib()`；`read_source_data()` 的 `source["patterns"][sid]["start"]`（已读 Start_190）；`SPECIAL_TO_MAP`（special→mapType 映射）
- Produces: `build_basic_spawn_snippets(source) -> Dict[str, str]`，返回 `{"seed_spawn": <JS>, "spawn_points_by_map": <JS>, "spawn_seed_count": int}`；`datajs_snippet.txt` 含这两段

- [ ] **Step 1: 写失败测试 `TestSpawnSnippets`**

在 `tests/test_integrate_dlc.py` 末尾追加：

```python
from integrate_dlc import build_basic_spawn_snippets, SPECIAL_TO_MAP
import re as _re

class TestSpawnSnippets(unittest.TestCase):
    def setUp(self):
        self.source = read_source_data()

    def test_seed_spawn_covers_520_seeds(self):
        snip = build_basic_spawn_snippets(self.source)
        self.assertEqual(snip["spawn_seed_count"], 520)

    def test_seed_spawn_values_valid(self):
        snip = build_basic_spawn_snippets(self.source)
        valid = {str(v) for v in range(700, 709)} | {"13000", "13001", "13002"}
        for m in _re.finditer(r'\d+: "([^"]+)"', snip["seed_spawn"]):
            self.assertIn(m.group(1), valid, f"非法出生点值 {m.group(1)}")

    def test_great_hollow_has_3_spawn_points(self):
        snip = build_basic_spawn_snippets(self.source)
        gh_section = snip["spawn_points_by_map"].split('"Great Hollow"')[1].split("]")[0]
        self.assertEqual(gh_section.count("label:"), 3)

    def test_spawn_points_coords_in_canvas(self):
        snip = build_basic_spawn_snippets(self.source)
        for m in _re.finditer(r'x: ([\d.]+), y: ([\d.]+)', snip["spawn_points_by_map"]):
            x, y = float(m.group(1)), float(m.group(2))
            self.assertTrue(0 <= x <= 768 and 0 <= y <= 768, f"({x},{y}) 越界")

    def test_spawn_points_subset_per_map(self):
        """每地图的出生点必须是该地图种子实际出现的 Start_190 子集（无死标记）。"""
        snip = build_basic_spawn_snippets(self.source)
        actual = {}
        for sid, pat in self.source["patterns"].items():
            mt = SPECIAL_TO_MAP.get(pat["special"], "Default")
            s = pat.get("start", "").strip()
            if s:
                actual.setdefault(mt, set()).add(s)
        for mt, vals in actual.items():
            if f'"{mt}"' not in snip["spawn_points_by_map"]:
                continue
            section = snip["spawn_points_by_map"].split(f'"{mt}"')[1].split("]")[0]
            in_snippet = set(_re.findall(r'value: "([^"]+)"', section))
            self.assertTrue(in_snippet <= vals, f"{mt} 含死标记 {in_snippet - vals}")
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `python3 -m unittest tests.test_integrate_dlc.TestSpawnSnippets -v`
Expected: FAIL，`ImportError: cannot import name 'build_basic_spawn_snippets'`。

- [ ] **Step 3: 实现 `_circled()` 与 `build_basic_spawn_snippets()`**

在 `integrate_dlc.py` 的 `build_basic_datajs_snippets` 函数之后追加：

```python
def _circled(n: int) -> str:
    """1→①, 2→②, …（U+2460 起，覆盖 1-20）；超出范围回退普通数字。"""
    return chr(0x2460 + n - 1) if 1 <= n <= 20 else str(n)


def build_basic_spawn_snippets(source: Dict) -> Dict[str, Any]:
    """生成基础版 data.js 的出生点片段：
    - seed_spawn: `const SEED_SPAWN = {seedNum: "value", ...}`（全 520 种子）
    - spawn_points_by_map: `const SPAWN_POINTS_BY_MAP = {map: [{value,x,y,label}, ...]}`

    坐标来自 load_spawn_calib()（dev 标定产物，{value: [x768,y768]}）。
    每地图出生点子集由该地图种子的 Start_190（source["patterns"][sid]["start"]）去重得出，
    避免 canvas 上出现永远不会命中的死标记。label 用"出生点①/②/③"序号（GH 无地名，统一序号）。"""
    calib = load_spawn_calib()

    # 1. SEED_SPAWN：全种子 → 出生点值
    seed_spawn = {}
    for sid, pat in source["patterns"].items():
        start = pat.get("start", "").strip()
        if start:
            seed_spawn[int(sid)] = start
    seed_spawn_js = "const SEED_SPAWN = {\n" + ",\n".join(
        f'  {sid}: "{v}"' for sid, v in sorted(seed_spawn.items())
    ) + "\n};"

    # 2. SPAWN_POINTS_BY_MAP：每地图出生点子集（按 SPECIAL_TO_MAP 固定顺序）
    map_spawns = {}  # {maptype: set(values)}
    for sid, pat in source["patterns"].items():
        mt = SPECIAL_TO_MAP.get(pat["special"], "Default")
        start = pat.get("start", "").strip()
        if start:
            map_spawns.setdefault(mt, set()).add(start)
    spm_lines = []
    for mt in SPECIAL_TO_MAP.values():
        vals = sorted(map_spawns.get(mt, set()), key=lambda v: int(v))
        if not vals:
            continue
        entries = []
        for i, v in enumerate(vals, 1):
            x, y = calib[v]
            entries.append(f'    {{ value: "{v}", x: {x}, y: {y}, label: "出生点{_circled(i)}" }}')
        spm_lines.append(f'  "{mt}": [\n' + ",\n".join(entries) + "\n  ]")
    spm_js = "const SPAWN_POINTS_BY_MAP = {\n" + ",\n".join(spm_lines) + "\n};"

    return {"seed_spawn": seed_spawn_js,
            "spawn_points_by_map": spm_js,
            "spawn_seed_count": len(seed_spawn)}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `python3 -m unittest tests.test_integrate_dlc.TestSpawnSnippets -v`
Expected: PASS（5 个测试）。

- [ ] **Step 5: 扩展 `_write_datajs_snippet_file()` 写出 spawn 片段**

定位 `integrate_dlc.py` 的 `_write_datajs_snippet_file` 函数（约 553 行），将其整体替换为：

```python
def _write_datajs_snippet_file(snip):
    """把 data.js 片段写到文本文件，供 Task 3.1 人工应用（避免脚本误改 17k 行 JS）。

    含三组片段：POIS_BY_MAP["Great Hollow"]、seedDataMatrix mapType 纠正、
    基础版出生点（SEED_SPAWN + SPAWN_POINTS_BY_MAP，后者由 build_basic_spawn_snippets 注入）。"""
    txt = (f'// === POIS_BY_MAP["Great Hollow"] 替换 [] 存根 ===\n{snip["pois_by_map_gh"]}\n\n'
           f'// === seedDataMatrix mapType 纠正（{len(snip["seed_matrix_fixes"])} 条）===\n'
           + "\n".join(f'{sid}: "{mt}"' for sid, mt in snip["seed_matrix_fixes"].items()))
    if "seed_spawn" in snip:
        txt += (f'\n\n// === 基础版出生点：SEED_SPAWN（{snip.get("spawn_seed_count", 0)} 种子）'
                f' ===\n{snip["seed_spawn"]}\n\n'
                f'// === 基础版出生点：SPAWN_POINTS_BY_MAP ===\n{snip["spawn_points_by_map"]}\n')
    with open(os.path.join(PARAMS_DIR, "datajs_snippet.txt"), "w", encoding="utf-8") as f:
        f.write(txt)
```

- [ ] **Step 6: 在 `main()` 注入 spawn 片段**

定位 `integrate_dlc.py` 的 `main()` 函数中这两行（约 526-528 行）：

```python
    snip = build_basic_datajs_snippets(source, calib, gh_768)
    _write_datajs_snippet_file(snip)
```

替换为：

```python
    snip = build_basic_datajs_snippets(source, calib, gh_768)
    snip.update(build_basic_spawn_snippets(source))  # 注入 SEED_SPAWN / SPAWN_POINTS_BY_MAP
    _write_datajs_snippet_file(snip)
    print("✅ data.js 片段写出（含基础版出生点，见 dataset/dlc-params/datajs_snippet.txt，人工应用）")
```

- [ ] **Step 7: 重跑 main()，确认片段写出**

Run: `python3 integrate_dlc.py`
Expected: 控制台打印"data.js 片段写出（含基础版出生点…）"；`dataset/dlc-params/datajs_snippet.txt` 末尾出现 `SEED_SPAWN` 与 `SPAWN_POINTS_BY_MAP` 两段。

- [ ] **Step 8: 跑全量单测，确认无回归**

Run: `python3 -m unittest tests.test_integrate_dlc -v`
Expected: 全部 PASS（原有测试 + Task 1 的 3 个 + 本任务 5 个）。

- [ ] **Step 9: 提交**

```bash
git add integrate_dlc.py tests/test_integrate_dlc.py dataset/dlc-params/datajs_snippet.txt
git commit -m "$(cat <<'EOF'
feat: 生成基础版 SEED_SPAWN / SPAWN_POINTS_BY_MAP 片段

build_basic_spawn_snippets 从 Start_190 + spawn_calib 生成全 520 种子出生点值
与每地图出生点候选点 JS 片段，写进 datajs_snippet.txt 供人工应用。每地图子集
按实际出现去重，避免死标记；label 用序号①②③。

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: 应用 spawn 片段到 data.js

**Files:**
- Modify: `data.js`（末尾追加 `SEED_SPAWN` + `SPAWN_POINTS_BY_MAP` 两个 const）
- Read: `dataset/dlc-params/datajs_snippet.txt`（Task 2 产出）

**Interfaces:**
- Consumes: `datajs_snippet.txt` 的 `SEED_SPAWN` 与 `SPAWN_POINTS_BY_MAP` 两段
- Produces: `data.js` 全局 `SEED_SPAWN`（`{seedNum: "value"}`）、`SPAWN_POINTS_BY_MAP`（`{map: [{value,x,y,label}]}`）

**背景**：`data.js` 含不可见字符（历史教训：Edit 工具在此文件易失败），用 Python 正则追加更可靠。追加位置：文件末尾（`loadSeedData` 函数之后）。**不修改任何现有行**。

- [ ] **Step 1: 从 datajs_snippet.txt 提取 spawn 片段，追加到 data.js 末尾**

Run（一次性 Python，读片段、定位 data.js 末尾、追加）：

```bash
python3 - <<'PYEOF'
import re, pathlib
proj = pathlib.Path(__file__).resolve().parent if '__file__' in dir() else pathlib.Path.cwd()
# 直接用绝对路径（CWD 为项目根）
snip = pathlib.Path("dataset/dlc-params/datajs_snippet.txt").read_text(encoding="utf-8")
# 提取 SEED_SPAWN 与 SPAWN_POINTS_BY_MAP 两段（从注释标记到下一个 === 或文末）
m1 = re.search(r'(const SEED_SPAWN = \{.*?\};)', snip, re.S)
m2 = re.search(r'(const SPAWN_POINTS_BY_MAP = \{.*?\};)', snip, re.S)
assert m1 and m2, "片段未找到，先跑 integrate_dlc.py"
datajs = pathlib.Path("data.js").read_text(encoding="utf-8")
assert "const SEED_SPAWN" not in datajs, "data.js 已含 SEED_SPAWN，勿重复追加"
addition = "\n\n// === 基础版出生点指认（由 integrate_dlc.py 生成，勿手改；改 Start_190/坐标后重跑）===\n"
addition += m1.group(1) + "\n\n" + m2.group(1) + "\n"
pathlib.Path("data.js").write_text(datajs + addition, encoding="utf-8")
print("✅ data.js 追加 SEED_SPAWN + SPAWN_POINTS_BY_MAP")
PYEOF
```

Expected: 打印"✅ data.js 追加…"。若报"已含 SEED_SPAWN"，说明已追加过，跳过。

- [ ] **Step 2: 语法校验（node 加载 data.js）**

Run: `node -e "global.POIS_BY_MAP=global.SEED_SPAWN=global.SPAWN_POINTS_BY_MAP=null; require('./data.js'); console.log('SEED_SPAWN keys:', Object.keys(SEED_SPAWN).length); console.log('SPAWN_POINTS_BY_MAP maps:', Object.keys(SPAWN_POINTS_BY_MAP));"`
Expected: 打印 `SEED_SPAWN keys: 520` 与 `SPAWN_POINTS_BY_MAP maps: ['Default','Mountaintop','Crater','Rotted Woods','Noklateo','Great Hollow']`（出现的地图子集），无语法错误。

**注意**：`data.js` 顶层是 `const`/`let` 声明，node `require` 包装成模块作用域，全局赋值无法直接读到。若上面的 `node -e` 读不到，改用浏览器验证（Step 3）。

- [ ] **Step 3: 浏览器验证**

Run: `node server.js`，浏览器开 `http://localhost:8000`，DevTools Console：
```javascript
console.log('SEED_SPAWN[1005]:', SEED_SPAWN[1005]);           // 应为 "13000"/"13001"/"13002" 之一
console.log('GH spawns:', SPAWN_POINTS_BY_MAP['Great Hollow']); // 应为 3 个 {value,x,y,label}
```
Expected: 1005 的出生点值是 13xxx；GH 有 3 个出生点候选。

- [ ] **Step 4: 提交**

```bash
git add data.js
git commit -m "$(cat <<'EOF'
feat: data.js 追加 SEED_SPAWN / SPAWN_POINTS_BY_MAP

从 datajs_snippet.txt 应用出生点数据：全 520 种子的出生点值 + 6 地图出生点候选点。
新增 const，不动现有 seedDataMatrix / POIS_BY_MAP 行。

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: script.js 出生点状态与筛选逻辑

**Files:**
- Modify: `script.js`（构造函数加状态；`selectMap`/`resetMap` 重置；`updateSeedFiltering` 加 spawnOk；加 `skipSpawn` 方法）

**Interfaces:**
- Consumes: Task 3 的全局 `SEED_SPAWN`（`{seedNum: "value"}`）
- Produces: 实例状态 `this.selectedSpawn`（`null` 或出生点值字符串）、`this.spawnPhase`（`boolean`）；筛选条件 `spawnOk`

- [ ] **Step 1: 构造函数加出生点状态**

定位 `script.js` 构造函数中 `this.chosenMap = null;`（约第 28 行），在其后追加两行：

```javascript
        this.chosenMap = null;
        this.selectedSpawn = null;   // 选中的出生点值（如 "13000"），null=未选/跳过
        this.spawnPhase = true;      // true=出生点阶段（锁地标），false=地标阶段
```

- [ ] **Step 2: selectMap 重置出生点状态**

定位 `selectMap` 方法中设置 `this.currentPOIs = POIS_BY_MAP[map] || [];` 与 `this.poiStates = this.initializePOIStates();`（约第 434-435 行），在其后追加：

```javascript
            this.currentPOIs = POIS_BY_MAP[map] || [];
            this.poiStates = this.initializePOIStates();
            this.selectedSpawn = null;   // 切地图重置出生点
            this.spawnPhase = true;      // 新地图默认回到出生点阶段
```

- [ ] **Step 3: resetMap 重置出生点状态**

定位 `resetMap` 方法中"if a map is selected"分支里的 `this.poiStates = this.initializePOIStates();`（约第 1111 行，注释 `// Reinitialize POI states for current map` 下方），在其后追加：

```javascript
            // Reinitialize POI states for current map
            this.currentPOIs = POIS_BY_MAP[this.chosenMap] || [];
            this.poiStates = this.initializePOIStates();
            this.selectedSpawn = null;
            this.spawnPhase = true;
```

- [ ] **Step 4: updateSeedFiltering 加 spawnOk 条件**

定位 `updateSeedFiltering` 方法中的 `possibleSeeds` 过滤（约第 1194-1198 行）：

```javascript
        const possibleSeeds = seedDataMatrix.filter(row => {
            //return row[1] === this.chosenNightlord && row[2] === this.chosenMap;
            const allNightlords = !this.chosenNightlord || row[1] === this.chosenNightlord;
            return allNightlords && row[2] === this.chosenMap;
        });
```

替换为（追加 `spawnOk`）：

```javascript
        const possibleSeeds = seedDataMatrix.filter(row => {
            const allNightlords = !this.chosenNightlord || row[1] === this.chosenNightlord;
            const spawnOk = !this.selectedSpawn || SEED_SPAWN[row[0]] === this.selectedSpawn;
            return allNightlords && row[2] === this.chosenMap && spawnOk;
        });
```

- [ ] **Step 5: 加 skipSpawn 方法**

在 `resetMap` 方法之后（约第 1135 行 `}` 之后）追加：

```javascript
    skipSpawn() {
        // 跳过出生点：不设筛选条件，直接进入地标阶段
        this.selectedSpawn = null;
        this.spawnPhase = false;
        if (this.canvas && this.ctx && this.chosenMap) {
            this.drawMap(this.images.maps[this.chosenMap]);
        }
        this.updateSeedFiltering();
        console.log('Skipped spawn selection, entered landmark phase');
    }
```

- [ ] **Step 6: 浏览器验证筛选生效**

Run: `node server.js`，浏览器选"大空洞"地图，DevTools Console：
```javascript
app = window.nightreignApp || document.querySelector('#map-canvas').__nightreign;
// 若无暴露实例，临时在 script.js 末尾 DOMContentLoaded 里加 window.__app = new NightreignMapRecogniser() 调试
```
（若实例未暴露）临时验证法：在 Console 直接设 `__app.selectedSpawn = SEED_SPAWN[1005]; __app.updateSeedFiltering();`，观察 `seed-count` 下降。或跳过精细验证，留到 Task 5 UI 完成后联调。

- [ ] **Step 7: 提交**

```bash
git add script.js
git commit -m "$(cat <<'EOF'
feat: 基础版出生点状态与筛选逻辑

加 selectedSpawn/spawnPhase 状态；updateSeedFiltering 追加 spawnOk 条件
（SEED_SPAWN[row[0]] === selectedSpawn）；selectMap/resetMap 切地图重置；
skipSpawn 跳过出生点进地标阶段。筛选逻辑就绪，UI 渲染在下一任务。

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: script.js 出生点标记渲染与两阶段点击

**Files:**
- Modify: `script.js`（`drawMap` 画 spawn 标记 + 地标变灰；加 `drawSpawnMarker`/`findClickedSpawn`；`click`/`touch` 处理分流）

**Interfaces:**
- Consumes: Task 3 的全局 `SPAWN_POINTS_BY_MAP`（`{map: [{value,x,y,label}]}`）；Task 4 的 `this.selectedSpawn`/`this.spawnPhase`/`this.skipSpawn()`
- Produces: canvas 上蓝色三角出生点标记；两阶段点击分流（spawn 阶段只响应 spawn，地标阶段响应地标）

- [ ] **Step 1: drawMap 画出生点标记 + spawnPhase 地标变灰**

定位 `drawMap(mapImage)` 方法末尾画 POI 的循环（约第 762-768 行）：

```javascript
        // Always draw POIs (they should be visible even without background image)
        this.currentPOIs.forEach(poi => {
            const state = this.poiStates[poi.id];
            this.drawPOI(poi, state);
        });

        console.log(`Drew map with ${this.currentPOIs.length} POIs for ${this.chosenMap}`);
    }
```

替换为（spawnPhase 时地标半透明；之后画 spawn 标记 + 阶段提示）：

```javascript
        // 画地标 POI（出生点阶段时半透明，提示先选出生点）
        if (this.spawnPhase) this.ctx.globalAlpha = 0.3;
        this.currentPOIs.forEach(poi => {
            const state = this.poiStates[poi.id];
            this.drawPOI(poi, state);
        });
        this.ctx.globalAlpha = 1.0;

        // 画出生点标记（蓝色三角，不受 spawnPhase 透明度影响）
        const spawns = (typeof SPAWN_POINTS_BY_MAP !== 'undefined' && SPAWN_POINTS_BY_MAP[this.chosenMap]) || [];
        spawns.forEach(sp => this.drawSpawnMarker(sp));

        // 出生点阶段顶部提示
        if (this.spawnPhase && spawns.length > 0) {
            this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
            this.ctx.fillRect(0, 0, CANVAS_SIZE, 40);
            this.ctx.fillStyle = '#00e5ff';
            this.ctx.font = 'bold 16px Inter, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(this.getText('map.spawn_hint'), CANVAS_SIZE / 2, 20);
        }

        console.log(`Drew map with ${this.currentPOIs.length} POIs and ${spawns.length} spawn points for ${this.chosenMap}`);
    }
```

- [ ] **Step 2: 加 drawSpawnMarker 方法**

在 `drawIcon` 方法之后（约第 822 行 `}` 之后）追加：

```javascript
    drawSpawnMarker(sp) {
        const { x, y, value, label } = sp;
        const selected = this.selectedSpawn === value;
        const r = ICON_SIZE / 2;
        // 蓝色实心三角（选中时青色高亮）
        this.ctx.beginPath();
        this.ctx.moveTo(x, y - r);
        this.ctx.lineTo(x + r, y + r);
        this.ctx.lineTo(x - r, y + r);
        this.ctx.closePath();
        this.ctx.fillStyle = selected ? '#00e5ff' : '#2196f3';
        this.ctx.fill();
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        // 序号 label
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 11px Inter, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(label, x, y + r * 0.3);
    }
```

- [ ] **Step 3: 加 findClickedSpawn 方法**

在 `findClickedPOI` 方法之后（约第 1089 行 `}` 之后）追加：

```javascript
    findClickedSpawn(x, y) {
        const spawns = (typeof SPAWN_POINTS_BY_MAP !== 'undefined' && SPAWN_POINTS_BY_MAP[this.chosenMap]) || [];
        return spawns.find(sp => {
            const dx = x - sp.x;
            const dy = y - sp.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance <= ICON_SIZE / 2 * 1.5;  // 与 findClickedPOI 同触控半径
        });
    }
```

- [ ] **Step 4: click 处理分流（出生点优先，spawnPhase 锁地标）**

定位 `setupCanvasEventListeners` 里 `this.canvas.addEventListener('click', (e) => {`（约第 839 行），将其开头的命中逻辑：

```javascript
        this.canvas.addEventListener('click', (e) => {
            if (!this.chosenMap) {
                console.log('Please select Map before marking POIs');
                return;
            }
            const pos = this.getMousePos(e);
            const poi = this.findClickedPOI(pos.x, pos.y);
            if (poi) {
```

替换为（先查 spawn，再按阶段分流地标）：

```javascript
        this.canvas.addEventListener('click', (e) => {
            if (!this.chosenMap) {
                console.log('Please select Map before marking POIs');
                return;
            }
            const pos = this.getMousePos(e);

            // 出生点标记优先（任何阶段都可改选/取消出生点）
            const spawn = this.findClickedSpawn(pos.x, pos.y);
            if (spawn) {
                this.selectedSpawn = (this.selectedSpawn === spawn.value) ? null : spawn.value;
                if (this.selectedSpawn) this.spawnPhase = false;  // 选定出生点 → 进地标阶段
                this.drawMap(this.images.maps[this.chosenMap]);
                this.updateSeedFiltering();
                console.log(`Spawn ${this.selectedSpawn ? 'selected' : 'cleared'}: ${spawn.value}`);
                return;
            }

            // 出生点阶段：地标点击无效（强制先选出生点）
            if (this.spawnPhase) {
                console.log('Spawn phase active - landmark clicks ignored (select spawn or skip)');
                return;
            }

            const poi = this.findClickedPOI(pos.x, pos.y);
            if (poi) {
```

- [ ] **Step 5: touch 处理同样分流**

定位 `setupCanvasEventListeners` 里 touch 结束时的命中处理（约第 928 行 `const poi = this.findClickedPOI(pos.x, pos.y);`，在长按/短按判定之后实际选中 POI 的位置）。在该 `findClickedPOI` 调用之前插入与 Step 4 相同的 spawn 分流逻辑：

```javascript
            const pos = this.getMousePos(touch);

            // 出生点标记优先
            const spawn = this.findClickedSpawn(pos.x, pos.y);
            if (spawn) {
                this.selectedSpawn = (this.selectedSpawn === spawn.value) ? null : spawn.value;
                if (this.selectedSpawn) this.spawnPhase = false;
                this.drawMap(this.images.maps[this.chosenMap]);
                this.updateSeedFiltering();
                return;
            }
            if (this.spawnPhase) return;  // 出生点阶段地标无效

            const poi = this.findClickedPOI(pos.x, pos.y);
```

**注意**：touch 有长按（法师塔/村庄）与短按（教堂）两套逻辑，阅读该处上下文确认插入点在"最终命中判定"之前、且不影响长按计时。若 touch 结构复杂难以安全插入，最低保证桌面 click（Step 4）正确，touch 分流作为后续优化。

- [ ] **Step 6: 浏览器联调（桌面）**

Run: `node server.js`，浏览器验证：
1. 选"大空洞"→ canvas 顶部提示"请先选择你的出生点"，地标半透明，3 个蓝色三角可见。
2. 点一个蓝色三角 → 变青色高亮，地标恢复不透明，顶部提示消失，`seed-count` 下降。
3. 再点同一三角 → 取消选中，回到出生点阶段。
4. 点另一个三角 → 换选。
5. 选定出生点后点地标圆点 → 正常切换教堂/清除（地标阶段生效）。
6. 点"跳过出生点"按钮（Task 6 加）→ 进地标阶段，出生点未选。

- [ ] **Step 7: 提交**

```bash
git add script.js
git commit -m "$(cat <<'EOF'
feat: 基础版出生点标记渲染与两阶段点击

drawMap 画蓝色三角出生点（spawnPhase 时地标半透明 + 顶部提示）；
drawSpawnMarker/findClickedSpawn；click/touch 分流：出生点优先，spawnPhase
锁地标。选定出生点后自动进地标阶段。

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: 跳过按钮 + i18n 文案

**Files:**
- Modify: `index.html`（`compact-button-row` 加"跳过出生点"按钮）
- Modify: `script.js`（绑定按钮 → `skipSpawn()`）
- Modify: `i18n/translations.js`（zh/en 加 `action.skip_spawn` + `map.spawn_hint`）

**Interfaces:**
- Consumes: Task 4 的 `this.skipSpawn()`；Task 5 的 `map.spawn_hint` 文案键
- Produces: `#skip-spawn-btn` 按钮；i18n 键 `action.skip_spawn` / `map.spawn_hint`

- [ ] **Step 1: index.html 加跳过按钮**

定位 `index.html` 的 `compact-button-row`（约第 85-94 行）：

```html
                <div class="compact-button-row">
                    <button id="reset-map-btn" class="reset-btn">
                        <i class="fas fa-undo"></i>
                        <span data-i18n="action.reset">重置所有标记</span>
                    </button>
                    
                    <button id="help-btn" class="help-btn">
                        <i class="fas fa-question-circle"></i>
                        <span data-i18n="action.help">帮助与提示</span>
                    </button>
                </div>
```

替换为（在 reset 与 help 之间插入跳过按钮）：

```html
                <div class="compact-button-row">
                    <button id="reset-map-btn" class="reset-btn">
                        <i class="fas fa-undo"></i>
                        <span data-i18n="action.reset">重置所有标记</span>
                    </button>
                    
                    <button id="skip-spawn-btn" class="reset-btn">
                        <i class="fas fa-forward"></i>
                        <span data-i18n="action.skip_spawn">跳过出生点</span>
                    </button>
                    
                    <button id="help-btn" class="help-btn">
                        <i class="fas fa-question-circle"></i>
                        <span data-i18n="action.help">帮助与提示</span>
                    </button>
                </div>
```

- [ ] **Step 2: script.js 绑定跳过按钮**

定位 `script.js` 中 `reset-map-btn` 的绑定（约第 168 行 `document.getElementById('reset-map-btn').addEventListener('click', ...`），在其后追加：

```javascript
            document.getElementById('skip-spawn-btn').addEventListener('click', () => {
                this.skipSpawn();
            });
```

- [ ] **Step 3: translations.js 加中文文案**

定位 `i18n/translations.js` 中文段 `'action.help': '帮助与提示',`（约第 58 行），在其后追加：

```javascript
        'action.help': '帮助与提示',
        'action.skip_spawn': '跳过出生点',
```

再定位中文段 `'map.click_dots': '点击橙色圆点标记兴趣点位置',`（约第 70 行），在其后追加：

```javascript
        'map.click_dots': '点击橙色圆点标记兴趣点位置',
        'map.spawn_hint': '请先选择你的出生点（蓝色三角），再标记地标',
```

- [ ] **Step 4: translations.js 加英文文案**

定位英文段 `'action.help': 'Help & Tips',`（约第 172 行），在其后追加：

```javascript
        'action.help': 'Help & Tips',
        'action.skip_spawn': 'Skip Spawn Point',
```

再定位英文段 `'map.click_dots'` 或同级 `map.*` 键，追加：

```javascript
        'map.spawn_hint': 'Select your spawn point (blue triangle) first, then mark landmarks',
```

（若英文段无 `map.click_dots`，定位任意 `map.*` 英文键之后追加即可。）

- [ ] **Step 5: 浏览器验证中英文 + 跳过按钮**

Run: `node server.js`，浏览器：
1. 选地图 → 顶部提示中文"请先选择你的出生点…"。
2. 点语言切换 → 提示变英文。
3. 点"跳过出生点"→ 进地标阶段，地标恢复不透明，顶部提示消失。
4. 跳过后 `seed-count` 不受 spawn 约束（显示该地图全部种子）。

- [ ] **Step 6: 提交**

```bash
git add index.html script.js i18n/translations.js
git commit -m "$(cat <<'EOF'
feat: 基础版出生点跳过按钮与中英文案

index.html 加跳过出生点按钮；translations.js 加 action.skip_spawn /
map.spawn_hint 中英文案。用户可跳过出生点直接进地标阶段。

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: 量化验证与收尾

**Files:**
- Modify: `.superpowers/sdd/progress.md`（更新进度账本）
- Create: `tests/quantify_spawn_ambiguity.py`（一次性量化脚本，dev 工具）

**Interfaces:**
- Consumes: Task 1-6 全部产物；`read_source_data()` 的 `source["patterns"]`
- Produces: spawn 前后歧义性对比数字（写入 progress.md）

- [ ] **Step 1: 写量化脚本**

Create `tests/quantify_spawn_ambiguity.py`：

```python
"""量化基础版出生点指认对种子歧义性的改善（一次性 dev 工具）。

对比"仅地标"vs"地标+出生点"两种筛选下，每种种地层组合的共享种子数分布。
方法：对每地图，按 (地标分类签名) 分组种子，看最大共享组；再按 (签名 + Start_190)
分组，看改善。

运行：python3 tests/quantify_spawn_ambiguity.py
"""
import os, sys, collections
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from integrate_dlc import read_source_data, SPECIAL_TO_MAP


def landmark_signature(constructs):
    """地地标签名：该种子显示建筑的 type 集合（粗粒度，仅用于量化趋势）。"""
    return tuple(sorted(c["type"] for c in constructs if c.get("is_display")))


def main():
    src = read_source_data()
    by_map = collections.defaultdict(list)  # {map: [(sid, landmark_sig, start)]}
    for sid, pat in src["patterns"].items():
        mt = SPECIAL_TO_MAP.get(pat["special"], "Default")
        cons = src["constructs"].get(sid, [])
        by_map[mt].append((sid, landmark_signature(cons), pat.get("start", "").strip()))

    print(f"{'地图':<14}{'种子数':>6}{'仅地标最大共享':>14}{'加spawn最大共享':>16}{'唯一性%':>10}")
    for mt in SPECIAL_TO_MAP.values():
        rows = by_map.get(mt, [])
        if not rows:
            continue
        # 仅地标
        lm_groups = collections.defaultdict(int)
        for _, sig, _ in rows:
            lm_groups[sig] += 1
        lm_max = max(lm_groups.values())
        # 地标 + spawn
        sp_groups = collections.defaultdict(int)
        for _, sig, start in rows:
            sp_groups[(sig, start)] += 1
        sp_max = max(sp_groups.values())
        uniq = sum(1 for v in sp_groups.values() if v == 1) / len(rows) * 100
        print(f"{mt:<14}{len(rows):>6}{lm_max:>14}{sp_max:>16}{uniq:>9.1f}%")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 运行量化**

Run: `python3 tests/quantify_spawn_ambiguity.py`
Expected: 打印各地图的"仅地标最大共享 / 加 spawn 最大共享 / 唯一性%"对比表。Great Hollow 行的唯一性应接近 95%（与 spec 预期一致）。

- [ ] **Step 3: 更新 progress.md**

把量化结果（尤其 GH 95%、基础地图改善幅度）与功能完成状态追加到 `.superpowers/sdd/progress.md`。

- [ ] **Step 4: 全量回归**

Run: `python3 -m unittest tests.test_integrate_dlc -v`
Expected: 全部 PASS。

浏览器全流程手测：选 6 种地图各一遍，确认出生点标记位置正确、两阶段交互正常、跳过可用、中英切换正常、种子筛选收紧符合预期。

- [ ] **Step 5: 提交**

```bash
git add tests/quantify_spawn_ambiguity.py .superpowers/sdd/progress.md
git commit -m "$(cat <<'EOF'
test: 量化基础版出生点指认的歧义改善 + 收尾

quantify_spawn_ambiguity.py 对比仅地标 vs 地标+出生点的种子共享分布；
更新 progress.md 记录量化结果（GH 约 95% 唯一）与功能完成状态。

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review（计划自检，执行前已跑）

**1. Spec 覆盖**：
- §3 坐标标定 → Task 1 ✓
- §4 数据管线（SEED_SPAWN / SPAWN_POINTS_BY_MAP）→ Task 2-3 ✓
- §5 UI 两阶段 + 实时筛选 + 跳过 → Task 4-6 ✓
- §6 决策表（敌人不做 / 引导强制 / 序号命名 / 不触碰 0-319）→ 全计划贯穿 ✓
- §8 测试（5 单测 + 浏览器手测）→ Task 1-2 单测 + 各 UI 任务手测 + Task 7 量化 ✓
- §9 量化 → Task 7 ✓
- §10 风险（Pillow 不可用 / 质心偏 / 卡死）→ Task 1 Step 7 核对 + Task 6 跳过逃生口 ✓

**2. 占位符扫描**：无 TBD/TODO；坐标值由 Task 1 标定动态产出落 JSON（非占位符，是数据驱动步骤）；每步含完整代码或精确命令 ✓

**3. 类型一致**：`load_spawn_calib() -> Dict[str, List[float]]`（Task 1）↔ `build_basic_spawn_snippets` 读 `calib[v]` 解包 `[x, y]`（Task 2）✓；`SEED_SPAWN[seedNum] === "value"`（Task 4 筛选）↔ `SEED_SPAWN = {seedNum: "value"}`（Task 2 生成）✓；`SPAWN_POINTS_BY_MAP[map]` 含 `{value,x,y,label}`（Task 2）↔ `drawSpawnMarker(sp)` 解构同字段（Task 5）✓；`skipSpawn()`（Task 4 定义）↔ 按钮 binding（Task 6）✓

**4. 已知 spec 细化**：spec §3 说"_SPAWN_CALIB 硬编码常量"，计划改为 `spawn_calib.json` + `load_spawn_calib()`（与现有 `great_hollow_calib.json` 同模式，更可重复、无需复制粘贴坐标）——功能等价，实现更优，已在 Architecture 注明。
