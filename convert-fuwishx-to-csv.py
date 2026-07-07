#!/usr/bin/env python3
"""
将 Fuwishx 数据源转换为 nightreignMapPatterns.csv 的 DLC 种子数据。

读取 distnr/ 目录下的 MAP_PATTERN.csv、CONSTRUCT.csv、NAME.csv、coords.csv
以及 distnr/Base/PatternPoint.txt，将种子 1000-1199 的 POI 数据填充到
dataset/nightreignMapPatterns.csv 中（保留种子 0-319 不变）。

用法:
    python convert-fuwishx-to-csv.py
"""

import csv
import os
import re
from collections import defaultdict

# ── 常量 ──────────────────────────────────────────────────────────────────

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DISTNR_DIR = os.path.join(SCRIPT_DIR, 'distnr')
DATASET_DIR = os.path.join(SCRIPT_DIR, 'dataset')

# 种子号 → CSV 行索引（第 1 行为 seed 0，行索引 = seed + 2 考虑两行表头）
CSV_HEADER_ROWS = 2

# NightLord ID → 名称
NIGHTLORD_NAMES = {
    0: "Gladius", 1: "Adel", 2: "Gnoster", 3: "Maris",
    4: "Libra", 5: "Fulghor", 6: "Caligo", 7: "Heolstor",
    8: "Harmonia", 9: "Straghess"
}

# Special 值 → 地图类型（注意: 4=Great Hollow 是 DLC 新增，5=Noklateo 与原版一致）
MAP_TYPE_NAMES = {
    0: "Default", 1: "Mountaintop", 2: "Crater",
    3: "Rotted Woods", 4: "Great Hollow", 5: "Noklateo"
}

# 事件 flag → 事件名称
EVENT_FLAG_NAMES = {
    7704: "Day 1 Night Horde", 7724: "Day 2 Night Horde",
    7701: "Day 1 Meteor Strike", 7721: "Day 2 Meteor Strike",
    7702: "Day 1 Mausoleum", 7722: "Day 2 Mausoleum",
    7706: "Day 1 Sorcerer's Tower", 7726: "Day 2 Sorcerer's Tower",
    7707: "Day 1 Frenzy Tower", 7727: "Day 2 Frenzy Tower",
    7700: "Day 1 Extra Night Boss", 7725: "Day 2 Extra Night Boss",
    7705: "Day 1 Special",
}

# Start_190 → 出生点英文名（从现有 CSV 交叉验证）
SPAWN_POINT_NAMES = {
    700: "Far Southwest",
    701: "Stormhill South of Gate",
    702: "West of Warmaster's Shack",
    703: "Above Stormhill Tunnel Entrance",
    704: "Southeast of Lake",
    705: "East of Cavalry Bridge",
    706: "Northeast of Saintsbridge",
    707: "Minor Erdtree",
    708: "Below Summonwater Hawk",
}

# Day1Loc/Day2Loc → 夜圈位置英文名
CIRCLE_LOCATION_NAMES = {
    1000: "Southwest Corner",
    1001: "West Stormhill Graveyard",
    1002: "Northwest Corner",
    1003: "South Lake",
    1004: "Northwest Lake",
    1005: "South of Castle",
    1006: "Northwest of Castle",
    1007: "Northeast of Lake",
    1008: "East of Saintsbridge",
    1009: "Southwest Mistwood",
    1010: "Northwest Mistwood Pond",
    1011: "Northeast Corner",
    1021: "Southeast Rotted Woods",
    1022: "Northwest Rotted Woods",
    1023: "Southeast Mountaintop",
    1024: "North of Crater",
    1025: "Noklateo Entrance",
    # DLC 特殊位置
    11000: "DLC Noklateo Circle 1",
    11001: "DLC Noklateo Circle 2",
    11002: "DLC Noklateo Circle 3",
    12000: "DLC Great Hollow Circle 1",
    12001: "DLC Great Hollow Circle 2",
}

# DLC 出生点
SPAWN_POINT_NAMES.update({
    13000: "DLC Noklateo Spawn A",
    13001: "DLC Noklateo Spawn B",
    13002: "DLC Noklateo Spawn C",
})

