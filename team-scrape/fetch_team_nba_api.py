#!/usr/bin/env python3
"""
NBA.com API-based team roster fetcher

A reliable alternative to web scraping that uses NBA.com's official stats API.
No timeouts, no browser needed - just clean API calls.

Usage:
    python3 team-scrape/fetch_team_nba_api.py --team-code LAL
    
    Or via npm:
    TEAM_CODE="LAL" npm run fetch:api
"""

import argparse
import json
import os
import sys
import requests
import time
from typing import Dict, List, Optional

# NBA Team Code to ID mapping
TEAM_ID_MAP = {
    'ATL': 1610612737, 'BOS': 1610612738, 'BKN': 1610612751, 'CHA': 1610612766,
    'CHI': 1610612741, 'CLE': 1610612739, 'DAL': 1610612742, 'DEN': 1610612743,
    'DET': 1610612765, 'GSW': 1610612744, 'HOU': 1610612745, 'IND': 1610612754,
    'LAC': 1610612746, 'LAL': 1610612747, 'MEM': 1610612763, 'MIA': 1610612748,
    'MIL': 1610612749, 'MIN': 1610612750, 'NOP': 1610612740, 'NYK': 1610612752,
    'OKC': 1610612760, 'ORL': 1610612753, 'PHI': 1610612755, 'PHX': 1610612756,
    'POR': 1610612757, 'SAC': 1610612758, 'SAS': 1610612759, 'TOR': 1610612761,
    'UTA': 1610612762, 'WAS': 1610612764
}

TEAM_NAME_MAP = {
    'ATL': 'Atlanta Hawks', 'BOS': 'Boston Celtics', 'BKN': 'Brooklyn Nets',
    'CHA': 'Charlotte Hornets', 'CHI': 'Chicago Bulls', 'CLE': 'Cleveland Cavaliers',
    'DAL': 'Dallas Mavericks', 'DEN': 'Denver Nuggets', 'DET': 'Detroit Pistons',
    'GSW': 'Golden State Warriors', 'HOU': 'Houston Rockets', 'IND': 'Indiana Pacers',
    'LAC': 'LA Clippers', 'LAL': 'Los Angeles Lakers', 'MEM': 'Memphis Grizzlies',
    'MIA': 'Miami Heat', 'MIL': 'Milwaukee Bucks', 'MIN': 'Minnesota Timberwolves',
    'NOP': 'New Orleans Pelicans', 'NYK': 'New York Knicks', 'OKC': 'Oklahoma City Thunder',
    'ORL': 'Orlando Magic', 'PHI': 'Philadelphia 76ers', 'PHX': 'Phoenix Suns',
    'POR': 'Portland Trail Blazers', 'SAC': 'Sacramento Kings', 'SAS': 'San Antonio Spurs',
    'TOR': 'Toronto Raptors', 'UTA': 'Utah Jazz', 'WAS': 'Washington Wizards'
}

