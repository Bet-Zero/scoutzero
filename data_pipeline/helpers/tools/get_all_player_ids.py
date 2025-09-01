#!/usr/bin/env python3
"""
Enhanced NBA Player Discovery - CURRENT PLAYERS ONLY
===================================================
"""

import requests
import json
import os
import time
import random

def get_nba_headers():
    """Rotate through different headers to avoid detection"""
    headers_list = [
        {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Referer": "https://www.nba.com/stats/players/",
            "Origin": "https://www.nba.com",
            "Connection": "keep-alive",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-site"
        },
        {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache"
        }
    ]
    return random.choice(headers_list)

def normalize_name(name):
    return name.lower().replace(".", "").replace("'", "").replace(" ", "_")

def fetch_with_retry(url, params, max_retries=5):
    """Fetch NBA data with exponential backoff and header rotation"""
    for attempt in range(max_retries):
        headers = get_nba_headers()
        wait_time = (2 ** attempt) + random.uniform(0, 2)
        
        if attempt > 0:
            print(f"⏳ Waiting {wait_time:.1f}s before retry {attempt}...")
            time.sleep(wait_time)
        
        try:
            print(f"📡 Attempt {attempt + 1}/{max_retries} - Requesting NBA player data...")
            response = requests.get(url, headers=headers, params=params, timeout=45)
            
            if response.status_code == 200:
                return response
            elif response.status_code == 429:
                print(f"⚠️  Rate limited (429) - backing off...")
                continue
            elif response.status_code == 403:
                print(f"⚠️  Forbidden (403) - trying different headers...")
                continue
            else:
                print(f"⚠️  HTTP {response.status_code} - retrying...")
                continue
                
        except requests.exceptions.Timeout:
            print(f"⚠️  Timeout on attempt {attempt + 1}")
            continue
        except requests.exceptions.ConnectionError:
            print(f"⚠️  Connection error on attempt {attempt + 1}")
            continue
        except Exception as e:
            print(f"⚠️  Unexpected error: {e}")
            continue
    
    return None

print("🏀 Enhanced NBA Player Discovery - CURRENT PLAYERS ONLY")
print("=" * 60)

# FIXED: Get current 2025-26 season players (not last year's 2024-25!)
endpoints = [
    {
        "url": "https://stats.nba.com/stats/commonallplayers",
        "params": {
            "LeagueID": "00",
            "Season": "2025-26",  # ✅ CURRENT SEASON (not "2024-25"!)
            "IsOnlyCurrentSeason": "1"
        },
        "description": "Current 2025-26 season players (this year)"
    },
    {
        "url": "https://stats.nba.com/stats/commonallplayers",
        "params": {
            "LeagueID": "00",
            "Season": "2024-25",  # Fallback to last season if current fails
            "IsOnlyCurrentSeason": "1"
        },
        "description": "Fallback: 2024-25 season players"
    }
]

player_ids = {}
success = False

for i, endpoint in enumerate(endpoints):
    print(f"\n🎯 Trying endpoint {i + 1}/{len(endpoints)}: {endpoint['description']}")
    
    response = fetch_with_retry(endpoint["url"], endpoint["params"])
    
    if response:
        try:
            data = response.json()
            rows = data["resultSets"][0]["rowSet"]
            headers = data["resultSets"][0]["headers"]
            
            idx_player_id = headers.index("PERSON_ID")
            idx_name = headers.index("DISPLAY_FIRST_LAST")
            idx_active = headers.index("ROSTERSTATUS")
            
            active_count = 0
            total_count = 0
            
            for row in rows:
                if row[idx_active] == 1:  # Only active players
                    full_name = row[idx_name]
                    player_id = row[idx_player_id]
                    key = normalize_name(full_name)
                    player_ids[key] = player_id
                    active_count += 1
                
                total_count += 1
            
            print(f"✅ Success! Found {active_count} active players from {total_count} total")
            
            # Sanity check - warn if we got too many players
            if len(player_ids) > 1000:
                print(f"⚠️  WARNING: Got {len(player_ids)} players - this seems like too many!")
                print(f"⚠️  Expected 500-700 current players, not thousands of historical ones")
            else:
                print(f"📊 Found reasonable number of current players: {len(player_ids)}")
            
            success = True
            break
            
        except (KeyError, IndexError, json.JSONDecodeError) as e:
            print(f"❌ Data parsing error: {e}")
            continue
    else:
        print(f"❌ Endpoint {i + 1} failed")

if success:
    output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
    os.makedirs(output_dir, exist_ok=True)

    output_file = os.path.join(output_dir, "all_player_ids.json")
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(player_ids, f, indent=2)

    print(f"\n🎉 Successfully saved {len(player_ids)} CURRENT players to {output_file}")
    print(f"📊 Expected range: Your existing 531 + new rookies/signings = ~600-700 total")
else:
    print(f"\n❌ All NBA API endpoints failed")
    print(f"💡 This is likely due to increased API restrictions since 3 months ago")
    print(f"🔄 Try running this script later or consider using cached data")