# NAME.csv 中没有英文名的 Boss ID → 英文名映射
# （优先使用 PatternPoint 中的英文名，此表补充 PatternPoint 覆盖不到的）
BOSS_ENGLISH_NAMES = {
    # Night Boss (NAME.csv 有英文名的)
    4770: "Tibia Mariner", 4780: "Gaping Dragon", 4790: "Centipede Demon",
    4800: "The Duke's Dear Freja", 4810: "Smelter Demon",
    4820: "Nameless King", 4830: "Dancer of the Boreal Valley",
    4840: "Morgott", 4850: "Draconic Tree Sentinel and Royal Cavalrymen",
    4860: "Tree Sentinel and Royal Cavalrymen", 4870: "Godskin Apostle",
    4880: "Godskin Duo", 4890: "Wormface",
    4910: "Grafted Monarch", 4917: "Valiant Gargoyle",
    4918: "Great Wyrm", 4919: "Ancient Dragon",
    4920: "Fallingstar Beast", 4921: "Death Rite Bird",
    4923: "Dragonkin Soldier", 4924: "Bell Bearing Hunter",
    4925: "Crucible Knight and Golden Hippopotamus",
    4926: "Outland Commander", 4927: "Battlefield Commander",
    4928: "Night's Cavalry Duo",
    4929: "Demi-Human Queen and Swordmaster",
    4930: "Royal Revenant", 4990: "Ulcerated Tree Spirit",
    # DLC Boss (5200+)
    5200: "Curseblade", 5201: "Great Red Bear",
    5202: "Death Knight", 5203: "Labyrinthian Demon",
    5210: "Blood Lord", 5211: "Divine Beast Dancing Lion",
    5212: "Artorias", 5213: "Demon Prince",
    # Extra Boss 五位数编码（神授塔 Boss）
    47702: "Tibia Mariner", 47802: "Gaping Dragon", 47902: "Centipede Demon",
    48002: "The Duke's Dear Freja", 48102: "Smelter Demon",
    48202: "Nameless King", 48302: "Dancer of the Boreal Valley",
    48402: "Morgott", 48502: "Draconic Tree Sentinel and Royal Cavalrymen",
    48602: "Tree Sentinel and Royal Cavalrymen", 48702: "Godskin Apostle",
    48802: "Godskin Duo", 48902: "Wormface",
    49102: "Grafted Monarch", 49172: "Valiant Gargoyle",
    49182: "Great Wyrm", 49192: "Ancient Dragon",
    49202: "Fallingstar Beast", 49212: "Death Rite Bird",
    49232: "Dragonkin Soldier", 49242: "Bell Bearing Hunter",
    49252: "Crucible Knight and Golden Hippopotamus",
    49262: "Outland Commander", 49272: "Battlefield Commander",
    49282: "Night's Cavalry Duo",
    49292: "Demi-Human Queen and Swordmaster",
    49302: "Royal Revenant", 49902: "Ulcerated Tree Spirit",
    # DLC Evergaol Boss (51000+, 51100+) — 占位符名称
    51000: "DLC Evergaol Boss",
    51050: "DLC Evergaol Boss",
    51100: "DLC Evergaol Boss A", 51101: "DLC Evergaol Boss B",
    51102: "DLC Evergaol Boss C", 51103: "DLC Evergaol Boss D",
    51104: "DLC Evergaol Boss E", 51105: "DLC Evergaol Boss F",
    51106: "DLC Evergaol Boss G", 51107: "DLC Evergaol Boss H",
    51108: "DLC Evergaol Boss I", 51109: "DLC Evergaol Boss J",
    51150: "DLC Evergaol Boss K",
    # DLC Field Boss (52400+) — 占位符名称
    52400: "DLC Field Boss A", 52420: "DLC Field Boss B",
    52450: "DLC Field Boss C", 52460: "DLC Field Boss D",
    52500: "DLC Field Boss E", 52520: "DLC Field Boss F",
    52550: "DLC Field Boss G", 52570: "DLC Field Boss H",
}

# ── 解析 PatternPoint.txt ─────────────────────────────────────────────────

