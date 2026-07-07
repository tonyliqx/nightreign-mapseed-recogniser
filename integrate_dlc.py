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


def load_spawn_calib() -> Dict[str, List[float]]:
    """加载 dataset/dlc-params/spawn_calib.json：{出生点值: [x768, y768]}（12 键）。

    由 dev 时 calibrate_spawn.py（Pillow）从源素材 Start_*.png 标定产出；
    生产端纯 json.load，无第三方依赖。与 load_great_hollow_calib 同模式。"""
    path = os.path.join(PARAMS_DIR, "spawn_calib.json")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


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


def build_maptype_fix(source: Dict[str, Any], target_override: Dict[str, str] = None) -> Dict[str, str]:
    """对比源 Special 与目标当前 mapType，返回需纠正的 {seed_id: correct_mapType}。

    target_override 用于测试注入合成目标状态，脱离 data.js 文件当前内容耦合；
    生产路径（main）留空，自动从 data.js 读真实当前值。"""
    target = target_override if target_override is not None else _load_target_maptypes()
    fix = {}
    for sid, pat in source["patterns"].items():
        if not (1000 <= int(sid) <= 1199):
            continue
        correct = SPECIAL_TO_MAP.get(pat["special"], "Default")
        if target.get(sid) != correct:
            fix[sid] = correct
    return fix


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


def cluster_great_hollow_pois(source: Dict[str, Any], calib: Dict[str, Any],
                              target_space: int, merge_threshold: float = 45.0,
                              exclude_bosses: bool = False) -> List[Dict]:
    """收集 80 条 Great Hollow 种子的全部建筑坐标（目标空间），近邻聚类去重。
    merge_threshold 以 768 空间像素为基准，按 target_space 线性缩放——保证基础版(768)
    与高级版(1536)聚类等价、候选点 id 一一对应。45px(768)≈源 280px。

    exclude_bosses=True 时剔除 boss 坐标（field_boss 图标 + 4xxxx boss type）。
    背景：boss 坐标占源数据 ~60%（每种子带 DAY1/2 Boss），混合聚类会令 17/25 候选点
    被 boss 主导，挤掉教堂/法师塔地标。基础版 POI 语义为教堂/法师塔/村庄（无 boss），
    排除后候选点回归地标（25→10）；高级版有 field boss 类别，保留 boss 候选点（默认 False）。"""
    icon_map = load_type_category_icon() if exclude_bosses else None

    def _is_boss(t) -> bool:
        t = str(t).strip()
        if icon_map and t in icon_map and icon_map[t].get("icon") == "field_boss":
            return True
        if t.isdigit() and 40000 <= int(t) < 50000:  # 4xxxx boss（DAY1/2 Boss 等，源数据主力）
            return True
        return False

    # 收集所有 Great Hollow 种子的建筑目标坐标
    points = []  # [(tx, ty, coord_id, pic_x, pic_y, type)]
    for sid, pat in source["patterns"].items():
        if not (1000 <= int(sid) <= 1199) or pat["special"] != 4:
            continue
        for con in source["constructs"].get(sid, []):
            # 执行期补丁：跳过 is_display=False 的背景装饰建筑，避免误成 POI 候选
            if not con.get("is_display"):
                continue
            # 基础版补丁：排除 boss 坐标，候选点回归教堂/法师塔/废墟地标（非 boss 主导）
            if exclude_bosses and _is_boss(con["type"]):
                continue
            coord = source["coords"].get(con["coord_index"])
            if not coord:
                continue
            tx, ty = transform_coord_great_hollow(coord[0], coord[1], con["coord_index"], calib, target_space)
            points.append((tx, ty, con["coord_index"], coord[0], coord[1], con["type"]))

    # 阈值按目标空间缩放：768 基准，1536→2 倍，两版聚类等价（坐标 768=1536×0.5 严格线性）
    effective_threshold = merge_threshold * target_space / 768
    # 贪心聚类：按 x 排序，距离 < threshold 合并
    points.sort()
    clusters = []  # 每个: {"coords": [...], "cx": , "cy": }
    for tx, ty, ci, px, py, t in points:
        merged = False
        for cl in clusters:
            if (cl["cx"] - tx) ** 2 + (cl["cy"] - ty) ** 2 <= effective_threshold ** 2:
                cl["coords"].append((px, py, ci, t))
                # 更新质心
                n = len(cl["coords"])
                cl["cx"] = ((n - 1) * cl["cx"] + tx) / n
                cl["cy"] = ((n - 1) * cl["cy"] + ty) / n
                merged = True
                break
        if not merged:
            clusters.append({"coords": [(px, py, ci, t)], "cx": tx, "cy": ty})

    # 后处理：贪心按 x 排序只向后合并，质心漂移后可能残留近邻簇对（实测 36.9px < 45）。
    # 反复合并质心距 ≤ threshold 的最近簇对，直到所有簇心间距 > threshold——
    # 这才是 merge_threshold 的真正不变量：输出候选点（质心）的图标不会重叠。
    while len(clusters) > 1:
        bi = bj = -1
        best_d2 = float("inf")
        for i in range(len(clusters)):
            for j in range(i + 1, len(clusters)):
                d2 = (clusters[i]["cx"] - clusters[j]["cx"]) ** 2 + \
                     (clusters[i]["cy"] - clusters[j]["cy"]) ** 2
                if d2 < best_d2:
                    best_d2 = d2; bi, bj = i, j
        if best_d2 > effective_threshold ** 2:
            break
        a, b = clusters[bi], clusters[bj]
        na, nb = len(a["coords"]), len(b["coords"])
        a["cx"] = (na * a["cx"] + nb * b["cx"]) / (na + nb)
        a["cy"] = (na * a["cy"] + nb * b["cy"]) / (na + nb)
        a["coords"] = a["coords"] + b["coords"]
        clusters.pop(bj)  # bj > bi，pop 安全

    # 按 (cx, cy) 排序后分配 id
    clusters.sort(key=lambda c: (c["cy"], c["cx"]))
    out = []
    for i, cl in enumerate(clusters, 1):
        out.append({"id": i, "x": round(cl["cx"], 1), "y": round(cl["cy"], 1),
                    "source_coords": cl["coords"]})
    return out


