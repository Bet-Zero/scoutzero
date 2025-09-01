#!/usr/bin/env python3
"""
Simple Season Transition
Uploads players.json to Firestore, preserving existing grades
"""

import json
import os
import sys
from datetime import datetime

# Firebase imports
try:
    import firebase_admin
    from firebase_admin import credentials, firestore
except ImportError:
    print("❌ Firebase Admin SDK not installed. Run: pip install firebase-admin")
    sys.exit(1)

def initialize_firebase():
    """Initialize Firebase with service account key"""
    service_key_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'serviceAccountKey.json')
    
    if not os.path.exists(service_key_path):
        print("❌ serviceAccountKey.json not found in project root")
        print("💡 Download from Firebase Console → Project Settings → Service Accounts")
        sys.exit(1)
    
    if not firebase_admin._apps:
        cred = credentials.Certificate(service_key_path)
        firebase_admin.initialize_app(cred)
    
    return firestore.client()

def load_players_json():
    """Load the complete player data from public/players.json"""
    players_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'public', 'players.json')
    
    if not os.path.exists(players_file):
        print(f"❌ players.json not found at: {players_file}")
        sys.exit(1)
    
    with open(players_file, 'r') as f:
        players_data = json.load(f)
    
    print(f"✅ Loaded {len(players_data)} players from players.json")
    return players_data

def preserve_existing_grades(db, player_id, new_player_data):
    """Check if player exists in Firestore and preserve their grades"""
    try:
        existing_doc = db.collection('players').document(player_id).get()
        
        if existing_doc.exists:
            existing_data = existing_doc.to_dict()
            
            # Preserve grades and scouting data
            preserved_fields = ['grades', 'scouting', 'traits', 'evaluations', 'notes']
            
            for field in preserved_fields:
                if field in existing_data:
                    new_player_data[field] = existing_data[field]
            
            return True  # Player existed
        
        return False  # New player
    
    except Exception as e:
        print(f"⚠️  Error checking existing data for {player_id}: {e}")
        return False

def upload_players_to_firestore(db, players_data):
    """Upload player data to Firestore, preserving existing grades"""
    
    new_players = 0
    updated_players = 0
    
    print("🔄 Uploading players to Firestore...")
    
    for player_id, player_data in players_data.items():
        try:
            # Create a copy to avoid modifying original data
            upload_data = player_data.copy()
            
            # Preserve existing grades if player exists
            existed = preserve_existing_grades(db, player_id, upload_data)
            
            # Add metadata
            upload_data['last_updated'] = datetime.now().isoformat()
            
            # Upload to Firestore
            db.collection('players').document(player_id).set(upload_data, merge=True)
            
            if existed:
                updated_players += 1
            else:
                new_players += 1
                print(f"  🆕 New player: {player_data.get('Name', player_id)}")
            
        except Exception as e:
            print(f"❌ Error uploading {player_id}: {e}")
    
    print(f"✅ Upload complete: {updated_players} updated, {new_players} new players")

def main():
    """Main season transition process"""
    print("🏀 NBA Season Transition - Simple Version")
    print("=" * 50)
    
    # Initialize Firebase
    print("🔥 Connecting to Firebase...")
    db = initialize_firebase()
    
    # Load player data
    print("📄 Loading player data...")
    players_data = load_players_json()
    
    # Upload to Firestore
    upload_players_to_firestore(db, players_data)
    
    print("\n🎉 Season transition complete!")
    print("💡 Run 'npm run capsheets:generate' to create salary cap sheets")

if __name__ == "__main__":
    main()