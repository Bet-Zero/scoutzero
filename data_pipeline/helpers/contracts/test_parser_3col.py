#!/usr/bin/env python3
"""
Test the parser with 3-column table
"""

import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from parse_contract_data_enhanced import parse_scraped_contract_html

def test_3col():
    """Test parser with 3-column table"""
    
    with open("/tmp/sample_3col_contract.html", "r") as f:
        sample_html = f.read()
    
    player_data = {
        "name": "Test Player",
        "contractHtml": sample_html,
        "source": "scraped"
    }
    
    print("🔄 Parsing 3-column table contract...")
    result = parse_scraped_contract_html("test_player", player_data)
    
    if result:
        print("\n✅ Parsing successful!")
        print(f"   Total Value: ${result['contract_summary']['value']:,}")
        
        print(f"\n📊 Annual Salaries:")
        salaries = result['contract']['annual_salaries']
        if salaries:
            for s in salaries:
                print(f"      {s['year']}: ${s['salary']:,}")
        else:
            print("      ❌ No salaries found!")
    else:
        print("❌ Parsing failed!")
    
    return result

if __name__ == "__main__":
    test_3col()