# 夜王编号→名称（与 data.js NIGHTLORDS / CSV 一致）
NIGHTLORD_NAMES = {
    0: "Gladius", 1: "Adel", 2: "Gnoster", 3: "Maris",
    4: "Libra", 5: "Fulghor", 6: "Caligo", 7: "Heolstor",
    8: "Harmonia", 9: "Straghess",
}


def load_type_category_icon() -> Dict[str, Dict]:
    """加载 Task 0.2 产出的 5xxxx type → 类目/图标映射表；缺失则返回空 dict。"""
    path = os.path.join(PARAMS_DIR, "type_category_icon.json")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return {}


def _adv_default_icon(adv: str) -> str:
    """高级版类目 → 兜底图标名（无显式图标表时的回退）。"""
    return {"majorBase": "ruin_blank", "minorBase": "church",
            "fieldBoss": "field_boss", "evergaol": "evergaol",
            "rottedWoods": "elite"}.get(adv, "ruin_blank")


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


def _nearest_gh_location(coord, gh_pois_1536, calib) -> str:
    """把源建筑坐标映射到最近的 Great Hollow 候选点程序化地名。"""
    tx, ty = transform_coord_great_hollow(coord[0], coord[1], "", calib, 1536)
    best, best_d = None, 1e9
    for p in gh_pois_1536:
        d = (p["x"] - tx) ** 2 + (p["y"] - ty) ** 2
        if d < best_d:
            best_d, best = d, f"greatHollow_{p['id']}"
    return best


