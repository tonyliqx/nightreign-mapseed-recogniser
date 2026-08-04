# tools/gen_type_mapping.py
# 初值来自旧 type_category_icon.json，用 NAME.csv + classify 规则补全未覆盖 type。
import json, csv, sys
from pathlib import Path

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

# 4) 合并
out = {}
for t, n in names.items():
    o = old.get(str(t), {})
    adv = o.get("adv") or classify_rules(t)
    basic = o.get("basic") or basic_from_name(n)
    icon = o.get("icon") or (adv if adv != "minorBase" else basic_from_name(n))
    out[str(t)] = {"advCategory": adv, "basicClass": basic, "icon": icon, "name": n}

# 5) evergaol 不在此表（按 coord 601-607 判定），但保留提示
(ROOT / "tools" / "type_mapping.json").write_text(
    json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"写入 {len(out)} 条 type 映射；请人工校对 advCategory/icon 列。")
if skipped:
    print(f"跳过 {len(skipped)} 行非数字首列：{skipped}", file=sys.stderr)
