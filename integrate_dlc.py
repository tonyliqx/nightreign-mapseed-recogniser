#!/usr/bin/env python3
"""DLC「被遗忘的空洞」统一集成生成器。
读源 4 张 CSV，经坐标变换/类目映射/mapType 纠正，产出高级版与基础版 DLC 数据。
设计文档：docs/superpowers/specs/2026-07-06-dlc-forsaken-hollows-integration-design.md"""
import csv, json, os
from typing import Dict, List, Tuple, Any

# === 常量 ===
PROJ_DIR = os.path.dirname(os.path.abspath(__file__))
PARAMS_DIR = os.path.join(PROJ_DIR, "dataset", "dlc-params")
SRC_DEFAULT = "/Users/lixiang/Documents/AI_code/Nightreign-maps-including-dlc-v0.3.3-main"
DLC_SEED_RANGE = range(1000, 1200)  # 200 条 DLC 种子
SPECIAL_TO_MAP = {0: "Default", 1: "Mountaintop", 2: "Crater",
                  3: "Rotted Woods", 4: "Great Hollow", 5: "Noklateo"}
SCALE_1536 = 1536 / 4775   # 高级版坐标空间
SCALE_768 = 768 / 4775     # 基础版坐标空间


def _read_csv_rows(path: str) -> List[List[str]]:
    with open(path, "r", encoding="utf-8") as f:
        return list(csv.reader(f))


def read_source_data(src_dir: str = SRC_DEFAULT) -> Dict[str, Any]:
    """读源 4 张 CSV → 结构化 dict。"""
    # MAP_PATTERN.csv: ID,NightLord,Special,Start_190,...,Day1Boss,Day1Loc,Day2Boss,Day2Loc
    patterns = {}
    for row in _read_csv_rows(os.path.join(src_dir, "MAP_PATTERN.csv"))[1:]:
        if not row or not row[0] or not row[0].strip().isdigit():
            continue
        sid = row[0].strip()
        patterns[sid] = {
            "nightlord": int(row[1]) if len(row) > 1 and row[1].strip().lstrip("-").isdigit() else 0,
            "special": int(row[2]) if len(row) > 2 and row[2].strip().isdigit() else 0,
            "start": row[3].strip() if len(row) > 3 else "",
            "day1_boss": row[10].strip() if len(row) > 10 else "",
            "day1_loc": row[11].strip() if len(row) > 11 else "",
            "day2_boss": row[12].strip() if len(row) > 12 else "",
            "day2_loc": row[13].strip() if len(row) > 13 else "",
        }

    # CONSTRUCT.csv: ID,MAP(=种子ID),type,is_display,_,coord_index,...
    constructs: Dict[str, List[Dict]] = {}
    for row in _read_csv_rows(os.path.join(src_dir, "CONSTRUCT.csv"))[1:]:
        if not row or len(row) < 6 or not row[1].strip().isdigit():
            continue
        sid = row[1].strip()
        ci = row[5].strip()
        if not ci:
            continue
        constructs.setdefault(sid, []).append(
            {"type": row[2].strip(), "coord_index": ci,
             "is_display": row[3].strip() == "1"})

    # 坐标.csv: ID,Name,...,picX,picY
    coords: Dict[str, Tuple[float, float]] = {}
    for row in _read_csv_rows(os.path.join(src_dir, "坐标.csv"))[1:]:
        if not row or len(row) < 9 or not row[0].strip():
            continue
        try:
            px, py = float(row[7]), float(row[8])
        except (ValueError, IndexError):
            continue
        if px > 0 or py > 0:  # 跳过 (0,0) 占位
            coords[row[0].strip()] = (px, py)

    # NAME.csv: ID,中文名(,英文名)
    names: Dict[str, str] = {}
    for row in _read_csv_rows(os.path.join(src_dir, "NAME.csv")):
        if not row or len(row) < 2 or not row[0].strip():
            continue
        names[row[0].strip()] = row[1].strip()

    return {"patterns": patterns, "constructs": constructs,
            "coords": coords, "names": names}


def main():
    pass  # 后续任务补全


if __name__ == "__main__":
    main()
