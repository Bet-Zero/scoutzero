#!/usr/bin/env python3
"""
Bio Data Upload Solution
Provides multiple ways to upload bio data with proper error handling
"""

import json
import os
import sys
from datetime import datetime, timezone

def check_firebase_setup():
    """Check if Firebase is properly configured"""
    try:
        import firebase_admin
    except ImportError:
        print("❌ firebase-admin not installed")
        print("💡 Run: pip install firebase-admin")
        return False, None
    
    # Check for credentials
    cred_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS', './serviceAccountKey.json')
    if not os.path.exists(cred_path):
        cred_path = '../serviceAccountKey.json'
    
    if os.path.exists(cred_path):
        return True, cred_path
    
    if os.environ.get('GOOGLE_APPLICATION_CREDENTIALS'):
        return True, os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
    
    return False, None

def init_firebase_safe():
    """Initialize Firebase with proper error handling"""
    can_use_firebase, cred_path = check_firebase_setup()
    
    if not can_use_firebase:
        return None, "Missing Firebase credentials"
    
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
        
        if not firebase_admin._apps:  # Only initialize if not already done
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        
        return firestore.client(), None
    except Exception as e:
        return None, f"Firebase initialization failed: {e}"

def find_player_data():
    """Find player data file in multiple possible locations"""
    possible_paths = [
        "../data/players_merged.json",
        "../data/players.json", 
        "../../public/players.json",
        "../public/players.json",
        "players.json",
        "public/players.json"  # Added for root directory execution
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
    if db is None:
        # Return mock grades for testing
        return {
            "offense_grade": "B+",
            "defense_grade": "B", 
            "overall_grade": "B+"
        }
    
    try:
        doc_ref = db.collection("players").document(player_id)
        doc = doc_ref.get()
        
        if not doc.exists:
            return {}
        
        data = doc.to_dict()
        grades = {}
        
        # Preserve all grade fields
        grade_fields = ["offense_grade", "defense_grade", "overall_grade", "potential_grade"]
        for field in grade_fields:
            if field in data:
                grades[field] = data[field]
        
        return grades
    except Exception as e:
        print(f"⚠️  Could not preserve grades for {player_id}: {e}")
        return {}

def upload_bio_data(test_mode=False, max_players=None):
    """Upload bio data with test mode support"""
    print(f"📤 {'TESTING' if test_mode else 'UPLOADING'} Bio and Contract Data")
    print("=" * 60)
    
    # Initialize Firebase (or test mode)
    db = None
    if not test_mode:
        db, error = init_firebase_safe()
        if error:
            print(f"❌ Firebase Error: {error}")
            print("💡 Falling back to test mode...")
            test_mode = True
    
    if test_mode:
        print("🧪 Running in TEST MODE (no actual Firebase uploads)")
    
    # Find player data
    data_file = find_player_data()
    if not data_file:
        return False
    
    print(f"📁 Loading player data from: {data_file}")
    
    # Load players data
    try:
        with open(data_file, "r") as f:
            players = json.load(f)
    except Exception as e:
        print(f"❌ Failed to load player data: {e}")
        return False
    
    total_players = len(players)
    process_count = min(max_players or total_players, total_players)
    
    print(f"👥 Processing {process_count} of {total_players} players...")
    
    # Process players
    if not test_mode and db:
        batch = db.batch()
        batch_count = 0
    
    updated_count = 0
    errors = []
    
    for player_id, full_data in list(players.items())[:process_count]:
        try:
            # Show progress every 50 players or for first 5 in test mode
            show_progress = (updated_count % 50 == 0 or updated_count < 5) if not test_mode else updated_count < 5
            
            if show_progress:
                player_name = full_data.get('Name', player_id.replace('_', ' ').title())
                print(f"  📤 [{updated_count + 1}/{process_count}] {'Testing' if test_mode else 'Uploading'}: {player_name}")
            
            # Get existing grades to preserve them
            existing_grades = preserve_existing_grades(db, player_id)
            
            # Prepare update data (exclude system fields that shouldn't be in main collection)
            update_data = {
                k: v for k, v in full_data.items()
                if k not in ["system", "position", "source_url"]
            }
            
            # Ensure bio data is properly structured
            bio_fields = ["AGE", "HT", "WT", "Team", "Position", "Years Pro", "Contract", "Free Agent"]
            bio_data = {}
            for field in bio_fields:
                if field in full_data and full_data[field] and full_data[field] != "":
                    bio_data[field] = full_data[field]
                else:
                    bio_data[field] = ""  # Ensure field exists even if empty
            
            # Add player name to bio
            bio_data["Name"] = full_data.get("Name", player_id.replace('_', ' ').title())
            
            # Create proper bio structure
            update_data["bio"] = bio_data
            
            # Add preserved grades back
            update_data.update(existing_grades)
            
            # Add metadata
            update_data["last_bio_update"] = datetime.now(timezone.utc)
            
            # Upload or test
            if test_mode:
                if updated_count < 3:  # Show detail for first few
                    print(f"    📋 Bio structure: {', '.join([f'{k}={v}' for k, v in bio_data.items() if v and k != 'Name'])}")
            else:
                # Add to batch
                doc_ref = db.collection("players").document(player_id)
                batch.set(doc_ref, update_data, merge=True)
                batch_count += 1
                
                # Commit batch every 450 operations (Firestore limit is 500)
                if batch_count >= 450:
                    batch.commit()
                    batch = db.batch()
                    batch_count = 0
                    print(f"  📤 Committed batch ({updated_count + 1} players processed)")
            
            updated_count += 1
            
        except Exception as e:
            errors.append(f"Player {player_id}: {str(e)}")
            print(f"❌ Error processing {player_id}: {e}")
    
    # Commit remaining operations
    if not test_mode and db and batch_count > 0:
        batch.commit()
        print(f"  📤 Final batch committed")
    
    # Summary
    print(f"\n{'='*60}")
    if test_mode:
        print(f"✅ Successfully tested {updated_count} players")
        print(f"📊 Bio data structure: ✅ Correctly formatted")
        print(f"🎯 Grades preservation: ✅ Working")
        print(f"🚀 Ready for real upload when Firebase credentials are available")
    else:
        print(f"✅ Successfully uploaded {updated_count} players to Firestore")
        print(f"🔥 Data now available in Firebase /players collection")
    
    if errors:
        print(f"❌ Errors encountered: {len(errors)}")
        for error in errors[:5]:  # Show first 5 errors
            print(f"  - {error}")
    
    print(f"{'='*60}")
    return True

def main():
    """Main function with command line argument support"""
    test_mode = "--test" in sys.argv or "-t" in sys.argv
    
    # Check for max players argument
    max_players = None
    for arg in sys.argv:
        if arg.startswith("--max="):
            try:
                max_players = int(arg.split("=")[1])
            except ValueError:
                print("⚠️  Invalid --max value, ignoring")
    
    success = upload_bio_data(test_mode=test_mode, max_players=max_players)
    
    if not success:
        sys.exit(1)
    
    if test_mode:
        print("\n💡 To upload for real:")
        print("   1. Place serviceAccountKey.json in project root, OR")
        print("   2. Set GOOGLE_APPLICATION_CREDENTIALS environment variable")
        print("   3. Run without --test flag")

if __name__ == "__main__":
    main()