#!/usr/bin/env python3
"""
Contract Scraping with Fallback - Enhanced for 2025-26 Season
Falls back to using existing contract data when external scraping fails
"""

import os
import json
import requests
import time
import unicodedata
import re

# Manual overrides for edge cases (same as original)
manual_slug_overrides = {
    "vit_krejci": "vit-krejci",
    "ronald_holland_ii": "ron-holland-ii", 
    "nikola_jokic": "nikola-jokic",
    "kristaps_porzingis": "kristaps-porzingis",
    "dennis_schroder": "dennis-schroder",
    "dario_saric": "dario-saric",
    "vlatko_cancar": "vlatko-cancar",
    "luka_doncic": "luka-doncic",
    "moussa_diabate": "moussa-diabate",
    "bogdan_bogdanovic": "bogdan-bogdanovic",
    "karlo_matkovic": "karlo-matkovic",
    "vasilije_micic": "vasilije-micic",
    "monte_morris": "monte-morris",
    "nikola_jovic": "nikola-jovic",
    "nikola_vucevic": "nikola-vucevic",
    "jonas_valanciunas": "jonas-valanciunas",
    # ... (other entries from original file)
}

def normalize_slug(name):
    """Convert player name to URL-friendly slug"""
    slug = unicodedata.normalize("NFD", name.lower())
    slug = "".join(c for c in slug if unicodedata.category(c) != "Mn")
    slug = re.sub(r"[^\w\s-]", "", slug).strip()
    slug = re.sub(r"[-\s]+", "-", slug)
    
    return manual_slug_overrides.get(name, slug)

def try_scrape_contract(player_key, player_data, max_attempts=2):
    """Try to scrape contract data with limited attempts"""
    name = player_data.get("Name", "").strip() or player_key.replace("_", " ").title()
    slug = normalize_slug(player_key)
    
    # Only try one primary URL to avoid long delays
    url = f"https://www.salaryswish.com/players/{slug}"
    
    for attempt in range(max_attempts):
        try:
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                print(f"    ✓ Found contract data for {name}")
                return {
                    "name": name,
                    "contractHtml": response.text,
                    "source": "scraped"
                }
        except Exception as e:
            if attempt == 0:
                print(f"    ⚠️ Scraping failed for {name}: {str(e)[:100]}...")
            time.sleep(0.5)
    
    return None

def get_current_team_from_nba_api(player_name):
    """Get current team from NBA's official API/data"""
    try:
        # Try NBA.com stats API (this is more reliable for current rosters)
        import requests
        import json
        
        # NBA stats API endpoint for player info
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        # Search for player
        search_url = "https://stats.nba.com/stats/commonallplayers"
        params = {
            'LeagueID': '00',
            'Season': '2024-25',
            'IsOnlyCurrentSeason': '1'
        }
        
        response = requests.get(search_url, headers=headers, params=params, timeout=10)
        if response.status_code == 200:
            data = response.json()
            
            # Look for player in results
            for player in data.get('resultSets', [{}])[0].get('rowSet', []):
                if len(player) > 2 and player_name.lower() in player[2].lower():
                    team_id = player[7] if len(player) > 7 else None
                    if team_id:
                        # Convert team ID to team name
                        team_mapping = {
                            1610612737: "Hawks", 1610612738: "Celtics", 1610612751: "Nets",
                            1610612766: "Hornets", 1610612741: "Bulls", 1610612739: "Cavaliers",
                            1610612742: "Mavericks", 1610612743: "Nuggets", 1610612765: "Pistons",
                            1610612744: "Warriors", 1610612745: "Rockets", 1610612754: "Pacers",
                            1610612746: "Clippers", 1610612747: "Lakers", 1610612763: "Grizzlies",
                            1610612748: "Heat", 1610612749: "Bucks", 1610612750: "Timberwolves",
                            1610612740: "Pelicans", 1610612752: "Knicks", 1610612760: "Thunder",
                            1610612753: "Magic", 1610612755: "76ers", 1610612756: "Suns",
                            1610612757: "Trail Blazers", 1610612758: "Kings", 1610612759: "Spurs",
                            1610612761: "Raptors", 1610612762: "Jazz", 1610612764: "Wizards"
                        }
                        return team_mapping.get(team_id, "Unknown")
        
        return None
        
    except Exception as e:
        print(f"      NBA API lookup failed: {str(e)[:50]}...")
        return None

