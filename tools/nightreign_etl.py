# tools/nightreign_etl.py
from collections import namedtuple
import csv
import pandas as pd

SPECIAL_TO_MAP = {0:"Default",1:"Mountaintop",2:"Crater",3:"Rotted Woods",4:"Great Hollow",5:"Noklateo"}
NIGHTLORD_TO_KEY = {0:"Gladius",1:"Adel",2:"Gnoster",3:"Maris",4:"Libra",5:"Fulghor",6:"Caligo",7:"Heolstor",8:"Harmonia",9:"Straghess"}

# 大空洞地下建筑 coord 集合（渲染层偏移，ETL 显示坐标需同步偏移以对齐 background_4）
K = 1536/4775
VOID_UNDERGROUND_COORDS = {1160,1159,1107,1110,1153,1175,1174,1213}
VOID_UNDERGROUND_OFFSET = (862*K, 355*K)  # ≈(277.3, 114.2)

SourceBundle = namedtuple("SourceBundle", ["patterns","coords","construct","names"])

def load_source(vendor_dir):
    patterns = pd.read_csv(f"{vendor_dir}/MAP_PATTERN.csv")
    coord_df = pd.read_csv(f"{vendor_dir}/坐标.csv")
    coords = {int(r.ID): (float(r.picX), float(r.picY)) for r in coord_df.itertuples()}
    construct = pd.read_csv(f"{vendor_dir}/CONSTRUCT.csv")
    names = {}
    with open(f"{vendor_dir}/NAME.csv", encoding="utf-8") as f:
        for row in csv.reader(f):
            if row and row[0].strip():
                names[int(row[0])] = row[1]
    return SourceBundle(patterns, coords, construct, names)

EVERGAOL_COORDS = set(range(601,608)) | set(range(2601,2608))
ROTTED_WOODS_TYPES = set()  # Task 1.1 校对后填入腐败森林独有 boss 的 type 集合

def apply_void_offset(coord_index, pic_xy):
    x, y = pic_xy
    if coord_index in VOID_UNDERGROUND_COORDS:
        dx, dy = VOID_UNDERGROUND_OFFSET
        return (x + dx, y + dy)
    return (x, y)

def to768(pic_xy):
    return (pic_xy[0]/2.0, pic_xy[1]/2.0)

def category_of(type_id, coord_index, type_map, names):
    if coord_index in EVERGAOL_COORDS:
        return "evergaol"
    t = type_map.get(str(type_id))
    if t:
        if str(type_id) in {str(x) for x in ROTTED_WOODS_TYPES}:
            return "rottedWoods"
        return t["advCategory"]
    # 兜底规则
    s = str(type_id)
    if s in ("49410","49420","49430"): return "majorBase"
    if s[:2] in ("45","46","47","52","53"): return "fieldBoss"
    return "minorBase"

def basic_class_of(type_id, type_map, names):
    t = type_map.get(str(type_id))
    if t:
        return t["basicClass"]
    n = names.get(type_id, "")
    if "教堂" in n: return "church"
    if "法师塔" in n: return "mage"
    if "村庄" in n or "村落" in n: return "village"
    if "马车" in n: return "carriage"
    return "other"
