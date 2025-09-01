
#!/usr/bin/env python3
"""
Push Bio and Contract Data to Firebase
Updates player bio and contract information while preserving grades
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

def preserve_existing_grades(db, player_id):
    """Get existing grades from player document"""
    try:
        doc_ref = db.collection("players").document(player_id)
        doc = doc_ref.get()
        
        if not doc.exists:
            return {}
        
        data = doc.to_dict()
        grades = {}
        
        # Preserve grade fields
        grade_fields = ['overall_grade', 'roles', 'traits', 'badges', 'blurbs']
        for field in grade_fields:
            if field in data:
                grades[field] = data[field]
        
        return grades
        
    except Exception as e:
        print(f"⚠️  Could not retrieve existing grades for {player_id}: {e}")
        return {}

def main():
    """Upload bio and contract data while preserving grades"""
    print("📤 Pushing Bio and Contract Data to Firebase")
    print("=" * 50)
    
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
    
    # Process players in batches
    batch = db.batch()
    batch_count = 0
    updated_count = 0
    errors = []
    
    for player_id, full_data in players.items():
        try:
            # Get existing grades to preserve them
            existing_grades = preserve_existing_grades(db, player_id)
            
            # Prepare update data (exclude system fields that shouldn't be in main collection)
            update_data = {
                k: v for k, v in full_data.items()
                if k not in ["system", "position", "source_url"]
            }
            
            # Add preserved grades back
            update_data.update(existing_grades)
            
            # Add metadata
            update_data["last_bio_update"] = datetime.now(timezone.utc)
            
            # Add to batch
            doc_ref = db.collection("players").document(player_id)
            batch.set(doc_ref, update_data, merge=True)
            
            batch_count += 1
            updated_count += 1
            
            # Commit batch every 450 operations (Firestore limit is 500)
            if batch_count >= 450:
                batch.commit()
                batch = db.batch()
                batch_count = 0
                print(f"  📤 Committed batch ({updated_count} players processed)")
                
        except Exception as e:
            errors.append(f"Player {player_id}: {str(e)}")
            print(f"❌ Error processing {player_id}: {e}")
    
    # Commit remaining operations
    if batch_count > 0:
        batch.commit()
        print(f"  📤 Final batch committed")
    
    # Summary
    print(f"\n{'='*50}")
    print(f"✅ Successfully updated {updated_count} players")
    if errors:
        print(f"❌ Errors encountered: {len(errors)}")
        for error in errors[:5]:  # Show first 5 errors
            print(f"  - {error}")
    print(f"{'='*50}")

if __name__ == "__main__":
    main()
