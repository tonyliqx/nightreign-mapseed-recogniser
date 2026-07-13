#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""回填 DLC（种子 1000–1199）前两夜 Boss 的英文全称。

背景：dataset/nightreignMapPatterns.csv 的 200 个 DLC 行里，
`Night 1 Boss` / `Night 2 Boss` 两列全空（生成链 integrate_dlc.py →
apply_advanced_csv_patch.py 只搬运 POI/夜王/地图列，从不写这两列）。
本脚本从外部权威数据源取 boss 数字 id，经内嵌 BOSS_EN_MAP 转英文全称，
仅回填这两列，其余列、行序、CRLF 行尾、UTF-8 编码零改动。

- 一次性幂等：重跑产生相同结果。
- 全部断言在写盘前完成，失败即退出，原文件不受影响。
- 回填后需手动重跑：python convert-csv-to-json.py
"""
import csv
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
TARGET_CSV = REPO_ROOT / "dataset" / "nightreignMapPatterns.csv"
EXTERNAL_MAP = Path(
    "/Users/lixiang/Documents/AI_code/Nightreign-maps-including-dlc-v0.3.3-main/MAP_PATTERN.csv"
)

DLC_MIN, DLC_MAX = 1000, 1199

# Boss 数字 id → 英文全称（与本体 CSV 命名风格一致；duo 用 "and"）。
# 4xxx 经 320 个本体种子配对验证（零冲突）；5xxx 经 Fandom wiki 官方列表确认。
BOSS_EN_MAP = {
    # Day1 本体（4xxx）
    4770: "Tibia Mariner",
    4780: "Gaping Dragon",
    4790: "Centipede Demon",
    4800: "The Duke's Dear Freja",
    4810: "Smelter Demon",
    4890: "Wormface",
    4910: "Grafted Monarch",
    4917: "Valiant Gargoyle",
    4924: "Bell Bearing Hunter",
    4927: "Battlefield Commander",
    4928: "Night's Cavalry Duo",
    4929: "Demi-Human Queen and Swordmaster",
    4930: "Royal Revenant",
    4990: "Ulcerated Tree Spirit",
    # Day2 本体（4xxx）
    4820: "Nameless King",
    4830: "Dancer of the Boreal Valley",
    4840: "Morgott",
    4850: "Draconic Tree Sentinel and Royal Cavalrymen",
    4860: "Tree Sentinel and Royal Cavalrymen",
    4880: "Godskin Duo",
    4918: "Great Wyrm",
    4919: "Ancient Dragon",
    4920: "Fallingstar Beast",
    4921: "Death Rite Bird",
    4923: "Dragonkin Soldier",
    4925: "Crucible Knight and Golden Hippopotamus",
    4926: "Outland Commander",
    # Day1 DLC（5xxx）
    5200: "Curseblade",
    5201: "Great Red Bear",
    5202: "Death Knight",
    5203: "Demon in Pain and Demon from Below",
    # Day2 DLC（5xxx）
    5210: "Lord of Blood",
    5211: "Divine Beast Dancing Lion",
    5212: "Knight Artorias",
    5213: "Demon Prince",
}


def load_external():
    """读外部 MAP_PATTERN.csv，返回 {seed_id: (day1_id, day2_id)}（全部种子）。"""
    if not EXTERNAL_MAP.exists():
        sys.exit(f"外部数据源不存在：{EXTERNAL_MAP}")
    result = {}
    with open(EXTERNAL_MAP, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            try:
                seed = int(row["ID"])
            except (KeyError, ValueError, TypeError):
                continue
            d1 = (row.get("Day1Boss") or "").strip()
            d2 = (row.get("Day2Boss") or "").strip()
            result[seed] = (
                int(d1) if d1 else None,
                int(d2) if d2 else None,
            )
    return result


def boss_name(boss_id):
    if boss_id is None:
        return ""
    if boss_id not in BOSS_EN_MAP:
        sys.exit(f"未知 boss id：{boss_id}（请补 BOSS_EN_MAP）")
    return BOSS_EN_MAP[boss_id]


def is_int(s):
    return s.isdigit()


def main():
    ext = load_external()
    dlc = {s: v for s, v in ext.items() if DLC_MIN <= s <= DLC_MAX}
    print(f"外部 DLC 种子数：{len(dlc)}（应为 200）")
    assert len(dlc) == 200, f"外部 DLC 种子数异常：{len(dlc)}"
    missing = [s for s, (d1, d2) in dlc.items() if d1 is None or d2 is None]
    assert not missing, f"外部存在空 boss id 的 DLC 种子：{missing[:10]}"

    with open(TARGET_CSV, "r", encoding="utf-8", newline="") as f:
        content = f.read()

    # 确认纯 CRLF（防止行尾混用导致 split('\r\n') 出错）
    assert content.count("\n") == content.count("\r"), "文件非纯 CRLF，需检查行尾"

    segments = content.split("\r\n")
    # 校验表头列位
    header_cols = segments[0].split(",")
    assert header_cols[5] == "Night 1 Boss", f"列6 非 Night 1 Boss：{header_cols[5]!r}"
    assert header_cols[6] == "Night 2 Boss", f"列7 非 Night 2 Boss：{header_cols[6]!r}"

    filled = 0
    seen = set()
    for i, seg in enumerate(segments):
        if not seg:
            continue
        first = seg.split(",", 1)[0]
        if not (is_int(first) and DLC_MIN <= int(first) <= DLC_MAX):
            continue
        seed = int(first)
        if seed not in dlc:
            sys.exit(f"repo 有 DLC 种子 {seed} 但外部无对应数据")
        seen.add(seed)
        parts = seg.split(",", 7)  # 8 段：前 7 字段 + 第 8 段为余下整体
        assert len(parts) == 8, f"种子 {seed} 字段数不足"
        d1, d2 = dlc[seed]
        expect1, expect2 = boss_name(d1), boss_name(d2)
        # 幂等 + 列对齐校验：原值必须为空或已是正确值
        if parts[5] not in ("", expect1):
            sys.exit(f"种子 {seed} Night1 Boss 非空且不符：{parts[5]!r}（列对齐可能出错）")
        if parts[6] not in ("", expect2):
            sys.exit(f"种子 {seed} Night2 Boss 非空且不符：{parts[6]!r}（列对齐可能出错）")
        parts[5] = expect1
        parts[6] = expect2
        segments[i] = ",".join(parts)
        filled += 1

    missing_in_repo = set(dlc) - seen
    assert not missing_in_repo, f"repo 缺少 DLC 种子行：{sorted(missing_in_repo)[:10]}"
    assert filled == 200, f"回填行数异常：{filled}（应 200）"

    new_content = "\r\n".join(segments)

    # 写盘前自检：DLC 行 Night 1/2 Boss 零空值
    verify_in_memory(new_content)
    # 本体交叉验证（只读，报告 BOSS_EN_MAP 与本体已填名是否一致）
    crosscheck_base(ext)

    with open(TARGET_CSV, "w", encoding="utf-8", newline="") as f:
        f.write(new_content)

    print(f"已回填 DLC 行：{filled}")
    print("回填完成。请重跑：python convert-csv-to-json.py")


def verify_in_memory(text):
    for seg in text.split("\r\n"):
        if not seg:
            continue
        first = seg.split(",", 1)[0]
        if is_int(first) and DLC_MIN <= int(first) <= DLC_MAX:
            parts = seg.split(",", 7)
            assert parts[5], f"种子 {parts[0]} Night1 Boss 仍为空"
            assert parts[6], f"种子 {parts[0]} Night2 Boss 仍为空"
    print("自检通过：DLC 200 行 Night 1/2 Boss 零空值")


def crosscheck_base(ext):
    """对照本体（0–319）已填英文 boss 名反查 id，与外部 id 比对（只读报告）。"""
    name_to_id = {v: k for k, v in BOSS_EN_MAP.items()}
    mismatches = []
    checked = 0
    with open(TARGET_CSV, "r", encoding="utf-8", newline="") as f:
        for seg in f.read().split("\r\n"):
            if not seg:
                continue
            first = seg.split(",", 1)[0]
            if not (is_int(first) and 0 <= int(first) <= 319):
                continue
            seed = int(first)
            if seed not in ext:
                continue
            parts = seg.split(",", 7)
            ext_d1, ext_d2 = ext[seed]
            for which, repo_name, ext_id in (
                ("D1", parts[5], ext_d1),
                ("D2", parts[6], ext_d2),
            ):
                if ext_id is None or repo_name not in name_to_id:
                    continue
                checked += 1
                if name_to_id[repo_name] != ext_id:
                    mismatches.append(
                        (seed, which, repo_name, name_to_id[repo_name], ext_id)
                    )
    if mismatches:
        print("⚠️ 本体 boss 名与外部 id 不一致（仅报告，未改动）：")
        for m in mismatches[:20]:
            print("   ", m)
    else:
        print(f"本体交叉验证通过（{checked} 处比对，BOSS_EN_MAP 与本体已填名一致）。")


if __name__ == "__main__":
    main()
