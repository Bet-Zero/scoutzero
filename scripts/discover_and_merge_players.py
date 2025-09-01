#!/usr/bin/env python3
"""
Comprehensive Player Discovery and Merging for Season Transitions
================================================================

This script:
1. Discovers current NBA players from multiple sources
2. Merges with existing player database
3. Ensures no players are lost (existing 531 + new discoveries)
4. Updates player data for season transition
"""

import json
import os
import requests
import time
from typing import Dict, List, Set

def normalize_name(name: str) -> str:
    """Normalize player names for consistent matching"""
    return name.lower().replace(".", "").replace("'", "").replace(" ", "_").replace("-", "_")

def load_existing_players(file_path: str) -> Dict:
    """Load existing player database"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            players = json.load(f)
        print(f"✅ Loaded {len(players)} existing players from {file_path}")
        return players
    except FileNotFoundError:
        print(f"❌ Could not find existing players file: {file_path}")
        return {}
    except Exception as e:
        print(f"❌ Error loading existing players: {e}")
        return {}

def load_contract_data(contract_file_path: str) -> Dict:
    """Load contract data for filtering players with $0.0M contracts"""
    try:
        with open(contract_file_path, 'r', encoding='utf-8') as f:
            contracts = json.load(f)
        print(f"✅ Loaded contract data for {len(contracts)} players")
        return contracts
    except FileNotFoundError:
        print(f"⚠️  Contract file not found: {contract_file_path}")
        print("   Proceeding without contract filtering...")
        return {}
    except Exception as e:
        print(f"⚠️  Error loading contracts: {e}")
        print("   Proceeding without contract filtering...")
        return {}

def has_zero_contract(player_name: str, contract_data: Dict) -> bool:
    """Check if a player has a $0.0M contract (training camp invite, etc.)"""
    if not contract_data:
        return False
    
    # Try different name formats to find contract data
    name_variants = [
        player_name,
        normalize_name(player_name),
        player_name.replace(" ", "_"),
        player_name.lower()
    ]
    
    for name_variant in name_variants:
        if name_variant in contract_data:
            player_contract = contract_data[name_variant]
            
            # Check various contract patterns that indicate $0.0M
            if isinstance(player_contract, dict):
                # Check contract field
                contract_str = player_contract.get("Contract", "")
                if "$0.0M" in contract_str or contract_str == "":
                    return True
                
                # Check salary field if it exists
                salary = player_contract.get("salary", None)
                if salary == 0 or salary == "0" or salary == "$0.0M":
                    return True
                
                # Check annual_salaries array
                annual_salaries = player_contract.get("annual_salaries", [])
                if annual_salaries:
                    current_year_salary = None
                    for salary_data in annual_salaries:
                        if salary_data.get("year") == 2025:
                            current_year_salary = salary_data.get("salary", 0)
                            break
                    
                    if current_year_salary == 0 or current_year_salary == "0":
                        return True
            
            elif isinstance(player_contract, str):
                # Contract is a string - check for $0.0M patterns
                if "$0.0M" in player_contract or player_contract.strip() == "":
                    return True
    
    return False

def should_exclude_new_player(player_name: str, contract_data: Dict) -> bool:
    """
    Determine if a new player should be excluded from the merge.
    Excludes new players with $0.0M contracts (training camp invites, etc.)
    """
    if not contract_data:
        # If no contract data available, don't exclude anyone
        return False
    
    # Check if player has a zero-dollar contract
    if has_zero_contract(player_name, contract_data):
        print(f"   🚫 Excluding new player with $0.0M contract: {player_name}")
        return True
    
    return False

def fetch_nba_players_with_retry() -> Dict:
    """Fetch current NBA players with multiple retry strategies"""
    
    # First, try to use cached/existing discovery data
    cached_file = "tools/output/all_player_ids.json"
    if os.path.exists(cached_file):
        try:
            with open(cached_file, 'r', encoding='utf-8') as f:
                cached_data = json.load(f)
            print(f"✅ Using cached player discovery data: {len(cached_data)} players")
            
            # Convert cached format to expected format
            discovered_players = {}
            for norm_name, player_id in cached_data.items():
                # Reconstruct name from normalized version (not perfect but workable)
                display_name = norm_name.replace("_", " ").title()
                discovered_players[norm_name] = {
                    "name": display_name,
                    "player_id": player_id,
                    "is_active": True,  # Assume active since from current season
                    "source": "cached_discovery"
                }
            
            return discovered_players
            
        except Exception as e:
            print(f"⚠️  Could not load cached data: {e}")
            print("📡 Falling back to live NBA API...")
    
    # If no cached data, try live API (existing code)
    url = "https://stats.nba.com/stats/commonallplayers"
    params = {
        "LeagueID": "00",
        "Season": "2024-25",
        "IsOnlyCurrentSeason": "0"  # Get ALL players, not just current season
    }
    
    headers_list = [
        # Try different user agents
        {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://www.nba.com/",
            "Origin": "https://www.nba.com",
            "Accept": "application/json",
            "Connection": "keep-alive"
        },
        {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9"
        },
        {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
    ]
    
    for attempt, headers in enumerate(headers_list, 1):
        print(f"📡 Attempting NBA API request (attempt {attempt}/{len(headers_list)})...")
        try:
            response = requests.get(url, headers=headers, params=params, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            rows = data["resultSets"][0]["rowSet"]
            headers_row = data["resultSets"][0]["headers"]
            
            idx_player_id = headers_row.index("PERSON_ID")
            idx_name = headers_row.index("DISPLAY_FIRST_LAST")
            idx_active = headers_row.index("ROSTERSTATUS")
            
            discovered_players = {}
            active_count = 0
            
            for row in rows:
                full_name = row[idx_name]
                player_id = row[idx_player_id]
                is_active = row[idx_active] == 1
                
                key = normalize_name(full_name)
                discovered_players[key] = {
                    "name": full_name,
                    "player_id": player_id,
                    "is_active": is_active,
                    "source": "nba_api"
                }
                
                if is_active:
                    active_count += 1
            
            print(f"✅ Successfully fetched {len(discovered_players)} total players ({active_count} active)")
            return discovered_players
            
        except requests.exceptions.RequestException as e:
            print(f"❌ Attempt {attempt} failed: {e}")
            if attempt < len(headers_list):
                print("⏳ Waiting 5 seconds before retry...")
                time.sleep(5)
            continue
        except Exception as e:
            print(f"❌ Unexpected error on attempt {attempt}: {e}")
            continue
    
    print("❌ All NBA API attempts failed")
    return {}

def create_player_id_mapping(existing_players: Dict) -> Dict:
    """Create mapping of NBA player IDs to existing player data"""
    id_mapping = {}
    name_mapping = {}
    
    for player_id, player_data in existing_players.items():
        if isinstance(player_data, dict):
            # Primary: Use NBA player ID if available
            if "nba_player_id" in player_data:
                id_mapping[player_data["nba_player_id"]] = {
                    "player_id": player_id,
                    "data": player_data,
                    "match_method": "nba_id"
                }
            
            # Secondary: Use player_id field if available  
            if "player_id" in player_data:
                id_mapping[player_data["player_id"]] = {
                    "player_id": player_id,
                    "data": player_data,
                    "match_method": "player_id"
                }
            
            # Fallback: Use name matching
            if "name" in player_data:
                normalized = normalize_name(player_data["name"])
                name_mapping[normalized] = {
                    "player_id": player_id,
                    "data": player_data,
                    "match_method": "name"
                }
    
    return id_mapping, name_mapping

def merge_player_databases(existing_players: Dict, discovered_players: Dict, contract_data: Dict = None) -> Dict:
    """Merge existing and discovered players using name matching with your actual data structure"""
    print(f"\n🔄 Merging player databases...")
    print(f"   📁 Existing players: {len(existing_players)}")
    print(f"   🆕 Discovered players: {len(discovered_players)}")
    
    if contract_data:
        print(f"   💰 Contract data available for filtering")
    else:
        print(f"   ⚠️  No contract data - all new players will be included")
    
    # Create name mapping from your existing players (using actual "Name" field)
    existing_name_mapping = {}
    for player_key, player_data in existing_players.items():
        if isinstance(player_data, dict) and "Name" in player_data:
            # Normalize the actual "Name" field from your data
            normalized = normalize_name(player_data["Name"])
            existing_name_mapping[normalized] = {
                "player_key": player_key,
                "data": player_data,
                "original_name": player_data["Name"]
            }
    
    print(f"   🏷️  Mapped {len(existing_name_mapping)} existing player names")
    
    # Start with all existing players
    merged_players = existing_players.copy()
    
    # Track statistics
    stats = {
        "existing_preserved": len(existing_players),
        "new_players_added": 0,
        "new_players_excluded": 0,
        "existing_updated": 0,
        "name_matches": 0,
        "no_matches": 0
    }
    
    # Process discovered players
    for norm_name, discovered_data in discovered_players.items():
        discovered_nba_id = discovered_data["player_id"]
        player_name = discovered_data["name"]
        
        # Try name matching with your existing data structure
        if norm_name in existing_name_mapping:
            existing_entry = existing_name_mapping[norm_name]
            player_key = existing_entry["player_key"]
            
            # Update existing player with NBA ID (preserve all existing data)
            if player_key in merged_players:
                # Add NBA player ID to existing player data
                merged_players[player_key]["nba_player_id"] = discovered_nba_id
                merged_players[player_key]["is_active_nba"] = discovered_data["is_active"]
                merged_players[player_key]["discovery_source"] = discovered_data["source"]
                merged_players[player_key]["last_updated"] = time.time()
                stats["existing_updated"] += 1
                stats["name_matches"] += 1
        else:
            # No match found - this is a new player
            # Check if we should exclude this new player due to $0.0M contract
            if should_exclude_new_player(player_name, contract_data):
                stats["new_players_excluded"] += 1
                stats["no_matches"] += 1
                continue  # Skip adding this player
            
            # Add as new player with your data structure
            new_player_key = norm_name  # Use same key format as existing
            merged_players[new_player_key] = {
                "Name": discovered_data["name"],
                "nba_player_id": discovered_nba_id,
                "is_active_nba": discovered_data["is_active"],
                "discovery_source": discovered_data["source"],
                "added_in_transition": True,
                "last_updated": time.time(),
                # Initialize empty fields to match your structure
                "HT": "",
                "WT": "",
                "AGE": "",
                "Years Pro": "",
                "Team": "",
                "Position": "",
                "Contract": "",
                "Free Agent": "",
                "Games Played": 0
            }
            stats["new_players_added"] += 1
            stats["no_matches"] += 1
    
    print(f"\n📊 Merge Results:")
    print(f"   ✅ Existing players preserved: {stats['existing_preserved']}")
    print(f"   🆕 New players added: {stats['new_players_added']}")
    print(f"   🚫 New players excluded ($0.0M contracts): {stats['new_players_excluded']}")
    print(f"   🔄 Existing players updated: {stats['existing_updated']}")
    print(f"   🏷️  Name matches found: {stats['name_matches']}")
    print(f"   ❓ No matches (processed): {stats['no_matches']}")
    print(f"   📈 Total players in merged database: {len(merged_players)}")
    
    return merged_players, stats

def save_merged_players(merged_players: Dict, output_path: str) -> bool:
    """Save merged player database"""
    try:
        # Ensure output directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(merged_players, f, indent=2, ensure_ascii=False)
        
        print(f"✅ Saved merged player database to {output_path}")
        return True
    except Exception as e:
        print(f"❌ Error saving merged players: {e}")
        return False

def main():
    """Main execution function"""
    print("🏀 NBA Player Discovery and Merging Tool")
    print("=" * 50)
    
    # Define paths
    existing_players_path = "public/players.json"
    contract_data_path = "data/parsed_contracts.json"  # Add contract data path
    output_path = "data/players_merged_with_discoveries.json"
    
    # Load existing players
    existing_players = load_existing_players(existing_players_path)
    if not existing_players:
        print("❌ Cannot proceed without existing player data")
        return False
    
    # Load contract data for filtering
    contract_data = load_contract_data(contract_data_path)
    
    # Discover current NBA players
    discovered_players = fetch_nba_players_with_retry()
    if not discovered_players:
        print("⚠️  No players discovered from NBA API - proceeding with existing data only")
        discovered_players = {}
    
    # Merge databases with contract filtering
    merged_players, stats = merge_player_databases(existing_players, discovered_players, contract_data)
    
    # Save results
    success = save_merged_players(merged_players, output_path)
    
    if success:
        print(f"\n🎉 Player discovery and merging completed successfully!")
        print(f"📁 Output saved to: {output_path}")
        print(f"📊 Final count: {len(merged_players)} players")
        
        if stats["new_players_added"] > 0:
            print(f"🆕 Added {stats['new_players_added']} new players to your database")
        
        if stats["new_players_excluded"] > 0:
            print(f"🚫 Excluded {stats['new_players_excluded']} new players with $0.0M contracts")
        
        if stats["new_players_added"] == 0 and stats["new_players_excluded"] == 0:
            print("ℹ️  No new players found - all discovered players were already in your database")
        
        return True
    else:
        print("❌ Failed to save merged player database")
        return False

if __name__ == "__main__":
    main()
