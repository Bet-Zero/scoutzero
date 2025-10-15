#!/usr/bin/env python3
"""
Parse Players v2 Contract Data for Architect
Transforms scraped player contract data into /architect/basePlayers schema
"""

import json
import os
import sys

def validate_player_data(player_data):
    """Validate that player data has required fields"""
    required_fields = ["playerId", "contract"]
    for field in required_fields:
        if field not in player_data:
            return False, f"Missing required field: {field}"
    
    contract = player_data.get("contract", {})
    if not contract.get("salariesByYear"):
        return False, "No salary data found"
    
    return True, "Valid"

def transform_to_architect_schema(player_data):
    """Transform scraped player data to match architect basePlayers schema"""
    
    contract = player_data.get("contract", {})
    salaries = contract.get("salariesByYear", [])
    
    # Build the architect-compliant structure
    architect_player = {
        # Player identity
        "playerId": player_data.get("playerId"),
        "displayName": player_data.get("displayName"),
        "teamCode": player_data.get("teamCode"),
        "teamName": player_data.get("teamName"),
        
        # Bio (minimal from player page)
        "bio": player_data.get("bio", {}),
        
        # Contract details
        "contract": {
            # Contract type and status
            "contractType": contract.get("contractType", "STANDARD CONTRACT"),
            "isExtension": contract.get("isExtension", False),
            "isRookieScale": contract.get("isRookieScale", False),
            
            # Signing details
            "signedUsing": contract.get("signedUsing"),
            "signingTeam": contract.get("signingTeam"),
            "signingDate": contract.get("signingDate"),
            "signedByCurrentTeam": contract.get("signedByCurrentTeam", True),
            
            # Contract duration
            "startSeason": contract.get("startSeason"),
            "endSeason": contract.get("endSeason"),
            "contractLength": contract.get("contractLength", 0),
            "yearsRemaining": calculate_years_remaining(salaries),
            
            # Financial summary
            "totalValue": contract.get("totalValue", 0),
            "averageAnnualValue": contract.get("averageAnnualValue", 0),
            "guaranteedValue": contract.get("guaranteedValue", 0),
            "guaranteedYears": contract.get("guaranteedYears", 0),
            
            # Per-season breakdown
            "salariesByYear": salaries,
            
            # Trade clauses
            "noTradeClause": contract.get("noTradeClause", False),
            "tradeKicker": contract.get("tradeKicker"),
            "tradeRestrictions": contract.get("tradeRestrictions", []),
            
            # Bird Rights & Free Agency
            "birdRights": contract.get("birdRights", {
                "status": None,
                "yearsOfService": None,
                "yearsWithTeam": None,
                "eligibleFor": []
            }),
            
            "freeAgency": contract.get("freeAgency", {
                "type": None,
                "year": None,
                "capHold": None,
                "qualifyingOffer": None,
                "earlyTerminationOption": None
            }),
            
            # Trade Eligibility (NEW for architect)
            "tradeEligibility": contract.get("tradeEligibility", {
                "canBeTradedNow": True,
                "restrictedUntil": None,
                "reason": None,
                "rules": {
                    "baseYearCompensation": False,
                    "poisonPill": False,
                    "aggregation": True
                }
            })
        },
        
        # Metadata
        "source": player_data.get("source", {
            "provider": "SalarySwish",
            "scrapedAt": None
        }),
        "lastUpdated": player_data.get("lastUpdated"),
        "version": player_data.get("version", "1.0")
    }
    
    return architect_player

def calculate_years_remaining(salaries):
    """Calculate years remaining on contract based on current season"""
    if not salaries:
        return 0
    
    # Assuming current season is 2025-26
    current_season = "2025-26"
    
    remaining = 0
    for salary in salaries:
        season = salary.get("season", "")
        if season >= current_season:
            remaining += 1
    
    return remaining

def parse_all_players(input_file, output_file):
    """Parse all players from scraped data"""
    
    print("🔄 Parsing Players v2 Contract Data for Architect")
    print("=" * 70)
    
    # Load scraped data
    try:
        with open(input_file, "r") as f:
            scraped_players = json.load(f)
        print(f"✅ Loaded {len(scraped_players)} players from: {input_file}")
    except FileNotFoundError:
        print(f"❌ Input file not found: {input_file}")
        return False
    except json.JSONDecodeError as e:
        print(f"❌ Invalid JSON in input file: {e}")
        return False
    
    # Parse and transform each player
    parsed_players = {}
    valid_count = 0
    invalid_count = 0
    
    for player_id, player_data in scraped_players.items():
        # Validate
        is_valid, msg = validate_player_data(player_data)
        
        if not is_valid:
            print(f"⚠️  Skipping {player_id}: {msg}")
            invalid_count += 1
            continue
        
        # Transform to architect schema
        try:
            architect_player = transform_to_architect_schema(player_data)
            parsed_players[player_id] = architect_player
            valid_count += 1
        except Exception as e:
            print(f"❌ Error parsing {player_id}: {str(e)[:50]}...")
            invalid_count += 1
    
    # Save parsed data
    with open(output_file, "w") as f:
        json.dump(parsed_players, f, indent=2)
    
    print(f"\n🎉 Parsing complete!")
    print(f"=" * 70)
    print(f"📊 Results:")
    print(f"   ✅ Successfully parsed: {valid_count} players")
    print(f"   ⚠️  Skipped/invalid: {invalid_count} players")
    print(f"   📁 Total valid contracts: {len(parsed_players)}")
    print(f"   💾 Output: {output_file}")
    
    return len(parsed_players) > 0

def main():
    """Main execution"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(script_dir)))
    data_pipeline_dir = os.path.join(project_root, "data_pipeline")
    
    # Input: scraped player data
    input_file = os.path.join(
        data_pipeline_dir, "resources", "data", "players_v2_contracts.json"
    )
    
    # Output: parsed architect-ready data
    output_file = os.path.join(
        data_pipeline_dir, "resources", "data", "architect_base_players.json"
    )
    
    success = parse_all_players(input_file, output_file)
    
    if success:
        print("\n✅ Players v2 data ready for Firestore upload to /architect/basePlayers")
    else:
        print("\n❌ Parsing failed - check errors above")
        sys.exit(1)

if __name__ == "__main__":
    main()