def parse_pattern_point(filepath):
    """解析 PatternPoint.txt，返回 SmallBaseData、AttachPointData、StartingPointData 的映射。"""
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()

    # SmallBaseData: type_id × 10 + variation → (category, name)
    small_base = {}
    sb_match = re.search(r'SmallBaseData:\n(.*?)(?=\n\w|\Z)', text, re.DOTALL)
    if sb_match:
        current_id = None
        for line in sb_match.group(1).split('\n'):
            line = line.strip()
            m_id = re.match(r'^- ID:\s*(\d+)', line)
            if m_id:
                current_id = int(m_id.group(1))
            m_var = re.match(r'^Variation:\s*(\d+)', line)
            if m_var and current_id is not None:
                # 先不处理，等下一个 Name 行
                pass
            m_cat = re.match(r'^Category:\s*(\S+)', line)
            if m_cat and current_id is not None:
                # 暂存 category
                pass
            m_name = re.match(r'^Name:\s*(.+)', line)
            if m_name and current_id is not None:
                pass  # 在下面统一处理

    # 使用更简单的方式：逐段解析
    small_base = _parse_small_base(text)
    attach_points, attach_points_by_category = _parse_attach_points(text)
    starting_points = _parse_starting_points(text)

    return small_base, attach_points, attach_points_by_category, starting_points


def _parse_small_base(text):
    """解析 SmallBaseData 段，返回 construct_type_id → (category, name)"""
    result = {}
    section = text.split('AttachPointData:')[0]
    section = section.split('SmallBaseData:')[1] if 'SmallBaseData:' in section else ''

    entries = re.split(r'- ID:', section)
    for entry in entries[1:]:  # 跳过第一段空内容
        lines = entry.strip().split('\n')
        base_id = int(lines[0].strip())

        # 解析后续行
        variation = 0
        category = None
        name = None
        for line in lines[1:]:
            line = line.strip()
            vm = re.match(r'Variation:\s*(\d+)', line)
            if vm:
                variation = int(vm.group(1))
                continue
            cm = re.match(r'Category:\s*(\S+)', line)
            if cm:
                category = cm.group(1)
                continue
            nm = re.match(r'Name:\s*(.+)', line)
            if nm:
                name = nm.group(1).strip()
                continue

        if category and name:
            construct_id = base_id * 10 + variation
            result[construct_id] = (category, name)

    return result


def _parse_attach_points(text):
    """解析 AttachPointData 段，返回 coord_id → (category, name) 和 category → {name: id}"""
    by_id = {}
    by_category = defaultdict(dict)

    section = text.split('AttachPointData:')[1]
    section = section.split('StartingPointData:')[0] if 'StartingPointData:' in section else section

    entries = re.split(r'- ID:', section)
    for entry in entries[1:]:
        lines = entry.strip().split('\n')
        coord_id = int(lines[0].strip())

        category = None
        name = None
        for line in lines[1:]:
            line = line.strip()
            cm = re.match(r'Category:\s*(\S+)', line)
            if cm:
                category = cm.group(1)
                continue
            nm = re.match(r'Name:\s*(.+)', line)
            if nm:
                name = nm.group(1).strip()
                continue

        if category and name:
            by_id[coord_id] = (category, name)
            by_category[category][coord_id] = name

    return by_id, by_category


def _parse_starting_points(text):
    """解析 StartingPointData 段，返回 point_id → name"""
    result = {}
    section = text.split('StartingPointData:')[1] if 'StartingPointData:' in text else ''

    entries = re.split(r'- ID:', section)
    for entry in entries[1:]:
        lines = entry.strip().split('\n')
        point_id = int(lines[0].strip())

        name = None
        for line in lines[1:]:
            line = line.strip()
            nm = re.match(r'Name:\s*(.+)', line)
            if nm:
                name = nm.group(1).strip()
                break

        if name:
            result[point_id] = name

    return result


# ── 加载数据文件 ──────────────────────────────────────────────────────────

def load_map_pattern(filepath):
    """加载 MAP_PATTERN.csv，返回 dict[seed_id] → row_dict"""
    result = {}
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            seed_id = int(row['ID'])
            result[seed_id] = row
    return result


def load_construct(filepath):
    """加载 CONSTRUCT.csv，返回 dict[seed_id] → [(type, is_display, coord_index)]"""
    result = defaultdict(list)
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader)  # 跳过表头
        for row in reader:
            if not row or len(row) < 5:
                continue
            seed_id = int(row[1])
            type_id = int(row[2])
            is_display = int(row[3])
            coord_index = int(row[4])
            result[seed_id].append((type_id, is_display, coord_index))
    return result


