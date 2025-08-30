#!/usr/bin/env python3
"""
Season Manager - CLI for creating, archiving, and listing NBA seasons
Works with real Firebase data and follows existing data patterns
"""

import sys
import json
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timezone
import os

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

def get_season_key(end_year):
    """Convert end year to season key format (2025 -> '2024-25')"""
    start_year = end_year - 1
    return f"{start_year}-{str(end_year)[-2:]}"

def get_current_season_year():
    """Get current season end year based on date"""
    now = datetime.now()
    year = now.year
    # NBA season flips July 1
    return year + 1 if now.month >= 7 else year

def create_season(db, year=None):
    """Create a new season with proper Firestore structure"""
    if year is None:
        year = get_current_season_year()
    
    season_key = get_season_key(year)
    season_ref = db.collection('seasons').document(str(year))
    
    # Check if season already exists
    if season_ref.get().exists:
        print(f"⚠️  Season {season_key} already exists")
        return
    
    # Create season document with metadata
    season_data = {
        'status': 'active',
        'display_name': season_key,
        'created_date': datetime.now(timezone.utc),
        'version': '1.0'
    }
    
    try:
        # Create season document
        season_ref.set(season_data)
        
        # Initialize subcollections with metadata documents
        season_ref.collection('metadata').document('info').set({
            'initialized_date': datetime.now(timezone.utc),
            'version': '1.0',
            'collections_created': ['playerGrades', 'teamData']
        })
        
        print(f"✅ Created season {season_key} (ending in {year})")
        
    except Exception as e:
        print(f"❌ Failed to create season: {e}")

def archive_season(db, year=None):
    """Archive a season by changing status to archived"""
    if year is None:
        year = get_current_season_year() - 1
    
    season_key = get_season_key(year)
    season_ref = db.collection('seasons').document(str(year))
    
    try:
        season_doc = season_ref.get()
        if not season_doc.exists:
            print(f"❌ Season {season_key} not found")
            return
        
        # Update status to archived
        season_ref.update({
            'status': 'archived',
            'archived_date': datetime.now(timezone.utc)
        })
        
        print(f"✅ Archived season {season_key}")
        
    except Exception as e:
        print(f"❌ Failed to archive season: {e}")

def list_seasons(db):
    """List all seasons with their status"""
    try:
        seasons = db.collection('seasons').order_by('display_name').get()
        
        if not seasons:
            print("📋 No seasons found")
            return
        
        print("\n📋 Seasons:")
        print("=" * 50)
        
        for season in seasons:
            data = season.to_dict()
            year = season.id
            display_name = data.get('display_name', year)
            status = data.get('status', 'unknown')
            created = data.get('created_date', 'unknown')
            
            # Format created date
            if isinstance(created, datetime):
                created_str = created.strftime('%Y-%m-%d')
            else:
                created_str = str(created)
            
            status_emoji = {
                'active': '🟢',
                'archived': '🟡', 
                'completed': '⚪'
            }.get(status, '❓')
            
            print(f"{status_emoji} {display_name} ({year}) - {status} - Created: {created_str}")
            
    except Exception as e:
        print(f"❌ Failed to list seasons: {e}")

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 season_manager.py <command> [year]")
        print("Commands:")
        print("  create [year]  - Create new season (defaults to current)")
        print("  archive [year] - Archive season (defaults to previous)")
        print("  list           - List all seasons")
        sys.exit(1)
    
    command = sys.argv[1]
    year = int(sys.argv[2]) if len(sys.argv) > 2 else None
    
    db = init_firebase()
    
    if command == 'create':
        create_season(db, year)
    elif command == 'archive':
        archive_season(db, year)
    elif command == 'list':
        list_seasons(db)
    else:
        print(f"❌ Unknown command: {command}")
        sys.exit(1)

if __name__ == "__main__":
    main()