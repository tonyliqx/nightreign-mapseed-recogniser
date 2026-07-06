#!/usr/bin/env python3
"""
Convert CSV data to optimized JSON format for Nightreign seed recognition
This script processes the nightreignMapPatterns.csv file and creates an efficient JSON structure
"""

import csv
import json
import os
from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Any, Tuple, Optional

# DLC 5xxxx type→{adv,icon} 映射表与 Great Hollow 候选点坐标的权威来源文件
_DLC_PARAMS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                               "dataset", "dlc-params")
_ADV_CSV_PATCH_PATH = os.path.join(_DLC_PARAMS_DIR, "advanced_csv_patch.json")
_TYPE_CATEGORY_ICON_PATH = os.path.join(_DLC_PARAMS_DIR, "type_category_icon.json")


def _load_great_hollow_coords() -> Dict[str, Tuple[float, float]]:
    """从 advanced_csv_patch.json 读取 Great Hollow 候选点坐标（1536 空间，41 个）。

    保持单一事实来源：坐标由 integrate_dlc.py 聚类产出，此处动态读取避免硬编码抄错。
    """
    try:
        with open(_ADV_CSV_PATCH_PATH, encoding="utf-8") as f:
            gh = json.load(f).get("great_hollow_coords", {})
        return {k: tuple(v) for k, v in gh.items()}
    except (FileNotFoundError, KeyError):
        return {}


def _load_dlc_type_icons() -> Dict[str, Dict[str, Optional[str]]]:
    """从 type_category_icon.json 动态生成 DLC type → icon 映射。

    按 adv 类目归类（majorBase→major_base，minorBase→minor_base 等），
    键为 5xxxx type 字符串（如 "52420"），值为 icon 名（如 cathedral_blank）。
    覆盖 46 条 type，避免手抄。
    """
    adv_to_cat = {"majorBase": "major_base", "minorBase": "minor_base",
                  "evergaol": "evergaol", "fieldBoss": "field_boss"}
    result: Dict[str, Dict[str, Optional[str]]] = {cat: {} for cat in adv_to_cat.values()}
    try:
        with open(_TYPE_CATEGORY_ICON_PATH, encoding="utf-8") as f:
            table = json.load(f)
    except FileNotFoundError:
        return result
    for type_str, info in table.items():
        cat = adv_to_cat.get(info.get("adv"))
        if cat:
            result[cat][type_str] = info.get("icon")
    return result


