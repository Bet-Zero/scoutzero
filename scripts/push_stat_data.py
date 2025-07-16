
import json
import firebase_admin
from firebase_admin import credentials, firestore

# Initialize Firebase
cred = credentials.Certificate("../data/firebaseServiceAccountKey.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

# Load stats from merged players.json
with open("../data/players.json", "r") as f:
    players = json.load(f)

for player_id, player_data in players.items():
    stats = player_data.get("system", {}).get("stats")
    if not stats:
        print(f"⚠️  No stats for {player_id}")
        continue

    try:
        doc_ref = db.collection("players").document(player_id)
        doc = doc_ref.get()
        if not doc.exists:
            print(f"❌ Skipping {player_id}: not found in Firestore.")
            continue

        # Merge only stats block
        update_payload = {
            "system": {
                "stats": stats
            }
        }

        doc_ref.set(update_payload, merge=True)
        print(f"✅ Stats updated for {player_id}")

    except Exception as e:
        print(f"❌ Error updating {player_id}: {e}")
