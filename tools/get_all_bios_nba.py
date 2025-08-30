import requests
import json
from datetime import datetime

# === CONFIG ===
player_id_file = "scripts/all_player_ids.json"
output_file = "players_bios_2025.json"

# === HEADERS ===
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/121.0.0.0 Safari/537.36",
    "Referer": "https://www.nba.com/",
    "Origin": "https://www.nba.com",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "application/json",
    "Connection": "keep-alive",
    "Host": "stats.nba.com"
}

def fetch_bio(player_id):
    try:
        url = "https://stats.nba.com/stats/commonplayerinfo"
        res = requests.get(url, headers=headers, params={"PlayerID": player_id}, timeout=10)
        data = res.json()
        row = data["resultSets"][0]["rowSet"][0]
        cols = data["resultSets"][0]["headers"]
        mapped = dict(zip(cols, row))

        # Calculate age (with better error handling)
        age = None
        if mapped.get("BIRTHDATE"):
            try:
                birthdate_str = mapped["BIRTHDATE"].split("T")[0] if "T" in mapped["BIRTHDATE"] else mapped["BIRTHDATE"]
                birthdate = datetime.strptime(birthdate_str, "%Y-%m-%d")
                today = datetime.today()
                age = today.year - birthdate.year - ((today.month, today.day) < (birthdate.month, birthdate.day))
            except (ValueError, AttributeError) as e:
                print(f"⚠️ Couldn't calculate age for {player_id}: {str(e)}")

        # Calculate years pro (with error handling)
        years_pro = None
        if mapped.get("TO_YEAR") and mapped.get("FROM_YEAR"):
            try:
                years_pro = int(mapped["TO_YEAR"]) - int(mapped["FROM_YEAR"]) + 1
            except (ValueError, TypeError) as e:
                print(f"⚠️ Couldn't calculate years pro for {player_id}: {str(e)}")

        # Clean team name (shorten common prefixes)
        short_team = mapped.get("TEAM_NAME", "")
        for prefix in ["Los Angeles", "Golden State", "Portland", "New Orleans", "San Antonio"]:
            if short_team.startswith(prefix):
                short_team = short_team.split()[-1]

        return {
            "HT": mapped.get("HEIGHT"),
            "WT": str(mapped.get("WEIGHT", "")),
            "AGE": age,
            "Years Pro": years_pro,
            "Team": short_team,
            "Position": mapped.get("POSITION")
        }

    except Exception as e:
        print(f"❌ Failed for ID {player_id}: {str(e)}")
        return None

# === MAIN ===
with open(player_id_file, "r", encoding="utf-8") as f:
    player_ids = json.load(f)

bios = {}

print(f"🔁 Fetching bios for {len(player_ids)} players...")
for name_key, player_id in player_ids.items():
    print(f"🧠 {name_key}...", end=" ")
    bio = fetch_bio(player_id)
    if bio:
        bios[name_key] = { "bio": bio }
        print("✅")
    else:
        print("❌")

# === SAVE OUTPUT ===
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(bios, f, indent=2)

print(f"\n🎉 Done! Saved all bios to {output_file}")