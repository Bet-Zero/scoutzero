
import json
import firebase_admin
from firebase_admin import credentials, firestore

# Initialize Firebase
cred = credentials.Certificate("../data/firebaseServiceAccountKey.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

# Load players.json (dictionary format)
with open("../data/players.json", "r") as f:
    players = json.load(f)

# Loop through each player object
for player_id, full_data in players.items():
    # Skip excluded fields
    update_data = {
        k: v for k, v in full_data.items()
        if k not in ["system", "position", "source_url"]
    }

    # Push to Firebase with merge=True
    try:
        db.collection("players").document(player_id).set(update_data, merge=True)
        print(f"✅ Updated {player_id}")
    except Exception as e:
        print(f"❌ Error updating {player_id}: {e}")
