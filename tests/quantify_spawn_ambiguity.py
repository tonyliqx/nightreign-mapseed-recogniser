"""量化基础版出生点指认对种子歧义性的改善（一次性 dev 工具）。

对比"仅地标"vs"地标+出生点"两种筛选下，每种种地层组合的共享种子数分布。
方法：对每地图，按 (地标分类签名) 分组种子，看最大共享组；再按 (签名 + Start_190)
分组，看改善。

运行：python3 tests/quantify_spawn_ambiguity.py
"""
import os, sys, collections
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from integrate_dlc import read_source_data, SPECIAL_TO_MAP


def landmark_signature(constructs):
    """地地标签名：该种子显示建筑的 type 集合（粗粒度，仅用于量化趋势）。"""
    return tuple(sorted(c["type"] for c in constructs if c.get("is_display")))


def main():
    src = read_source_data()
    by_map = collections.defaultdict(list)  # {map: [(sid, landmark_sig, start)]}
    for sid, pat in src["patterns"].items():
        mt = SPECIAL_TO_MAP.get(pat["special"], "Default")
        cons = src["constructs"].get(sid, [])
        by_map[mt].append((sid, landmark_signature(cons), pat.get("start", "").strip()))

    print(f"{'地图':<14}{'种子数':>6}{'仅地标最大共享':>14}{'加spawn最大共享':>16}{'唯一性%':>10}")
    for mt in SPECIAL_TO_MAP.values():
        rows = by_map.get(mt, [])
        if not rows:
            continue
        # 仅地标
        lm_groups = collections.defaultdict(int)
        for _, sig, _ in rows:
            lm_groups[sig] += 1
        lm_max = max(lm_groups.values())
        # 地标 + spawn
        sp_groups = collections.defaultdict(int)
        for _, sig, start in rows:
            sp_groups[(sig, start)] += 1
        sp_max = max(sp_groups.values())
        uniq = sum(1 for v in sp_groups.values() if v == 1) / len(rows) * 100
        print(f"{mt:<14}{len(rows):>6}{lm_max:>14}{sp_max:>16}{uniq:>9.1f}%")


if __name__ == "__main__":
    main()
