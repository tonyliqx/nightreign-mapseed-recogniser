# tools/build_advanced_json.py
# 从 vendor 新源生成高级版 dataset/nightreignMapPatterns.json
# category=NAME 类别英文 key，单层选 type 中文名，icon 按类派生。
# 决策见 memory: category-name-taxonomy-decision
# 输出到 .new.json 供验证（app 改造完成前不覆盖生产 JSON）。
import json, csv, sys
from pathlib import Path
from collections import defaultdict
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from nightreign_etl import (load_source, SPECIAL_TO_MAP, NIGHTLORD_TO_KEY,
                            INCLUDED_CATEGORIES, category_of, icon_of, apply_void_offset)

VENDOR = ROOT / "vendor" / "nightreign-data"
OUT = ROOT / "dataset" / "nightreignMapPatterns.new.json"
TM = json.loads((ROOT / "tools" / "type_mapping.json").read_text(encoding="utf-8"))
GREAT_HOLLOW = 4

# 基础版 SPAWN_POINTS_BY_MAP（data.js，1536 空间）—— 权威落地点（与 render_terrain_cats.py 同源）
# 注意：坐标.csv 的 700-708 是山羊刷新点，非落地点，绝不可用；大空洞 13000-13002 仅基础版有
SPAWN_1536 = {
    "Default": {"700": (298.8, 1123.0), "701": (313.0, 850.8), "702": (326.8, 559.8), "703": (492.8, 564.8),
                "704": (881.8, 1266.0), "705": (754.0, 1015.4), "706": (786.2, 290.4), "707": (1286.8, 795.4), "708": (1043.6, 556.4)},
    "Mountaintop": {"700": (298.8, 1123.0), "701": (313.0, 850.8), "704": (881.8, 1266.0), "705": (754.0, 1015.4),
                    "706": (786.2, 290.4), "707": (1286.8, 795.4), "708": (1043.6, 556.4)},
    "Crater": {"700": (298.8, 1123.0), "701": (313.0, 850.8), "702": (326.8, 559.8), "704": (881.8, 1266.0),
               "705": (754.0, 1015.4), "707": (1286.8, 795.4), "708": (1043.6, 556.4)},
    "Rotted Woods": {"700": (298.8, 1123.0), "701": (313.0, 850.8), "702": (326.8, 559.8), "703": (492.8, 564.8),
                     "706": (786.2, 290.4), "708": (1043.6, 556.4)},
    "Great Hollow": {"13000": (410.0, 1100.0), "13001": (695.0, 1230.0), "13002": (1110.0, 437.0)},
    "Noklateo": {"702": (326.8, 559.8), "703": (492.8, 564.8), "704": (881.8, 1266.0), "705": (754.0, 1015.4),
                 "706": (786.2, 290.4), "707": (1286.8, 795.4), "708": (1043.6, 556.4)},
}


def coord_key(x, y):
    # 聚类键：精确同坐标（0.1）合并共享位置的 coord（含 +2000 变体）→ 1 个槽位
    return (round(float(x), 1), round(float(y), 1))


def included(cat, terr):
    if cat not in INCLUDED_CATEGORIES:
        return False
    # 大空洞商人仅大空洞地形
    if cat == "merchant" and terr != GREAT_HOLLOW:
        return False
    return True


