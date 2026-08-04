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
