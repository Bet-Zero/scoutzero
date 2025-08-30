
import os
import json
import requests

# === Config Paths ===
PLAYERS_FILE = "public/players.json"
ID_MAP_FILE = "tools/output/all_player_ids.json"
HEADSHOTS_DIR = "public/assets/headshots"

# === Load Data ===
with open(PLAYERS_FILE, "r", encoding="utf-8") as f:
    players = json.load(f)

with open(ID_MAP_FILE, "r", encoding="utf-8") as f:
    id_map = json.load(f)

# === Ensure output folder exists ===
os.makedirs(HEADSHOTS_DIR, exist_ok=True)

# === Download Headshots ===
for player_key in players:
    nba_id = id_map.get(player_key)
    if not nba_id:
        print(f"❌ No NBA ID for {player_key}")
        continue

    url = f"https://cdn.nba.com/headshots/nba/latest/1040x760/{nba_id}.png"
    output_path = os.path.join(HEADSHOTS_DIR, f"{player_key}.png")

    try:
        res = requests.get(url)
        if res.status_code == 200:
            with open(output_path, "wb") as f:
                f.write(res.content)
            print(f"✅ Saved: {player_key}")
        else:
            print(f"❌ Failed ({res.status_code}) for {player_key}")
    except Exception as e:
        print(f"❌ Error for {player_key}: {e}")
