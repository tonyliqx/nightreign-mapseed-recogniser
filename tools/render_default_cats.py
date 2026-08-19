# tools/render_default_cats.py
# Default 地形：按类别分图（每类一张，标注 type中文名+coord）+ 修正落地点图
# 落地点正确源 = 基础版 SPAWN_POINTS_BY_MAP(1536)（历史推导曾用 768×2，1.05 校正已弃用）
import math, os
from collections import defaultdict
import pandas as pd
from PIL import Image, ImageDraw, ImageFont

V = "vendor/nightreign-data"
OUT = "verify_pool/default_cats"
os.makedirs(OUT, exist_ok=True)
FONT_PATH = "/System/Library/Fonts/STHeiti Medium.ttc"

coord = pd.read_csv(f"{V}/坐标.csv")
con = pd.read_csv(f"{V}/CONSTRUCT.csv")
con["coord_index"] = con["Unnamed: 4"]  # 真坐标ID；coord_index 在 108/307、116/313(含+2000)4对上与坐标表互换，须用 Unnamed:4
mp = pd.read_csv(f"{V}/MAP_PATTERN.csv")
names = pd.read_excel(f"{V}/NAME.xlsx", sheet_name="NAME")
M = coord.set_index("ID")
nm = dict(zip(names["ID"], names["中文名"]))


def norm_cat(c):
    if pd.isna(c):
        return None
    s = str(c)
    return "共享点位" if "共享点位" in s else s


cat = {k: norm_cat(v) for k, v in dict(zip(names["ID"], names["类别"])).items()}

# 基础版 SPAWN_POINTS_BY_MAP（data.js，1536 空间）—— 真落地点
SPAWN_1536 = {
    "Default": [
        ("700", 298.8, 1123.0, "出生点①"), ("701", 313.0, 850.8, "出生点②"),
        ("702", 326.8, 559.8, "出生点③"), ("703", 492.8, 564.8, "出生点④"),
        ("704", 881.8, 1266.0, "出生点⑤"), ("705", 754.0, 1015.4, "出生点⑥"),
        ("706", 786.2, 290.4, "出生点⑦"), ("707", 1286.8, 795.4, "出生点⑧"),
        ("708", 1043.6, 556.4, "出生点⑨"),
    ],
    "Mountaintop": [
        ("700", 298.8, 1123.0, "①"), ("701", 313.0, 850.8, "②"), ("704", 881.8, 1266.0, "③"),
        ("705", 754.0, 1015.4, "④"), ("706", 786.2, 290.4, "⑤"), ("707", 1286.8, 795.4, "⑥"),
        ("708", 1043.6, 556.4, "⑦"),
    ],
    "Crater": [
        ("700", 298.8, 1123.0, "①"), ("701", 313.0, 850.8, "②"), ("702", 326.8, 559.8, "③"),
        ("704", 881.8, 1266.0, "④"), ("705", 754.0, 1015.4, "⑤"), ("707", 1286.8, 795.4, "⑥"),
        ("708", 1043.6, 556.4, "⑦"),
    ],
    "Rotted Woods": [
        ("700", 298.8, 1123.0, "①"), ("701", 313.0, 850.8, "②"), ("702", 326.8, 559.8, "③"),
        ("703", 492.8, 564.8, "④"), ("706", 786.2, 290.4, "⑤"), ("708", 1043.6, 556.4, "⑥"),
    ],
    "Noklateo": [
        ("702", 326.8, 559.8, "①"), ("703", 492.8, 564.8, "②"), ("704", 881.8, 1266.0, "③"),
        ("705", 754.0, 1015.4, "④"), ("706", 786.2, 290.4, "⑤"), ("707", 1286.8, 795.4, "⑥"),
        ("708", 1043.6, 556.4, "⑦"),
    ],
}
SPAWN_SCALE = 1  # 数据已 1536 直取（与 generate_poi_maps.py S=1.0 一致）


def font(sz):
    return ImageFont.truetype(FONT_PATH, sz)


def pic(ci):
    if ci not in M.index:
        return None
    r = M.loc[ci]
    return float(r.picX), float(r.picY)


def text_outline(dr, xy, s, f, fill=(15, 15, 15), outline=(255, 255, 255)):
    x, y = xy
    for dx, dy in [(-1, -1), (1, -1), (-1, 1), (1, 1), (0, -1), (0, 1), (-1, 0), (1, 0)]:
        dr.text((x + dx, y + dy), s, font=f, fill=outline)
    dr.text((x, y), s, font=f, fill=fill)


def star_pts(cx, cy, r):
    return [(cx + (r if i % 2 == 0 else r * 0.42) * math.cos(-math.pi / 2 + i * math.pi / 5),
             cy + (r if i % 2 == 0 else r * 0.42) * math.sin(-math.pi / 2 + i * math.pi / 5))
            for i in range(10)]


