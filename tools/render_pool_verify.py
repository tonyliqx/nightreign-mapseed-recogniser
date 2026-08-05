# tools/render_pool_verify.py
# 池化验证可视化：任务1(757点位+主城关系) + 任务2(6地形×类别 POI池分布)
# PIL 渲染，输出 verify_pool/
import math, os
import pandas as pd
from PIL import Image, ImageDraw, ImageFont

V = "vendor/nightreign-data"
OUT = "verify_pool"
os.makedirs(OUT, exist_ok=True)
FONT_PATH = "/System/Library/Fonts/STHeiti Medium.ttc"
TERRAIN = {0: "Default 默认", 1: "Mountaintop 山顶", 2: "Crater 火山口",
           3: "Rotted Woods 腐败森林", 4: "Great Hollow 大空洞", 5: "Noklateo 诺克史黛拉"}

coord = pd.read_csv(f"{V}/坐标.csv")
con = pd.read_csv(f"{V}/CONSTRUCT.csv")
con["coord_index"] = con["Unnamed: 4"]  # 真坐标ID；coord_index 与坐标表在 108/307、116/313(含+2000)4对上互换
mp = pd.read_csv(f"{V}/MAP_PATTERN.csv")
names = pd.read_excel(f"{V}/NAME.xlsx", sheet_name="NAME")
M = coord.set_index("ID")
nm = dict(zip(names["ID"], names["中文名"]))
raw_cat = dict(zip(names["ID"], names["类别"]))


def font(sz):
    return ImageFont.truetype(FONT_PATH, sz)


def norm_cat(c):
    if pd.isna(c):
        return None
    s = str(c)
    if "共享点位" in s:
        return "共享点位"
    return s


cat = {k: norm_cat(v) for k, v in raw_cat.items()}

# 类别 → (颜色, 形状, 图例标签)
# 形状: circle / square / star / tri
STYLE = {
    "落地点":   ((225, 50, 50), "star"),
    "主城":     ((130, 30, 70), "square"),
    "共享点位": ((45, 100, 220), "circle"),
    "野外据点": ((40, 170, 80), "tri"),
    "野外BOSS": ((240, 140, 30), "circle"),
    "夜晚BOSS": ((150, 55, 205), "circle"),
    "监牢BOSS": ((30, 185, 200), "circle"),
    "额外事件": ((235, 215, 45), "circle"),
    "特殊事件": ((230, 120, 180), "circle"),
    "特殊地形点位": ((135, 135, 135), "circle"),
    "山羊事件特殊点位": ((150, 95, 45), "circle"),
}
LEGEND_ORDER = ["落地点", "主城", "共享点位", "野外据点", "野外BOSS",
                "夜晚BOSS", "监牢BOSS", "额外事件", "特殊事件", "特殊地形点位", "山羊事件特殊点位"]

# 优先级：冲突 coord（极少）取靠前类别
PRIORITY = {c: i for i, c in enumerate(LEGEND_ORDER)}


def pic(ci):
    if ci not in M.index:
        return None
    r = M.loc[ci]
    return float(r.picX), float(r.picY)


def star_pts(cx, cy, r):
    pts = []
    for i in range(10):
        ang = -math.pi / 2 + i * math.pi / 5
        rr = r if i % 2 == 0 else r * 0.42
        pts.append((cx + rr * math.cos(ang), cy + rr * math.sin(ang)))
    return pts


def tri_pts(cx, cy, r):
    return [(cx, cy - r), (cx - r * 0.9, cy + r * 0.7), (cx + r * 0.9, cy + r * 0.7)]


def draw_marker(dr, x, y, cat_name, r=9):
    if cat_name not in STYLE:
        return
    col, sh = STYLE[cat_name]
    if sh == "circle":
        dr.ellipse([x - r, y - r, x + r, y + r], fill=col, outline=(255, 255, 255), width=2)
    elif sh == "square":
        dr.rectangle([x - r, y - r, x + r, y + r], fill=col, outline=(255, 255, 255), width=2)
    elif sh == "tri":
        dr.polygon(tri_pts(x, y, r + 2), fill=col, outline=(255, 255, 255))
    elif sh == "star":
        dr.polygon(star_pts(x, y, r + 4), fill=col, outline=(255, 255, 255))