def get_poi_icon_mappings() -> Dict[str, Dict[str, str]]:
    """Return hardcoded mapping of POI categories to icon names."""
    mappings = {
        # Major Base - Structure & Boss combinations
        "major_base": {
            "Camp - Banished Knights": "camp_blank",
            "Camp - Elder Lion": "camp_blank",
            "Camp - Flame Chariots": "camp_fire",
            "Camp - Frenzied Flame Troll": "camp_madness",
            "Camp - Leonine Misbegotten": "camp_blank",
            "Camp - Redmane Knights": "camp_fire",
            "Camp - Royal Army Knights": "camp_lightning",
            "Fort - Abductor Virgin": "fort_blank",
            "Fort - Crystalians": "fort_magic",
            "Fort - Guardian Golem": "fort_blank",
            "Fort - Lordsworn Captain": "fort_blank",
            "Great Church - Fire Monk": "cathedral_fire",
            "Great Church - Guardian Golem": "cathedral_blank",
            "Great Church - Mausoleum Knight": "cathedral_blank",
            "Great Church - Oracle Envoys": "cathedral_holy",
            "Ruins - Albinauric Archers": "ruin_frost",
            "Ruins - Albinaurics": "ruin_holy",
            "Ruins - Ancient Heroes of Zamor": "ruin_frost",
            "Ruins - Battlemages": "ruin_magic",
            "Ruins - Beastmen of Farum Azula": "ruin_lightning",
            "Ruins - Depraved Perfumer": "ruin_poison",
            "Ruins - Erdtree Burial Watchdogs": "ruin_blank",
            "Ruins - Perfumer": "ruin_poison",
            "Ruins - Runebear": "ruin_sleep",
            "Ruins - Sanguine Noble": "ruin_blood",
            "Ruins - Wormface": "ruin_death"
        },
        
        # Minor Base - Structures only
        "minor_base": {
            "Church": "church",
            "Difficult Sorcerer's Rise": "ancient_rise",
            "Small Camp": None,
            "Sorcerer's Rise": "rise",
            "Township": None
        },
        
        # Field Boss - Bosses only
        "field_boss": {
            "Ancestor Spirit": "elite",
            "Ancient Hero of Zamor": "field_boss",
            "Bell Bearing Hunter": "elite",
            "Black Blade Kindred": "elite",
            "Black Knife Assassin": "field_boss",
            "Death Rite Bird": "elite",
            "Demi-Human Queen": "field_boss",
            "Draconic Tree Sentinel": "elite",
            "Elder Lion": "field_boss",
            "Erdtree Avatar": "elite",
            "Flying Dragon": "elite",
            "Golden Hippopotamus": "field_boss",
            "Grafted Scion": "field_boss",
            "Leonine Misbegotten": "field_boss",
            "Magma Wyrm": "elite",
            "Miranda Blossom": "field_boss",
            "Night's Cavalry": "field_boss",
            "Red Wolf": "field_boss",
            "Royal Carian Knight": "elite",
            "Royal Revenant": "field_boss",
            "Tree Sentinel": "elite",
            "Ulcerated Tree Spirit": "elite"
        },
        
        # Rotted Woods - Bosses only
        "rotted_woods": {
            "Ancestor Spirit": "elite",
            "Bell Bearing Hunter": "elite",
            "Black Blade Kindred": "elite",
            "Death Rite Bird": "elite",
            "Draconic Tree Sentinel": "elite",
            "Erdtree Avatar": "elite",
            "Magma Wyrm": "elite",
            "Royal Carian Knight": "elite",
            "Tree Sentinel": "elite",
            "Ulcerated Tree Spirit": "elite"
        },
        
        # Evergaol - All use same icon
        "evergaol": {
            "all": "evergaol"
        }
    }
    # 合并 DLC 5xxxx type → icon 映射（动态从 type_category_icon.json 读取）
    # major_base 补 3 条 cathedral_blank；minor_base 补 35 条 rise/ruin_blank；
    # evergaol 补 7 条（保留 "all" 兜底）；field_boss 补 53990。
    dlc_icons = _load_dlc_type_icons()
    for cat, items in dlc_icons.items():
        mappings.setdefault(cat, {}).update(items)
    return mappings

def get_poi_coordinates() -> Dict[str, Dict[str, Tuple[float, float]]]:
    """Return hardcoded mapping of POI categories to location coordinates."""
    return {
        # Minor Base locations - 11 locations
        "minor_base": {
            "Third Church": (1196, 543),
            "East of Cavalry Bridge": (844, 972),
            "Northeast of Saintsbridge": (824, 340),
            "Far Southwest": (310, 1090),
            "West of Warmaster's Shack": (336, 541.54),
            "Southeast of Lake": (874, 1224),
            "Above Stormhill Tunnel Entrance": (554, 608),
            "Lake": (697, 1067),
            "Stormhill South of Gate": (318, 852),
            "Below Summonwater Hawk": (1066, 559),
            "Minor Erdtree": (1238, 892)
        },
        
        # Major Base locations - 16 locations
        "major_base": {
            "Stormhill North of Gate": (437, 684),
            "Minor Erdtree": (1156, 964),
            "Summonwater Approach": (969, 448),
            "Northwest Mistwood": (1022, 710),
            "Gatefront": (492, 846),
            "Waypoint Ruins": (941, 1054),
            "Northeast Mistwood": (1191, 649),
            "Groveside": (429, 1003),
            "Northwest Stormhill": (354, 429),
            "South Mistwood": (1147, 1132),
            "West Mistwood": (971, 905),
            "Northeast Stormhill": (616, 273),
            "South Lake": (611, 1201),
            "Alexander Spot": (640, 461),
            "Summonwater": (1096, 330),
            "Artist's Shack": (898, 653)
        },
        
        # Evergaol locations - 7 locations
        "evergaol": {
            "Northwest of Lake": (532.65, 970.35),
            "East of Lake": (953.3, 1178.55),
            "Murkwater Terminus": (684.37, 586.82),
            "Stormhill": (258.6, 486.97),
            "Northeast Tunnel Entrance": (969.22, 557.85),
            "Highroad": (739.79, 301.91),
            "Mistwood": (1213.87, 749.62)
        },
        
        # Field Boss locations - 10 locations
        "field_boss": {
            "Far Southwest of Lake": (477.28, 1263.43),
            "Lake": (665, 1097), # CV recognition coordinate.
            "North of Stormhill Tunnel Entrance": (478.25, 574.2),
            "North of Murkwater Terminus": (724.86, 551.25),
            "Stormhill Spectral Hawk": (515.19, 364.85),
            "Northwest Stormhill Cliffside": (453, 294), # CV recognition coordinate.
            "Mistwood Spectral Hawk": (1049.07, 1198.38),
            "North Mistwood": (1174.18, 778.31),
            "East of Murkwater Terminus": (846.46, 584.37),
            "Northwest of Summonwater": (975.16, 333.17)
        },
        
        # Rotted Woods locations - 8 locations
        "rotted_woods": {
            "Southwest": (995.06, 1139.42),
            "Southeast": (1205.98, 1059.54),
            "Center West": (930.3, 955.0),
            "Center East": (1111.23, 979.51),
            "Far Northwest": (882.42, 867.61),
            "Northwest": (968.97, 856.12),
            "Northeast": (1177.51, 921.69),
            "Far Northeast": (1201.5, 849.72)
        },

        # Great Hollow locations - DLC: The Forsaken Hollows
        # 动态从 advanced_csv_patch.json 读取 41 个候选点坐标（1536 聚类空间）
        "great_hollow": _load_great_hollow_coords()
    }

