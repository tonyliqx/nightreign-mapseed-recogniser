#!/usr/bin/env python3
"""评估"用权威 type→basic 映射覆盖投票/boss规则"对基础版 1000-1199 分类的影响。

背景（用户 2026-07-09 权威确认）：
  普通模式 POI 只有 村庄/法师塔(含高级)/教堂，其余全是野外 BOSS 点位。
  - 法师塔 40000-40009 / 高级法师塔 40900-40909 → mage
  - 教堂 41000,41001,41010,41011 → church
  - 村庄 37900 → village
  - 小型要塞30xxx / 大型营地32xxx / 大型遗迹34xxx / 大教堂38xxx → other（BOSS点位）
  - 21400 红点(特殊事件) → other
当前代码 build_base_type_category:239 把 40000-49999 一刀切当 boss → 真 mage/church 被丢；
投票把 38xxx/32xxx/34xxx 误投成 church/mage。本脚本量化修正后的翻转。

纯只读评估，不改任何文件。
"""
import os
import sys
import json
from collections import defaultdict, Counter

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import integrate_dlc as M

PROJ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def authoritive_map():
    """用户权威 type→basic。32100 用户营地列表未列，先按 other（与当前投票一致）。"""
    m = {}
    for i in range(10):
        m[f"4000{i}"] = "mage"          # 法师塔
        m[f"4090{i}"] = "mage"          # 高级法师塔（共享点位）
    for t in ("41000", "41001", "41010", "41011"):
        m[t] = "church"                 # 教堂
    m["37900"] = "village"              # 村庄
    # 野外 BOSS 点位 → other
    for t in ("30000", "30001", "30300", "30301"):           # 小型要塞
        m[t] = "other"
    for t in ("32000", "32001", "32100", "32101", "32102", "32200", "32201"):  # 大型营地
        m[t] = "other"
    for t in ("34000", "34001", "34002", "34003", "34100", "34101", "34102",
              "34103", "34104", "34200", "34300"):           # 大型遗迹
        m[t] = "other"
    for t in ("38000", "38001", "38100", "38101"):           # 大教堂
        m[t] = "other"
    m["21400"] = "other"               # 红点（特殊事件，非建筑）
    return m


def build_fixed_icon_map(icon_map, auth):
    """把权威 basic 合入 icon_map（保留 adv/icon 合理值），_classify_type 优先用它。"""
    adv_of = {"mage": "minorBase", "church": "majorBase", "village": "minorBase", "other": "minorBase"}
    icon_of = {"mage": "sage_tower", "church": "church", "village": "village", "other": "ruin_blank"}
    fixed = dict(icon_map)
    for t, basic in auth.items():
        fixed[t] = {"icon": icon_of[basic], "adv": adv_of[basic], "basic": basic,
                    "note": "用户权威分类 2026-07-09"}
    return fixed


def main():
    source = M.read_source_data(M.SRC_DEFAULT)
    icon_map = M.load_type_category_icon()
    auth = authoritive_map()
    fixed = build_fixed_icon_map(icon_map, auth)

    # 当前 dataset.json 的 1000-1199 分类
    cur_all = json.load(open(os.path.join(PROJ, "dataset", "dataset.json"), encoding="utf-8"))["classifications"]
    cur = {sid: cls for sid, cls in cur_all.items() if sid.isdigit() and 1000 <= int(sid) <= 1199}

    # 修正后重算
    new = M.build_basic_classifications(source, icon_map=fixed)

    # 对比
    changed_seeds = []
    flip_counter = Counter()        # (old,new) → count
    type_flip = Counter()           # 哪个 type 触发了翻转（取该 POI 上的 construct type）
    by_terrain = defaultdict(lambda: [0, 0])  # maptype → [变化种子数, 总种子数]

    for sid, new_cls in new.items():
        old_cls = cur.get(sid, {})
        pat = source["patterns"].get(sid.lstrip("0") or "0")
        maptype = M.SPECIAL_TO_MAP.get(pat["special"], "Default") if pat else "?"
        by_terrain[maptype][1] += 1
        diff = False
        for poi, nb in new_cls.items():
            ob = old_cls.get(poi, "nothing")
            if ob != nb:
                diff = True
                flip_counter[(ob, nb)] += 1
        if diff:
            changed_seeds.append(sid)
            by_terrain[maptype][0] += 1

    print(f"DLC 1000-1199 共 {len(new)} 个种子 | 当前 dataset.json 有 {len(cur)} 个")
    print(f"分类变化种子数: {len(changed_seeds)} / {len(new)} "
          f"({100*len(changed_seeds)/max(len(new),1):.0f}%)")
    print("\n=== 翻转方向 (old → new) ===")
    for (ob, nb), n in flip_counter.most_common():
        print(f"  {ob:8} → {nb:8} : {n} 处")
    print("\n=== 按地形 ===")
    for mt, (chg, tot) in sorted(by_terrain.items()):
        print(f"  {mt:<16} {chg}/{tot} 种子变化")
    print("\n=== 变化最大的 10 个种子（示例）===")
    # 重算每个种子的翻转数
    seed_flips = []
    for sid, new_cls in new.items():
        old_cls = cur.get(sid, {})
        nflip = sum(1 for poi, nb in new_cls.items() if old_cls.get(poi, "nothing") != nb)
        if nflip:
            seed_flips.append((nflip, sid))
    seed_flips.sort(reverse=True)
    for nflip, sid in seed_flips[:10]:
        old_cls, new_cls = cur.get(sid, {}), new[sid]
        detail = []
        for poi in sorted(new_cls, key=lambda p: int(p[3:]) if p[3:].isdigit() else 0):
            ob, nb = old_cls.get(poi, "nothing"), new_cls[poi]
            if ob != nb:
                detail.append(f"{poi}:{ob}→{nb}")
        print(f"  种子 {sid} ({nflip}处): {' '.join(detail)}")


if __name__ == "__main__":
    main()
