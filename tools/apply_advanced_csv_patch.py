#!/usr/bin/env python3
"""把 advanced_csv_patch.json 的 DLC 行数据合并进 nightreignMapPatterns.csv。
- 填充 DLC 行(1000-1199)的 POI 槽位（按类别×地名）。
- mapType 纠正（改 'Shifting Earth' 列）。
幂等：以 CSV 第1行表头为准，重写 DLC 行的 POI 列。"""
import csv, json, os

PROJ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(PROJ, "dataset", "nightreignMapPatterns.csv")
PATCH_PATH = os.path.join(PROJ, "dataset", "dlc-params", "advanced_csv_patch.json")

CATEGORY_TO_HEADER = {"major_base": "Major Base", "minor_base": "Minor Base",
                      "evergaol": "Evergaol", "field_boss": "Field Boss"}

def _append_column(rows, h1_val, h2_val):
    """在两行表头与全部数据行末尾追加一列，返回新列索引。"""
    new_c = len(rows[0])
    rows[0].append(h1_val)
    rows[1].append(h2_val)
    for r in rows[2:]:
        r.append("")
    return new_c


def main():
    with open(PATCH_PATH, encoding="utf-8") as f:
        patch = json.load(f)
    with open(CSV_PATH, encoding="utf-8") as f:
        rows = list(csv.reader(f))
    header1, header2 = rows[0], rows[1]

    # 行宽归一化：DLC 行（如 1000）当前可能只有少量字段，需补齐到表头宽度，否则追加列会错位
    width = len(header1)
    for r in rows:
        while len(r) < width:
            r.append("")

    # 预清理：删除所有旧 Great Hollow 槽位列，幂等重建。
    # 候选点数变化时（如 41→26），旧列与旧值若残留会被 convert 解析成无效 POI。
    gh_cols = [c for c in range(min(len(header2), width))
               if header2[c].strip().startswith("greatHollow_")]
    for c in reversed(gh_cols):
        for r in rows:
            if c < len(r):
                del r[c]
    if gh_cols:
        print(f"清理旧 GH 槽位列：{len(gh_cols)}")
    header1, header2 = rows[0], rows[1]
    width = len(header1)

    # 建 (header1, header2_location) → col_index 索引
    col_idx = {}
    for c in range(width):
        h1 = header1[c].strip()
        h2 = header2[c].strip() if c < len(header2) else ""
        if h1 in CATEGORY_TO_HEADER.values() and h2:
            col_idx[(h1, h2)] = c

    # 收集 patch 涉及的全部 (category, location) 槽位
    needed = set()
    for r in patch["rows"].values():
        for cat, header in CATEGORY_TO_HEADER.items():
            for loc in r.get(cat, {}):
                needed.add((header, loc))

    # 缺失的槽位追加新列（两行表头同步扩展）
    added = 0
    for (header, loc) in sorted(needed):
        if (header, loc) not in col_idx:
            col_idx[(header, loc)] = _append_column(rows, header, loc)
            added += 1
    print(f"新增槽位列：{added}")

    # 定位 Shifting Earth / Nightlord 列
    def find_col(name):
        for c in range(len(rows[0])):
            if rows[0][c].strip() == name:
                return c
        return None
    c_maptype = find_col("Shifting Earth")
    c_nightlord = find_col("Nightlord")

    # 逐 DLC 行填值（mapType + nightlord + POI 槽位）
    updated = 0
    for r in rows[2:]:
        if not r or not r[0].strip().isdigit():
            continue
        sid = r[0].strip()
        if sid not in patch["rows"]:
            continue
        pr = patch["rows"][sid]
        if c_maptype is not None:
            r[c_maptype] = pr["mapType"]
        if c_nightlord is not None:
            r[c_nightlord] = pr["nightlord"]
        for cat, header in CATEGORY_TO_HEADER.items():
            for loc, val in pr.get(cat, {}).items():
                c = col_idx.get((header, loc))
                if c is not None:
                    r[c] = val
        updated += 1

    with open(CSV_PATH, "w", encoding="utf-8", newline="") as f:
        csv.writer(f).writerows(rows)
    print(f"✅ CSV 更新：{updated} DLC 行")

if __name__ == "__main__":
    main()