def get_poi_icon(category: str, structure: str, boss: str, icon_mappings: Dict[str, Dict[str, str]]) -> str:
    """Determine the icon for a POI based on its category, structure, and boss."""
    # DLC 5xxxx type 编号（纯数字）：直接按 type 查 DLC 图标映射，跳过常规组合查找。
    # Great Hollow 的 POI value 是裸 type 编号（不含 ' - ' 分隔符）。
    if structure and structure.isdigit():
        return icon_mappings.get(category, {}).get(structure)

    if category == "major_base":
        # Major base uses structure-boss combination
        # If boss is None (e.g., Map Events), the combo will be "Map Event - None" which won't match any mapping
        combo = f"{structure} - {boss}"
        return icon_mappings["major_base"].get(combo)
    
    elif category == "minor_base":
        # Minor base uses structure only
        return icon_mappings["minor_base"].get(structure)
    
    elif category == "field_boss":
        # Field boss uses boss only
        return icon_mappings["field_boss"].get(boss)
    
    elif category == "rotted_woods":
        # Rotted woods uses boss only
        return icon_mappings["rotted_woods"].get(boss)
    
    elif category == "evergaol":
        # Evergaol always uses the same icon
        return icon_mappings["evergaol"]["all"]
    
    return None

def find_minor_base_data_for_spawn_point(spawn_point_location: str, all_pois: Dict[str, Any], location_coords: Dict[str, Dict[str, Tuple[float, float]]]) -> Dict[str, Any]:
    """Find the corresponding minor base data for a spawn point location."""
    
    # Look through all POIs to find a minor base with matching location
    for poi_id, poi in all_pois.items():
        if poi.get('category') == 'minorBase' and poi.get('location') == spawn_point_location:
            # Found matching minor base, extract coordinate and enemy
            coordinates = poi.get('coordinates', {})
            enemy = poi.get('enemy', 'Rats')  # Default to "Rats" if no enemy field
            
            return {
                'location': spawn_point_location,
                'coordinate': coordinates,
                'enemy': enemy
            }
    
    # If no matching minor base found, try to get coordinates from hardcoded data
    # and default enemy to "Rats" (for church spawn points)
    if spawn_point_location in location_coords['minor_base']:
        coords = location_coords['minor_base'][spawn_point_location]
        return {
            'location': spawn_point_location,
            'coordinate': {'x': coords[0], 'y': coords[1]},
            'enemy': 'Rats (Church Only)'  # Default for church spawn points
        }
    
    # Fallback if location not found
    return {
        'location': spawn_point_location,
        'coordinate': {},
        'enemy': 'Rats (Church Only)'
    }

