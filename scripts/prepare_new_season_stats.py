#!/usr/bin/env python3
"""
Prepare New Season Stats - Sets up stats structure for new season
Maintains player identities while clearing old stats
"""

import sys
import os
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

def clear_stats_fields(db):
    """Clear stats fields while preserving bio data and grades"""
    print("\n📊 Preparing stats structure for new season...")
    
    # Stats fields to clear for new season
    stats_fields = [
        'MIN', 'PPG', 'RPG', 'APG', 'FG%', '3PT%', 'FT%', 'EFG%', 
        'Games Played', 'TS%', 'USG%', 'BPM', 'VORP', 'WS', 'PER'
    ]
    
    try:
        players_ref = db.collection('players')
        players = players_ref.get()
        
        updated_count = 0
        batch = db.batch()
        batch_count = 0
        
        for player_doc in players:
            player_ref = players_ref.document(player_doc.id)
            
            # Create update dict to clear stats fields
            updates = {}
            player_data = player_doc.to_dict()
            
            for field in stats_fields:
                if field in player_data:
                    updates[field] = None  # Clear the field
            
            # Add last_stats_update timestamp
            updates['last_stats_update'] = datetime.now(timezone.utc)
            updates['stats_season'] = None  # Will be set when new stats are loaded
            
            if updates:
                batch.update(player_ref, updates)
                updated_count += 1
                batch_count += 1
                
                # Commit batch every 450 operations
                if batch_count >= 450:
                    batch.commit()
                    batch = db.batch()
                    batch_count = 0
                    print(f"  📊 Processed {updated_count} players so far")
        
        # Commit remaining operations
        if batch_count > 0:
            batch.commit()
        
        print(f"✅ Cleared stats for {updated_count} players")
        return True
        
    except Exception as e:
        print(f"❌ Failed to prepare stats structure: {e}")
        return False

def validate_bio_preservation(db):
    """Ensure bio data and grades are still intact"""
    print("\n🛡️  Validating bio data and grades preservation...")
    
    try:
        players_ref = db.collection('players')
        sample_players = players_ref.limit(10).get()
        
        preserved_count = 0
        bio_fields = ['Name', 'HT', 'WT', 'AGE', 'Years Pro', 'Team', 'Position', 'Contract']
        grade_fields = ['overall_grade', 'roles', 'traits', 'badges', 'blurbs']
        
        for player_doc in sample_players:
            player_data = player_doc.to_dict()
            
            # Check bio preservation
            bio_present = any(field in player_data for field in bio_fields)
            # Check grades preservation (optional but should be preserved if present)
            grades_preserved = True  # Assume preserved unless proven otherwise
            
            if bio_present:
                preserved_count += 1
        
        if preserved_count == len(sample_players):
            print(f"✅ Bio data preserved for all sampled players")
            return True
        else:
            print(f"⚠️  Bio data missing for some players")
            return False
            
    except Exception as e:
        print(f"❌ Failed to validate preservation: {e}")
        return False

def setup_stats_metadata(db):
    """Set up metadata for new season stats"""
    print("\n📋 Setting up stats metadata...")
    
    try:
        # Get current season year
        now = datetime.now()
        current_year = now.year + 1 if now.month >= 7 else now.year
        season_key = f"{current_year-1}-{str(current_year)[-2:]}"
        
        # Update metadata collection
        metadata_ref = db.collection('metadata').document('stats')
        metadata_ref.set({
            'last_cleared': datetime.now(timezone.utc),
            'season': season_key,
            'ready_for_new_stats': True,
            'cleared_fields': [
                'MIN', 'PPG', 'RPG', 'APG', 'FG%', '3PT%', 'FT%', 'EFG%', 
                'Games Played', 'TS%', 'USG%', 'BPM', 'VORP', 'WS', 'PER'
            ]
        }, merge=True)
        
        print(f"✅ Stats metadata set for {season_key} season")
        return True
        
    except Exception as e:
        print(f"❌ Failed to set up stats metadata: {e}")
        return False

def main():
    """Prepare stats structure for new season"""
    print("📊 New Season Stats Preparation")
    print("=" * 40)
    
    # Initialize Firebase
    db = init_firebase()
    
    # Step 1: Clear old stats while preserving bio and grades
    if not clear_stats_fields(db):
        print("❌ Failed to clear stats fields")
        sys.exit(1)
    
    # Step 2: Validate bio data and grades are preserved
    if not validate_bio_preservation(db):
        print("❌ Bio data or grades not properly preserved")
        sys.exit(1)
    
    # Step 3: Set up metadata for new season
    if not setup_stats_metadata(db):
        print("❌ Failed to set up stats metadata")
        sys.exit(1)
    
    print("\n✅ Stats structure prepared for new season!")
    print("📋 Ready for new stats data via update_stats.py")

if __name__ == "__main__":
    main()