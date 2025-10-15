#!/usr/bin/env python3
"""
Example: How to Use Players v2 Data in Architect Tools

This demonstrates how to access and use the scraped player contract data
in the Architect GM Tools for trade validation, cap calculations, etc.
"""

import json
import os

# Example data structure (as would be stored in Firestore)
EXAMPLE_PLAYER = {
    "playerId": "austin_reaves",
    "displayName": "Austin Reaves",
    "teamCode": "LAL",
    "teamName": "Los Angeles Lakers",
    "bio": {
        "position": "G",
        "height": "6-5",
        "weight": "206",
        "age": 26,
        "experience": 3
    },
    "contract": {
        "contractType": "VETERAN CONTRACT",
        "isExtension": False,
        "signedUsing": "Bird Exception",
        "startSeason": "2023-24",
        "endSeason": "2027-28",
        "totalValue": 53830000,
        "averageAnnualValue": 13457500,
        "salariesByYear": [
            {
                "season": "2025-26",
                "salary": 12000000,
                "capHit": 12000000,
                "guaranteed": True,
                "guaranteedAmount": 12000000,
                "option": None
            },
            {
                "season": "2026-27",
                "salary": 13900000,
                "capHit": 13900000,
                "guaranteed": True,
                "guaranteedAmount": 13900000,
                "option": None
            },
            {
                "season": "2027-28",
                "salary": 15000000,
                "capHit": 15000000,
                "guaranteed": False,
                "guaranteedAmount": 0,
                "option": "PO"  # Player Option
            }
        ],
        "noTradeClause": False,
        "tradeKicker": None,
        "birdRights": {
            "status": "Bird",
            "yearsOfService": 3,
            "yearsWithTeam": 3,
            "eligibleFor": ["Bird Exception"]
        },
        "freeAgency": {
            "type": "UFA",
            "year": 2028,
            "capHold": 18750000,
            "qualifyingOffer": None,
            "earlyTerminationOption": None
        },
        "tradeEligibility": {
            "canBeTradedNow": True,
            "restrictedUntil": None,
            "reason": None,
            "rules": {
                "baseYearCompensation": False,
                "poisonPill": False,
                "aggregation": True
            }
        }
    }
}

# ============================================================================
# Example Use Cases
# ============================================================================

def example_1_trade_validation(player):
    """Example 1: Validate if player can be traded"""
    print("=" * 70)
    print("Example 1: Trade Validation")
    print("=" * 70)
    
    eligibility = player["contract"]["tradeEligibility"]
    
    print(f"\nPlayer: {player['displayName']}")
    print(f"Team: {player['teamName']}")
    
    if eligibility["canBeTradedNow"]:
        print("✅ Player is eligible to be traded")
        
        # Check trade rules
        rules = eligibility["rules"]
        
        if rules["baseYearCompensation"]:
            print("⚠️  Base Year Compensation applies - salary matching affected")
            print("   BYC outgoing value = 50% of salary OR previous year salary")
        
        if rules["poisonPill"]:
            print("⚠️  Poison Pill applies - different values for acquiring teams")
            print("   Each team uses their own cap hit for trade matching")
        
        if not rules["aggregation"]:
            print("⚠️  Cannot be aggregated with other players in trade")
        else:
            print("✅ Can be aggregated in multi-player trades")
    else:
        print(f"❌ Player cannot be traded")
        if eligibility["restrictedUntil"]:
            print(f"   Restricted until: {eligibility['restrictedUntil']}")
        if eligibility["reason"]:
            print(f"   Reason: {eligibility['reason']}")

def example_2_free_agency_planning(player):
    """Example 2: Free Agency Planning"""
    print("\n" + "=" * 70)
    print("Example 2: Free Agency Planning")
    print("=" * 70)
    
    fa = player["contract"]["freeAgency"]
    bird_rights = player["contract"]["birdRights"]
    
    print(f"\nPlayer: {player['displayName']}")
    
    if fa["type"]:
        print(f"Free Agency: {fa['year']} ({fa['type']})")
        
        if fa["type"] == "RFA":
            print(f"Qualifying Offer: ${fa['qualifyingOffer']:,}")
            print("⚠️  Other teams can make offer sheets")
            print("✅ You can match any offer")
        elif fa["type"] == "UFA":
            print("⚠️  Unrestricted - can sign anywhere")
        
        if fa["capHold"]:
            print(f"Cap Hold: ${fa['capHold']:,}")
            print("   (counts against cap until player signs or rights renounced)")
        
        print(f"\nBird Rights: {bird_rights['status']}")
        if bird_rights["status"] == "Bird":
            print("✅ Can re-sign over the cap with no limit")
        elif bird_rights["status"] == "Early Bird":
            print("✅ Can re-sign over the cap up to 175% of previous salary")
        elif bird_rights["status"] == "Non-Bird":
            print("⚠️  Can only use Non-Bird exception (120% of previous salary)")