def parse_csv_file(csv_path: str, location_coords: Dict[str, Dict[str, Tuple[float, float]]], icon_mappings: Dict[str, Dict[str, str]]) -> Dict[str, Any]:
    """Parse the CSV file and return complete JSON structure."""
    with open(csv_path, 'r', encoding='utf-8') as file:
        reader = csv.reader(file)
        rows = list(reader)
    
    
    # Initialize the complete JSON structure
    json_data = {
        "extractedTime": datetime.now().isoformat(),
        "seeds": {}
    }
    
    # Process each seed row as key-value pairs
    for i in range(2, len(rows)):
        row = rows[i]
        if not row or not row[0]:  # Skip empty rows
            continue
        
        # Create key-value pairs for this row (skip first empty column)
        row_data = {}
        for col in range(1, len(rows[0])):
            header = rows[0][col].strip()
            second_header = rows[1][col].strip()
            
            if second_header:
                # Create nested dictionary structure
                if header not in row_data:
                    row_data[header] = {}
                row_data[header][second_header] = row[col].strip() if row[col].strip() else None
            else:
                # Simple key-value pair
                row_data[header] = row[col].strip() if row[col].strip() else None
        
        # Extract basic seed data from simple keys
        seed_number = int(row[0].strip()) if row[0].strip() else i - 2
        nightlord = row_data.get('Nightlord', 'Unknown')
        map_type = row_data.get('Shifting Earth', 'Default')
        spawn_point_location = row_data.get('Spawn Point', '')
        special_event = row_data.get('Special Event')
        
        # Night 1 and Night 2 data
        night_1_boss = row_data.get('Night 1 Boss')
        night_2_boss = row_data.get('Night 2 Boss')
        night_1_circle = row_data.get('Night 1 Circle')
        night_2_circle = row_data.get('Night 2 Circle')
        extra_night_boss_value = row_data.get('Extra Night Boss')
        
        # Handle Extra Night Boss
        night_1_extra_boss = None
        night_2_extra_boss = None
        if extra_night_boss_value and special_event:
            if special_event == "Day 1 Extra Night Boss":
                night_1_extra_boss = extra_night_boss_value
            elif special_event == "Day 2 Extra Night Boss":
                night_2_extra_boss = extra_night_boss_value
        
        # Standalone properties
        rot_blessing = row_data.get('Rot Blessing')
        frenzy_tower = row_data.get('Frenzy Tower')
        scale_bearing_merchant = row_data.get('Scale-Bearing Merchant')
        
        
        # All POIs in a single dictionary
        all_pois = {}
        start_index = 0
        
        # Major Base POIs
        for index, (location, value) in enumerate(row_data['Major Base'].items()):
            if value:
                # Parse value as '<structure> - <boss>'；DLC Great Hollow 的 value 是裸 5xxxx type 编号，无分隔符
                parts = value.split(' - ', 1)
                structure = parts[0]
                boss = parts[1] if len(parts) > 1 else None

                # For Map Events, set boss to null since the "boss" is actually just a location name
                if structure == 'Map Event':
                    boss = None

                poi_data = {'location': location, 'structure': structure, 'boss': boss, 'index': start_index + index, 'category': 'majorBase'}

                # Add coordinates if available（先查 major_base，未命中回退到 great_hollow 候选点）
                coords = location_coords['major_base'].get(location) or location_coords['great_hollow'].get(location)
                if coords:
                    poi_data['coordinates'] = {'x': coords[0], 'y': coords[1]}
                
                # Add icon
                icon = get_poi_icon('major_base', structure, boss, icon_mappings)
                poi_data['icon'] = icon
                
                all_pois[f"{start_index + index}"] = poi_data
        
        start_index += len(row_data['Major Base'])
        
        # Minor Base POIs
        for index, (location, value) in enumerate(row_data['Minor Base'].items()):
            if value:
                # Parse value as '<structure> - <detail>'；DLC Great Hollow 的 value 是裸 5xxxx type 编号，无分隔符
                parts = value.split(' - ', 1)
                structure = parts[0]
                detail = parts[1] if len(parts) > 1 else None

                # Special handling for certain structures
                if structure == 'Small Camp':
                    poi_data = {'location': location, 'structure': structure, 'enemy': detail, 'index': start_index + index, 'category': 'minorBase'}
                elif structure in ['Sorcerer\'s Rise', 'Difficult Sorcerer\'s Rise'] and detail:
                    # Parse puzzles as comma-separated list
                    puzzles = [puzzle.strip() for puzzle in detail.split(',')]
                    poi_data = {'location': location, 'structure': structure, 'puzzles': puzzles, 'index': start_index + index, 'category': 'minorBase'}
                else:
                    poi_data = {'location': location, 'structure': structure, 'index': start_index + index, 'category': 'minorBase'}

                # Add coordinates if available（先查 minor_base，未命中回退到 great_hollow 候选点）
                coords = location_coords['minor_base'].get(location) or location_coords['great_hollow'].get(location)
                if coords:
                    poi_data['coordinates'] = {'x': coords[0], 'y': coords[1]}
                
                # Add icon
                icon = get_poi_icon('minor_base', structure, None, icon_mappings)
                poi_data['icon'] = icon
                
                all_pois[f"{start_index + index}"] = poi_data
        
        start_index += len(row_data['Minor Base'])
        
        # Evergaol POIs
        for index, (location, boss) in enumerate(row_data['Evergaol'].items()):
            if boss:  # Only process if boss value exists
                poi_data = {'location': location, 'boss': boss, 'index': start_index + index, 'category': 'evergaol'}

                # Add coordinates if available（先查 evergaol，未命中回退到 great_hollow 候选点）
                coords = location_coords['evergaol'].get(location) or location_coords['great_hollow'].get(location)
                if coords:
                    poi_data['coordinates'] = {'x': coords[0], 'y': coords[1]}
                
                # Add icon
                icon = get_poi_icon('evergaol', None, boss, icon_mappings)
                poi_data['icon'] = icon
                
                all_pois[f"{start_index + index}"] = poi_data
        
        start_index += len(row_data['Evergaol'])
        
        # Field Boss POIs
        for index, (location, boss) in enumerate(row_data['Field Boss'].items()):
            if boss:  # Only process if boss value exists
                # Skip Castle Rooftop location
                if location == 'Castle Rooftop':
                    continue
                
                poi_data = {'location': location, 'boss': boss, 'index': start_index + index, 'category': 'fieldBoss'}

                # Add coordinates if available（先查 field_boss，未命中回退到 great_hollow 候选点）
                coords = location_coords['field_boss'].get(location) or location_coords['great_hollow'].get(location)
                if coords:
                    poi_data['coordinates'] = {'x': coords[0], 'y': coords[1]}
                
                # Add icon
                icon = get_poi_icon('field_boss', None, boss, icon_mappings)
                poi_data['icon'] = icon
                
                all_pois[f"{start_index + index}"] = poi_data
        
        start_index += len(row_data['Field Boss'])
        
        # Rotted Woods POIs
        for index, (location, boss) in enumerate(row_data['Rotted Woods'].items()):
            if boss:  # Only process if boss value exists
                # Set Putrid Ancestral Followers to null since it does not show as a boss icon on the map.
                processed_boss = None if boss == 'Putrid Ancestral Followers' else boss
                
                poi_data = {'location': location, 'boss': processed_boss, 'index': start_index + index, 'category': 'rottedWoods'}
                
                # Add coordinates if available (use rotted_woods category)
                if location in location_coords['rotted_woods']:
                    coords = location_coords['rotted_woods'][location]
                    poi_data['coordinates'] = {'x': coords[0], 'y': coords[1]}
                
                # Add icon
                icon = get_poi_icon('rotted_woods', None, boss, icon_mappings)
                poi_data['icon'] = icon
                
                all_pois[f"{start_index + index}"] = poi_data
        
        # Castle data from nested structure
        castle_data = {
            'main': row_data['Castle']['Castle'],
            'basement': row_data['Arena Boss']['Castle Basement'],
            'rooftop': row_data['Field Boss']['Castle Rooftop']
        }
        
        # Create spawn point object with location, coordinate, and enemy
        spawn_point_object = find_minor_base_data_for_spawn_point(spawn_point_location, all_pois, location_coords)
        
        # Add seed to JSON
        json_data["seeds"][str(seed_number)] = {
            "seedNumber": seed_number,
            "nightlord": nightlord,
            "mapType": map_type,
            "spawnPoint": spawn_point_object,
            "specialEvent": special_event,
            "night1": {
                "boss": night_1_boss,
                "location": night_1_circle,
                "extraBoss": night_1_extra_boss
            },
            "night2": {
                "boss": night_2_boss,
                "location": night_2_circle,
                "extraBoss": night_2_extra_boss
            },
            "castle": castle_data,
            "pois": all_pois,
            "rotBlessing": rot_blessing,
            "frenzyTower": frenzy_tower,
            "scaleBearingMerchant": scale_bearing_merchant
        }
    
    return json_data

