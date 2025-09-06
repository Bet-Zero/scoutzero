import undetected_chromedriver as uc
import json
import time
import os

def normalize_name(name):
    return name.lower().replace(".", "").replace("'", "").replace(" ", "_")

url = (
    "https://stats.nba.com/stats/commonallplayers?"
    "LeagueID=00&Season=2024-25&IsOnlyCurrentSeason=1"
)

print("🚀 Launching headless browser...")
options = uc.ChromeOptions()
options.headless = True
driver = uc.Chrome(options=options)

print("📡 Loading NBA data from browser...")
driver.get(url)

# Wait for network to finish (NBA's JS pipeline is slow sometimes)
time.sleep(5)

# Extract raw JSON from page body
pre = driver.find_element("tag name", "pre")
data = json.loads(pre.text)
driver.quit()

print("✅ Data received from browser")

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

output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
os.makedirs(output_dir, exist_ok=True)

output_file = os.path.join(output_dir, "all_player_ids.json")
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(player_ids, f, indent=2)

print(f"✅ Pulled {len(player_ids)} players and saved to {output_file}")
