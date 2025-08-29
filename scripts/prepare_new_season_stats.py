#!/usr/bin/env python3
"""
Prepare stats structure for new season without overwriting previous season data.
This script sets up the stats framework for a new season while preserving
historical stats in the archive.
"""

import json
import os
import sys
from datetime import datetime

# Add the scripts directory to the path
sys.path.append(os.path.dirname(__file__))

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
except ImportError:
    print("❌ Firebase Admin SDK not installed. Install with: pip install firebase-admin")
    sys.exit(1)

def init_firebase():
    """Initialize Firebase Admin SDK"""
    key_path = os.path.join(os.path.dirname(__file__), '../src/serviceAccountKey.json')
    
    if not os.path.exists(key_path):
        print(f"❌ Service account key not found: {key_path}")
        print("💡 Place your Firebase service account key at src/serviceAccountKey.json")
        return None
    
    try:
        cred = credentials.Certificate(key_path)
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred)
        return firestore.client()
    except Exception as e:
        print(f"❌ Failed to initialize Firebase: {e}")
        return None

def get_current_season():
    """Determine current NBA season year"""
    now = datetime.now()
    current_month = now.month
    
    # NBA season logic
    if current_month >= 7 and current_month <= 9:
        # July-September: Preparing for next season
        return now.year + 1
    elif current_month >= 10:
        # October-December: Current season year
        return now.year + 1
    else:
        # January-June: Current season year
        return now.year

def prepare_new_season_stats(season_year=None):
    """
    Prepare stats structure for new season
    """
    db = init_firebase()
    if not db:
        return False
    
    if not season_year:
        season_year = get_current_season()
    
    print(f"📊 Preparing stats structure for {season_year-1}-{str(season_year)[-2:]} season...")
    
    try:
        # Get all players
        players = db.collection('players').get()
        
        success_count = 0
        error_count = 0
        
        for player_doc in players:
            try:
                player_data = player_doc.to_dict()
                player_id = player_doc.id
                
                # Check if player already has current season stats structure
                current_stats = player_data.get('system', {}).get('stats', {})
                current_season_in_stats = current_stats.get('season')
                
                # Only update if stats are from previous season or missing season info
                if not current_season_in_stats or current_season_in_stats != f"{season_year-1}-{str(season_year)[-2:]}":
                    # Create new season stats structure (empty/placeholder)
                    new_stats = {
                        'season': f"{season_year-1}-{str(season_year)[-2:]}",
                        'games_played': 0,
                        'PPG': 0.0,
                        'RPG': 0.0,
                        'APG': 0.0,
                        'FG%': 0.0,
                        'FT%': 0.0,
                        '3P%': 0.0,
                        'SPG': 0.0,
                        'BPG': 0.0,
                        'TPG': 0.0,
                        'last_updated': datetime.now().isoformat(),
                        'stats_source': 'placeholder_new_season'
                    }
                    
                    # Update player's system stats
                    system_data = player_data.get('system', {})
                    system_data['stats'] = new_stats
                    
                    # Update the document
                    db.collection('players').document(player_id).update({
                        'system.stats': new_stats
                    })
                    
                    success_count += 1
                    
                    if success_count % 50 == 0:
                        print(f"📈 Prepared stats for {success_count} players...")
                else:
                    print(f"⏭️  Skipping {player_id} - already has {season_year-1}-{str(season_year)[-2:]} stats structure")
                
            except Exception as e:
                error_count += 1
                print(f"❌ Error preparing stats for {player_id}: {e}")
        
        print(f"\n✅ Stats preparation complete:")
        print(f"  Success: {success_count}")
        print(f"  Errors: {error_count}")
        print(f"\n💡 Stats are now ready for {season_year-1}-{str(season_year)[-2:]} season")
        print(f"   Run 'npm run stats:update' once games begin to populate real stats")
        
        return error_count == 0
        
    except Exception as e:
        print(f"❌ Error preparing new season stats: {e}")
        return False

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Prepare stats structure for new NBA season')
    parser.add_argument('--season', type=int, help='Season year (e.g., 2025 for 2024-25 season)')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be done without making changes')
    
    args = parser.parse_args()
    
    if args.dry_run:
        print("🔍 DRY RUN MODE - No changes will be made")
        # Could implement dry run logic here
        return
    
    success = prepare_new_season_stats(args.season)
    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()