def generate_poi_lookup_by_map_type(data: Dict[str, Any], location_coords: Dict[str, Dict[str, Tuple[float, float]]]) -> Dict[str, List[Dict[str, Any]]]:
    """Generate POI lookup by map type with coordinates - flattened structure."""
    
    # Group seeds by map type
    map_types = defaultdict(list)
    for seed_id, seed_data in data['seeds'].items():
        map_type = seed_data['mapType']
        map_types[map_type].append(seed_data)
    
    # Analyze POI availability for each map type
    poi_lookup = {}
    
    for map_type, seeds in map_types.items():
        print(f"  📍 Analyzing {map_type} ({len(seeds)} seeds)...")
        
        # Track which POI locations have appeared at least once with their data
        available_pois = {}
        
        # Check each seed for POI presence and collect data
        for seed in seeds:
            # Handle both dictionary and list formats
            if isinstance(seed['pois'], dict):
                pois_iter = seed['pois'].items()
            else:
                # If it's still the old format, skip for now
                continue
                
            for poi_id, poi in pois_iter:
                location = poi['location']
                category = poi['category']
                index = poi['index']
                
                # Create unique key for this POI (location + category)
                key = f"{location}_{category}"
                
                if key not in available_pois:
                    # Store POI data with category and index
                    poi_data = {
                        'id': poi_id,
                        'location': location,
                        'category': category,
                        'index': index,
                        'coordinates': poi.get('coordinates', {})
                    }
                    available_pois[key] = poi_data
        
        # Convert to sorted list by index
        poi_lookup[map_type] = sorted(list(available_pois.values()), key=lambda x: x['index'])
    
    return poi_lookup

