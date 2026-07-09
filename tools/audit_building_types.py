#!/usr/bin/env python3
"""全面排查基础建筑 type 的 basic 分类，供用户用种子做视觉核对。

背景：build_base_type_category 从 0-319 基础种子投票学 type→basic。
4xxxx boss 强制 other、5xxxx DLC 走 icon_map；其余基础建筑 type（38xxx/32xxx/21xxx 等）
走投票——投票结果随"哪些地形参与"而抖动（RW 正则修复就翻转了 38001/32102/38000）。

本脚本自跑投票并保留完整分布（不只是最多票），标注"险胜"（top-second≤2=不稳），
附图标 + 代表种子 + 该种子的 POI 位置，让用户拿种子号核对真实建筑类别再决定 basic。

输出：distnr/audit/building_types.{md,json}、icons/Construct_XXXXX.png、contact_sheet.png
"""
import os
import sys
import shutil
import json
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from PIL import Image, ImageDraw, ImageFont

import integrate_dlc as M

PROJ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = M.SRC_DEFAULT
OUT = os.path.join(PROJ, "distnr", "audit")
ICONS_OUT = os.path.join(OUT, "icons")
SRC_ICONS = os.path.join(SRC, "素材")

VOTE_TOL = 30   # 投票容差（与 build_base_type_category 一致）
LANDMARKS = {"church", "mage", "village", "carriage"}


def load_font(size):
    for p in ("/System/Library/Fonts/PingFang.ttc",):
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()


def run_vote_tally(source, pois_by_map, classifications):
    """复刻 build_base_type_category 的投票，但保留每个 type 的完整分布 {basic: count}。
    返回 {type: {"dist": {basic: count}, "hits": [(sid, maptype, poi_id, bx, by)]}}。
    hits 仅记 POI 匹配上的（投票来源），用于挑代表种子。"""
    tally = defaultdict(lambda: {"dist": defaultdict(int), "hits": []})
    for sid, pat in source["patterns"].items():
        if not (0 <= int(sid) <= 319):
            continue
        cls = classifications.get(sid.zfill(3))
        if not cls:
            continue
        maptype = M.SPECIAL_TO_MAP.get(pat["special"], "Default")
        pois = pois_by_map.get(maptype, [])
        if not pois:
            continue
        for con in source["constructs"].get(sid, []):
            coord = source["coords"].get(con["coord_index"])
            if not coord:
                continue
            bx, by = M.transform_coord_basic(coord[0], coord[1], 768)
            best, best_d = None, 1e9
            for p in pois:
                d = (p["x"] - bx) ** 2 + (p["y"] - by) ** 2
                if d < best_d:
                    best_d, best = d, p
            if best is None or best_d > VOTE_TOL * VOTE_TOL:
                continue
            basic = cls.get(f"POI{best['id']}")
            if not basic:
                continue
            t = con["type"]
            ti = int(t) if t.isdigit() else 0
            if 40000 <= ti < 50000 or ti >= 50000:
                continue
            tally[t]["dist"][basic] += 1
            tally[t]["hits"].append((sid, maptype, best["id"], round(bx), round(by)))
    return tally


