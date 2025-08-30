import requests
import json
import os

url = "https://stats.nba.com/stats/commonallplayers"
params = {
    "LeagueID": "00",
    "Season": "2024-25",
    "IsOnlyCurrentSeason": "1"
}
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/121.0.0.0 Safari/537.36",
    "Referer": "https://www.nba.com/",
    "Origin": "https://www.nba.com",
    "Accept": "application/json",
    "Connection": "keep-alive"
}

def normalize_name(name):
    return name.lower().replace(".", "").replace("'", "").replace(" ", "_")

print("📡 Requesting NBA player data...")

try:
    res = requests.get(url, headers=headers, params=params, timeout=10)
    res.raise_for_status()
except requests.exceptions.RequestException as e:
    print(f"❌ Request failed: {e}")
    exit(1)

print("✅ Response received")

data = res.json()
rows = data["resultSets"][0]["rowSet"]
headers = data["resultSets"][0]["headers"]

idx_player_id = headers.index("PERSON_ID")
idx_name = headers.index("DISPLAY_FIRST_LAST")
idx_active = headers.index("ROSTERSTATUS")

player_ids = {}

for row in rows:
    if row[idx_active] == 1:
        full_name = row[idx_name]
        player_id = row[idx_player_id]
        key = normalize_name(full_name)
        player_ids[key] = player_id

os.makedirs("tools/output", exist_ok=True)

with open("tools/output/all_player_ids.json", "w", encoding="utf-8") as f:
    json.dump(player_ids, f, indent=2)

print(f"✅ Pulled {len(player_ids)} active players and saved to tools/output/all_player_ids.json")