def main():
    """Main conversion function."""
    print("🔄 Starting CSV to JSON conversion...")

    # Set up paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(script_dir, 'dataset', 'nightreignMapPatterns.csv')
    output_path = os.path.join(script_dir, 'dataset', 'nightreignMapPatterns.json')

    try:
        # Get hardcoded POI coordinates
        print("📍 Loading POI coordinates...")
        location_coords = get_poi_coordinates()
        total_coords = sum(len(coords) for coords in location_coords.values())
        print(f"📍 Loaded {total_coords} hardcoded location coordinates across {len(location_coords)} categories")
        
        # Get hardcoded POI icon mappings
        print("🎨 Loading POI icon mappings...")
        icon_mappings = get_poi_icon_mappings()
        total_icons = sum(len(mappings) for mappings in icon_mappings.values())
        print(f"🎨 Loaded {total_icons} icon mappings across {len(icon_mappings)} categories")
        
        # Parse CSV file and create JSON structure
        json_data = parse_csv_file(csv_path, location_coords, icon_mappings)
        print(f"📖 CSV file read successfully")
        print(f"🏗️  Created JSON structure with {len(json_data['seeds'])} seeds")

        # Generate POI lookup by map type
        print("🔍 Generating POI lookup by map type...")
        poi_lookup = generate_poi_lookup_by_map_type(json_data, location_coords)
        json_data['poiLookupByMapType'] = poi_lookup

        # Write to JSON file
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, indent=2, ensure_ascii=False)

        print(f"✅ Conversion complete! Output saved to: {output_path}")

        # Display statistics
        print("\n📈 Conversion Statistics:")
        print(f"   • Total Seeds: {len(json_data['seeds'])}")
        print(f"   • Map Types: {len(poi_lookup)}")
        for map_type, pois in poi_lookup.items():
            print(f"     - {map_type}: {len(pois)} POIs")

        return json_data

    except Exception as error:
        print(f"❌ Error during conversion: {error}")

if __name__ == "__main__":
    main()