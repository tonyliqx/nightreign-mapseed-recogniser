# tools/render_terrain_cats.py
# 6 地形按类别分图（Default 已验证通过，此为泛化版）
# 两处关键修复（与 render_default_cats.py 一致）：
#   1) con["coord_index"] = con["Unnamed: 4"]   —— 真坐标ID（coord_index 在 108/307、116/313 含+2000 共4对上互换）
#   2) SPAWN_SCALE = 2                            —— 落地点取基础版 SPAWN_POINTS_BY_MAP(768) ×2，绝不用坐标.csv 山羊点
import math, os
from collections import defaultdict
import pandas as pd
from PIL import Image, ImageDraw, ImageFont

V = "vendor/nightreign-data"
ROOT_OUT = "verify_pool"
FONT_PATH = "/System/Library/Fonts/STHeiti Medium.ttc"

coord = pd.read_csv(f"{V}/坐标.csv")
con = pd.read_csv(f"{V}/CONSTRUCT.csv")
con["coord_index"] = con["Unnamed: 4"]  # 真坐标ID
mp = pd.read_csv(f"{V}/MAP_PATTERN.csv")
names = pd.read_excel(f"{V}/NAME.xlsx", sheet_name="NAME")
M = coord.set_index("ID")


def norm_cat(c):
    if pd.isna(c):
        return None
    s = str(c)
    if "共享点位" in s:
        return "共享点位"
    # 夜晚BOSS = 大空洞神授塔守塔BOSS(5位type)，其4位同名原型22/22全部在 Day1/Day2
    # 夜晚BOSS池重复出现 → BOSS身份与野外夜晚BOSS重叠，识别器归类为野外BOSS。
    # NAME.xlsx 保留「夜晚BOSS」为数据真相，此处仅做识别器分类合并。
    if s == "夜晚BOSS":
        return "野外BOSS"
    return s


cat = {k: norm_cat(v) for k, v in dict(zip(names["ID"], names["类别"])).items()}

# (terrain_id, 中文名, slug)
TERRAINS = [
    (0, "Default 默认", "default"),
    (1, "Mountaintop 山顶", "mountaintop"),
    (2, "Crater 火山口", "crater"),
    (3, "Rotted Woods 腐败森林", "rotted"),
    (4, "Great Hollow 大空洞", "great_hollow"),
    (5, "Noklateo 诺克史黛拉", "noklateo"),
]

# 基础版 SPAWN_POINTS_BY_MAP（data.js:17568，768 空间）—— 真落地点
SPAWN_768 = {
    "Default 默认": [("700", 149.4, 561.5), ("701", 156.5, 425.4), ("702", 163.4, 279.9),
                     ("703", 246.4, 282.4), ("704", 440.9, 633.0), ("705", 377.0, 507.7),
                     ("706", 393.1, 145.2), ("707", 643.4, 397.7), ("708", 521.8, 278.2)],
    "Mountaintop 山顶": [("700", 149.4, 561.5), ("701", 156.5, 425.4), ("704", 440.9, 633.0),
                        ("705", 377.0, 507.7), ("706", 393.1, 145.2), ("707", 643.4, 397.7),
                        ("708", 521.8, 278.2)],
    "Crater 火山口": [("700", 149.4, 561.5), ("701", 156.5, 425.4), ("702", 163.4, 279.9),
                     ("704", 440.9, 633.0), ("705", 377.0, 507.7), ("707", 643.4, 397.7),
                     ("708", 521.8, 278.2)],
    "Rotted Woods 腐败森林": [("700", 149.4, 561.5), ("701", 156.5, 425.4), ("702", 163.4, 279.9),
                            ("703", 246.4, 282.4), ("706", 393.1, 145.2), ("708", 521.8, 278.2)],
    "Great Hollow 大空洞": [("13000", 91.8, 491.9), ("13001", 261.2, 574.7), ("13002", 442.2, 126.4)],
    "Noklateo 诺克史黛拉": [("702", 163.4, 279.9), ("703", 246.4, 282.4), ("704", 440.9, 633.0),
                          ("705", 377.0, 507.7), ("706", 393.1, 145.2), ("707", 643.4, 397.7),
                          ("708", 521.8, 278.2)],
}
SPAWN_SCALE = 2  # 768→1536（与 generate_poi_maps.py S=2.0 一致；无 5% 缩进校正）

# 大空洞地底错开偏移（源 汉化地图导出.py:85 transform_coord / POI点位标注.py:37）
# 地表/地底物理重叠，地底建筑整体右下偏移到「展示区」与地表错开。坐标.csv 已统一 1536 口径，
# 故非地底点直接用 picX/picY，仅这 8 个 underground coord 加 (862*K, 355*K)。
K = 1536 / 4775  # 4775 设计基准 → 1536
UNDERGROUND = {1160, 1159, 1107, 1110, 1153, 1175, 1174, 1213}

STYLE = {
    "共享点位": (45, 100, 220), "野外据点": (40, 170, 80), "野外BOSS": (240, 140, 30),
    "夜晚BOSS": (150, 55, 205), "监牢BOSS": (30, 185, 200), "主城": (130, 30, 70),
    "山羊事件特殊点位": (150, 95, 45), "大空洞商人": (0, 170, 160),
}
CATS = ["共享点位", "野外据点", "野外BOSS", "监牢BOSS", "夜晚BOSS", "主城", "山羊事件特殊点位", "大空洞商人"]


