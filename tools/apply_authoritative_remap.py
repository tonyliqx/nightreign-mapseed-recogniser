#!/usr/bin/env python3
"""把用户权威 type→basic 分类写入 type_category_icon.json（覆盖投票/boss规则）。

先备份 type_category_icon.json 与 dataset.json 到 /tmp/dlc_backup_v2/，再写入。
_classify_type:370 优先 icon_map，故这些条目覆盖 build_base_type_category 的投票
和 line 239 的 4xxxx→boss 规则。之后跑 integrate_dlc.py 重生成 dataset.json 1000-1199。
"""
import json
import os
import shutil

PROJ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PARAMS = os.path.join(PROJ, "dataset", "dlc-params")
TCI = os.path.join(PARAMS, "type_category_icon.json")
DSJ = os.path.join(PROJ, "dataset", "dataset.json")
BAK = "/tmp/dlc_backup_v2"


def entry(basic, label, icon, adv):
    return {"icon": icon, "adv": adv, "basic": basic,
            "note": f"{label}。用户权威分类 2026-07-09：普通模式 POI 仅村庄/法师塔(含高级)/"
                    f"教堂，其余野外BOSS点位=other（覆盖投票与4xxxx boss规则）"}


def build_auth():
    a = {}
    for i in range(10):
        a[f"4000{i}"] = entry("mage", "法师塔", "rise", "minorBase")
        a[f"4090{i}"] = entry("mage", "高级法师塔（与法师塔共享点位）", "rise", "minorBase")
    for t in ("41000", "41001", "41010", "41011"):
        a[t] = entry("church", "教堂", "church", "minorBase")
    a["37900"] = entry("village", "村庄", "ruin_blank", "minorBase")
    for t in ("30000", "30001", "30300", "30301"):
        a[t] = entry("other", "小型要塞（野外BOSS点位）", "fort_blank", "minorBase")
    for t in ("32000", "32001", "32100", "32101", "32102", "32200", "32201"):
        a[t] = entry("other", "大型营地（野外BOSS点位）", "camp_blank", "minorBase")
    for t in ("34000", "34001", "34002", "34003", "34100", "34101", "34102",
              "34103", "34104", "34200", "34300"):
        a[t] = entry("other", "大型遗迹（野外BOSS点位）", "ruin_blank", "minorBase")
    for t in ("38000", "38001", "38100", "38101"):
        a[t] = entry("other", "大教堂（野外BOSS点位）", "cathedral_blank", "majorBase")
    a["21400"] = entry("other", "红点（特殊事件位置标记，非建筑）", "event", "minorBase")
    return a


def main():
    os.makedirs(BAK, exist_ok=True)
    shutil.copy(TCI, os.path.join(BAK, "type_category_icon.json.bak"))
    shutil.copy(DSJ, os.path.join(BAK, "dataset.json.bak"))
    print(f"✅ 备份 → {BAK}/")

    d = json.load(open(TCI, encoding="utf-8"))
    auth = build_auth()
    n_before = len(d)
    d.update(auth)
    d_sorted = {k: d[k] for k in sorted(d, key=lambda x: int(x) if x.isdigit() else 0)}
    json.dump(d_sorted, open(TCI, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"✅ 写入 {len(auth)} 条权威映射（新增 {len(d_sorted) - n_before}），总计 {len(d_sorted)} 条")

    from collections import Counter
    c = Counter(v["basic"] for v in auth.values())
    print("   权威映射 basic 分布:", dict(c))


if __name__ == "__main__":
    main()
