#!/usr/bin/env python3
"""
Contract data parser - processes raw contract data into clean format
"""

import json
import os
from datetime import datetime

def parse_contract_data():
    print("🔧 Starting contract data parsing...")
    
    data_dir = os.path.join(os.path.dirname(__file__), '../../data')
    raw_contracts_file = os.path.join(data_dir, 'raw_contracts.json')
    parsed_contracts_file = os.path.join(data_dir, 'parsed_contracts.json')
    
    if not os.path.exists(raw_contracts_file):
        print(f"❌ Raw contracts file not found: {raw_contracts_file}")
        print("💡 Run scrape_all_contracts.py first")
        return None
    
    # Load raw contract data
    with open(raw_contracts_file, 'r') as f:
        raw_data = json.load(f)
    
    parsed_data = {
        "last_updated": datetime.now().isoformat(),
        "source": "contract_parser",
        "players": {}
    }
    
    # Parse each contract into clean format
    for player_id, contract_data in raw_data.get('contracts', {}).items():
        parsed_contract = {
            "contract_summary": {
                "years": contract_data.get('years'),
                "total_value": contract_data.get('total_value'),
                "average_value": contract_data.get('average_annual_value'),
                "guaranteed_total": contract_data.get('guaranteed'),
                "salaries_by_year": {}
            },
            "team": contract_data.get('team'),
            "player_name": contract_data.get('player_name')
        }
        
        # Parse salary details by year
        for year, salary_info in contract_data.get('salaries_by_year', {}).items():
            parsed_contract["contract_summary"]["salaries_by_year"][year] = {
                "salary": salary_info.get('salary', 0),
                "guaranteed": salary_info.get('guaranteed', 0),
                "option": salary_info.get('option'),
                "source": "parsed_scrape"
            }
        
        parsed_data["players"][player_id] = parsed_contract
    
    # Save parsed data
    with open(parsed_contracts_file, 'w') as f:
        json.dump(parsed_data, f, indent=2)
    
    print(f"📄 Parsed contract data saved to {parsed_contracts_file}")
    print(f"✅ Parsed {len(parsed_data['players'])} player contracts")
    
    return parsed_contracts_file

if __name__ == "__main__":
    parse_contract_data()