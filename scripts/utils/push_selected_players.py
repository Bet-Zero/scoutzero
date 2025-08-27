import sys
import json
import os

# ✅ Add the path to your src folder
sys.path.append('./src')

from firebase_helpers import savePlayerData

# Load merged player data
with open("data/players.json", "r") as f:
    all_players = json.load(f)

# Players to update
target_players = [
    "saddiq_bey",
    "daron_holmes_ii",
    "nikola_topic"
]

for player_id in target_players:
    if player_id in all_players:
        print(f"🔁 Re-pushing {player_id}...")
        savePlayerData(player_id, all_players[player_id])
    else:
        print(f"❌ {player_id} not found in players.json")
