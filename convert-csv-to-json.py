#!/usr/bin/env python3
"""
Convert CSV data to optimized JSON format for Nightreign seed recognition
This script processes the nightreignMapPatterns.csv file and creates an efficient JSON structure
"""

import csv
import json
import os
from datetime import datetime
from typing import Dict, List, Any

def parse_csv_file(csv_path: str) -> Dict[str, Any]:
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
        map_type = row_data.get('Map Type', 'Default')
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
                major_base_pois.append({'location': location, 'structure': structure, 'boss': boss})
        
        # Minor Base POIs
        minor_base_pois = []
        for location, value in row_data['Minor Base'].items():
            if value:
                # Parse value as '<structure> - <detail>'
                structure, detail = value.split(' - ', 1)
                
                # Special handling for certain structures
                if structure == 'Small Camp':
                    minor_base_pois.append({'location': location, 'structure': structure, 'enemy': detail})
                elif structure in ['Sorcerer\'s Rise', 'Difficult Sorcerer\'s Rise']:
                    # Parse puzzles as comma-separated list
                    puzzles = [puzzle.strip() for puzzle in detail.split(',')]
                    minor_base_pois.append({'location': location, 'structure': structure, 'puzzles': puzzles})
                else:
                    minor_base_pois.append({'location': location, 'structure': structure})
        
        # Evergaol POIs
        evergaol_pois = []
        for location, boss in row_data['Evergaol'].items():
            evergaol_pois.append({'location': location, 'boss': boss})
        
        # Field Boss POIs
        field_boss_pois = []
        for location, boss in row_data['Field Boss'].items():
            # Skip Castle Rooftop location
            if location == 'Castle Rooftop':
                continue
            field_boss_pois.append({'location': location, 'boss': boss})
        
        # Rotted Woods POIs
        rotted_woods_pois = []
        for location, boss in row_data['Rotted Woods'].items():
            # Skip Putrid Ancestral Followers
            if boss == 'Putrid Ancestral Followers':
                continue
            rotted_woods_pois.append({'location': location, 'boss': boss})
        
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

def main():
    """Main conversion function."""
    print("🔄 Starting CSV to JSON conversion...")

    # Set up paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(script_dir, 'dataset', 'nightreignMapPatterns.csv')
    output_path = os.path.join(script_dir, 'dataset', 'nightreignMapPatterns.json')

    try:
        # Parse CSV file and create JSON structure
        json_data = parse_csv_file(csv_path)
        print(f"📖 CSV file read successfully")
        print(f"🏗️  Created JSON structure with {len(json_data['seeds'])} seeds")

        # Write to JSON file
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, indent=2, ensure_ascii=False)

        print(f"✅ Conversion complete! Output saved to: {output_path}")

        # Display statistics
        print("\n📈 Conversion Statistics:")
        print(f"   • Total Seeds: {len(json_data['seeds'])}")

        return json_data

    except Exception as error:
        print(f"❌ Error during conversion: {error}")

if __name__ == "__main__":
    main()