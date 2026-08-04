#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 vendor 元数据 + MAP_PATTERN.csv 重算 dataset/boss_data.json。

背景：
  vendor/nightreign-data/boss_data.json 的 nightlords/day1Bosses/day2Bosses 三块
  元数据与旧 boss-reverse.html 内嵌 DATA 字节一致，可直接沿用；但其 combos 是
  较弱的标量形状 {"lord":N,"seeds":N}（90 条、无 count），无法支撑页面现有的
  多夜王歧义 / 占比渲染。本脚本按 spec §6「新源缺字段则 ETL 补齐」从 MAP_PATTERN.csv
  全量重算 combos，输出与旧内嵌 DATA 同形的 {"lords":[{"id","count"}],"seeds":N}。

算法：
  遍历 MAP_PATTERN.csv 每个种子行，key = f"{Day1Boss}_{Day2Boss}"，按夜王 id
  累计种子数；lords 按 (-count, id) 排序（与旧内嵌 DATA 一致）。
  跳过 Day1Boss/Day2Boss 为 -1 或空的行。

幂等：重跑结果一致。只读 vendor/，不修改。
"""
import csv
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VENDOR = ROOT / "vendor" / "nightreign-data"
SRC_JSON = VENDOR / "boss_data.json"
SRC_CSV = VENDOR / "MAP_PATTERN.csv"
OUT = ROOT / "dataset" / "boss_data.json"


def build_combos(map_pattern_csv):
    """返回 { "d1_d2": {"lords":[{"id","count"}], "seeds":N} }。"""
    accum = defaultdict(lambda: defaultdict(int))  # key -> {lord_id: count}
    with open(map_pattern_csv, encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            d1 = (r.get("Day1Boss") or "").strip()
            d2 = (r.get("Day2Boss") or "").strip()
            lord = (r.get("NightLord") or "").strip()
            if not d1 or not d2 or d1 == "-1" or d2 == "-1":
                continue
            try:
                lid = int(lord)
            except ValueError:
                continue
            accum[f"{d1}_{d2}"][lid] += 1

    combos = {}
    for key, counts in accum.items():
        # lords 按 count 降序、id 升序（与旧内嵌 DATA 排序一致）
        lords = [
            {"id": lid, "count": c}
            for lid, c in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
        ]
        combos[key] = {"lords": lords, "seeds": sum(counts.values())}
    return combos


def main():
    meta = json.loads(SRC_JSON.read_text(encoding="utf-8"))
    combos = build_combos(SRC_CSV)

    out = {
        "nightlords": meta["nightlords"],
        "day1Bosses": meta["day1Bosses"],
        "day2Bosses": meta["day2Bosses"],
        "combos": combos,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    multi = sum(1 for c in combos.values() if len(c["lords"]) > 1)
    total_seeds = sum(c["seeds"] for c in combos.values())
    print(
        f"写入 {OUT.relative_to(ROOT)}：nightlords={len(out['nightlords'])} "
        f"day1Bosses={len(out['day1Bosses'])} day2Bosses={len(out['day2Bosses'])} "
        f"combos={len(combos)}（多夜王歧义 {multi} 条）"
    )
    print(f"  seeds 总计 {total_seeds}（期望 520 = MAP_PATTERN 数据行数）")


if __name__ == "__main__":
    main()
