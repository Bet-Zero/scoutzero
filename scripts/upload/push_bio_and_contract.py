#!/usr/bin/env python3
"""
Push bio and contract data to Firestore
"""

import json
import os
import sys
from datetime import datetime

# Add the scripts directory to the path so we can import Firebase helpers
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
except ImportError:
    print("❌ Firebase Admin SDK not installed. Install with: pip install firebase-admin")
    sys.exit(1)

def push_bio_and_contract():
    print("🚀 Starting bio and contract data upload...")
    
    # Initialize Firebase Admin (using serviceAccountKey.json)
    key_path = os.path.join(os.path.dirname(__file__), '../../src/serviceAccountKey.json')
    
    if not os.path.exists(key_path):
        print(f"❌ Service account key not found: {key_path}")
        print("💡 Place your Firebase service account key at src/serviceAccountKey.json")
        return False
    
    try:
        cred = credentials.Certificate(key_path)
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred)
        db = firestore.client()
    except Exception as e:
        print(f"❌ Failed to initialize Firebase: {e}")
        return False
    
    # Load merged player data
    data_dir = os.path.join(os.path.dirname(__file__), '../../data')
    merged_players_file = os.path.join(data_dir, 'merged_players.json')
    
    if not os.path.exists(merged_players_file):
        print(f"❌ Merged players file not found: {merged_players_file}")
        print("💡 Run merge_universal_player_data.py first")
        return False
    
    with open(merged_players_file, 'r') as f:
        player_data = json.load(f)
    
    players = player_data.get('players', {})
    print(f"📊 Found {len(players)} players to upload")
    
    # Upload each player
    success_count = 0
    error_count = 0
    
    for player_id, player_info in players.items():
        try:
            # Prepare the update data
            update_data = {
                "bio": player_info.get("bio", {}),
                "contract_summary": player_info.get("contract_summary", {}),
                "team": player_info.get("team"),
                "status": player_info.get("status", "Signed"),
                "last_updated": datetime.now(),
                "data_source": "automated_pipeline"
            }
            
            # Update the player document
            db.collection("players").document(player_id).set(update_data, merge=True)
            success_count += 1
            
            if success_count % 10 == 0:
                print(f"📈 Uploaded {success_count}/{len(players)} players...")
                
        except Exception as e:
            print(f"❌ Error uploading {player_id}: {e}")
            error_count += 1
    
    print(f"\n✅ Upload complete:")
    print(f"  Success: {success_count}")
    print(f"  Errors: {error_count}")
    
    return error_count == 0

if __name__ == "__main__":
    success = push_bio_and_contract()
    sys.exit(0 if success else 1)