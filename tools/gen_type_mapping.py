# tools/gen_type_mapping.py
# 初值来自旧 type_category_icon.json，用 NAME.csv + classify 规则补全未覆盖 type。
import json, csv, sys
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
VENDOR = ROOT / "vendor" / "nightreign-data"
OLD = ROOT / "dataset" / "dlc-params" / "type_category_icon.json"

# 1) 旧映射初值
old = json.loads(OLD.read_text(encoding="utf-8"))  # {"<type>": {"icon":..,"adv":..,"basic":..,...}}

# 2) 新源 NAME.csv 全量 type
names = {}
skipped = []
with (VENDOR / "NAME.csv").open(encoding="utf-8") as f:
    for row in csv.reader(f):
        if row and row[0].strip():
            # 硬化：跳过首列非数字行（数据应全部为数字，仅防御）
            if not row[0].strip().lstrip("-").isdigit():
                skipped.append(row)
                continue
            names[int(row[0])] = row[1]

# 3) classify 规则（与新源 生成总表.py 一致）
def classify_rules(t):
    s = str(t)
    if s in ("49410","49420","49430"): return "majorBase"      # 特殊建筑/主城
    if s[:2] in ("45","46","47","52","53"): return "fieldBoss" # 野外Boss/敌人
    return "minorBase"                                          # 其余建筑设施

def basic_from_name(name):
    if "教堂" in name: return "church"
    if "法师塔" in name: return "mage"
    if "村庄" in name or "村落" in name: return "village"
    if "马车" in name: return "carriage"
    return "other"

# 3.5) 人工 curation（用户裁定 2026-08-04）
#   evergaol/rottedWoods 按坐标(601-607/2601-2607)/地形判，type 侧只分 major/minor/fieldBoss。
CURATION_ADV = {
    # B1① 38xxx 敌方 type（神谕使者/魔像守卫/火焰修士/灵庙骑士）→ fieldBoss
    "38000": "fieldBoss", "38001": "fieldBoss", "38100": "fieldBoss", "38101": "fieldBoss",
    # B1② 510xx 教堂×3 + 51150 马车 → minorBase
    "51000": "minorBase", "51050": "minorBase", "51051": "minorBase", "51150": "minorBase",
    # B1③ 51100-51109 DLC 地标件（镜像本体 40xxx 法师塔地标件）→ minorBase
    "51100": "minorBase", "51101": "minorBase", "51102": "minorBase", "51103": "minorBase",
    "51104": "minorBase", "51105": "minorBase", "51106": "minorBase", "51107": "minorBase",
    "51108": "minorBase", "51109": "minorBase",
    # B2 evergaol type 统一 → fieldBoss（53670 尊腐城除外→majorBase）
    "50011": "fieldBoss", "50001": "fieldBoss", "50114": "fieldBoss",
    "50030": "fieldBoss", "50040": "fieldBoss", "52520": "fieldBoss",
    # B3 真城 → majorBase（49410/49420/49430/53590 已是 majorBase，无需覆盖）
    "53580": "majorBase", "53670": "majorBase", "53680": "majorBase",
    # B3 城内下层精英敌人 → fieldBoss
    "53600": "fieldBoss", "53610": "fieldBoss", "53700": "fieldBoss",
    "53710": "fieldBoss", "53720": "fieldBoss",
}
CURATION_BASIC = {  # 名含"教堂"却被旧映射标 nothing
    "51050": "church", "51051": "church",
}

# 4) 合并
out = {}
for t, n in names.items():
    o = old.get(str(t), {})
    adv = o.get("adv") or classify_rules(t)
    basic = o.get("basic") or basic_from_name(n)
    icon = o.get("icon") or (adv if adv != "minorBase" else basic_from_name(n))
    out[str(t)] = {"advCategory": adv, "basicClass": basic, "icon": icon, "name": n}

# 5) 应用人工 curation 覆盖（advCategory / basicClass）
for t, adv in CURATION_ADV.items():
    if t in out:
        out[t]["advCategory"] = adv
    else:
        print(f"⚠️ curation type {t} 不在 NAME.csv，跳过", file=sys.stderr)
for t, basic in CURATION_BASIC.items():
    if t in out:
        out[t]["basicClass"] = basic

# 5.5) 规则④⑤：NAME.xlsx「类别」列是分类权威。
#   规则④：夜晚BOSS/野外BOSS/监牢BOSS 三类 → fieldBoss。
#     修复 classify_rules 只覆盖 45/46/47/52/53 前缀、漏 48/49 前缀夜晚BOSS（50 type 误判 minorBase）的 bug。
#     （夜晚BOSS 4780-4930 系列是大空洞神授塔守塔 BOSS，其 4 位原型 22/22 出现在 Day1/Day2 夜晚BOSS 池。）
#   规则⑤：53990「野外商人」类别=大空洞商人 → minorBase（商人设施，覆盖 "53" 前缀误判 fieldBoss）。
nx = pd.read_excel(VENDOR / "NAME.xlsx", sheet_name="NAME")
_name_cat = {int(k): ("" if pd.isna(v) else str(v)) for k, v in zip(nx["ID"], nx["类别"])}
NAME_CAT_ADV = {"夜晚BOSS": "fieldBoss", "野外BOSS": "fieldBoss", "监牢BOSS": "fieldBoss"}
_boss_fixed = 0
for t, entry in out.items():
    nc = _name_cat.get(int(t), "")
    if nc in NAME_CAT_ADV:
        if entry["advCategory"] != NAME_CAT_ADV[nc]:
            _boss_fixed += 1
        entry["advCategory"] = NAME_CAT_ADV[nc]
if "53990" in out:
    out["53990"]["advCategory"] = "minorBase"
print(f"规则④⑤：三类BOSS→fieldBoss 修正 {_boss_fixed} type；53990→minorBase", file=sys.stderr)

# 6) evergaol 不在此表（按 coord 601-607 判定）；curation 后应 0 条 evergaol 残留
(ROOT / "tools" / "type_mapping.json").write_text(
    json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

from collections import Counter
dist = Counter(v["advCategory"] for v in out.values())
print(f"写入 {len(out)} 条 type 映射；advCategory 分布: {dict(sorted(dist.items()))}")
if skipped:
    print(f"跳过 {len(skipped)} 行非数字首列：{skipped}", file=sys.stderr)
