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
from typing import Dict, List, Any, Tuple

def get_poi_coordinates() -> Dict[str, Dict[str, Tuple[int, int]]]:
    """Return hardcoded mapping of POI categories to location coordinates."""
    return {
        # Minor Base locations - 11 locations
        "minor_base": {
            "Third Church": (1196, 543),
            "East of Cavalry Bridge": (844, 972),
            "Northeast of Saintsbridge": (824, 340),
            "Far Southwest": (310, 1090),
            "West of Warmaster's Shack": (336, 542),
            "Southeast of Lake": (874, 1224),
            "Above Stormhill Tunnel Entrance": (554, 608),
            "Lake": (697, 1067),
            "Stormhill South of Gate": (318, 852),
            "Below Summonwater Hawk": (1066, 559),
            "Minor Erdtree": (1238, 892)
        },
        
        # Major Base locations - 16 locations
        "major_base": {
            "Stormhill North of Gate": (438, 683),
            "Minor Erdtree": (1157, 963),
            "Summonwater Approach": (970, 447),
            "Northwest Mistwood": (1023, 709),
            "Gatefront": (493, 845),
            "Waypoint Ruins": (942, 1053),
            "Northeast Mistwood": (1192, 648),
            "Groveside": (430, 1002),
            "Northwest Stormhill": (355, 428),
            "South Mistwood": (1148, 1131),
            "West Mistwood": (972, 904),
            "Northeast Stormhill": (1097, 329),
            "South Lake": (612, 1200),
            "Alexander Spot": (641, 460),
            "Summonwater": (617, 272),
            "Artist's Shack": (899, 652)
        },
        
        # Evergaol locations - 7 locations
        "evergaol": {
            "Northwest of Lake": (532, 968),
            "East of Lake": (952, 1176),
            "Murkwater Terminus": (684, 585),
            "Stormhill": (258, 485),
            "Northeast Tunnel Entrance": (968, 556),
            "Highroad": (739, 300),
            "Mistwood": (1212, 748)
        },
        
        # Field Boss locations - 10 locations
        "field_boss": {
            "Far Southwest of Lake": (477, 1263),
            "Lake": (665, 1097),
            "North of Stormhill Tunnel Entrance": (478, 575),
            "North of Murkwater Terminus": (724, 552),
            "Stormhill Spectral Hawk": (515, 365),
            "Northwest Stormhill Cliffside": (453, 294),
            "Mistwood Spectral Hawk": (1048, 1198),
            "North Mistwood": (1173, 778),
            "East of Murkwater Terminus": (845, 585),
            "Northwest of Summonwater": (974, 334)
        },
        
        # Rotted Woods locations - 8 locations
        "rotted_woods": {
            "Southwest": (994, 1139),
            "Southeast": (1204, 1059),
            "Center West": (929, 954),
            "Center East": (1110, 979),
            "Far Northwest": (881, 867),
            "Northwest": (967, 856),
            "Northeast": (1176, 921),
            "Far Northeast": (1200, 849)
        }
    }

