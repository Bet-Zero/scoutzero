import firebase_admin
from firebase_admin import credentials, firestore
import os

# 🔐 Load existing service account key from /src
SERVICE_ACCOUNT_PATH = os.path.join(os.path.dirname(__file__), "serviceAccountKey.json")
cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)

# ✅ Initialize Firebase once
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)

# 📚 Connect to Firestore
db = firestore.client()

# ✅ Save player data
def savePlayerData(player_id, player_data):
    doc_ref = db.collection("players").document(player_id)
    doc_ref.set(player_data, merge=True)
    print(f"✅ Uploaded {player_id} to Firebase")