def example_3_contract_option_analysis(player):
    """Example 3: Contract Option Analysis"""
    print("\n" + "=" * 70)
    print("Example 3: Contract Option Analysis")
    print("=" * 70)
    
    print(f"\nPlayer: {player['displayName']}")
    print("Contract Breakdown:")
    
    for salary in player["contract"]["salariesByYear"]:
        season = salary["season"]
        amount = salary["salary"]
        guaranteed = "Guaranteed" if salary["guaranteed"] else "Non-Guaranteed"
        option = salary.get("option")
        
        option_str = ""
        if option == "PO":
            option_str = " (PLAYER OPTION)"
        elif option == "TO":
            option_str = " (TEAM OPTION)"
        elif option == "ETO":
            option_str = " (EARLY TERMINATION OPTION)"
        
        print(f"  {season}: ${amount:,} - {guaranteed}{option_str}")
    
    # Find options
    options = [s for s in player["contract"]["salariesByYear"] if s.get("option")]
    
    if options:
        print("\n⚙️  Options in contract:")
        for opt in options:
            if opt["option"] == "PO":
                print(f"   {opt['season']}: Player can opt out and become free agent")
            elif opt["option"] == "TO":
                print(f"   {opt['season']}: Team can decline and player becomes free agent")
            elif opt["option"] == "ETO":
                print(f"   {opt['season']}: Player can terminate early")

def example_4_cap_space_calculation(player):
    """Example 4: Cap Space Calculation"""
    print("\n" + "=" * 70)
    print("Example 4: Cap Space Impact")
    print("=" * 70)
    
    print(f"\nPlayer: {player['displayName']}")
    
    # Get current season salary (assuming 2025-26)
    current_season = "2025-26"
    current_salary = next(
        (s for s in player["contract"]["salariesByYear"] if s["season"] == current_season),
        None
    )
    
    if current_salary:
        cap_hit = current_salary["capHit"]
        print(f"Current Season ({current_season}) Cap Hit: ${cap_hit:,}")
        
        if current_salary.get("option") == "PO":
            print("⚠️  Player has option - may decline and leave")
            fa = player["contract"]["freeAgency"]
            if fa["capHold"]:
                print(f"   If player opts out, cap hold would be: ${fa['capHold']:,}")
        
        # Multi-season projection
        print("\nMulti-Season Cap Hit Projection:")
        for salary in player["contract"]["salariesByYear"]:
            if salary["season"] >= current_season:
                hit = salary["capHit"]
                status = ""
                if salary.get("option"):
                    status = f" ({salary['option']})"
                elif not salary["guaranteed"]:
                    status = " (Non-Guaranteed)"
                
                print(f"  {salary['season']}: ${hit:,}{status}")

def example_5_firestore_query():
    """Example 5: Firestore Query Pattern"""
    print("\n" + "=" * 70)
    print("Example 5: Firestore Query Pattern (Pseudo-code)")
    print("=" * 70)
    
    print("""
# In your React/JavaScript code:

import { collection, doc, getDoc } from 'firebase/firestore';

// Get single player
async function getPlayerContract(playerId) {
  const docRef = doc(db, 'architect', 'basePlayers', 'players', playerId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    const player = docSnap.data();
    
    // Check trade eligibility
    if (player.contract.tradeEligibility.canBeTradedNow) {
      // Player can be traded
      
      // Check for BYC
      if (player.contract.tradeEligibility.rules.baseYearCompensation) {
        // Calculate BYC outgoing value
        const bycValue = calculateBYCValue(player);
      }
    }
    
    // Check Bird rights for re-signing
    if (player.contract.birdRights.status === 'Bird') {
      // Can re-sign over cap
    }
    
    return player;
  }
}

// Get all players for a team
async function getTeamPlayers(teamCode) {
  const playersRef = collection(db, 'architect', 'basePlayers', 'players');
  const q = query(playersRef, where('teamCode', '==', teamCode));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => doc.data());
}
    """)

# ============================================================================
# Run Examples
# ============================================================================

def main():
    print("\n🏀 Players v2 Contract Data - Usage Examples")
    print("=" * 70)
    print("Demonstrating how to use architect player contract data")
    print("=" * 70)
    
    example_1_trade_validation(EXAMPLE_PLAYER)
    example_2_free_agency_planning(EXAMPLE_PLAYER)
    example_3_contract_option_analysis(EXAMPLE_PLAYER)
    example_4_cap_space_calculation(EXAMPLE_PLAYER)
    example_5_firestore_query()
    
    print("\n" + "=" * 70)
    print("✅ Examples Complete")
    print("=" * 70)
    print("\nThese patterns can be used in:")
    print("  - Trade Machine (validateTrade function)")
    print("  - Cap Sheet (calculateCapSpace function)")
    print("  - Roster Builder (free agency planning)")
    print("  - GM Dashboard (contract overview)")
    print()

if __name__ == "__main__":
    main()
