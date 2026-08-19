#!/usr/bin/env python3
"""抽查指定 DLC 种子的 construct 明细 + 修正前后 POI 对照，供用户游戏核对。

用法: python3 tools/inspect_seed.py 1092 1144 1193
输出写到 distnr/audit/inspect_<seed>.md
"""
import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import integrate_dlc as M
from tools.eval_basic_remap import authoritive_map, build_fixed_icon_map

PROJ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(PROJ, "distnr", "audit")
TOL = 80
LANDMARKS = {"church", "mage", "village", "carriage"}


def main():
    seeds = sys.argv[1:] or ["1092", "1144", "1193"]
    source = M.read_source_data(M.SRC_DEFAULT)
    icon_map = M.load_type_category_icon()
    fixed = build_fixed_icon_map(icon_map, authoritive_map())
    cur_all = json.load(open(os.path.join(PROJ, "dataset", "dataset.json"), encoding="utf-8"))["classifications"]
    new = M.build_basic_classifications(source, icon_map=fixed)
    calib = M.load_great_hollow_calib()
    gh_pois_1536 = M.cluster_great_hollow_pois(source, calib, 1536, exclude_bosses=True)
    pois_by_map = M._load_basic_pois_by_map()
    names = source["names"]

    for sid0 in seeds:
        sid = sid0.lstrip("0") or "0"
        sid4 = sid.zfill(4)
        pat = source["patterns"].get(sid)
        if not pat:
            print(f"种子 {sid0} 不存在"); continue
        maptype = M.SPECIAL_TO_MAP.get(pat["special"], "Default")
        is_gh = maptype == "Great Hollow"
        pois = gh_pois_1536 if is_gh else pois_by_map.get(maptype, [])

        lines = [f"# 种子 {sid4} 抽查明细", "",
                 f"地形: **{maptype}** | 夜王: {pat['nightlord']} | 候选点 {len(pois)} 个", "",
                 "## POI 对照（修正前 → 修正后）", ""]
        old_cls = cur_all.get(sid4, {})
        new_cls = new.get(sid4, {})
        for p in sorted(pois, key=lambda x: x["id"]):
            poi = f"POI{p['id']}"
            ob, nb = old_cls.get(poi, "nothing"), new_cls.get(poi, "nothing")
            mark = " ✏️" if ob != nb else ""
            lines.append(f"- {poi} ({p['x']:.0f},{p['y']:.0f}): **{ob} → {nb}**{mark}")
        lines.append("")
        lines.append("## 该种子所有 is_display=True 建筑（按 type 分组）")
        lines.append("")
        cons = source["constructs"].get(sid, [])
        rows = []
        for con in cons:
            if not con.get("is_display"):
                continue
            coord = source["coords"].get(con["coord_index"])
            if not coord:
                continue
            if is_gh:
                bx, by = M.transform_coord_great_hollow(coord[0], coord[1], con["coord_index"], calib, 1536)
            else:
                bx, by = M.transform_coord_basic(coord[0], coord[1], 1536)
            best, best_d = None, 1e9
            for p in pois:
                d = (p["x"] - bx) ** 2 + (p["y"] - by) ** 2
                if d < best_d:
                    best_d, best = d, p
            captured = best and best_d <= TOL * TOL
            cls = M._classify_type(con["type"], source, fixed, M.build_base_type_category(source))
            auth_basic = authoritive_map().get(con["type"])
            rows.append((con["type"], names.get(con["type"], ""), cls["basic"],
                         auth_basic, bx, by, best["id"] if best else None,
                         best_d ** 0.5 if best else None, captured))
        rows.sort(key=lambda r: int(r[0]) if r[0].isdigit() else 0)
        from collections import defaultdict
        by_type = defaultdict(list)
        for r in rows:
            by_type[r[0]].append(r)
        # 只列「能匹配 POI 的」或「basic 是地标的」，否则太多
        shown = [r for r in rows if r[8] or r[2] in LANDMARKS or r[3] in LANDMARKS]
        lines.append(f"（共 {len(rows)} 个显示建筑，下表列 {len(shown)} 个：匹配POI或地标类）")
        lines.append("")
        lines.append("| type | 命名 | _classify后basic | 权威basic | xy1536 | 最近POI | 距离 | 捕获(≤80) |")
        lines.append("|------|------|-----------------|-----------|-------|---------|------|-----------|")
        for t, name, cb, ab, bx, by, pid, dist, cap in shown:
            star = "⭐" if ab in LANDMARKS else ""
            lines.append(f"| {t} {star} | {name or '—'} | {cb} | {ab or '—'} | {bx:.0f},{by:.0f} | {pid} | {dist:.0f} | {'✅' if cap else '❌'} |")
        lines.append("")
        lines.append("> ⭐=权威POI地标(church/mage/village) | ✅=落在候选点40px内会标注 | "
                     "看图标 icons/Construct_XXXXX.png 核对真实建筑")
        outpath = os.path.join(OUT, f"inspect_{sid4}.md")
        with open(outpath, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        print(f"种子 {sid4} ({maptype}): {outpath}")
        # 关键翻转摘要
        flips = [(p, old_cls.get(f'POI{p["id"]}', "nothing"), new_cls.get(f'POI{p["id"]}', "nothing"))
                 for p in pois if old_cls.get(f'POI{p["id"]}', "nothing") != new_cls.get(f'POI{p["id"]}', "nothing")]
        for p, o, n in flips:
            print(f"    POI{p['id']}: {o} → {n}")


if __name__ == "__main__":
    main()