def load_names(filepath):
    """加载 NAME.csv，返回 dict[type_id] → english_name（优先英文列，否则中文名）。"""
    result = {}
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        for row in reader:
            if not row or len(row) < 2:
                continue
            try:
                type_id = int(row[0])
                english = row[2].strip() if len(row) > 2 and row[2].strip() else ''
                chinese = row[1].strip() if len(row) > 1 else ''
                result[type_id] = english if english else chinese
            except (ValueError, IndexError):
                continue
    return result


def load_coords(filepath):
    """加载 coords.csv，返回 dict[coord_id] → (picX, picY)"""
    result = {}
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader)  # 跳过表头
        for row in reader:
            if not row or len(row) < 9:
                continue
            try:
                coord_id = int(row[0])
                pic_x = float(row[7])
                pic_y = float(row[8])
                result[coord_id] = (pic_x, pic_y)
            except (ValueError, IndexError):
                continue
    return result


# ── 构建映射表 ────────────────────────────────────────────────────────────

def build_category_for_type(small_base):
    """构建 type_id → 分类名映射，返回 dict[construct_type_id] → category_string"""
    cat_map = {}
    for type_id, (category, name) in small_base.items():
        cat_map[type_id] = category
    return cat_map


def build_structure_display_name(type_id, small_base, names):
    """根据 type_id 生成显示名称。返回 (structure_label, display_name)。

    structure_label 用于 Major Base 的 "Category - Name" 格式
    display_name 用于 Field Boss/Evergaol 的仅名称格式
    """
    if type_id in small_base:
        category, name = small_base[type_id]
        # 将 PatternPoint category 转为 CSV 中的标签
        label = _category_to_label(category)
        return (label, name)

    # DLC 50000+ 类型使用占位符
    return None


def _category_to_label(category):
    """PatternPoint category → CSV 标签名"""
    mapping = {
        'Fort': 'Fort',
        'Camp': 'Camp',
        'Ruins': 'Ruins',
        'Great_Church': 'Great Church',
        'Sorcerers_Rise': "Sorcerer's Rise",
        'Church': 'Church',
        'Small_Camp': 'Small Camp',
        'Township': 'Township',
        'Map_Event': 'Map Event',
        'Shack': 'Shack',
        'Field_Boss': None,
        'Strong_Field_Boss': None,
        'Evergaol': None,
        'Arena_Boss': None,
        'Night_Boss': None,
        'Night_Horde': None,
        'Event': None,
        'Castle': None,
        'Extra_Night_Boss': None,
    }
    return mapping.get(category, category)


def coord_to_location_name(coord_index, attach_points):
    """将 coord_index 转为位置名。利用镜像关系：2100→100, 2300→300 等。"""
    # 直接查找
    if coord_index in attach_points:
        return attach_points[coord_index][1]

    # 镜像查找：DLC 坐标 = regular_base + offset * 10000
    # 2100-2199 → 100-199, 2300-2399 → 300-399, 2600-2699 → 600-699
    # 2700-2799 → 700-799 (部分), 2750-2763 → 750-763
    if coord_index >= 2000:
        mirror = coord_index % 10000
        if mirror in attach_points:
            return attach_points[mirror][1]

    # 特殊 DLC 位置
    special = {
        11000: "DLC Noklateo Night Circle 1",
        11001: "DLC Noklateo Night Circle 2",
        11002: "DLC Noklateo Night Circle 3",
        12000: "DLC Great Hollow Night Circle 1",
        12001: "DLC Great Hollow Night Circle 2",
        13000: "DLC Noklateo Spawn A",
        13001: "DLC Noklateo Spawn B",
        13002: "DLC Noklateo Spawn C",
    }
    if coord_index in special:
        return special[coord_index]

    return None


def spawn_point_name(start_190):
    """将 Start_190 值转为出生点英文名。"""
    if start_190 in SPAWN_POINT_NAMES:
        return SPAWN_POINT_NAMES[start_190]
    return f"Spawn {start_190}"


def circle_location_name(loc_id):
    """将 Day1Loc/Day2Loc 转为夜圈位置英文名。"""
    if loc_id in CIRCLE_LOCATION_NAMES:
        return CIRCLE_LOCATION_NAMES[loc_id]
    return f"Circle {loc_id}"