def main():
    os.makedirs(ICONS_OUT, exist_ok=True)
    source = M.read_source_data(SRC)
    icon_map = M.load_type_category_icon()
    pois_by_map = M._load_basic_pois_by_map()
    classifications = M._load_basic_classifications()
    names = source["names"]
    tally = run_vote_tally(source, pois_by_map, classifications)

    rows = []
    for t, data in tally.items():
        dist = dict(data["dist"])
        total = sum(dist.values())
        top = max(dist, key=dist.get)
        sorted_votes = sorted(dist.items(), key=lambda kv: -kv[1])
        second = sorted_votes[1][1] if len(sorted_votes) > 1 else 0
        unstable = (dist[top] - second) <= 2  # 险胜：top-second≤2 → 易翻转
        hits = data["hits"]
        # 代表种子：优先取命中 POI 的（投票来源），覆盖多地形更好
        reps = hits[:3]
        icon_src = os.path.join(SRC_ICONS, f"Construct_{t}.png")
        icon_present = os.path.exists(icon_src)
        if icon_present:
            shutil.copy(icon_src, os.path.join(ICONS_OUT, f"Construct_{t}.png"))
        rows.append({
            "type": t, "name": names.get(t, ""),
            "basic": top, "vote_count": total,
            "dist": dist, "unstable": unstable,
            "icon_present": icon_present,
            "reps": [{"seed": s, "map": m, "poi": p, "xy768": [x, y]}
                     for (s, m, p, x, y) in reps],
        })

    order = {"church": 0, "mage": 1, "village": 2, "carriage": 3, "other": 4, "nothing": 5}
    rows.sort(key=lambda r: (order.get(r["basic"], 9), -r["vote_count"]))

    with open(os.path.join(OUT, "building_types.json"), "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)

    def fmt_dist(d):
        return " ".join(f"{k}:{v}" for k, v in sorted(d.items(), key=lambda kv: -kv[1]))

    def fmt_reps(rs):
        return " / ".join(f"{x['seed']}({x['map']}·POI{x['poi']}·{x['xy768'][0]},{x['xy768'][1]})"
                          for x in rs) or "—(无POI匹配样本)"

    md = ["# 基础建筑 type 分类排查清单",
          "",
          f"投票样本：0-319 基础种子 | 投票容差 {VOTE_TOL}px(768) | 共 {len(rows)} 个基础建筑 type",
          "",
          "**⚠ 险胜** = top 与次高票差 ≤2，投票不稳（正是 RW 修复翻转的那类）。",
          "",
          "**核对方法**：看 `icons/Construct_XXXXX.png`（或 `contact_sheet.png` 总览），",
          "用 `代表种子` 号去游戏/源数据核对真实建筑类别，回填正确 basic。",
          "",
          "## 🔴 误报风险组（被投票成地标 church/mage/village/carriage）",
          "",
          "| type | 当前basic | 投票分布 | 险胜 | 代表种子(地形·POI·xy768) |",
          "|------|-----------|----------|------|--------------------------|"]
    for r in rows:
        if r["basic"] not in LANDMARKS:
            continue
        flag = "⚠" if r["unstable"] else ""
        md.append(f"| {r['type']} | **{r['basic']}** | {fmt_dist(r['dist'])} | {flag} | {fmt_reps(r['reps'])} |")

    md += ["", "## 🟡 其他组（被投票成 other/nothing —— 漏报风险低）", "",
           "| type | 当前basic | 投票分布 | 险胜 | 代表种子(地形·POI) |",
           "|------|-----------|----------|------|--------------------|"]
    for r in rows:
        if r["basic"] in LANDMARKS:
            continue
        flag = "⚠" if r["unstable"] else ""
        rs = r["reps"][:2]
        fmt = " / ".join(f"{x['seed']}({x['map']}·POI{x['poi']})" for x in rs) or "—"
        md.append(f"| {r['type']} | {r['basic']} | {fmt_dist(r['dist'])} | {flag} | {fmt} |")

    with open(os.path.join(OUT, "building_types.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(md))

    make_contact_sheet(rows, "contact_sheet_all.png")            # 全部 28 个
    make_contact_sheet([r for r in rows if r["basic"] in LANDMARKS],
                       "contact_sheet.png")                      # 9 个误报风险重点
    n_unstable = sum(1 for r in rows if r["unstable"])
    print(f"基础建筑 type 共 {len(rows)} 个 | 险胜(不稳) {n_unstable} 个")
    for k in ("church", "mage", "village", "carriage", "other", "nothing"):
        n = sum(1 for r in rows if r['basic'] == k)
        if n:
            print(f"  {k}: {n}")
    print(f"输出: {OUT}/building_types.md")


def make_contact_sheet(rows, filename="contact_sheet.png"):
    if not rows:
        return
    CELL, PAD = 180, 12
    cols = 6
    rows_n = (len(rows) + cols - 1) // cols
    W = cols * (CELL + PAD) + PAD
    H = rows_n * (CELL + PAD + 30) + PAD
    sheet = Image.new("RGB", (W, H), (245, 245, 248))
    d = ImageDraw.Draw(sheet)
    f_sub = load_font(14)
    color = {"church": (20, 130, 40), "mage": (30, 90, 220),
             "village": (200, 150, 0), "carriage": (220, 110, 0)}
    for i, r in enumerate(rows):
        cx = PAD + (i % cols) * (CELL + PAD)
        cy = PAD + (i // cols) * (CELL + PAD + 30)
        icon_path = os.path.join(ICONS_OUT, f"Construct_{r['type']}.png")
        if os.path.exists(icon_path):
            try:
                im = Image.open(icon_path).convert("RGBA")
                im.thumbnail((CELL - 8, CELL - 8))
                sheet.paste(im, (cx + (CELL - im.width) // 2,
                                 cy + (CELL - im.height) // 2), im)
            except Exception:
                d.rectangle([cx, cy, cx + CELL, cy + CELL], outline=(200, 200, 200))
        else:
            d.rectangle([cx, cy, cx + CELL, cy + CELL], outline=(200, 200, 200))
        c = color.get(r["basic"], (40, 40, 40))
        d.rectangle([cx, cy + CELL + 2, cx + CELL, cy + CELL + 28], fill=c)
        warn = "⚠" if r["unstable"] else ""
        d.text((cx + 4, cy + CELL + 7), f"{warn}{r['type']}={r['basic']}({r['vote_count']})",
               fill=(255, 255, 255), font=f_sub)
    sheet.save(os.path.join(OUT, filename))


if __name__ == "__main__":
    main()