def parse_csv_file(csv_path: str, location_coords: Dict[str, Dict[str, Tuple[int, int]]]) -> Dict[str, Any]:
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
        spawn_point = row_data.get('Spawn Point', '')
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
        
        
        # Major Base POIs
        major_base_pois = []
        for location, value in row_data['Major Base'].items():
            if value:
                # Parse value as '<structure> - <boss>'
                structure, boss = value.split(' - ', 1)
                poi_data = {'location': location, 'structure': structure, 'boss': boss}
                
                # Add coordinates if available (use major_base category)
                if location in location_coords['major_base']:
                    coords = location_coords['major_base'][location]
                    poi_data['coordinates'] = {'x': coords[0], 'y': coords[1]}
                
                major_base_pois.append(poi_data)
        
        # Minor Base POIs
        minor_base_pois = []
        for location, value in row_data['Minor Base'].items():
            if value:
                # Parse value as '<structure> - <detail>'
                structure, detail = value.split(' - ', 1)
                
                # Special handling for certain structures
                if structure == 'Small Camp':
                    poi_data = {'location': location, 'structure': structure, 'enemy': detail}
                elif structure in ['Sorcerer\'s Rise', 'Difficult Sorcerer\'s Rise']:
                    # Parse puzzles as comma-separated list
                    puzzles = [puzzle.strip() for puzzle in detail.split(',')]
                    poi_data = {'location': location, 'structure': structure, 'puzzles': puzzles}
                else:
                    poi_data = {'location': location, 'structure': structure}
                
                # Add coordinates if available (use minor_base category)
                if location in location_coords['minor_base']:
                    coords = location_coords['minor_base'][location]
                    poi_data['coordinates'] = {'x': coords[0], 'y': coords[1]}
                
                minor_base_pois.append(poi_data)
        
        # Evergaol POIs
        evergaol_pois = []
        for location, boss in row_data['Evergaol'].items():
            if boss:  # Only process if boss value exists
                poi_data = {'location': location, 'boss': boss}
                
                # Add coordinates if available
                if location in location_coords['evergaol']:
                    coords = location_coords['evergaol'][location]
                    poi_data['coordinates'] = {'x': coords[0], 'y': coords[1]}
                
                evergaol_pois.append(poi_data)
        
        # Field Boss POIs
        field_boss_pois = []
        for location, boss in row_data['Field Boss'].items():
            if boss:  # Only process if boss value exists
                # Skip Castle Rooftop location
                if location == 'Castle Rooftop':
                    continue
                
                poi_data = {'location': location, 'boss': boss}
                
                # Add coordinates if available (use field_boss category)
                if location in location_coords['field_boss']:
                    coords = location_coords['field_boss'][location]
                    poi_data['coordinates'] = {'x': coords[0], 'y': coords[1]}
                
                field_boss_pois.append(poi_data)
        
        # Rotted Woods POIs
        rotted_woods_pois = []
        for location, boss in row_data['Rotted Woods'].items():
            if boss:  # Only process if boss value exists
                # Skip Putrid Ancestral Followers
                if boss == 'Putrid Ancestral Followers':
                    continue
                
                poi_data = {'location': location, 'boss': boss}
                
                # Add coordinates if available (use rotted_woods category)
                if location in location_coords['rotted_woods']:
                    coords = location_coords['rotted_woods'][location]
                    poi_data['coordinates'] = {'x': coords[0], 'y': coords[1]}
                
                rotted_woods_pois.append(poi_data)
        
        # Castle data from nested structure
        castle_data = {
            'main': row_data['Castle']['Castle'],
            'basement': row_data['Arena Boss']['Castle Basement'],
            'rooftop': row_data['Field Boss']['Castle Rooftop']
        }
        
        # Add seed to JSON
        json_data["seeds"][str(seed_number)] = {
            "seedNumber": seed_number,
            "nightlord": nightlord,
            "mapType": map_type,
            "spawnPoint": spawn_point,
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
            "pois": {
                "majorBase": major_base_pois,
                "minorBase": minor_base_pois,
                "evergaol": evergaol_pois,
                "fieldBoss": field_boss_pois,
                "rottedWoods": rotted_woods_pois
            },
            "rotBlessing": rot_blessing,
            "frenzyTower": frenzy_tower,
            "scaleBearingMerchant": scale_bearing_merchant
        }
    
    return json_data

def generate_poi_lookup_by_map_type(data: Dict[str, Any], location_coords: Dict[str, Dict[str, Tuple[int, int]]]) -> Dict[str, Dict[str, List[Dict[str, Any]]]]:
    """Generate POI lookup by map type with coordinates."""
    
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
        available_pois = {
            'majorBase': {},
            'minorBase': {},
            'evergaol': {},
            'fieldBoss': {},
            'rottedWoods': {}
        }
        
        # Check each seed for POI presence and collect data
        for seed in seeds:
            for category, available_dict in available_pois.items():
                for poi in seed['pois'][category]:
                    location = poi['location']
                    if location not in available_dict:
                        # Store only location and coordinates
                        poi_data = {
                            'location': location,
                            'coordinates': poi.get('coordinates', {})
                        }
                        available_dict[location] = poi_data
        
        # Convert to sorted lists
        poi_lookup[map_type] = {
            category: sorted(list(available_dict.values()), key=lambda x: x['location'])
            for category, available_dict in available_pois.items()
        }
    
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
        
        # Parse CSV file and create JSON structure
        json_data = parse_csv_file(csv_path, location_coords)
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
        for map_type, categories in poi_lookup.items():
            total_pois = sum(len(pois) for pois in categories.values())
            print(f"     - {map_type}: {total_pois} POIs")

        return json_data

    except Exception as error:
        print(f"❌ Error during conversion: {error}")

if __name__ == "__main__":
    main()