def boss_name(boss_id, names):
    """将 Boss ID 转为英文名。优先使用 BOSS_ENGLISH_NAMES，再查 NAME.csv 的英文列。"""
    # 优先使用硬编码的英文映射
    if boss_id in BOSS_ENGLISH_NAMES:
        return BOSS_ENGLISH_NAMES[boss_id]

    # 查 NAME.csv 的第三列（英文）
    if boss_id in names:
        return names[boss_id]

    # 五位数编码: 47702 = 4770×10+2 → 取 4770 的英文名
    if boss_id >= 10000:
        base = boss_id // 10
        if base in BOSS_ENGLISH_NAMES:
            return BOSS_ENGLISH_NAMES[base]
        if base in names:
            return names[base]

    return None


# ── POI 分类逻辑 ─────────────────────────────────────────────────────────

def classify_type(type_id, small_base):
    """将 CONSTRUCT type_id 分类到 CSV 列类别。

    返回类别名: 'castle', 'major_base', 'minor_base', 'evergaol',
                'arena_boss', 'field_boss', 'rotted_woods', 'scale_merchant',
                'night_horde'（跳过）, 'tower_boss'（神授塔Boss）, 'event'（特殊）, 'unknown'
    """
    # Castle
    if type_id in (49410, 49420, 49430):
        return 'castle'

    # Scale Merchant
    if type_id == 49400:
        return 'scale_merchant'

    # Night Horde → 跳过（包括常规和 DLC）
    if 46000 <= type_id <= 46060:
        return 'night_horde'
    if type_id in (53000, 53050):
        return 'night_horde'
    if 53500 <= type_id <= 53999:
        return 'night_horde'

    # 五位数编码的神授塔 Boss (47702, 47802, ..., 49902) → tower_boss
    # 这些是 DLC Great Hollow/Noklateo 中的额外 Boss
    if type_id >= 47700 and type_id <= 49999 and type_id % 10 == 2:
        return 'tower_boss'

    # SmallBaseData 中的类型映射
    if type_id in small_base:
        cat, name = small_base[type_id]
        # Major Base 结构类型
        if cat in ('Fort', 'Camp', 'Ruins', 'Great_Church', 'Map_Event'):
            return 'major_base'
        # Minor Base 结构类型
        if cat in ('Church', 'Sorcerers_Rise', 'Small_Camp', 'Township', 'Shack'):
            return 'minor_base'
        # Evergaol
        if cat == 'Evergaol':
            return 'evergaol'
        # Arena Boss (Castle Basement)
        if cat == 'Arena_Boss':
            return 'arena_boss'
        # Field Boss / Strong Field Boss
        if cat in ('Field_Boss', 'Strong_Field_Boss'):
            return 'field_boss'
        # Black Knife Assassin (Field Boss)
        if cat == 'Field_Boss' and name == 'Black Knife Assassin':
            return 'field_boss'
        # Night Boss / Extra Night Boss 在 CONSTRUCT 中出现但属于种子级数据
        if cat in ('Night_Boss', 'Extra_Night_Boss'):
            return 'night_horde'  # 跳过，种子级数据已从 MAP_PATTERN 获取
        # Event 类型 (Morgott, Gnoster 等夜王事件)
        if cat == 'Event':
            return 'event'

    # DLC Major Base 新类型 (50001-50116)
    if 50001 <= type_id <= 50116:
        return 'major_base'

    # DLC Evergaol (51000, 51050, 51100-51150)
    if type_id in (51000, 51050) or 51100 <= type_id <= 51150:
        return 'evergaol'

    # DLC Field Boss (52400-52599)
    if 52400 <= type_id <= 52599:
        return 'field_boss'

    # Black Knife Assassin (45510)
    if type_id == 45510:
        return 'field_boss'
    event_types = {4552, 4553, 4555, 4678}
    if type_id in event_types:
        return 'event'

    return 'unknown'


def format_major_base_value(type_id, small_base, names):
    """生成 Major Base 列的值，格式 "Category - Name"。"""
    if type_id in small_base:
        category, name = small_base[type_id]
        label = _category_to_label(category)
        if label:
            return f"{label} - {name}"
        return name

    # DLC 占位符
    return f"Unknown DLC Type {type_id}"