def font(sz):
    return ImageFont.truetype(FONT_PATH, sz)


def pic(ci, tid=None):
    if ci not in M.index:
        return None
    r = M.loc[ci]
    x, y = float(r.picX), float(r.picY)
    # 大空洞地底层：右下偏移避免与地表重叠
    if tid == 4 and ci in UNDERGROUND:
        x += 862 * K
        y += 355 * K
    return x, y


def text_outline(dr, xy, s, f, fill=(15, 15, 15), outline=(255, 255, 255)):
    x, y = xy
    for dx, dy in [(-1, -1), (1, -1), (-1, 1), (1, 1), (0, -1), (0, 1), (-1, 0), (1, 0)]:
        dr.text((x + dx, y + dy), s, font=f, fill=outline)
    dr.text((x, y), s, font=f, fill=fill)


def star_pts(cx, cy, r):
    return [(cx + (r if i % 2 == 0 else r * 0.42) * math.cos(-math.pi / 2 + i * math.pi / 5),
             cy + (r if i % 2 == 0 else r * 0.42) * math.sin(-math.pi / 2 + i * math.pi / 5))
            for i in range(10)]


def draw_title(bg, title):
    overlay = Image.new("RGBA", bg.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rectangle([20, 18, 20 + od.textlength(title, font=font(34)) + 40, 64], fill=(255, 255, 255, 215))
    od.text((40, 22), title, font=font(34), fill=(20, 20, 20, 255))
    bg.paste(overlay, mask=overlay)


seed_terr = dict(zip(mp["ID"], mp["Special"]))
d = con[con["is_display"] == 1].copy()
d["terr"] = d["MAP"].map(seed_terr)

for tid, tname, slug in TERRAINS:
    OUT = f"{ROOT_OUT}/{slug}_cats"
    os.makedirs(OUT, exist_ok=True)
    sub = d[d["terr"] == tid]
    print(f"\n=== {tname} (terrain {tid}) ===")
    # ---- 类别图 ----
    for cn in CATS:
        coord_types = defaultdict(list)
        for r in sub.itertuples():
            if cat.get(int(r.type)) == cn:
                coord_types[int(r.coord_index)].append(int(r.type))
        if not coord_types:
            print(f"  {cn}: 无")
            continue
        bg = Image.open(f"{V}/素材/background_{tid}.png").convert("RGB")
        dr = ImageDraw.Draw(bg, "RGBA")
        col = STYLE[cn]
        pts = [(ci, p[0], p[1]) for ci in sorted(coord_types) if (p := pic(ci, tid))]
        groups = defaultdict(list)
        for ci, x, y in pts:
            groups[(round(x, 1), round(y, 1))].append(ci)
        coord_xy = {ci: (x, y) for ci, x, y in pts}
        for (_, _), cis in groups.items():
            x, y = coord_xy[cis[0]]
            dr.ellipse([x - 11, y - 11, x + 11, y + 11], fill=col, outline=(255, 255, 255), width=2)
            for i, ci in enumerate(sorted(cis)):
                text_outline(dr, (x + 13, y - 11 + i * 22), f"#{ci}", font(20))
        n_types = len({t for ts in coord_types.values() for t in ts})
        draw_title(bg, f"{tname} · {cn}（{len(coord_types)}坐标位 / {n_types}种type）")
        bg.save(f"{OUT}/{slug}_{cn}.png", quality=92)
        print(f"  {cn}: {len(coord_types)}坐标位 / {n_types}type")
    # ---- 落地点图 ----
    bg = Image.open(f"{V}/素材/background_{tid}.png").convert("RGB")
    dr = ImageDraw.Draw(bg, "RGBA")
    # 棕●山羊点（坐标.csv picX/picY，type 49400）
    goat = sorted(set(int(x) for x in sub[sub["type"] == 49400]["coord_index"]))
    gpts = [(ci, p[0], p[1]) for ci in goat if (p := pic(ci, tid))]
    gg = defaultdict(list)
    for ci, x, y in gpts:
        gg[(round(x, 1), round(y, 1))].append(ci)
    gxy = {ci: (x, y) for ci, x, y in gpts}
    for (_, _), cis in gg.items():
        x, y = gxy[cis[0]]
        dr.ellipse([x - 9, y - 9, x + 9, y + 9], fill=(150, 95, 45), outline=(255, 255, 255), width=2)
        for i, ci in enumerate(sorted(cis)):
            text_outline(dr, (x + 12, y + 8 + i * 20), f"#{ci}", font(18), fill=(110, 60, 20))
    # 红★落地点（基础版 SPAWN 768 ×2）
    for val, x768, y768 in SPAWN_768[tname]:
        bx, by = x768 * SPAWN_SCALE, y768 * SPAWN_SCALE
        dr.polygon(star_pts(bx, by, 16), fill=(225, 50, 50), outline=(255, 255, 255))
        text_outline(dr, (bx + 16, by - 14), f"#{val}", font(22), fill=(200, 30, 30))
    draw_title(bg, f"{tname} · 落地点(红★ 基础版×2) vs 山羊点(棕● 坐标.csv)")
    bg.save(f"{OUT}/{slug}_落地点.png", quality=92)
    print(f"  落地点图: 红★{len(SPAWN_768[tname])} / 棕●山羊{len(goat)}")

print("\n全部输出于", ROOT_OUT + "/")
