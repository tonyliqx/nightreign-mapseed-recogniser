#!/usr/bin/env python3
"""自动选每个地形的代表种子（翻转最多），生成汇总抽查包供用户核对。

每地形选 1 个翻转最多的种子，列出每个翻转 POI 的：修正前→后、实际建筑 type、图标、距离。
用户拿 type 号看 icons/Construct_XXXXX.png 核对修正方向。
"""
import os
import sys
import json
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import integrate_dlc as M
from tools.eval_basic_remap import authoritive_map, build_fixed_icon_map

PROJ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(PROJ, "distnr", "audit")
TOL = 80
LANDMARK_LABEL = {"church": "教堂", "mage": "法师塔", "village": "村庄", "carriage": "马车"}


def main():
    n_per_terrain = int(sys.argv[1]) if len(sys.argv) > 1 else 2
    source = M.read_source_data(M.SRC_DEFAULT)
    icon_map = M.load_type_category_icon()
    fixed = build_fixed_icon_map(icon_map, authoritive_map())
    base_map = M.build_base_type_category(source)
    cur_all = json.load(open(os.path.join(PROJ, "dataset", "dataset.json"), encoding="utf-8"))["classifications"]
    new = M.build_basic_classifications(source, icon_map=fixed)
    calib = M.load_great_hollow_calib()
    gh_pois_1536 = M.cluster_great_hollow_pois(source, calib, 1536, exclude_bosses=True)
    pois_by_map = M._load_basic_pois_by_map()
    names = source["names"]

    # 按地形分组，按翻转数排序
    by_terrain = defaultdict(list)
    for sid4, new_cls in new.items():
        sid = sid4.lstrip("0") or "0"
        pat = source["patterns"].get(sid)
        maptype = M.SPECIAL_TO_MAP.get(pat["special"], "Default") if pat else "?"
        old_cls = cur_all.get(sid4, {})
        nflips = sum(1 for p, nb in new_cls.items() if old_cls.get(p, "nothing") != nb)
        if nflips:
            by_terrain[maptype].append((nflips, sid4, sid))

    picked = []
    for mt in ["Default", "Mountaintop", "Crater", "Rotted Woods", "Noklateo", "Great Hollow"]:
        lst = sorted(by_terrain.get(mt, []), reverse=True)[:n_per_terrain]
        for _, sid4, sid in lst:
            picked.append((mt, sid4, sid))

    lines = ["# 代表种子抽查汇总（每地形翻转最多）", "",
             f"每地形选 {n_per_terrain} 个 | 核对：看 type 号对应的图标 icons/Construct_XXXXX.png，"
             "确认修正后 basic 是否匹配真实建筑", ""]
    auth = authoritive_map()

    for mt, sid4, sid in picked:
        pat = source["patterns"].get(sid)
        is_gh = mt == "Great Hollow"
        pois = gh_pois_1536 if is_gh else pois_by_map.get(mt, [])
        old_cls, new_cls = cur_all.get(sid4, {}), new[sid4]
        lines += [f"## 种子 {sid4}（{mt}）", "",
                  "| POI(坐标) | 修正前→后 | 实际建筑 type(距离) | 图标 |",
                  "|-----------|-----------|---------------------|------|"]
        # 每个翻转 POI 找最近的 is_display construct
        cons = [c for c in source["constructs"].get(sid, []) if c.get("is_display")]
        for p in sorted(pois, key=lambda x: x["id"]):
            poi = f"POI{p['id']}"
            ob, nb = old_cls.get(poi, "nothing"), new_cls.get(poi, "nothing")
            if ob == nb:
                continue
            # 找该 POI 40px 内、且 basic 等于 nb 的 construct（解释为何变成 nb）
            expl = []
            for con in cons:
                coord = source["coords"].get(con["coord_index"])
                if not coord:
                    continue
                bx, by = (M.transform_coord_great_hollow(coord[0], coord[1], con["coord_index"], calib, 1536)
                          if is_gh else M.transform_coord_basic(coord[0], coord[1], 1536))
                d = ((p["x"] - bx) ** 2 + (p["y"] - by) ** 2) ** 0.5
                if d > TOL:
                    continue
                cls = M._classify_type(con["type"], source, fixed, base_map)
                if cls["basic"] == nb or auth.get(con["type"]) == nb:
                    expl.append((con["type"], d, cls["basic"]))
            expl.sort(key=lambda x: x[1])
            if expl:
                t, d, b = expl[0]
                label = LANDMARK_LABEL.get(b, b)
                cells = f"{t} ({d:.0f}px, {label})"
                icon = f"[icon](icons/Construct_{t}.png)"
            else:
                cells = f"（40px 内无 {LANDMARK_LABEL.get(nb,nb)} 建筑 → 回归 nothing）"
                icon = "—"
            lines.append(f"| {poi}({p['x']:.0f},{p['y']:.0f}) | **{ob}→{nb}** | {cells} | {icon} |")
        lines.append("")

    outpath = os.path.join(OUT, "inspect_overview.md")
    with open(outpath, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"抽查 {len(picked)} 个种子 → {outpath}")
    for mt, sid4, sid in picked:
        print(f"  {sid4} ({mt})")


if __name__ == "__main__":
    main()
