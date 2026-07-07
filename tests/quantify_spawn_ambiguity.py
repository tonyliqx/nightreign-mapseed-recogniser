"""量化基础版出生点指认对种子歧义性的改善（一次性 dev 工具）。

对比"仅前端分类地标"vs"地标+出生点"两种筛选下，每地图的共享种子数分布，
精确复现 spec §9（《docs/superpowers/specs/2026-07-07-basic-spawn-point-recognition-design.md》
第 209-216 行）的歧义量化预期：
  - Great Hollow 仅地标 71%（23/80 歧义，最坏 3 共享）→ 加 spawn 95%（最坏 2 共享）
  - 基础地图前端分类多数已唯一，spawn 在多数基础地图无边际改善
    （Rotted Woods 例外：仅地标最大共享 10 → 加 spawn 3）

签名定义：前端分类签名 = tuple(sorted(classifications[str(sid)].items()))，
分类值取自 dataset.json classifications（church/mage/village/other/nothing，
即前端 CV_CLASSIFICATION_DATA 的真实数据源）。两个种子签名相同 = 在前端所有
POI 标记下都无法区分（地标歧义）。种子的地图归属与出生点值仍从
integrate_dlc.read_source_data() 取（patterns[sid].special / .start）。

注意：dataset.json classifications 对种子 0-99 用零填充 3 位键（"000".."099"），
而 patterns 用普通数字键（"0".."99"），二者不匹配——这 100 个种子在前端按
str(sid) 查询 classification 时同样查不到，本脚本如实跳过并报告跳过数（与
前端数据视图一致）。

运行：python3 tests/quantify_spawn_ambiguity.py
"""
import os, sys, json, collections
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from integrate_dlc import read_source_data, SPECIAL_TO_MAP

DATASET_JSON = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "dataset", "dataset.json")

# 表格输出顺序（spec §9 量化目标以 Great Hollow 收尾）
MAP_ORDER = ["Default", "Mountaintop", "Crater", "Rotted Woods", "Noklateo", "Great Hollow"]


def load_classifications():
    """读 dataset.json 的 classifications（前端 CV_CLASSIFICATION_DATA 数据源）。"""
    with open(DATASET_JSON, "r", encoding="utf-8") as f:
        return json.load(f)["classifications"]


def landmark_signature(sid, classifications):
    """前端分类签名：该种子各 POI 槽位→分类的排序元组。

    无分类数据返回 None（调用方跳过并统计）。
    """
    cls = classifications.get(str(sid))
    if cls is None:
        return None
    return tuple(sorted(cls.items()))


def main():
    src = read_source_data()
    classifications = load_classifications()

    by_map = collections.defaultdict(list)  # {map: [(sid, sig, start)]}
    skipped = 0
    for sid, pat in src["patterns"].items():
        mt = SPECIAL_TO_MAP.get(pat["special"], "Default")
        sig = landmark_signature(sid, classifications)
        if sig is None:
            skipped += 1
            continue
        start = pat.get("start", "").strip()
        by_map[mt].append((sid, sig, start))

    print(f"（跳过 {skipped} 个无前端分类数据的种子：dataset.json classifications 对 "
          f"种子 0-99 用零填充 3 位键，patterns 用普通数字键，二者不匹配）")
    print()
    print(f"{'地图':<14}{'种子数':>6}{'仅地标最大共享':>14}{'加spawn最大共享':>16}{'唯一性%':>10}")
    for mt in MAP_ORDER:
        rows = by_map.get(mt, [])
        if not rows:
            continue
        lm_groups = collections.Counter(sig for _, sig, _ in rows)
        sp_groups = collections.Counter((sig, start) for _, sig, start in rows)
        lm_max = max(lm_groups.values())
        sp_max = max(sp_groups.values())
        uniq_pct = sum(1 for c in sp_groups.values() if c == 1) / len(rows) * 100
        print(f"{mt:<14}{len(rows):>6}{lm_max:>14}{sp_max:>16}{uniq_pct:>9.1f}%")

    # Great Hollow 明细（精确复现 spec §9 第 213 行）
    gh = by_map.get("Great Hollow", [])
    if gh:
        lm = collections.Counter(sig for _, sig, _ in gh)
        sp = collections.Counter((sig, start) for _, sig, start in gh)
        lm_amb = sum(c for c in lm.values() if c > 1)        # 处于共享组的种子数
        sp_amb = sum(c for c in sp.values() if c > 1)
        lm_uniq_pct = sum(1 for c in lm.values() if c == 1) / len(gh) * 100
        sp_uniq_pct = sum(1 for c in sp.values() if c == 1) / len(gh) * 100
        print()
        print("Great Hollow 明细（spec §9 第 213 行复现）：")
        print(f"  仅地标   ：{lm_amb}/{len(gh)} 歧义，最大共享 {max(lm.values())}，"
              f"唯一性 {lm_uniq_pct:.1f}%")
        print(f"  加 spawn ：{sp_amb}/{len(gh)} 歧义，最大共享 {max(sp.values())}，"
              f"唯一性 {sp_uniq_pct:.1f}%")


if __name__ == "__main__":
    main()