def fetch_team_roster(team_code: str, season: str = "2024-25") -> Optional[Dict]:
    """
    Fetch team roster from NBA.com Stats API
    
    Args:
        team_code: 3-letter NBA team code (e.g., 'LAL')
        season: NBA season string (e.g., '2024-25')
    
    Returns:
        Dict with team data or None on failure
    """
    team_id = TEAM_ID_MAP.get(team_code.upper())
    if not team_id:
        print(f"❌ Invalid team code: {team_code}")
        print(f"   Valid codes: {', '.join(sorted(TEAM_ID_MAP.keys()))}")
        return None
    
    team_name = TEAM_NAME_MAP.get(team_code.upper())
    
    print(f"🏀 Fetching roster for {team_name} ({team_code})")
    print(f"📅 Season: {season}")
    print()
    
    # NBA.com Stats API endpoint
    url = "https://stats.nba.com/stats/commonteamroster"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://www.nba.com',
        'Referer': f'https://www.nba.com/team/{team_id}',
        'x-nba-stats-origin': 'stats',
        'x-nba-stats-token': 'true'
    }
    
    params = {
        'TeamID': team_id,
        'Season': season
    }
    
    try:
        print("📡 Fetching from NBA.com Stats API...")
        response = requests.get(url, headers=headers, params=params, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        
        # Parse the response
        result_sets = data.get('resultSets', [])
        if not result_sets:
            print("❌ No data returned from API")
            return None
        
        roster_data = result_sets[0]
        headers_row = roster_data.get('headers', [])
        rows = roster_data.get('rowSet', [])
        
        print(f"✅ Retrieved {len(rows)} players")
        
        # Build roster list
        roster = []
        for row in rows:
            player_dict = dict(zip(headers_row, row))
            roster.append({
                'playerId': str(player_dict.get('PLAYER_ID', '')),
                'displayName': player_dict.get('PLAYER', ''),
                'jerseyNumber': player_dict.get('NUM', ''),
                'position': player_dict.get('POSITION', ''),
                'height': player_dict.get('HEIGHT', ''),
                'weight': player_dict.get('WEIGHT', ''),
                'birthDate': player_dict.get('BIRTH_DATE', ''),
                'age': player_dict.get('AGE', ''),
                'experience': player_dict.get('EXP', ''),
                'school': player_dict.get('SCHOOL', '')
            })
        
        # Build team document
        team_doc = {
            'teamCode': team_code.upper(),
            'teamName': team_name.upper(),
            'season': season,
            'roster': roster,
            'deadCap': [],  # Not available from this API
            'capHolds': [],  # Not available from this API
            'exceptions': {
                'mle': None,
                'taxpayerMle': None,
                'room': None,
                'bae': None,
                'dpe': None,
                'tpe': []
            },
            'draftPicks': [],  # Not available from this API
            'totals': {},  # Not available from this API
            'source': {
                'provider': 'NBA.com Stats API',
                'teamPageUrl': f'https://www.nba.com/team/{team_id}',
                'apiUrl': url,
                'scrapedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            },
            'lastUpdated': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            'version': '1.0'
        }
        
        return team_doc
        
    except requests.exceptions.Timeout:
        print("❌ Request timed out")
        return None
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return None
    except (KeyError, IndexError, ValueError) as e:
        print(f"❌ Failed to parse API response: {e}")
        return None

def main():
    parser = argparse.ArgumentParser(
        description="Fetch NBA team roster from NBA.com Stats API"
    )
    parser.add_argument(
        '--team-code',
        type=str,
        default=os.environ.get('TEAM_CODE'),
        help='3-letter NBA team code (e.g., LAL, BOS, GSW) or set TEAM_CODE env var'
    )
    parser.add_argument(
        '--season',
        type=str,
        default=os.environ.get('SEASON', '2024-25'),
        help='NBA season (e.g., 2024-25)'
    )
    parser.add_argument(
        '--output',
        type=str,
        default='team_nba_api.json',
        help='Output file path (default: team_nba_api.json)'
    )
    
    args = parser.parse_args()
    
    if not args.team_code:
        print("❌ Error: TEAM_CODE is required")
        print()
        print("Usage:")
        print("  python3 team-scrape/fetch_team_nba_api.py --team-code LAL")
        print("  Or:")
        print('  TEAM_CODE="LAL" python3 team-scrape/fetch_team_nba_api.py')
        print()
        print(f"Valid team codes: {', '.join(sorted(TEAM_ID_MAP.keys()))}")
        sys.exit(1)
    
    # Fetch team data
    team_data = fetch_team_roster(args.team_code, args.season)
    
    if not team_data:
        sys.exit(1)
    
    # Write to file
    output_path = args.output
    if not os.path.isabs(output_path):
        # Change to team-scrape directory for relative paths
        script_dir = os.path.dirname(os.path.abspath(__file__))
        output_path = os.path.join(script_dir, args.output)
    
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(team_data, f, indent=2, ensure_ascii=False)
        
        print()
        print(f"✅ Saved to {output_path}")
        print()
        print("⚠️  NOTE: This API provides roster data only.")
        print("   Salary cap details (exceptions, cap holds, draft picks) are NOT included.")
        print("   For complete cap data, you still need to use the SalarySwish scraper.")
        print()
        print("What you GET from this API:")
        print("  ✅ Current roster with player IDs, names, positions")
        print("  ✅ Player bio data (height, weight, age, school)")
        print("  ✅ Fast, reliable data fetch (no browser needed)")
        print()
        print("What you DON'T GET:")
        print("  ❌ Salary cap totals and cap space")
        print("  ❌ Signing exceptions (MLE, BAE, etc.)")
        print("  ❌ Trade exceptions (TPE)")
        print("  ❌ Cap holds (free agents, draft picks)")
        print("  ❌ Draft pick assets and protections")
        
    except IOError as e:
        print(f"❌ Failed to write output file: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
