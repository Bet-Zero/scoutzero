#!/usr/bin/env python3
"""
Test the parser with sample Jayson Tatum HTML
"""

import json
import sys
import os

# Add the parent directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from parse_contract_data_enhanced import parse_scraped_contract_html

def test_parser():
    """Test parser with sample HTML"""
    
    # Load sample HTML
    with open("/tmp/sample_tatum_contract.html", "r") as f:
        sample_html = f.read()
    
    # Create player data object
    player_data = {
        "name": "Jayson Tatum",
        "contractHtml": sample_html,
        "source": "scraped"
    }
    
    # Parse it
    print("🔄 Parsing Jayson Tatum contract...")
    result = parse_scraped_contract_html("jayson_tatum", player_data)
    
    if result:
        print("\n✅ Parsing successful!")
        print(f"   Contract Type: {result['contract_summary']['type']}")
        print(f"   Is Extension: {result['contract_summary']['is_extension']}")
        print(f"   Length: {result['contract_summary']['length']}")
        print(f"   Total Value: ${result['contract_summary']['value']:,}")
        print(f"   AAV: ${result['contract_summary']['aav']:,}")
        print(f"   Bird Rights: {result['bird_rights']}")
        
        print(f"\n📊 Annual Salaries:")
        salaries = result['contract']['annual_salaries']
        if salaries:
            for s in salaries:
                print(f"      {s['year']}: ${s['salary']:,}")
        else:
            print("      ❌ No salaries found!")
        
        print(f"\n📝 Full result:")
        print(json.dumps(result, indent=2))
    else:
        print("❌ Parsing failed!")
    
    return result

if __name__ == "__main__":
    test_parser()