def create_fallback_contract_data(player_key, player_data):
    """Create contract data structure from existing player info"""
    name = player_data.get("Name", "").strip() or player_key.replace("_", " ").title()
    
    # Try to get updated team info from NBA API first
    current_team = get_current_team_from_nba_api(name)
    team = current_team if current_team else player_data.get("Team", "")
    
    if current_team and current_team != player_data.get("Team", ""):
        print(f"      📋 Updated {name}: {player_data.get('Team', '')} → {current_team}")
    
    # Extract contract info from existing data
    contract_str = player_data.get("Contract", "")
    free_agent = player_data.get("Free Agent", "")
    
    # Parse basic contract information
    contract_value = None
    contract_years = None
    
    if contract_str:
        # Try to extract value and years from format like "$6.0M / 1 yr"
        value_match = re.search(r'\$([0-9.]+)M', contract_str)
        years_match = re.search(r'(\d+)\s*yr', contract_str)
        
        if value_match:
            contract_value = float(value_match.group(1)) * 1000000  # Convert to dollars
        if years_match:
            contract_years = int(years_match.group(1))
    
    # Parse free agency year
    fa_year = None
    if free_agent:
        year_match = re.search(r'(\d{4})', free_agent)
        if year_match:
            fa_year = int(year_match.group(1))
    
    return {
        "name": name,
        "contractData": {
            "team": team,  # Use updated team info
            "contract_string": contract_str,
            "free_agent_info": free_agent,
            "estimated_value": contract_value,
            "estimated_years": contract_years,
            "free_agency_year": fa_year,
            "source": "nba_api" if current_team else "existing_data"
        },
        "source": "fallback_enhanced"
    }

def main():
    """Main execution with fallback logic"""
    print("🏀 Enhanced Contract Scraping with Fallback")
    print("=" * 50)
    
    # Load player data from multiple possible sources
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(script_dir))
    
    players_file_paths = [
        os.path.join(project_root, "data", "players_merged_with_discoveries.json"),
        os.path.join(project_root, "public", "players.json"),
        os.path.join(project_root, "data", "merged_players.json"),
    ]
    
    players = None
    for path in players_file_paths:
        try:
            with open(path, "r") as f:
                players = json.load(f)
                print(f"✅ Loaded player data from: {path}")
                print(f"📊 Found {len(players)} players to process")
                break
        except FileNotFoundError:
            continue
    
    if players is None:
        print("❌ No player data file found!")
        return
    
    # Process players with fallback logic
    output = {}
    scraped_count = 0
    fallback_count = 0
    total = len(players)
    
    print(f"\n🔄 Processing {total} players...")
    print("Will try scraping first few players, then use fallback for speed")
    
    for idx, (key, player) in enumerate(players.items(), 1):
        name = player.get("Name", key.replace("_", " ").title())
        
        # Only try scraping for first 5 players to test if external service works
        if idx <= 5:
            print(f"[{idx}/{total}] Trying to scrape {name}...")
            scraped_data = try_scrape_contract(key, player)
            
            if scraped_data:
                output[key] = scraped_data
                scraped_count += 1
                continue
        
        # Use fallback for all others or when scraping fails
        if idx > 5 or (idx <= 5 and key not in output):
            if idx <= 5:
                print(f"    → Using fallback for {name}")
            elif idx % 50 == 0:  # Progress indicator
                print(f"[{idx}/{total}] Processing with fallback...")
            
            fallback_data = create_fallback_contract_data(key, player)
            output[key] = fallback_data
            fallback_count += 1
    
    # Ensure output directory exists
    os.makedirs(os.path.join(project_root, "data"), exist_ok=True)
    
    # Save processed data
    output_path = os.path.join(project_root, "data", "raw_contract_html.json")
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)
    
    print(f"\n✅ Contract processing complete!")
    print(f"📊 Results:")
    print(f"   📡 Scraped: {scraped_count} players")
    print(f"   🔄 Fallback: {fallback_count} players")
    print(f"   📁 Total: {len(output)} players")
    print(f"   💾 Saved to: {output_path}")
    
    # Create summary for next pipeline step
    summary = {
        "scraped_players": scraped_count,
        "fallback_players": fallback_count,
        "total_players": len(output),
        "external_service_working": scraped_count > 0,
        "processing_date": time.time()
    }
    
    summary_path = os.path.join(project_root, "data", "contract_processing_summary.json")
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2)
    
    print(f"   📋 Summary: {summary_path}")

if __name__ == "__main__":
    main()