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
    # Check environment variable first
    cred_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
    
    if cred_path and os.path.exists(cred_path):
        print(f"🔑 Using credentials from GOOGLE_APPLICATION_CREDENTIALS: {cred_path}")
    else:
        # Try multiple possible locations
        possible_paths = [
            './serviceAccountKey.json',           # Project root (run from repo root)
            '../serviceAccountKey.json',          # Project root (run from data_pipeline/)
            '../../serviceAccountKey.json',       # Project root (run from data_pipeline/helpers/)
            '../../../serviceAccountKey.json',    # Project root (run from helpers/upload/)
            './src/serviceAccountKey.json',       # Src directory (run from repo root)
            '../src/serviceAccountKey.json',      # Src directory (run from data_pipeline/)
            '../../src/serviceAccountKey.json',   # Src directory (run from data_pipeline/helpers/)
            '../../../src/serviceAccountKey.json' # Src directory (run from helpers/upload/)
        ]
        
        cred_path = None
        for path in possible_paths:
            if os.path.exists(path):
                cred_path = path
                print(f"🔑 Found credentials at: {path}")
                break
        
        if not cred_path:
            print("❌ Firebase credentials not found in any expected location.")
            print("💡 SOLUTION:")
            print("   1. Download serviceAccountKey.json from Firebase Console:")
            print("      - Go to Project Settings → Service Accounts") 
            print("      - Click 'Generate new private key'")
            print("      - Save as serviceAccountKey.json")
            print("   2. Place it in one of these locations:")
            for path in possible_paths[:3]:  # Show main locations
                abs_path = os.path.abspath(path)
                print(f"      - {abs_path}")
            print("   3. OR set GOOGLE_APPLICATION_CREDENTIALS environment variable")
            print("   4. Then re-run this script")
            print("\n🧪 To test upload logic without credentials:")
            print("   Run: python3 data_pipeline/upload_bio_solution.py --test")
            sys.exit(1)
    
    try:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
        return firestore.client()
    except Exception as e:
        print(f"❌ Failed to initialize Firebase: {e}")
        print("💡 Check that your serviceAccountKey.json is valid")
        sys.exit(1)

def find_player_data():
    """Find player data file in multiple possible locations"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    possible_paths = [
        os.path.join(script_dir, "..", "..", "resources", "data", "merged_players.json"),      # FIXED: Correct merged file name
        os.path.join(script_dir, "..", "..", "resources", "data", "players_merged.json"),      # Backup name
        os.path.join(script_dir, "..", "..", "resources", "data", "players.json"),
        os.path.join(script_dir, "..", "..", "..", "public", "players.json"),
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

def get_contract_id(player_data):
    """Generate a contract ID based on contract data"""
    # Use contract summary or free agency year as ID
    if 'contract_summary' in player_data:
        return f"current_{datetime.now().year}"
    elif 'Free Agent' in player_data:
        fa_year = player_data.get('Free Agent', '').split('(')[0].strip()
        return f"current_{fa_year}" if fa_year else "current"
    return "current"

def main():
    """Upload bio and contract data while preserving grades"""
    print("📤 Pushing Bio and Contract Data to Firebase with Subcollections")
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
    
    print(f"👥 Processing {len(players)} players for Firebase upload...")
    
    # Define contract fields that should go to subcollection
    CONTRACT_FIELDS = {
        'Contract', 'Free Agent', 'bird_rights', 'free_agent_type', 
        'free_agency_year', 'contract_summary', 'contract', 'contract_clean',
        'cap_hold', 'qualifying_offer', 'no_trade_clause', 'trade_kicker',
        'agent', 'status'
    }
    
    # Process players in batches
    batch = db.batch()
    batch_count = 0
    updated_count = 0
    contract_count = 0
    errors = []
    
    for player_id, full_data in players.items():
        try:
            # Show progress every 50 players
            if updated_count % 50 == 0 or updated_count < 5:
                player_name = full_data.get('Name', player_id.replace('_', ' ').title())
                print(f"  📤 [{updated_count + 1}/{len(players)}] Uploading: {player_name}")
            
            # Get existing grades to preserve them
            existing_grades = preserve_existing_grades(db, player_id)
            
            # Separate contract fields from bio fields
            bio_data = {}
            contract_data = {}
            
            for k, v in full_data.items():
                if k in CONTRACT_FIELDS:
                    contract_data[k] = v
                elif k not in ["system", "position", "source_url"]:
                    bio_data[k] = v
            
            # Ensure bio data is properly structured for rookies and newcomers
            bio_fields = ["AGE", "HT", "WT", "Team", "Position", "Years Pro"]
            bio_structure = {}
            for field in bio_fields:
                if field in full_data and full_data[field] and full_data[field] != "":
                    bio_structure[field] = full_data[field]
                else:
                    bio_structure[field] = ""  # Ensure field exists even if empty
            
            # Add player name to bio
            bio_structure["Name"] = full_data.get("Name", player_id.replace('_', ' ').title())
            
            # Create proper bio structure in root document
            bio_data["bio"] = bio_structure
            
            # Add preserved grades back
            bio_data.update(existing_grades)
            
            # Add metadata
            bio_data["last_bio_update"] = datetime.now(timezone.utc)
            
            # Write root document (bio data)
            doc_ref = db.collection("players").document(player_id)
            batch.set(doc_ref, bio_data, merge=True)
            batch_count += 1
            
            # Write contract subcollection if contract data exists
            if contract_data:
                contract_id = get_contract_id(contract_data)
                contract_ref = doc_ref.collection("contracts").document(contract_id)
                contract_data["updated_at"] = datetime.now(timezone.utc)
                batch.set(contract_ref, contract_data, merge=True)
                batch_count += 1
                contract_count += 1
            
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
    print(f"✅ Successfully updated {updated_count} players")
    print(f"   📄 Root documents (bio): {updated_count}")
    print(f"   📋 Contract subcollections: {contract_count}")
    if errors:
        print(f"❌ Errors encountered: {len(errors)}")
        for error in errors[:5]:  # Show first 5 errors
            print(f"  - {error}")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()
