#!/usr/bin/env python3
"""为 5 种非大空洞地形生成 POI 点位诊断图。

每地形一张图（1536 背景），叠加：
  - POI 候选点（红圈+编号+坐标）+ 40px 容差圈（768 空间，×2=80px in 1536）
  - 出生点（蓝三角+编号）
  - 该地形所有 DLC 种子（1000-1199）的地标 construct（church/mage/village/carriage），
    按类型着色；区分「被最近 POI 40px 容差捕获」（实心）vs「被丢弃」（红边空心=丢失地标）

用途：定位 1159 类 bug——直观看出哪些地标 construct 因 >40px 容差被丢弃，
导致基础版 dataset.json 分类为 nothing。坐标系 POIS_BY_MAP/SPAWN 为 768，背景图 1536，渲染 ×2。

纯 Python 3 标准库 + Pillow，无第三方依赖（同 integrate_dlc.py / generate_great_hollow_map.py）。
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from PIL import Image, ImageDraw, ImageFont

from integrate_dlc import (
    SRC_DEFAULT, SPECIAL_TO_MAP, _classify_type, build_base_type_category,
    _load_basic_pois_by_map, load_type_category_icon, read_source_data,
    transform_coord_basic,
)

PROJ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(PROJ, "distnr")
S = 2.0  # 768 渲染空间 → 1536 背图层
TOL_PX = 40  # 基础版查询容差（768 空间），见 integrate_dlc.build_basic_classifications

TERRAINS = {
    "Default": "Default-POI.png",
    "Mountaintop": "Mountaintop-POI.png",
    "Crater": "Crater-POI.png",
    "Rotted Woods": "RottedWoods-POI.png",
    "Noklateo": "Noklateo-POI.png",
}

COLORS = {  # basic → (R,G,B)
    "church": (60, 200, 60),
    "mage": (60, 130, 255),
    "village": (255, 205, 0),
    "carriage": (255, 140, 0),
}
TYPE_LABEL = {"church": "教堂", "mage": "法师塔", "village": "村庄", "carriage": "马车"}


def load_font(size):
    for p in ("/System/Library/Fonts/PingFang.ttc",
              "/System/Library/Fonts/STHeiti Medium.ttc",
              "/System/Library/Fonts/Hiragino Sans GB.ttc"):
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()


def load_spawns_by_map():
    """从 data.js 解析 SPAWN_POINTS_BY_MAP：{map: [{value,x,y,label}]}（768 空间）。"""
    txt = open(os.path.join(PROJ, "data.js"), encoding="utf-8").read()
    out = {}
    for m in re.finditer(r'"?([\w ]+)"?\s*:\s*\[(.*?)\]', txt, re.S):
        name, body = m.group(1), m.group(2)
        if name not in TERRAINS:
            continue
        spawns = []
        for pm in re.finditer(
            r'\{\s*value:\s*"(\d+)"\s*,\s*x:\s*([\d.]+)\s*,\s*y:\s*([\d.]+)\s*,'
            r'\s*label:\s*"([^"]*)"\s*\}', body):
            spawns.append({"value": pm.group(1), "x": float(pm.group(2)),
                           "y": float(pm.group(3)), "label": pm.group(4)})
        if spawns:
            out[name] = spawns
    return out


def text_centered(d, xy, text, font, fill):
    cx, cy = xy
    tb = d.textbbox((0, 0), text, font=font)
    w, h = tb[2] - tb[0], tb[3] - tb[1]
    d.text((cx - w / 2, cy - h / 2 - tb[1]), text, fill=fill, font=font)


def main():
    os.makedirs(DIST, exist_ok=True)
    source = read_source_data(SRC_DEFAULT)
    icon_map = load_type_category_icon()
    base_map = build_base_type_category(source)
    pois_by_map = {k: v for k, v in _load_basic_pois_by_map().items() if k in TERRAINS}
    spawns_by_map = load_spawns_by_map()

    font_lg = load_font(26)
    font_md = load_font(20)
    font_sm = load_font(16)
    font_xs = load_font(14)

    print(f"{'地形':<14}{'POI':>5}{'出生':>5}{'教堂':>6}{'法师':>6}{'村庄':>6}{'马车':>6}"
          f"{'丢弃':>6}")
    print("-" * 64)

    for maptype, bgfile in TERRAINS.items():
        bg = Image.open(os.path.join(PROJ, "assets", "images", bgfile)).convert("RGBA")
        overlay = Image.new("RGBA", bg.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(overlay)
        pois = pois_by_map.get(maptype, [])
        spawns = spawns_by_map.get(maptype, [])

        # 1. 40px 容差圈（淡红，最底层）
        for p in pois:
            cx, cy = p["x"] * S, p["y"] * S
            d.ellipse([cx - TOL_PX * S, cy - TOL_PX * S, cx + TOL_PX * S, cy + TOL_PX * S],
                      outline=(255, 80, 80, 70), width=2)

        # 2. 地标 construct 叠加
        counts = {"church": 0, "mage": 0, "village": 0, "carriage": 0}
        lost = {"church": 0, "mage": 0, "village": 0, "carriage": 0}
        for sid, pat in source["patterns"].items():
            if not (1000 <= int(sid) <= 1199):
                continue
            if SPECIAL_TO_MAP.get(pat["special"]) != maptype:
                continue
            for con in source["constructs"].get(sid, []):
                if not con.get("is_display"):
                    continue
                coord = source["coords"].get(con["coord_index"])
                if not coord:
                    continue
                bx, by = transform_coord_basic(coord[0], coord[1], 768)
                c = _classify_type(con["type"], source, icon_map, base_map)
                if c["basic"] not in COLORS:
                    continue
                counts[c["basic"]] += 1
                best_d = min((p["x"] - bx) ** 2 + (p["y"] - by) ** 2 for p in pois) if pois else 1e9
                captured = best_d <= TOL_PX * TOL_PX
                cx, cy = bx * S, by * S
                col = COLORS[c["basic"]]
                if captured:
                    d.ellipse([cx - 5, cy - 5, cx + 5, cy + 5],
                              fill=col + (210,), outline=(255, 255, 255, 160))
                else:
                    lost[c["basic"]] += 1
                    d.ellipse([cx - 7, cy - 7, cx + 7, cy + 7],
                              fill=col + (110,), outline=(255, 40, 40, 255), width=2)

        # 3. POI 候选点（红圈+编号，置于 construct 之上）
        for p in pois:
            cx, cy = p["x"] * S, p["y"] * S
            d.ellipse([cx - 17, cy - 17, cx + 17, cy + 17],
                      fill=(210, 35, 35, 235), outline=(255, 255, 255, 255), width=2)
            text_centered(d, (cx, cy), str(p["id"]), font_lg, (255, 255, 255, 255))
            d.text((cx + 21, cy - 8), f"({p['x']:.0f},{p['y']:.0f})",
                   fill=(255, 255, 210, 255), font=font_xs)

        # 4. 出生点（蓝三角+编号）
        for sp in spawns:
            cx, cy = sp["x"] * S, sp["y"] * S
            d.polygon([(cx, cy - 17), (cx - 15, cy + 11), (cx + 15, cy + 11)],
                      fill=(35, 110, 245, 235), outline=(255, 255, 255, 255))
            num = sp["label"].replace("出生点", "")
            text_centered(d, (cx, cy - 2), num, font_md, (255, 255, 255, 255))

        # 5. 标题 + 图例
        d.text((18, 14), f"{maptype}  POI 点位诊断图（DLC 1000-1199 地标分布）",
               fill=(255, 255, 255, 255), font=font_md)
        d.text((18, 40), f"丢弃地标（红边空心，>{TOL_PX}px 容差外）合计 {sum(lost.values())} 个",
               fill=(255, 150, 150, 255), font=font_sm)

        # 图例（右下）
        lx = bg.size[0] - 300
        ly = bg.size[1] - 200
        d.rectangle([lx - 12, ly - 14, bg.size[0] - 12, bg.size[1] - 12],
                    fill=(0, 0, 0, 160), outline=(255, 255, 255, 120))
        d.text((lx, ly), "图例", fill=(255, 255, 255, 255), font=font_sm)
        ly += 22
        d.ellipse([lx, ly - 7, lx + 14, ly + 7], fill=(210, 35, 35, 235),
                  outline=(255, 255, 255, 255))
        d.text((lx + 22, ly - 8), "POI 候选点（红圈=编号）", fill=(255, 255, 255, 255), font=font_xs)
        ly += 18
        d.polygon([(lx + 7, ly - 8), (lx, ly + 7), (lx + 14, ly + 7)],
                  fill=(35, 110, 245, 235), outline=(255, 255, 255, 255))
        d.text((lx + 22, ly - 8), "出生点（三角=编号）", fill=(255, 255, 255, 255), font=font_xs)
        ly += 18
        d.ellipse([lx, ly - 7, lx + 14, ly + 7], outline=(255, 80, 80, 120), width=2)
        d.text((lx + 22, ly - 8), f"{TOL_PX}px 查询容差圈", fill=(255, 255, 255, 255), font=font_xs)
        ly += 18
        for k in ("church", "mage", "village", "carriage"):
            col = COLORS[k]
            d.ellipse([lx, ly - 5, lx + 10, ly + 5], fill=col + (210,),
                      outline=(255, 255, 255, 160))
            d.ellipse([lx + 16, ly - 6, lx + 28, ly + 6], fill=col + (110,),
                      outline=(255, 40, 40, 255), width=2)
            d.text((lx + 38, ly - 8),
                   f"{TYPE_LABEL[k]} 实心=捕获 / 红边=丢弃",
                   fill=(255, 255, 255, 255), font=font_xs)
            ly += 16

        out = Image.alpha_composite(bg, overlay).convert("RGB")
        outpath = os.path.join(DIST, f"{maptype.replace(' ', '_')}_poi_map.png")
        out.save(outpath)
        print(f"{maptype:<14}{len(pois):>5}{len(spawns):>5}"
              f"{counts['church']:>6}{counts['mage']:>6}{counts['village']:>6}"
              f"{counts['carriage']:>6}{sum(lost.values()):>6}  → {outpath}")


if __name__ == "__main__":
    main()