def main():
    src = load_source(str(VENDOR))
    patterns, coords, construct, names = src.patterns, src.coords, src.construct, src.names
    seed_terr = dict(zip(patterns["ID"], patterns["Special"]))
    d = construct[construct["is_display"] == 1].copy()
    # 补录：vendor 早期 CONSTRUCT 把「池沼·鲜血贵族们」(type=50060) 误标 is_display=0，
    # 同槽位的兄弟 boss（腐败眷属 50001 等）均为 is_display=1，外部 v0.3.3 已修正为 1。
    # 在 vendor 整体同步到 v0.3.3 前，于此幂等强制纳入（vendor 已修正后此条件不再命中）。
    missing_50060 = construct[(construct["type"] == 50060) & (construct["is_display"] == 0)]
    if len(missing_50060):
        d = pd.concat([d, missing_50060], ignore_index=True)
    d["terr"] = d["MAP"].map(seed_terr)

    # ---- 1. poiLookupByMapType: 按地形聚类 coord → 槽位 ----
    poiLookupByMapType = {}
    terrain_slots = {}  # tname -> {coord_key: slot_dict}
    for tid, tname in SPECIAL_TO_MAP.items():
        sub = d[d["terr"] == tid]
        clusters = defaultdict(list)          # coord_key -> [coord_id]
        cat_of_coord = defaultdict(lambda: defaultdict(int))  # coord_key -> {cat: count}
        for r in sub.itertuples():
            cid = int(r.coord_index)
            if cid not in coords:
                continue
            cat = category_of(int(r.type), cid, TM, names)
            if not included(cat, tid):
                continue
            x, y = apply_void_offset(cid, coords[cid])
            k = coord_key(x, y)
            clusters[k].append(cid)
            cat_of_coord[k][cat] += 1
        # 槽位 index 按 (y, x) 稳定排序
        keys = sorted(clusters.keys(), key=lambda k: (k[1], k[0]))
        terrain_slots[tname] = {}
        slot_list = []
        for idx, k in enumerate(keys):
            cat = max(cat_of_coord[k], key=cat_of_coord[k].get)  # 众数类别
            sd = {"id": str(idx), "category": cat, "index": idx,
                  "coordinates": {"x": k[0], "y": k[1]}}
            terrain_slots[tname][k] = sd
            slot_list.append(sd)
        poiLookupByMapType[tname] = slot_list
        print(f"{tname}: {len(slot_list)} 槽位", file=sys.stderr)

    # ---- 2. seeds: 每个 pattern 的 POI（按参与类别过滤）----
    seeds = {}
    n_pois = 0
    for r in patterns.itertuples():
        pid = int(r.ID)
        terr = int(r.Special)
        tname = SPECIAL_TO_MAP.get(terr)
        if tname is None or tname not in terrain_slots:
            continue
        pois = {}
        for cr in d[d["MAP"] == pid].itertuples():
            cid = int(cr.coord_index)
            if cid not in coords:
                continue
            cat = category_of(int(cr.type), cid, TM, names)
            if not included(cat, terr):
                continue
            x, y = apply_void_offset(cid, coords[cid])
            slot = terrain_slots[tname].get(coord_key(x, y))
            if not slot:
                continue
            tinfo = TM.get(str(int(cr.type)))
            tcn = tinfo["name"] if tinfo else names.get(int(cr.type), str(cr.type))
            pois[str(slot["index"])] = {
                "name": tcn, "type": tcn, "category": cat,
                "index": slot["index"],
                "coordinates": {"x": round(x, 1), "y": round(y, 1)},
                "icon": icon_of(int(cr.type), TM, names),
            }
            n_pois += 1
        # 出生点：Start_190 → 基础版 SPAWN_1536（权威落地点；非坐标.csv 山羊点）
        spawn_cid = str(int(r.Start_190)) if pd.notna(r.Start_190) else None
        spawn_1536 = SPAWN_1536.get(tname, {}).get(spawn_cid) if spawn_cid else None
        spawn_point = {
            "location": f"出生点{spawn_cid}",
            "coordinate": {"x": round(spawn_1536[0], 1), "y": round(spawn_1536[1], 1)},
            "enemy": None
        } if spawn_1536 else None

        seeds[str(pid)] = {
            "seedNumber": pid,
            "nightlord": NIGHTLORD_TO_KEY.get(int(r.NightLord), str(r.NightLord)),
            "mapType": tname,
            "spawnPoint": spawn_point,
            "pois": pois,
        }
    out = {"extractedTime": "new-source-v0.3.3", "seeds": seeds, "poiLookupByMapType": poiLookupByMapType}
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n写入 {OUT.name}: {len(seeds)} seeds, {n_pois} pois", file=sys.stderr)


if __name__ == "__main__":
    main()