def format_minor_base_value(type_id, small_base, names):
    """生成 Minor Base 列的值。"""
    if type_id in small_base:
        category, name = small_base[type_id]

        # Small Camp → "Small Camp - Detail"
        if category == 'Small_Camp':
            return f"Small Camp - {name}"

        # Church → "Church - Normal" 等
        if category == 'Church':
            return f"Church - {name}"

        # Sorcerer's Rise → "Sorcerer's Rise - Detail"
        if category == 'Sorcerers_Rise':
            return f"Sorcerer's Rise - {name}"

        # Township, Shack
        if category == 'Township':
            return 'Township'

        return f"{_category_to_label(category)} - {name}"

    # Caravans 特殊处理
    if type_id in (45000, 45001):
        if type_id == 45000:
            return "Small Camp - Caravans"
        return "Small Camp - Caravans and Nobles"

    return f"Unknown Minor {type_id}"


def format_boss_value(type_id, small_base, names):
    """生成 Boss 类列（Evergaol/Field Boss/Arena Boss）的值。仅返回名称。"""
    # 优先使用 PatternPoint 英文名
    if type_id in small_base:
        return small_base[type_id][1]

    # 硬编码的英文映射（含 DLC Boss）
    if type_id in BOSS_ENGLISH_NAMES:
        return BOSS_ENGLISH_NAMES[type_id]

    # 尝试 NAME.csv（英文列优先）
    if type_id in names:
        return names[type_id]

    # 五位数编码
    if type_id >= 10000:
        base = type_id // 10
        if base in BOSS_ENGLISH_NAMES:
            return BOSS_ENGLISH_NAMES[base]
        if base in names:
            return names[base]

    return f"Unknown Boss {type_id}"


# ── 主处理逻辑 ────────────────────────────────────────────────────────────

