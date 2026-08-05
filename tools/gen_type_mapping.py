# tools/gen_type_mapping.py
# 从 NAME.xlsx 生成 type→{category,icon,name,basicClass} 映射。
# category 用 NAME「类别」列映射的英文 key（弃用旧的 major/minor 5 类框架）。
# 决策见 memory: category-name-taxonomy-decision
import json, sys
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
VENDOR = ROOT / "vendor" / "nightreign-data"

# NAME「类别」列 → 英文 category key（权威分类，用户 2026-08-04 裁定）
NAME_CAT_TO_KEY = {
    "主城": "castle",
    "野外据点": "stronghold",
    "教堂、法师塔、特殊商人、马车、破败小屋共享点位": "landmark",
    "野外BOSS": "fieldBoss",
    "夜晚BOSS": "nightBoss",
    "监牢BOSS": "evergaol",
    "大空洞商人": "merchant",
    "山羊事件特殊点位": "scaleMerchant",
}

# category key → 默认 icon（assets/icons/，无扩展名）
CATEGORY_ICON = {
    "castle": "castle",
    "stronghold": "camp_blank",
    "fieldBoss": "field_boss",
    "nightBoss": "field_boss",
    "evergaol": "evergaol",
    "merchant": "merchant",
    "scaleMerchant": "merchant",
    "excluded": "unknown",
}

# landmark（共享点位）按 type 中文名细分 icon
def landmark_icon(name):
    if "教堂" in name: return "church"
    if "法师塔" in name or "塔" in name: return "rise"
    if "商人" in name: return "merchant"
    if "村庄" in name or "村落" in name: return "village"
    return "blessing"  # 破败小屋/其他共享点位兜底

def basic_from_name(name):
    if "教堂" in name: return "church"
    if "法师塔" in name: return "mage"
    if "村庄" in name or "村落" in name: return "village"
    if "马车" in name: return "carriage"
    return "other"

nx = pd.read_excel(VENDOR / "NAME.xlsx", sheet_name="NAME").fillna("")

# 法师塔 type_id 集合（用户 2026-08-04 精确裁定）：
# 40000-40009 原版法师塔 / 40900,40901,40904,40905,40907,40908 高级法师塔 / 51100-51109 DLC 法师塔
# 这些 type 在 NAME.xlsx 被标成解谜元素名（门上方/枯树/幻影平台…），界面统一显示为「法师塔」
MAGE_TOWER_IDS = set(range(40000, 40010)) | {40900, 40901, 40904, 40905, 40907, 40908} | set(range(51100, 51110))

out = {}
for _, r in nx.iterrows():
    tid = int(r["ID"])
    name = str(r["中文名"]).strip()
    cat = str(r["类别"]).strip()
    key = NAME_CAT_TO_KEY.get(cat, "excluded")  # 额外事件/特殊事件/特殊地形/空 → excluded
    if tid in MAGE_TOWER_IDS:
        disp_name, icon, basic = "法师塔", "rise", "mage"
    elif key == "landmark":
        disp_name, icon, basic = name, landmark_icon(name), basic_from_name(name)
    else:
        disp_name, icon, basic = name, CATEGORY_ICON.get(key, "unknown"), basic_from_name(name)
    out[str(tid)] = {"category": key, "icon": icon, "name": disp_name, "basicClass": basic}

(ROOT / "tools" / "type_mapping.json").write_text(
    json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

from collections import Counter
dist = Counter(v["category"] for v in out.values())
print(f"写入 {len(out)} 条 type 映射；category 分布: {dict(sorted(dist.items()))}")
