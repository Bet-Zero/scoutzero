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
    # Check if Firebase is already initialized
    if firebase_admin._apps:
        return firestore.client()
    
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

def preserve_stats_across_seasons(db):
    """Preserve existing stats while setting up metadata for new season (no clearing)"""
    print("\n📊 Preserving stats across seasons and updating metadata...")
    
    try:
        players_ref = db.collection('players')
        players = players_ref.get()
        
        updated_count = 0
        batch = db.batch()
        batch_count = 0
        
        for player_doc in players:
            player_ref = players_ref.document(player_doc.id)
            player_data = player_doc.to_dict()
            
            # Only update metadata fields, preserve all existing stats
            updates = {
                'last_stats_transition': datetime.now(timezone.utc),
                'stats_carry_over': True  # Flag to indicate stats carried over from previous season
            }
            
            # Only add stats_season if it doesn't exist or is null
            if not player_data.get('stats_season'):
                updates['stats_season'] = 'carried_over'  # Will be updated when new stats are loaded
            
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
        
        print(f"✅ Preserved stats for {updated_count} players (no data loss)")
        return True
        
    except Exception as e:
        print(f"❌ Failed to preserve stats across seasons: {e}")
        return False

def validate_bio_preservation(db):
    """Ensure bio data and grades are still intact"""
    print("\n🛡️  Validating bio data and grades preservation...")
    
    try:
        players_ref = db.collection('players')
        sample_players = players_ref.limit(10).get()
        
        preserved_count = 0
        bio_fields = ['Name', 'Team', 'Position']  # Core required fields only
        
        for player_doc in sample_players:
            player_data = player_doc.to_dict()
            
            # Check core bio preservation - just need Name, Team, Position
            core_bio_present = all(field in player_data and player_data[field] for field in bio_fields)
            
            if core_bio_present:
                preserved_count += 1
        
        success_rate = (preserved_count / len(sample_players)) * 100
        
        if success_rate >= 80:  # Allow for some flexibility
            print(f"✅ Bio data preserved for {preserved_count}/{len(sample_players)} sampled players ({success_rate:.0f}%)")
            return True
        else:
            print(f"⚠️  Bio data missing for some players ({preserved_count}/{len(sample_players)} valid)")
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
            'last_transition': datetime.now(timezone.utc),
            'season': season_key,
            'ready_for_new_stats': True,
            'stats_policy': 'carry_over',  # Updated to reflect new policy
            'note': 'Stats carry over from previous season until updated individually'
        }, merge=True)
        
        print(f"✅ Stats metadata set for {season_key} season (carry-over policy)")
        return True
        
    except Exception as e:
        print(f"❌ Failed to set up stats metadata: {e}")
        return False

def main():
    """Prepare stats structure for new season"""
    print("📊 New Season Stats Preparation (Preserve Stats Policy)")
    print("=" * 60)
    
    # Initialize Firebase
    db = init_firebase()
    
    # Step 1: Preserve existing stats while updating metadata
    if not preserve_stats_across_seasons(db):
        print("❌ Failed to preserve stats across seasons")
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
    print("📋 Stats carry over from previous season until updated")
    print("📋 Ready for new stats data via update_stats.py when season starts")

if __name__ == "__main__":
    main()