def build_dlc_seed_row(seed_id, mp, construct_rows, small_base, attach_points,
                        names, coords):
    """为单个 DLC 种子构建完整的 CSV 行（68 列）。

    CSV 列布局（参考现有表头）：
    0: seed, 1: Nightlord, 2: Shifting Earth, 3: Spawn Point, 4: Special Event
    5: Night 1 Boss, 6: Night 2 Boss, 7: Extra Night Boss
    8: Night 1 Circle, 9: Night 2 Circle
    10: Castle
    11-26: Major Base × 16
    27-37: Minor Base × 11
    38-44: Evergaol × 7
    45: Arena Boss (Castle Basement)
    46-56: Field Boss × 11 (含 Castle Rooftop)
    57-64: Rotted Woods × 8
    65: Rot Blessing, 66: Frenzy Tower, 67: Scale-Bearing Merchant
    """
    NUM_COLS = 68
    row = [''] * NUM_COLS

    # ── 基础字段 ──
    row[0] = str(seed_id)

    # NightLord
    nl_id = int(mp['NightLord'])
    row[1] = NIGHTLORD_NAMES.get(nl_id, f"Unknown NL {nl_id}")

    # 地图类型
    special = int(mp['Special'])
    row[2] = MAP_TYPE_NAMES.get(special, f"Unknown Map {special}")

    # 出生点
    start_190 = int(mp['Start_190'])
    row[3] = spawn_point_name(start_190)

    # 特殊事件
    event_flag = int(mp['EventFlag']) if mp['EventFlag'] else 0
    event_val = int(mp['Event_30*0']) if mp['Event_30*0'] else 0
    if event_flag and event_flag in EVENT_FLAG_NAMES:
        row[4] = EVENT_FLAG_NAMES[event_flag]
    elif event_val and event_val in EVENT_FLAG_NAMES:
        row[4] = EVENT_FLAG_NAMES[event_val]
    elif event_flag in (7707, 7727):
        row[4] = EVENT_FLAG_NAMES.get(event_flag, '')

    # Night Bosses
    day1_boss = int(mp['Day1Boss']) if mp['Day1Boss'] else 0
    day2_boss = int(mp['Day2Boss']) if mp['Day2Boss'] else 0
    row[5] = boss_name(day1_boss, names) or ''
    row[6] = boss_name(day2_boss, names) or ''

    # Extra Night Boss
    extra1 = int(mp['extra1']) if mp['extra1'] and mp['extra1'] != '-1' else 0
    if extra1:
        extra_name = boss_name(extra1, names)
        row[7] = extra_name or ''

    # Night Circles
    day1_loc = int(mp['Day1Loc']) if mp['Day1Loc'] else 0
    day2_loc = int(mp['Day2Loc']) if mp['Day2Loc'] else 0
    row[8] = circle_location_name(day1_loc) or ''
    row[9] = circle_location_name(day2_loc) or ''

    # ── POI 分类 ──
    castle_entries = []
    major_base_entries = []
    minor_base_entries = []
    evergaol_entries = []
    arena_boss_entries = []
    field_boss_entries = []
    rotted_woods_entries = []
    scale_merchant_coord = None
    tower_boss_entries = []

    for type_id, is_display, coord_index in construct_rows:
        if is_display != 1:
            continue

        category = classify_type(type_id, small_base)

        if category == 'castle':
            castle_entries.append((type_id, coord_index))
        elif category == 'major_base':
            major_base_entries.append((type_id, coord_index))
        elif category == 'minor_base':
            minor_base_entries.append((type_id, coord_index))
        elif category == 'evergaol':
            evergaol_entries.append((type_id, coord_index))
        elif category == 'arena_boss':
            arena_boss_entries.append((type_id, coord_index))
        elif category == 'field_boss':
            # 检查是否在 Rotted Woods 坐标范围
            # Rotted Woods coord: 309, 315-322 (常规), 2309, 2315-2322 (DLC)
            mirror = coord_index % 10000
            if mirror in attach_points:
                cat, name = attach_points[mirror]
                if cat == 'Rotted_Woods':
                    rotted_woods_entries.append((type_id, coord_index))
                    continue
            field_boss_entries.append((type_id, coord_index))
        elif category == 'rotted_woods':
            rotted_woods_entries.append((type_id, coord_index))
        elif category == 'scale_merchant':
            scale_merchant_coord = coord_index
        elif category == 'night_horde':
            pass  # 跳过
        elif category == 'tower_boss':
            tower_boss_entries.append((type_id, coord_index))
        else:
            # unknown 类型，根据坐标范围推断
            if 2600 <= (coord_index % 10000) <= 2607:
                evergaol_entries.append((type_id, coord_index))
            elif 2750 <= (coord_index % 10000) <= 2763:
                field_boss_entries.append((type_id, coord_index))
            elif 2757 == (coord_index % 10000):
                arena_boss_entries.append((type_id, coord_index))
            # 其他未知类型暂时跳过

    # ── 填充 Castle (col 10) ──
    if castle_entries:
        # Castle 只有一个，取第一个
        type_id, _ = castle_entries[0]
        row[10] = format_boss_value(type_id, small_base, names)

    # ── 填充 Major Base (cols 11-26, 16 列) ──
    # 按 coord_index 排序
    major_base_entries.sort(key=lambda x: x[1])
    for i, (type_id, coord_index) in enumerate(major_base_entries[:16]):
        row[11 + i] = format_major_base_value(type_id, small_base, names)

    # ── 填充 Minor Base (cols 27-37, 11 列) ──
    minor_base_entries.sort(key=lambda x: x[1])
    for i, (type_id, coord_index) in enumerate(minor_base_entries[:11]):
        row[27 + i] = format_minor_base_value(type_id, small_base, names)

    # ── 填充 Evergaol (cols 38-44, 7 列) ──
    evergaol_entries.sort(key=lambda x: x[1])
    for i, (type_id, coord_index) in enumerate(evergaol_entries[:7]):
        row[38 + i] = format_boss_value(type_id, small_base, names)

    # ── 填充 Arena Boss / Castle Basement (col 45, 1 列) ──
    if arena_boss_entries:
        type_id, _ = arena_boss_entries[0]
        row[45] = format_boss_value(type_id, small_base, names)

    # ── 填充 Field Boss (cols 46-56, 11 列) ──
    field_boss_entries.sort(key=lambda x: x[1])
    for i, (type_id, coord_index) in enumerate(field_boss_entries[:11]):
        row[46 + i] = format_boss_value(type_id, small_base, names)

    # ── 填充 Rotted Woods (cols 57-64, 8 列) ──
    rotted_woods_entries.sort(key=lambda x: x[1])
    for i, (type_id, coord_index) in enumerate(rotted_woods_entries[:8]):
        row[57 + i] = format_boss_value(type_id, small_base, names)

    # ── 填充 Rot Blessing (col 65) ──
    rot_rew = int(mp['RotRew_500']) if mp['RotRew_500'] else 0
    if rot_rew:
        row[65] = "Yes"

    # ── 填充 Frenzy Tower (col 66) ──
    if event_flag in (7707, 7727):
        row[66] = "Yes"

    # ── 填充 Scale-Bearing Merchant (col 67) ──
    if scale_merchant_coord is not None:
        loc = coord_to_location_name(scale_merchant_coord, attach_points)
        row[67] = loc or "Yes"

    return row


