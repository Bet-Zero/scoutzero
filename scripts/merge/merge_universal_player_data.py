#!/usr/bin/env python3
"""
Universal player data merger - combines all data sources into unified player records
"""

import json
import os
from datetime import datetime

def merge_universal_player_data():
    print("🔀 Starting universal player data merge...")
    
    data_dir = os.path.join(os.path.dirname(__file__), '../../data')
    parsed_contracts_file = os.path.join(data_dir, 'parsed_contracts.json')
    merged_players_file = os.path.join(data_dir, 'merged_players.json')
    
    merged_data = {
        "last_updated": datetime.now().isoformat(),
        "source": "universal_merger",
        "players": {}
    }
    
    # Load contract data if available
    contracts_data = {}
    if os.path.exists(parsed_contracts_file):
        with open(parsed_contracts_file, 'r') as f:
            contract_info = json.load(f)
            contracts_data = contract_info.get('players', {})
        print(f"📊 Loaded contract data for {len(contracts_data)} players")
    else:
        print("⚠️  No contract data found - merge will proceed without contracts")
    
    # In a real implementation, this would also load:
    # - Bio data (age, height, weight, position)
    # - Stats data (from basketball-reference, NBA API)
    # - Grades and evaluations
    # - Trade data and contract details
    
    # For now, merge available contract data with placeholder bio data
    for player_id, contract_data in contracts_data.items():
        player_record = {
            "player_id": player_id,
            "name": contract_data.get('name', 'Unknown'),
            "display_name": contract_data.get('name', 'Unknown'),
            "team": contract_data.get('team', 'UNK'),
            "bio": contract_data.get('bio', {
                "age": 25,  # Placeholder
                "height": "6'6\"",  # Placeholder  
                "weight": 200,  # Placeholder
                "position": "SF"  # Placeholder
            }),
            "contract_summary": contract_data.get('contract_summary', {}),
            "salaries_by_year": contract_data.get('salaries_by_year', {}),
            "bird_rights": contract_data.get('bird_rights'),
            "trade_kicker": contract_data.get('trade_kicker'),
            "no_trade_clause": contract_data.get('no_trade_clause', False),
            "status": "Signed",
            "last_updated": datetime.now().isoformat()
        }
        
        merged_data["players"][player_id] = player_record
    
    # Save merged data
    os.makedirs(data_dir, exist_ok=True)
    with open(merged_players_file, 'w') as f:
        json.dump(merged_data, f, indent=2)
    
    print(f"📄 Merged player data saved to {merged_players_file}")
    print(f"✅ Merged data for {len(merged_data['players'])} players")
    
    return merged_players_file

if __name__ == "__main__":
    merge_universal_player_data()