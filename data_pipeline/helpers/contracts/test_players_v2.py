#!/usr/bin/env python3
"""
Test script for Players v2 scraper
Tests parsing logic with mock HTML data
"""

import json
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(__file__))

from scrape_players_v2 import (
    parse_player_html,
    extract_bird_rights_details,
    extract_free_agency_info,
    extract_trade_eligibility,
    extract_salary_table
)
from parse_players_v2 import (
    transform_to_architect_schema,
    validate_player_data
)

# Mock HTML data for testing
MOCK_HTML = """
<html>
<body>
<h1>Austin Reaves</h1>
<div class="sw_bodyContent">
    <div class="sw_playerContract__header">
        <h6>VETERAN CONTRACT</h6>
    </div>
    
    <div class="player-info">
        Position: G
        Height: 6-5
        Weight: 206
        Age: 26
        Experience: 3 years with team
    </div>
    
    <div class="contract-details">
        Signed using: Bird Exception
        Signed: July 1, 2023
        Bird Rights: Bird (Full)
        Free Agent: 2028 (UFA)
        Cap Hold: $18,750,000
    </div>
    
    <table class="salary-table">
        <tr>
            <th>Season</th>
            <th>Age</th>
            <th>Salary</th>
            <th>Cap Hit</th>
            <th>Option</th>
        </tr>
        <tr>
            <td>2023-24</td>
            <td>25</td>
            <td>$10,000,000</td>
            <td>$10,000,000</td>
            <td></td>
        </tr>
        <tr>
            <td>2024-25</td>
            <td>26</td>
            <td>$11,000,000</td>
            <td>$11,000,000</td>
            <td></td>
        </tr>
        <tr>
            <td>2025-26</td>
            <td>27</td>
            <td>$12,000,000</td>
            <td>$12,000,000</td>
            <td></td>
        </tr>
        <tr>
            <td>2026-27</td>
            <td>28</td>
            <td>$13,900,000</td>
            <td>$13,900,000</td>
            <td>Player Option</td>
        </tr>
    </table>
    
    <div class="trade-info">
        Trade eligible: Yes
        No Base Year Compensation
        Not subject to Poison Pill
        Can be aggregated in trades
    </div>
</div>
</body>
</html>
"""

def test_parse_player_html():
    """Test parsing complete player HTML"""
    print("🧪 Test 1: Parse Player HTML")
    print("-" * 50)
    
    player_data = parse_player_html("austin_reaves", MOCK_HTML)
    
    # Debug output
    actual_name = player_data.get("displayName")
    print(f"Debug - Actual name: '{actual_name}'")
    
    assert player_data["playerId"] == "austin_reaves", f"Player ID mismatch: {player_data['playerId']}"
    assert actual_name == "Austin Reaves", f"Name mismatch: expected 'Austin Reaves', got '{actual_name}'"
    
    print(f"✅ Player ID: {player_data['playerId']}")
    print(f"✅ Display Name: {player_data['displayName']}")
    print(f"✅ Contract Type: {player_data['contract']['contractType']}")
    print()

def test_extract_bird_rights():
    """Test Bird Rights extraction"""
    print("🧪 Test 2: Extract Bird Rights")
    print("-" * 50)
    
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(MOCK_HTML, 'html.parser')
    bird_rights = extract_bird_rights_details(soup)
    
    assert bird_rights["status"] == "Bird", f"Expected 'Bird', got {bird_rights['status']}"
    assert bird_rights["yearsWithTeam"] == 3, f"Expected 3 years, got {bird_rights['yearsWithTeam']}"
    
    print(f"✅ Bird Rights Status: {bird_rights['status']}")
    print(f"✅ Years with Team: {bird_rights['yearsWithTeam']}")
    print(f"✅ Eligible For: {bird_rights['eligibleFor']}")
    print()

def test_extract_free_agency():
    """Test Free Agency info extraction"""
    print("🧪 Test 3: Extract Free Agency Info")
    print("-" * 50)
    
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(MOCK_HTML, 'html.parser')
    fa_info = extract_free_agency_info(soup)
    
    assert fa_info["type"] == "UFA", f"Expected 'UFA', got {fa_info['type']}"
    assert fa_info["year"] == 2028, f"Expected 2028, got {fa_info['year']}"
    assert fa_info["capHold"] == 18750000, f"Expected 18750000, got {fa_info['capHold']}"
    
    print(f"✅ FA Type: {fa_info['type']}")
    print(f"✅ FA Year: {fa_info['year']}")
    print(f"✅ Cap Hold: ${fa_info['capHold']:,}")
    print()