def pick_cat(cats):
    """coord 上多类别时按优先级选；nan 过滤"""
    cs = [c for c in cats if c]
    if not cs:
        return None
    return min(cs, key=lambda c: PRIORITY.get(c, 99))


def draw_legend(bg, used):
    x0, y0 = bg.width - 360, 30
    h = 42 * len(used) + 24
    overlay = Image.new("RGBA", bg.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rectangle([x0, y0, bg.width - 20, y0 + h], fill=(255, 255, 255, 215), outline=(0, 0, 0, 230), width=2)
    od.text((x0 + 16, y0 + 8), "图例", font=font(26), fill=(0, 0, 0, 255))
    for i, c in enumerate(used):
        yy = y0 + 44 + i * 42
        col, sh = STYLE[c]
        cx = x0 + 30
        if sh == "circle":
            od.ellipse([cx - 12, yy - 12, cx + 12, yy + 12], fill=col + (255,), outline=(0, 0, 0, 200))
        elif sh == "square":
            od.rectangle([cx - 12, yy - 12, cx + 12, yy + 12], fill=col + (255,), outline=(0, 0, 0, 200))
        elif sh == "tri":
            od.polygon([(cx, yy - 13), (cx - 12, yy + 10), (cx + 12, yy + 10)], fill=col + (255,), outline=(0, 0, 0, 200))
        elif sh == "star":
            od.polygon(star_pts(cx, yy, 14), fill=col + (255,), outline=(0, 0, 0, 200))
        od.text((cx + 28, yy - 14), c, font=font(24), fill=(0, 0, 0, 255))
    bg.paste(overlay, mask=overlay)


def draw_title(bg, title):
    dr = ImageDraw.Draw(bg)
    dr.rectangle([0, 0, bg.width, 60], fill=(0, 0, 0, 0))
    overlay = Image.new("RGBA", bg.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rectangle([20, 18, 20 + od.textlength(title, font=font(34)) + 40, 64], fill=(255, 255, 255, 210))
    od.text((40, 22), title, font=font(34), fill=(20, 20, 20, 255))
    bg.paste(overlay, mask=overlay)


# ============ 任务1：757 点位 + 主城关系 ============
def task1():
    bg = Image.open(f"{V}/素材/background_0.png").convert("RGB")
    dr = ImageDraw.Draw(bg, "RGBA")
    bosses = ["黑刀刺客", "红狼", "狮子混种", "铃珠猎人", "王室幽魂", "接肢贵族", "萨米尔"]

    # 三个主城点位（参考）
    cities = [(190, "主城190\n失乡/山妖/熔炉城"), (1141, "主城1141\n梅瑟莫/神皮城"), (1135, "主城1135\n尊腐/神兽城")]
    for ci, label in cities:
        p = pic(ci)
        if not p:
            continue
        x, y = p
        dr.rectangle([x - 16, y - 16, x + 16, y + 16], outline=(130, 30, 70, 255), width=4)

    # 757 大红圆
    p = pic(757); x, y = p
    dr.ellipse([x - 22, y - 22, x + 22, y + 22], fill=(225, 50, 50, 255), outline=(255, 255, 255, 255), width=4)
    # 190 框已画，与757重叠 → 拉引线标注
    dr.line([x, y, x + 120, y - 90], fill=(0, 0, 0, 200), width=2)
    dr.text((x + 124, y - 130), "coord 757 / 2757", font=font(30), fill=(225, 50, 50, 255))
    dr.text((x + 124, y - 92), "夜游BOSS池(7个轮换)", font=font(26), fill=(225, 50, 50, 255))

    # 主城标注
    for ci, label in cities:
        p = pic(ci)
        if not p:
            continue
        cx, cy = p
        dr.text((cx + 22, cy + 18), label.replace("\n", " "), font=font(22), fill=(130, 30, 70, 255))

    # 757 vs 190 距离说明
    p190 = pic(190)
    info = (f"757(735,832) 与 主城190(730,832)：X差5px / Y相同 → 同一点位\n"
            f"即「主城地下室」位置，7个夜游BOSS在此轮换：\n" + " · ".join(bosses))
    # 信息框左下
    x0, y0 = 30, bg.height - 150
    od = ImageDraw.Draw(bg, "RGBA")
    od.rectangle([x0, y0, x0 + 760, y0 + 120], fill=(255, 255, 255, 225), outline=(225, 50, 50, 255), width=3)
    for i, line in enumerate(info.split("\n")):
        od.text((x0 + 16, y0 + 12 + i * 30), line, font=font(22), fill=(20, 20, 20, 255))

    draw_title(bg, "任务1：coord 757 = 主城地下室夜游BOSS点位（Default 地形）")
    bg.save(f"{OUT}/task1_coord757_主城关系.png", quality=92)
    print("任务1 →", f"{OUT}/task1_coord757_主城关系.png")


# ============ 任务2：6 地形 × 类别 POI 池分布 ============
def task2():
    seed_terr = dict(zip(mp["ID"], mp["Special"]))
    d = con[con["is_display"] == 1].copy()
    d["terr"] = d["MAP"].map(seed_terr)

    for t in range(6):
        bg = Image.open(f"{V}/素材/background_{t}.png").convert("RGB")
        dr = ImageDraw.Draw(bg, "RGBA")
        sub = d[d["terr"] == t]

        # coord → 类别集合
        coord_cats = {}
        for r in sub.itertuples():
            c = cat.get(int(r.type))
            coord_cats.setdefault(int(r.coord_index), set()).add(c)

        used = set()
        n_poi = 0
        for ci, cs in coord_cats.items():
            p = pic(ci)
            if not p:
                continue
            c = pick_cat(cs)
            if not c:
                continue
            draw_marker(dr, p[0], p[1], c)
            used.add(c)
            n_poi += 1

        # 落地点池
        spawns = sorted(set(int(x) for x in mp[mp["Special"] == t]["Start_190"] if pd.notna(x)))
        n_spawn = 0
        unmapped = []
        for ci in spawns:
            p = pic(ci)
            if not p:
                unmapped.append(ci)
                continue
            draw_marker(dr, p[0], p[1], "落地点", r=11)
            n_spawn += 1
        if n_spawn:
            used.add("落地点")
        # 地下地形：落地点为独立编号（如大空洞 13000-13002），无 picX/picY 投影 → 说明框
        if unmapped:
            note = (f"⚠ 该地形落地点 {unmapped} 为地下独立坐标编号，\n"
                    f"未登记 picX/picY，无法投影到主地图底图。")
            y0n = bg.height - 110
            od2 = ImageDraw.Draw(bg, "RGBA")
            od2.rectangle([30, y0n, 780, y0n + 84], fill=(255, 250, 230, 225), outline=(200, 120, 30, 255), width=3)
            for i, line in enumerate(note.split("\n")):
                od2.text((46, y0n + 14 + i * 30), line, font=font(22), fill=(120, 70, 10, 255))

        used_ordered = [c for c in LEGEND_ORDER if c in used]
        draw_legend(bg, used_ordered)
        draw_title(bg, f"任务2：{TERRAIN[t]} — POI 池分布（POI {n_poi} / 落地点 {n_spawn}）")
        bg.save(f"{OUT}/task2_terrain{t}_{TERRAIN[t].split()[0].lower()}.png", quality=92)
        print(f"任务2 地形{t} → task2_terrain{t}_*.png  (POI={n_poi}, spawn={n_spawn}, 类别={used_ordered})")


if __name__ == "__main__":
    task1()
    task2()
    print("\n全部输出于", OUT + "/")
