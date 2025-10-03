#!/usr/bin/env python3
"""
Push Player Data to Firestore with Subcollections
Routes contract data to players/{id}/contracts/{contractId}
Routes season data to players/{id}/seasons/{seasonId}
Writes everything else to the root players/{id} doc
"""

import json
import os
import sys
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timezone

# Define field categories
CONTRACT_FIELDS = {
    'Contract', 'Free Agent', 'bird_rights', 'free_agent_type', 
    'free_agency_year', 'contract_summary', 'contract', 'contract_clean',
    'cap_hold', 'qualifying_offer', 'no_trade_clause', 'trade_kicker',
    'agent', 'status'
}

SEASON_STATS_FIELDS = {
    'MIN', 'PPG', 'RPG', 'APG', 'FG%', '3PT%', 'FT%', 'EFG%', 
    'Games Played', 'TS%', 'USG%', 'BPM', 'VORP', 'WS', 'PER',
    'stats_season', 'last_stats_update'
}

# Fields that belong in root document (bio, grades, identity)
ROOT_FIELDS = {
    'Name', 'HT', 'WT', 'AGE', 'Years Pro', 'Team', 'Position',
    'bio', 'traits', 'roles', 'blurbs', 'subRoles', 'badges',
    'overall_grade', 'shootingProfile', 'draft',
    'player_id', 'nba_player_id', 'name', 'display_name',
    'is_active_nba', 'discovery_source', 'last_updated', 'last_bio_update'
}

def init_firebase():
    """Initialize Firebase with real credentials"""
    cred_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
    
    if cred_path and os.path.exists(cred_path):
        print(f"🔑 Using credentials from GOOGLE_APPLICATION_CREDENTIALS: {cred_path}")
    else:
        possible_paths = [
            './serviceAccountKey.json',
            '../serviceAccountKey.json',
            '../../serviceAccountKey.json',
            '../../../serviceAccountKey.json',
        ]
        
        cred_path = None
        for path in possible_paths:
            if os.path.exists(path):
                cred_path = path
                print(f"🔑 Found credentials at: {path}")
                break
        
        if not cred_path:
            print("❌ Firebase credentials not found")
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
        os.path.join(script_dir, "..", "..", "resources", "data", "merged_players.json"),
        os.path.join(script_dir, "..", "..", "resources", "data", "players_merged.json"),
        os.path.join(script_dir, "..", "..", "resources", "data", "players.json"),
        os.path.join(script_dir, "..", "..", "..", "public", "players.json"),
        "players.json"
    ]
    
    for path in possible_paths:
        if os.path.exists(path):
            return path
    
    print("❌ No player data file found")
    return None

def categorize_fields(player_data):
    """Categorize fields into root, contract, and season data"""
    root_data = {}
    contract_data = {}
    season_data = {}
    
    for key, value in player_data.items():
        if key in CONTRACT_FIELDS:
            contract_data[key] = value
        elif key in SEASON_STATS_FIELDS:
            season_data[key] = value
        elif key in ROOT_FIELDS:
            root_data[key] = value
        else:
            # Default to root for unknown fields
            root_data[key] = value
    
    return root_data, contract_data, season_data

def get_current_season_id():
    """Get current season ID like '2024-25'"""
    now = datetime.now()
    # NBA season starts in October
    current_year = now.year if now.month >= 10 else now.year - 1
    next_year = current_year + 1
    return f"{current_year}-{str(next_year)[-2:]}"

def get_contract_id(player_data):
    """Generate a contract ID based on contract data"""
    # Use contract summary or free agency year as ID
    if 'contract_summary' in player_data:
        # Use a hash or timestamp for uniqueness
        return f"current_{datetime.now().year}"
    elif 'Free Agent' in player_data:
        fa_year = player_data.get('Free Agent', '').split('(')[0].strip()
        return f"current_{fa_year}" if fa_year else "current"
    return "current"

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
        grade_fields = ['overall_grade', 'roles', 'traits', 'badges', 'blurbs', 'subRoles', 'shootingProfile']
        for field in grade_fields:
            if field in data:
                grades[field] = data[field]
        
        return grades
        
    except Exception as e:
        print(f"⚠️  Could not retrieve existing grades for {player_id}: {e}")
        return {}

def main():
    """Upload data with proper subcollection routing"""
    print("📤 Pushing Player Data to Firestore with Subcollections")
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
    
    # Get season ID
    season_id = get_current_season_id()
    print(f"📅 Using season ID: {season_id}")
    
    # Process players
    batch = db.batch()
    batch_count = 0
    updated_count = 0
    contract_count = 0
    season_count = 0
    errors = []
    
    for player_id, full_data in players.items():
        try:
            if updated_count % 50 == 0 or updated_count < 5:
                player_name = full_data.get('Name', player_id.replace('_', ' ').title())
                print(f"  📤 [{updated_count + 1}/{len(players)}] Processing: {player_name}")
            
            # Preserve existing grades
            existing_grades = preserve_existing_grades(db, player_id)
            
            # Categorize fields
            root_data, contract_data, season_data = categorize_fields(full_data)
            
            # Add preserved grades to root
            root_data.update(existing_grades)
            
            # Add metadata
            root_data["last_updated"] = datetime.now(timezone.utc)
            
            # Write root document
            doc_ref = db.collection("players").document(player_id)
            batch.set(doc_ref, root_data, merge=True)
            batch_count += 1
            
            # Write contract subcollection if data exists
            if contract_data:
                contract_id = get_contract_id(contract_data)
                contract_ref = doc_ref.collection("contracts").document(contract_id)
                contract_data["updated_at"] = datetime.now(timezone.utc)
                batch.set(contract_ref, contract_data, merge=True)
                batch_count += 1
                contract_count += 1
            
            # Write season subcollection if data exists
            if season_data:
                season_ref = doc_ref.collection("seasons").document(season_id)
                season_data["updated_at"] = datetime.now(timezone.utc)
                batch.set(season_ref, season_data, merge=True)
                batch_count += 1
                season_count += 1
            
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
    print(f"\n{'='*60}")
    print(f"✅ Successfully processed {updated_count} players")
    print(f"   📄 Root documents updated: {updated_count}")
    print(f"   📋 Contract subcollections created: {contract_count}")
    print(f"   📊 Season subcollections created: {season_count}")
    if errors:
        print(f"❌ Errors encountered: {len(errors)}")
        for error in errors[:5]:
            print(f"  - {error}")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()