def test_extract_trade_eligibility():
    """Test Trade Eligibility extraction"""
    print("🧪 Test 4: Extract Trade Eligibility")
    print("-" * 50)
    
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(MOCK_HTML, 'html.parser')
    eligibility = extract_trade_eligibility(soup)
    
    assert eligibility["canBeTradedNow"] == True, "Should be tradeable"
    assert eligibility["rules"]["baseYearCompensation"] == False, "Should not have BYC"
    assert eligibility["rules"]["poisonPill"] == False, "Should not have poison pill"
    assert eligibility["rules"]["aggregation"] == True, "Should be aggregatable"
    
    print(f"✅ Can Be Traded: {eligibility['canBeTradedNow']}")
    print(f"✅ BYC: {eligibility['rules']['baseYearCompensation']}")
    print(f"✅ Poison Pill: {eligibility['rules']['poisonPill']}")
    print(f"✅ Aggregation: {eligibility['rules']['aggregation']}")
    print()

def test_extract_salary_table():
    """Test Salary Table extraction"""
    print("🧪 Test 5: Extract Salary Table")
    print("-" * 50)
    
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(MOCK_HTML, 'html.parser')
    salaries = extract_salary_table(soup)
    
    assert len(salaries) == 4, f"Expected 4 salary years, got {len(salaries)}"
    
    # Check first year
    assert salaries[0]["season"] == "2023-24", f"Expected '2023-24', got {salaries[0]['season']}"
    assert salaries[0]["salary"] == 10000000, f"Expected 10000000, got {salaries[0]['salary']}"
    
    # Check option year
    assert salaries[-1]["option"] == "PO", f"Expected 'PO', got {salaries[-1]['option']}"
    
    print(f"✅ Salary Years: {len(salaries)}")
    print(f"✅ First Year: {salaries[0]['season']} - ${salaries[0]['salary']:,}")
    print(f"✅ Last Year: {salaries[-1]['season']} - ${salaries[-1]['salary']:,} ({salaries[-1]['option']})")
    print()

def test_transform_schema():
    """Test transformation to architect schema"""
    print("🧪 Test 6: Transform to Architect Schema")
    print("-" * 50)
    
    player_data = parse_player_html("austin_reaves", MOCK_HTML)
    architect_player = transform_to_architect_schema(player_data)
    
    # Validate required fields
    assert "playerId" in architect_player, "Missing playerId"
    assert "contract" in architect_player, "Missing contract"
    assert "birdRights" in architect_player["contract"], "Missing birdRights"
    assert "freeAgency" in architect_player["contract"], "Missing freeAgency"
    assert "tradeEligibility" in architect_player["contract"], "Missing tradeEligibility"
    
    print(f"✅ Player ID: {architect_player['playerId']}")
    print(f"✅ Bird Rights: {architect_player['contract']['birdRights']['status']}")
    print(f"✅ FA Type: {architect_player['contract']['freeAgency']['type']}")
    print(f"✅ Trade Eligible: {architect_player['contract']['tradeEligibility']['canBeTradedNow']}")
    print()

def test_validate_player_data():
    """Test player data validation"""
    print("🧪 Test 7: Validate Player Data")
    print("-" * 50)
    
    player_data = parse_player_html("austin_reaves", MOCK_HTML)
    is_valid, msg = validate_player_data(player_data)
    
    assert is_valid == True, f"Validation failed: {msg}"
    
    print(f"✅ Validation: {msg}")
    print()

def run_all_tests():
    """Run all tests"""
    print("=" * 70)
    print("🏀 Players v2 Scraper Test Suite")
    print("=" * 70)
    print()
    
    try:
        test_parse_player_html()
        test_extract_bird_rights()
        test_extract_free_agency()
        test_extract_trade_eligibility()
        test_extract_salary_table()
        test_transform_schema()
        test_validate_player_data()
        
        print("=" * 70)
        print("✅ All tests passed!")
        print("=" * 70)
        return True
        
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}")
        return False
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