STYLE = {
    "共享点位": (45, 100, 220), "野外据点": (40, 170, 80), "野外BOSS": (240, 140, 30),
    "夜晚BOSS": (150, 55, 205), "监牢BOSS": (30, 185, 200), "主城": (130, 30, 70),
    "山羊事件特殊点位": (150, 95, 45), "落地点": (225, 50, 50),
}
CATS = ["共享点位", "野外据点", "野外BOSS", "监牢BOSS", "夜晚BOSS", "主城", "山羊事件特殊点位"]


def draw_title(bg, title):
    overlay = Image.new("RGBA", bg.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rectangle([20, 18, 20 + od.textlength(title, font=font(34)) + 40, 64], fill=(255, 255, 255, 215))
    od.text((40, 22), title, font=font(34), fill=(20, 20, 20, 255))
    bg.paste(overlay, mask=overlay)


# ---- Default POI 按类别 ----
seed_terr = dict(zip(mp["ID"], mp["Special"]))
d = con[con["is_display"] == 1].copy()
d["terr"] = d["MAP"].map(seed_terr)
sub = d[d["terr"] == 0]

for cn in CATS:
    coord_types = defaultdict(list)
    for r in sub.itertuples():
        if cat.get(int(r.type)) == cn:
            coord_types[int(r.coord_index)].append(int(r.type))
    if not coord_types:
        print(f"{cn}: Default 无")
        continue
    bg = Image.open(f"{V}/素材/background_0.png").convert("RGB")
    dr = ImageDraw.Draw(bg, "RGBA")
    col = STYLE[cn]
    pts = [(ci, p[0], p[1]) for ci in sorted(coord_types) if (p := pic(ci))]
    groups = defaultdict(list)
    for ci, x, y in pts:
        groups[(round(x, 1), round(y, 1))].append(ci)
    coord_xy = {ci: (x, y) for ci, x, y in pts}
    for (_, _), cis in groups.items():
        x, y = coord_xy[cis[0]]
        dr.ellipse([x - 11, y - 11, x + 11, y + 11], fill=col, outline=(255, 255, 255), width=2)
        # 同坐标多个编号竖向错开
        for i, ci in enumerate(sorted(cis)):
            text_outline(dr, (x + 13, y - 11 + i * 22), f"#{ci}", font(20))
    n_types = len({t for ts in coord_types.values() for t in ts})
    draw_title(bg, f"Default · {cn}（{len(coord_types)}个坐标位 / {n_types}种type）")
    fn = f"{OUT}/default_{cn}.png"
    bg.save(fn, quality=92)
    print(f"{cn}: {len(coord_types)}坐标位, {n_types}type → {fn}")

# ---- 落地点修正图 ----
bg = Image.open(f"{V}/素材/background_0.png").convert("RGB")
dr = ImageDraw.Draw(bg, "RGBA")
# 山羊点对比（坐标.csv 原值，type 49400 的 coord = 700-708）
goat_coords = sorted(set(int(x) for x in sub[sub["type"] == 49400]["coord_index"]))
gpts = [(ci, p[0], p[1]) for ci in goat_coords if (p := pic(ci))]
ggroups = defaultdict(list)
for ci, x, y in gpts:
    ggroups[(round(x, 1), round(y, 1))].append(ci)
gxy = {ci: (x, y) for ci, x, y in gpts}
for (_, _), cis in ggroups.items():
    x, y = gxy[cis[0]]
    dr.ellipse([x - 9, y - 9, x + 9, y + 9], fill=(150, 95, 45), outline=(255, 255, 255), width=2)
    for i, ci in enumerate(sorted(cis)):
        text_outline(dr, (x + 12, y + 8 + i * 20), f"#{ci}", font(18), fill=(110, 60, 20))
# 修正落地点（基础版 ×2 ×1.05）
for val, x1536, y1536, lab in SPAWN_1536["Default"]:
    bx, by = x1536 * SPAWN_SCALE, y1536 * SPAWN_SCALE
    dr.polygon(star_pts(bx, by, 16), fill=(225, 50, 50), outline=(255, 255, 255))
    text_outline(dr, (bx + 16, by - 14), f"#{val}", font(22), fill=(200, 30, 30))
# 说明框
y0 = bg.height - 96
od = ImageDraw.Draw(bg, "RGBA")
od.rectangle([30, y0, 820, y0 + 76], fill=(255, 250, 230, 225), outline=(200, 120, 30, 255), width=3)
od.text((46, y0 + 12), "红★=落地点（基础版SPAWN 1536坐标）", font=font(22), fill=(200, 30, 30, 255))
od.text((46, y0 + 40), "棕●=山羊刷新点（坐标.csv picX/picY，原误用作落地点）", font=font(22), fill=(110, 60, 20, 255))
draw_title(bg, "Default · 落地点修正（红★）vs 山羊点（棕●）")
bg.save(f"{OUT}/default_落地点修正.png", quality=92)
print(f"落地点修正 → {OUT}/default_落地点修正.png  (山羊coord={goat_coords})")
print("\n全部输出于", OUT + "/")
