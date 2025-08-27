#!/usr/bin/env python3
"""
Push stat data to Firestore 
"""

import json
import os
import sys
from datetime import datetime

# Add the scripts directory to the path
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
except ImportError:
    print("❌ Firebase Admin SDK not installed. Install with: pip install firebase-admin")
    sys.exit(1)

def push_stat_data():
    print("📊 Starting stat data upload...")
    
    # Initialize Firebase Admin
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
    
    # Load stat data (placeholder - in real implementation would load from stats pipeline)
    data_dir = os.path.join(os.path.dirname(__file__), '../../data')
    stats_file = os.path.join(data_dir, 'player_stats.json')
    
    # Create sample stats if file doesn't exist
    if not os.path.exists(stats_file):
        print("📝 Creating sample stats data...")
        sample_stats = {
            "last_updated": datetime.now().isoformat(),
            "source": "stats_pipeline",
            "players": {
                "sample_player_id": {
                    "PPG": 24.5,
                    "RPG": 8.2,
                    "APG": 5.1,
                    "FG%": 0.482,
                    "3P%": 0.367,
                    "FT%": 0.847,
                    "MPG": 34.2,
                    "GP": 72
                }
            }
        }
        
        os.makedirs(data_dir, exist_ok=True)
        with open(stats_file, 'w') as f:
            json.dump(sample_stats, f, indent=2)
    
    with open(stats_file, 'r') as f:
        stats_data = json.load(f)
    
    players = stats_data.get('players', {})
    print(f"📊 Found stats for {len(players)} players")
    
    # Upload stats for each player
    success_count = 0
    error_count = 0
    
    for player_id, player_stats in players.items():
        try:
            # Update the player document with stats
            doc_ref = db.collection("players").document(player_id)
            update_data = {
                "system": {
                    "stats": player_stats
                },
                "stats_updated": datetime.now(),
                "data_source": "automated_stats_pipeline"
            }
            
            doc_ref.set(update_data, merge=True)
            success_count += 1
            
            if success_count % 10 == 0:
                print(f"📈 Updated stats for {success_count}/{len(players)} players...")
                
        except Exception as e:
            print(f"❌ Error updating stats for {player_id}: {e}")
            error_count += 1
    
    print(f"\n✅ Stats upload complete:")
    print(f"  Success: {success_count}")
    print(f"  Errors: {error_count}")
    
    return error_count == 0

if __name__ == "__main__":
    success = push_stat_data()
    sys.exit(0 if success else 1)