
#!/usr/bin/env python3
"""
Push Stat Data to Firebase
Updates player stats while preserving bio data and grades
"""

import json
import os
import sys
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timezone

def init_firebase():
    """Initialize Firebase with real credentials"""
    cred_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS', './serviceAccountKey.json')
    if not os.path.exists(cred_path):
        cred_path = '../serviceAccountKey.json'
    if not os.path.exists(cred_path):
        cred_path = '../../serviceAccountKey.json'
    
    if not os.path.exists(cred_path):
        print("❌ Firebase credentials not found. Place serviceAccountKey.json in project root.")
        sys.exit(1)
    
    try:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
        return firestore.client()
    except Exception as e:
        print(f"❌ Failed to initialize Firebase: {e}")
        sys.exit(1)

def find_player_data():
    """Find player data file in multiple possible locations"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    possible_paths = [
        os.path.join(script_dir, "..", "..", "resources", "data", "players_merged.json"),
        os.path.join(script_dir, "..", "..", "resources", "data", "players.json"),
        os.path.join(script_dir, "..", "..", "..", "public", "players.json"),
        "players.json"
    ]
    
    for path in possible_paths:
        if os.path.exists(path):
            return path
    
    print("❌ No player data file found. Tried:")
    for path in possible_paths:
        print(f"  - {path}")
    return None

def extract_stats_from_player_data(player_data):
    """Extract stats from player data - handles both system.stats and direct fields"""
    stats = {}
    
    # Check for system.stats format first
    if "system" in player_data and "stats" in player_data["system"]:
        stats = player_data["system"]["stats"]
    else:
        # Extract stats fields directly from player data
        stats_fields = ["MIN", "PPG", "RPG", "APG", "FG%", "3PT%", "FT%", "EFG%", "Games Played", "TS%", "USG%", "BPM", "VORP", "WS", "PER"]
        for field in stats_fields:
            if field in player_data:
                stats[field] = player_data[field]
    
    return stats

def main():
    """Upload stats data to seasons subcollection"""
    print("📊 Pushing Stat Data to Firebase Seasons Subcollection")
    print("=" * 60)
    
    # Initialize Firebase
    db = init_firebase()
    
    # Find player data
    data_file = find_player_data()
    if not data_file:
        sys.exit(1)
    
    print(f"📁 Loading player data from: {data_file}")
    
    # Load players data
    try:
        with open(data_file, "r") as f:
            players = json.load(f)
    except Exception as e:
        print(f"❌ Failed to load player data: {e}")
        sys.exit(1)
    
    print(f"👥 Processing {len(players)} players...")
    
    # Get current season info
    now = datetime.now()
    current_year = now.year + 1 if now.month >= 7 else now.year
    season_key = f"{current_year-1}-{str(current_year)[-2:]}"
    
    print(f"📅 Using season ID: {season_key}")
    
    # Process players in batches
    batch = db.batch()
    batch_count = 0
    updated_count = 0
    no_stats_count = 0
    errors = []
    
    for player_id, player_data in players.items():
        try:
            # Extract stats from player data
            stats = extract_stats_from_player_data(player_data)
            
            if not stats:
                no_stats_count += 1
                print(f"⚠️  No stats for {player_id}")
                continue
            
            # Check if player exists in Firestore
            doc_ref = db.collection("players").document(player_id)
            doc = doc_ref.get()
            
            if not doc.exists:
                print(f"⚠️  Player {player_id} not found in Firestore, skipping stats update")
                continue
            
            # Create season subcollection document
            season_ref = doc_ref.collection("seasons").document(season_key)
            
            # Prepare season data payload
            season_payload = {}
            
            # Add all stat fields
            for stat_field, value in stats.items():
                season_payload[stat_field] = value
            
            # Add metadata
            season_payload["updated_at"] = datetime.now(timezone.utc)
            season_payload["season_id"] = season_key
            
            # Write to seasons subcollection
            batch.set(season_ref, season_payload, merge=True)
            
            batch_count += 1
            updated_count += 1
            
            # Commit batch every 450 operations
            if batch_count >= 450:
                batch.commit()
                batch = db.batch()
                batch_count = 0
                print(f"  📊 Committed batch ({updated_count} players processed)")
                
        except Exception as e:
            errors.append(f"Player {player_id}: {str(e)}")
            print(f"❌ Error processing {player_id}: {e}")
    
    # Commit remaining operations
    if batch_count > 0:
        batch.commit()
        print(f"  📊 Final batch committed")
    
    # Summary
    print(f"\n{'='*60}")
    print(f"✅ Successfully updated {updated_count} players")
    print(f"   📊 Season subcollections created: {updated_count}")
    print(f"⚠️  {no_stats_count} players had no stats")
    if errors:
        print(f"❌ Errors encountered: {len(errors)}")
        for error in errors[:5]:  # Show first 5 errors
            print(f"  - {error}")
    print(f"📅 Season: {season_key}")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()
