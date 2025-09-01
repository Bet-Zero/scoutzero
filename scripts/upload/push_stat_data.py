
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
    """Initialize Firebase with real credentials - optional"""
    cred_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS', './serviceAccountKey.json')
    if not os.path.exists(cred_path):
        cred_path = '../serviceAccountKey.json'
    
    if not os.path.exists(cred_path):
        print("⚠️  Firebase credentials not found. Skipping upload.")
        print("💡 Place serviceAccountKey.json in project root to enable uploads.")
        return None
    
    try:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
        return firestore.client()
    except Exception as e:
        print(f"⚠️  Failed to initialize Firebase: {e}")
        print("💡 Data processing completed successfully. Only upload step skipped.")
        return None

def find_player_data():
    """Find player data file in multiple possible locations"""
    possible_paths = [
        "../data/players_merged.json",
        "../data/players.json",
        "../../public/players.json",
        "../public/players.json",
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
    """Upload stats data while preserving other player data"""
    print("📊 Pushing Stat Data to Firebase")
    print("=" * 40)
    
    # Initialize Firebase
    db = init_firebase()
    if db is None:
        print("✅ Data processing completed. Upload skipped due to missing credentials.")
        sys.exit(0)
    
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
            
            # Prepare update payload with stats
            update_payload = {}
            
            # Add individual stat fields for easy querying
            for stat_field, value in stats.items():
                update_payload[stat_field] = value
            
            # Also store in system.stats for compatibility
            update_payload["system"] = {
                "stats": stats
            }
            
            # Add metadata
            update_payload["last_stats_update"] = datetime.now(timezone.utc)
            update_payload["stats_season"] = season_key
            
            # Add to batch
            batch.update(doc_ref, update_payload)
            
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
    print(f"\n{'='*40}")
    print(f"✅ Successfully updated {updated_count} players")
    print(f"⚠️  {no_stats_count} players had no stats")
    if errors:
        print(f"❌ Errors encountered: {len(errors)}")
        for error in errors[:5]:  # Show first 5 errors
            print(f"  - {error}")
    print(f"📊 Stats season: {season_key}")
    print(f"{'='*40}")

if __name__ == "__main__":
    main()
