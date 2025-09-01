#!/usr/bin/env python3
"""
NBA Season Management Tool
Provides CLI interface for season operations: create, archive, list
"""

import sys
import os
import json
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timezone

def init_firebase():
    """Initialize Firebase connection with fallback credential loading"""
    if firebase_admin._apps:
        return firestore.client()
    
    # Try multiple credential locations
    credential_paths = [
        "./serviceAccountKey.json",
        "../serviceAccountKey.json", 
        os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    ]
    
    for path in credential_paths:
        if path and os.path.exists(path):
            try:
                cred = credentials.Certificate(path)
                firebase_admin.initialize_app(cred)
                print(f"✅ Firebase initialized with credentials: {path}")
                return firestore.client()
            except Exception as e:
                print(f"❌ Failed to initialize Firebase with {path}: {e}")
                continue
    
    # Fallback: try default credentials
    try:
        firebase_admin.initialize_app()
        print("✅ Firebase initialized with default credentials")
        return firestore.client()
    except Exception as e:
        print(f"❌ Firebase initialization failed: {e}")
        print("💡 Place serviceAccountKey.json in project root or set GOOGLE_APPLICATION_CREDENTIALS")
        return None

def list_seasons():
    """List all available seasons"""
    print("🗄️ NBA Seasons Available")
    print("=" * 50)
    
    db = init_firebase()
    if not db:
        print("❌ Cannot connect to Firebase")
        return False
    
    try:
        seasons_ref = db.collection('seasons')
        seasons = seasons_ref.stream()
        
        season_list = []
        for season in seasons:
            season_data = season.to_dict()
            season_list.append({
                'id': season.id,
                'year': season_data.get('year', 'Unknown'),
                'status': season_data.get('status', 'active'),
                'created': season_data.get('created_at', 'Unknown'),
                'player_count': season_data.get('player_count', 0)
            })
        
        if not season_list:
            print("📂 No seasons found in database")
            return True
        
        # Sort by year
        season_list.sort(key=lambda x: x['year'], reverse=True)
        
        print(f"{'Year':<10} {'Status':<10} {'Players':<10} {'Created':<20}")
        print("-" * 50)
        
        for season in season_list:
            print(f"{season['year']:<10} {season['status']:<10} {season['player_count']:<10} {season['created']:<20}")
        
        print(f"\n📊 Total seasons: {len(season_list)}")
        return True
        
    except Exception as e:
        print(f"❌ Error listing seasons: {e}")
        return False

def create_season(year=None):
    """Create a new NBA season"""
    if not year:
        year = datetime.now().year + 1  # Default to next year
    
    season_id = f"{year-1}-{str(year)[2:]}"  # e.g., "2024-25"
    
    print(f"🆕 Creating NBA Season: {season_id}")
    print("=" * 50)
    
    db = init_firebase()
    if not db:
        print("❌ Cannot connect to Firebase")
        return False
    
    try:
        season_ref = db.collection('seasons').document(season_id)
        
        # Check if season already exists
        if season_ref.get().exists:
            print(f"⚠️ Season {season_id} already exists")
            return True
        
        # Create season document
        season_data = {
            'year': year,
            'season_id': season_id,
            'status': 'active',
            'created_at': datetime.now(timezone.utc).isoformat(),
            'player_count': 0,
            'teams_count': 30,
            'description': f"NBA {season_id} Season"
        }
        
        season_ref.set(season_data)
        print(f"✅ Created season: {season_id}")
        print(f"📊 Status: {season_data['status']}")
        print(f"📅 Created: {season_data['created_at']}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error creating season {season_id}: {e}")
        return False

def archive_season(year=None):
    """Archive an existing NBA season"""
    if not year:
        year = datetime.now().year  # Default to current year
    
    season_id = f"{year-1}-{str(year)[2:]}"  # e.g., "2024-25"
    
    print(f"📦 Archiving NBA Season: {season_id}")
    print("=" * 50)
    
    db = init_firebase()
    if not db:
        print("❌ Cannot connect to Firebase")
        return False
    
    try:
        season_ref = db.collection('seasons').document(season_id)
        season_doc = season_ref.get()
        
        if not season_doc.exists:
            print(f"❌ Season {season_id} does not exist")
            return False
        
        # Update status to archived
        season_ref.update({
            'status': 'archived',
            'archived_at': datetime.now(timezone.utc).isoformat()
        })
        
        print(f"✅ Archived season: {season_id}")
        print(f"📅 Archived at: {datetime.now(timezone.utc).isoformat()}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error archiving season {season_id}: {e}")
        return False

def main():
    """Main CLI interface"""
    if len(sys.argv) < 2:
        print("Usage: python3 season_manager.py <command> [args]")
        print("Commands:")
        print("  list              - List all seasons")
        print("  create [year]     - Create new season (defaults to next year)")
        print("  archive [year]    - Archive season (defaults to current year)")
        sys.exit(1)
    
    command = sys.argv[1].lower()
    
    if command == 'list':
        success = list_seasons()
    elif command == 'create':
        year = int(sys.argv[2]) if len(sys.argv) > 2 else None
        success = create_season(year)
    elif command == 'archive':
        year = int(sys.argv[2]) if len(sys.argv) > 2 else None
        success = archive_season(year)
    else:
        print(f"❌ Unknown command: {command}")
        sys.exit(1)
    
    if not success:
        sys.exit(1)

if __name__ == "__main__":
    main()