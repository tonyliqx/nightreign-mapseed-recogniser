#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""重生成 boss-reverse.html 内联 DATA.combos 为「全量组合」。

旧 combos 只保留能唯一反推夜王的 day1+day2 组合（90/116），
导致歧义组合（如 唤声船+双神皮 → 山羊/冰龙）从夜2选项里消失。

本脚本从外部 MAP_PATTERN.csv 统计【全部】day1+day2 组合，每条记录
所对应的全部夜王及种子数：
    "4770_4880": {"lords":[{"id":6,"count":2},{"id":4,"count":1}],"seeds":3}
然后用花括号配平定位 HTML 中 "combos":{...} 整体并替换（不动其余 DATA）。

- 一次性幂等：重跑结果一致。
- 写盘前断言：恰好 1 处 "combos":、花括号配平、JSON 可解析。
- 依赖外部目录 /Users/lixiang/Documents/AI_code/Nightreign-maps-including-dlc-v0.3.3-main。
"""
import csv
import json
import sys
from collections import Counter
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
HTML = REPO_ROOT / "boss-reverse.html"
EXT = Path("/Users/lixiang/Documents/AI_code/Nightreign-maps-including-dlc-v0.3.3-main")
MAP_PATTERN = EXT / "MAP_PATTERN.csv"


def build_combos():
    """{ (d1,d2): Counter({lord: count}) } —— 全量组合。"""
    combos = {}
    with open(MAP_PATTERN, encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            d1 = (r.get("Day1Boss") or "").strip()
            d2 = (r.get("Day2Boss") or "").strip()
            lord = (r.get("NightLord") or "").strip()
            if not (d1 and d2 and lord):
                continue
            try:
                lord_i = int(lord)
            except ValueError:
                continue
            combos.setdefault((d1, d2), Counter())[lord_i] += 1
    return combos


def serialize(combos):
    """转成紧凑 JSON，lords 按 count 降序。"""
    out = {}
    for (d1, d2), counts in combos.items():
        lords = [{"id": lid, "count": c} for lid, c in counts.most_common()]
        out[f"{d1}_{d2}"] = {"lords": lords, "seeds": sum(counts.values())}
    return json.dumps(out, separators=(",", ":"), ensure_ascii=False)


def patch_html(new_combos_json):
    html = HTML.read_text(encoding="utf-8")
    assert html.count('"combos":') == 1, '"combos": 出现次数 ≠ 1，拒绝改写'

    key = '"combos":'
    start = html.find(key) + len(key)
    assert html[start] == "{", f'"combos": 后应为 {{，实际 {html[start]!r}'

    # 花括号配平找 combos 对象结束位置（combos 内无字符串嵌套花括号，安全）
    depth = 0
    end = None
    for i in range(start, len(html)):
        c = html[i]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    assert end is not None, "combos 对象花括号未配平"

    old_obj = html[start:end]
    # 解析旧值确认替换的是 combos 对象本身
    json.loads(old_obj)

    new_html = html[:start] + new_combos_json + html[end:]
    # 写盘前再校验整体可解析（提取 DATA 对象）
    verify_data_parses(new_html)
    HTML.write_text(new_html, encoding="utf-8")
    return old_obj


def verify_data_parses(html):
    """提取 const DATA = {...}; 并 json.loads 校验。"""
    mark = "const DATA = "
    s = html.find(mark) + len(mark)
    depth = 0
    e = None
    for i in range(s, len(html)):
        c = html[i]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                e = i + 1
                break
    assert e is not None, "DATA 对象花括号未配平"
    json.loads(html[s:e])  # 抛错即中止


def main():
    if not MAP_PATTERN.exists():
        sys.exit(f"外部数据缺失：{MAP_PATTERN}")
    combos = build_combos()
    new_json = serialize(combos)

    n = len(combos)
    multi = sum(1 for c in combos.values() if len(c) > 1)
    print(f"全量组合：{n} 条（其中多夜王歧义 {multi} 条）")

    old = patch_html(new_json)
    old_obj = json.loads(old)
    print(f"旧 combos：{len(old_obj)} 条（已替换）")
    print(f"已写入：{HTML}")
    print("请浏览器打开 boss-reverse.html 验证。")


if __name__ == "__main__":
    main()
