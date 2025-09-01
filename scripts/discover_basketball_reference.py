#!/usr/bin/env python3
"""
Alternative Player Discovery using Basketball Reference
=====================================================

This script fetches player data from Basketball Reference as a backup
when NBA.com API is unavailable.
"""

import requests
import json
import os
import time
from bs4 import BeautifulSoup

def get_basketball_reference_players():
    """Scrape current NBA players from Basketball Reference"""
    print("📡 Fetching players from Basketball Reference...")
    
    # Basketball Reference current players page
    url = "https://www.basketball-reference.com/leagues/NBA_2025_per_game.html"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Find the stats table
        table = soup.find('table', {'id': 'per_game_stats'})
        if not table:
            print("❌ Could not find player stats table")
            return {}
        
        players = {}
        rows = table.find('tbody').find_all('tr')
        
        for row in rows:
            # Skip header rows
            if row.get('class') and 'thead' in row.get('class'):
                continue
                
            cells = row.find_all(['td', 'th'])
            if len(cells) < 3:
                continue
                
            # Get player name and team
            player_cell = cells[1] if len(cells) > 1 else None
            team_cell = cells[4] if len(cells) > 4 else None
            
            if player_cell and player_cell.find('a'):
                player_name = player_cell.find('a').text.strip()
                team = team_cell.text.strip() if team_cell else "Unknown"
                
                # Normalize name for matching
                norm_name = player_name.lower().replace(".", "").replace("'", "").replace(" ", "_").replace("-", "_")
                
                players[norm_name] = {
                    "name": player_name,
                    "team": team,
                    "source": "basketball_reference"
                }
        
        print(f"✅ Found {len(players)} players from Basketball Reference")
        return players
        
    except Exception as e:
        print(f"❌ Error fetching from Basketball Reference: {e}")
        return {}

def main():
    """Run Basketball Reference player discovery"""
    players = get_basketball_reference_players()
    
    if players:
        # Save to output file
        os.makedirs("data", exist_ok=True)
        output_path = "data/basketball_reference_players.json"
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(players, f, indent=2, ensure_ascii=False)
        
        print(f"📁 Saved {len(players)} players to {output_path}")
        return True
    else:
        print("❌ No players found")
        return False

if __name__ == "__main__":
    main()