def build_advanced_csv_rows(source: Dict, icon_map: Dict,
                             base_map: Dict = None, gh_pois_1536: List[Dict] = None,
                             calib: Dict = None) -> Dict[str, Dict]:
    """生成 200 条 DLC 种子的高级版 CSV 行数据。
    返回 {seed_id: {"mapType", "nightlord", "major_base", "minor_base", "evergaol", "field_boss"}}。"""
    if base_map is None:
        base_map = build_base_type_category(source)
    if calib is None:
        calib = load_great_hollow_calib()
    if gh_pois_1536 is None:
        gh_pois_1536 = cluster_great_hollow_pois(source, calib, 1536)

    rows = {}
    for sid, pat in source["patterns"].items():
        if not (1000 <= int(sid) <= 1199):
            continue
        maptype = SPECIAL_TO_MAP.get(pat["special"], "Default")
        row = {"mapType": maptype, "nightlord": NIGHTLORD_NAMES.get(pat["nightlord"], "Gladius"),
               "major_base": {}, "minor_base": {}, "evergaol": {}, "field_boss": {}}

        # 仅 Great Hollow 填 POI（用户决策 2026-07-06）：基础地图 DLC 种子的建筑布局
        # 与现有候选点不对齐——实测严格公差 0% 命中、30px 才 57%——故基础地图 DLC 种子
        # 只保留 mapType/nightlord，POI 字典留空。原 else 分支用 coord_index 当地名 +
        # 裸 type 编号当 value，会导致 convert-csv-to-json.py 崩溃（major_base value
        # 无 ' - ' 分隔符）且坐标缺失。基础地图 DLC 种子走 mapType/夜王筛选即可。
        if maptype == "Great Hollow":
            for con in source["constructs"].get(sid, []):
                # 执行期补丁：跳过 is_display=False 的背景装饰建筑，非 POI
                if not con.get("is_display"):
                    continue
                cls = _classify_type(con["type"], source, icon_map, base_map)
                cat_key = {"majorBase": "major_base", "minorBase": "minor_base",
                           "fieldBoss": "field_boss", "evergaol": "evergaol",
                           "rottedWoods": "field_boss"}[cls["adv"]]
                # 匹配到最近的 Great Hollow 候选点地名
                coord = source["coords"].get(con["coord_index"])
                if not coord:
                    continue
                loc = _nearest_gh_location(coord, gh_pois_1536, calib)
                if loc is None:
                    continue
                # Great Hollow POI value：boss 中文名（fieldBoss）或裸 5xxxx type 编号（结构）。
                # fieldBoss 不再用 "structure - boss" 重复格式——现有 CSV field_boss 就是纯 boss 名。
                value = source["names"].get(con["type"], con["type"])
                row[cat_key][loc] = value
        rows[sid] = row
    return rows


def build_basic_classifications(source: Dict, icon_map: Dict = None,
                                 base_map: Dict = None, gh_pois_768: List[Dict] = None,
                                 calib: Dict = None, existing_pois_by_map: Dict = None) -> Dict[str, Dict[str, str]]:
    """生成 200 条 DLC 种子的基础版 4 类（church/mage/village/other/nothing）分类。
    返回 {seed_id(零填充4位): {"POI<n>": <class>, ...}}。"""
    if icon_map is None:
        icon_map = load_type_category_icon()
    if base_map is None:
        base_map = build_base_type_category(source)
    if calib is None:
        calib = load_great_hollow_calib()
    if gh_pois_768 is None:
        # 基础版候选点排除 boss（语义为教堂/法师塔/村庄），见 cluster_great_hollow_pois 文档
        gh_pois_768 = cluster_great_hollow_pois(source, calib, 768, exclude_bosses=True)
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
            # 执行期补丁：跳过 is_display=False 的背景装饰建筑，非 POI
            if not con.get("is_display"):
                continue
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


def build_basic_datajs_snippets(source: Dict, calib: Dict = None,
                                gh_pois_768: List[Dict] = None,
                                target_override: Dict[str, str] = None) -> Dict[str, Any]:
    """生成基础版 data.js 需要的两类片段：
    - pois_by_map_gh: POIS_BY_MAP["Great Hollow"] 的 JS 数组字面量（768 空间候选点）
    - seed_matrix_fixes: seedDataMatrix 的 mapType 纠正表 {seed_id: maptype}

    target_override 透传给 build_maptype_fix（测试注入用，生产留空读 data.js）。"""
    if calib is None:
        calib = load_great_hollow_calib()
    if gh_pois_768 is None:
        # 基础版候选点排除 boss（语义为教堂/法师塔/村庄），见 cluster_great_hollow_pois 文档
        gh_pois_768 = cluster_great_hollow_pois(source, calib, 768, exclude_bosses=True)

    # POIS_BY_MAP["Great Hollow"] 的 JS 数组字面量
    lines = []
    for p in gh_pois_768:
        lines.append(f"    {{ id: {p['id']}, x: {p['x']}, y: {p['y']} }}")
    pois_js = ",\n".join(lines)

    return {
        "pois_by_map_gh": pois_js,
        "seed_matrix_fixes": build_maptype_fix(source, target_override),
    }


def main():
    """主流程：读源 → 算各产出 → 写文件。幂等可重跑。"""
    print("🔄 DLC 集成生成器启动...")
    source = read_source_data()
    calib = load_great_hollow_calib()
    icon_map = load_type_category_icon()
    base_map = build_base_type_category(source)

    gh_1536 = cluster_great_hollow_pois(source, calib, 1536)
    gh_768 = cluster_great_hollow_pois(source, calib, 768, exclude_bosses=True)  # 基础版排除 boss

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


if __name__ == "__main__":
    main()