def main():
    print("🔄 开始转换 Fuwishx 数据到 CSV...")

    # ── 加载数据 ──
    print("📂 加载数据源...")
    small_base, attach_points, attach_by_cat, starting_points = \
        parse_pattern_point(os.path.join(DISTNR_DIR, 'Base', 'PatternPoint.txt'))
    print(f"  SmallBaseData: {len(small_base)} 条映射")
    print(f"  AttachPointData: {len(attach_points)} 条映射")
    print(f"  StartingPointData: {len(starting_points)} 条映射")

    map_patterns = load_map_pattern(os.path.join(DISTNR_DIR, 'MAP_PATTERN.csv'))
    print(f"  MAP_PATTERN: {len(map_patterns)} 个种子")

    constructs = load_construct(os.path.join(DISTNR_DIR, 'CONSTRUCT.csv'))
    print(f"  CONSTRUCT: {len(constructs)} 个种子")

    names = load_names(os.path.join(DISTNR_DIR, 'NAME.csv'))
    print(f"  NAME: {len(names)} 条映射")

    coords = load_coords(os.path.join(DISTNR_DIR, 'coords.csv'))
    print(f"  coords: {len(coords)} 条坐标")

    # ── 加载现有 CSV ──
    csv_path = os.path.join(DATASET_DIR, 'nightreignMapPatterns.csv')
    print(f"\n📖 读取现有 CSV: {csv_path}")
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        all_rows = list(reader)

    header_row1 = all_rows[0]
    header_row2 = all_rows[1]
    data_rows = all_rows[2:]
    print(f"  表头行: 2, 数据行: {len(data_rows)}")

    # ── 处理每个 DLC 种子 ──
    print(f"\n🏗️  处理 DLC 种子 1000-1199...")
    updated = 0
    unknown_types = set()

    for seed_id in range(1000, 1200):
        if seed_id not in map_patterns:
            print(f"  ⚠️ 种子 {seed_id} 不在 MAP_PATTERN 中，跳过")
            continue

        mp = map_patterns[seed_id]
        construct_rows = constructs.get(seed_id, [])

        row = build_dlc_seed_row(
            seed_id, mp, construct_rows,
            small_base, attach_points, names, coords
        )

        # 计算在 data_rows 中的索引
        # data_rows[0] = seed 0, data_rows[i] = seed i (假设连续)
        # 但需要找到正确的行
        row_idx = None
        for i, dr in enumerate(data_rows):
            if dr and dr[0].strip() == str(seed_id):
                row_idx = i
                break

        if row_idx is not None:
            data_rows[row_idx] = row
            updated += 1
        else:
            print(f"  ⚠️ 种子 {seed_id} 在现有 CSV 中未找到")

        # 收集未知类型
        for type_id, is_display, _ in construct_rows:
            if is_display == 1 and type_id not in small_base and type_id not in names:
                cat = classify_type(type_id, small_base)
                if cat == 'unknown':
                    unknown_types.add(type_id)

    # ── 写入 CSV ──
    print(f"\n💾 写入 CSV...")
    with open(csv_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(header_row1)
        writer.writerow(header_row2)
        for row in data_rows:
            writer.writerow(row)

    print(f"✅ 完成！更新了 {updated} 个 DLC 种子")

    # ── 报告未知类型 ──
    if unknown_types:
        print(f"\n⚠️ 发现 {len(unknown_types)} 个未映射的类型 ID:")
        for tid in sorted(unknown_types):
            print(f"  - {tid}")


if __name__ == '__main__':
    main()
