#!/usr/bin/env python3
"""
Enhanced Bio Upload with Detailed Debugging
Provides comprehensive logging to identify exactly why uploads might be failing
"""

import json
import os
import sys
import time
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timezone

def init_firebase_with_verbose_logging():
    """Initialize Firebase with detailed logging"""
    print("🔍 FIREBASE INITIALIZATION")
    print("=" * 40)
    
    # Check environment variable first
    cred_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
    
    if cred_path and os.path.exists(cred_path):
        print(f"🔑 Using credentials from GOOGLE_APPLICATION_CREDENTIALS: {cred_path}")
    else:
        # Try multiple possible locations
        possible_paths = [
            './serviceAccountKey.json',          # Project root (when run from root)
            '../serviceAccountKey.json',         # Project root (when run from scripts/)
            '../../serviceAccountKey.json',      # Project root (when run from scripts/upload/)
            './src/serviceAccountKey.json',      # Src directory (when run from root)
            '../src/serviceAccountKey.json',     # Src directory (when run from scripts/)
            '../../src/serviceAccountKey.json',  # Src directory (when run from scripts/upload/)
        ]
        
        cred_path = None
        print("🔍 Searching for credentials...")
        for path in possible_paths:
            if os.path.exists(path):
                cred_path = path
                print(f"✅ Found credentials at: {path}")
                break
            else:
                print(f"❌ Not found: {path}")
        
        if not cred_path:
            print("❌ Firebase credentials not found in any expected location.")
            sys.exit(1)
    
    try:
        # Load and validate credentials
        print(f"📋 Loading credentials from: {cred_path}")
        with open(cred_path, 'r') as f:
            cred_data = json.load(f)
        
        project_id = cred_data.get('project_id')
        client_email = cred_data.get('client_email')
        print(f"📊 Project ID: {project_id}")
        print(f"📧 Service Account: {client_email}")
        
        # Initialize Firebase
        cred = credentials.Certificate(cred_path)
        
        # Clean up existing app if any
        try:
            app = firebase_admin.get_app()
            firebase_admin.delete_app(app)
            print("🔄 Cleaned up existing Firebase app")
        except ValueError:
            pass
        
        app = firebase_admin.initialize_app(cred)
        db = firestore.client()
        print("✅ Firebase initialized successfully")
        
        # Test basic connectivity
        print("🧪 Testing Firestore connectivity...")
        try:
            # Try to access the players collection
            players_ref = db.collection("players")
            test_query = players_ref.limit(1).get()
            print(f"✅ Successfully connected to Firestore")
            print(f"📊 Players collection accessible: {len(test_query)} documents found in test query")
        except Exception as e:
            print(f"❌ Firestore connectivity test failed: {e}")
            raise
        
        return db, project_id, client_email
        
    except Exception as e:
        print(f"❌ Failed to initialize Firebase: {e}")
        sys.exit(1)

def find_and_analyze_player_data():
    """Find player data and analyze its structure"""
    print("\n📁 PLAYER DATA ANALYSIS")
    print("=" * 40)
    
    possible_paths = [
        "public/players.json",
        "../public/players.json", 
        "../../public/players.json",
        "../data/players_merged.json",
        "../data/players.json",
        "data/players.json"
    ]
    
    data_file = None
    print("🔍 Searching for player data...")
    for path in possible_paths:
        if os.path.exists(path):
            data_file = path
            print(f"✅ Found player data: {path}")
            break
        else:
            print(f"❌ Not found: {path}")
    
    if not data_file:
        print("❌ No player data file found")
        sys.exit(1)
    
    # Load and analyze the data
    try:
        with open(data_file, "r") as f:
            players = json.load(f)
        
        print(f"📊 Total players in file: {len(players)}")
        
        # Analyze first few players
        sample_players = list(players.items())[:3]
        print("\n🔍 Analyzing player data structure...")
        
        for player_id, player_data in sample_players:
            player_name = player_data.get('Name', player_id.replace('_', ' ').title())
            print(f"\n👤 Player: {player_name} (ID: {player_id})")
            print(f"   📋 Total fields: {len(player_data)}")
            
            # Check for bio fields
            bio_fields = ["Name", "Team", "Position", "HT", "WT", "AGE", "Years Pro"]
            present_bio = [field for field in bio_fields if field in player_data and player_data[field]]
            missing_bio = [field for field in bio_fields if field not in player_data or not player_data[field]]
            
            print(f"   ✅ Bio fields present: {present_bio}")
            if missing_bio:
                print(f"   ❌ Bio fields missing: {missing_bio}")
            
            # Check for nested bio structure
            if "bio" in player_data:
                print(f"   🏗️  Has nested bio structure")
                bio_data = player_data["bio"]
                print(f"   📊 Nested bio fields: {list(bio_data.keys())}")
            else:
                print(f"   📋 Uses flat structure")
        
        return data_file, players
        
    except Exception as e:
        print(f"❌ Failed to load player data: {e}")
        sys.exit(1)

def test_single_player_upload(db, player_id, player_data, project_id):
    """Test uploading a single player with detailed logging"""
    print(f"\n🧪 TESTING SINGLE PLAYER UPLOAD")
    print(f"=" * 40)
    
    player_name = player_data.get('Name', player_id.replace('_', ' ').title())
    print(f"👤 Testing upload for: {player_name} (ID: {player_id})")
    
    try:
        # Check if player already exists
        doc_ref = db.collection("players").document(player_id)
        existing_doc = doc_ref.get()
        
        if existing_doc.exists:
            existing_data = existing_doc.to_dict()
            print(f"📋 Player already exists with {len(existing_data)} fields")
            
            # Show some existing fields
            if "bio" in existing_data:
                print(f"   🏗️  Has existing bio structure: {list(existing_data['bio'].keys())}")
            if "overall_grade" in existing_data:
                print(f"   🎯 Has existing grade: {existing_data['overall_grade']}")
        else:
            print(f"📋 Player does not exist yet - will be created")
        
        # Prepare the update data (same logic as main script)
        update_data = {
            k: v for k, v in player_data.items()
            if k not in ["system", "position", "source_url"]
        }
        
        # Create bio structure
        bio_fields = ["AGE", "HT", "WT", "Team", "Position", "Years Pro", "Contract", "Free Agent"]
        bio_data = {}
        for field in bio_fields:
            if field in player_data and player_data[field] and player_data[field] != "":
                bio_data[field] = player_data[field]
            else:
                bio_data[field] = ""
        
        bio_data["Name"] = player_data.get("Name", player_id.replace('_', ' ').title())
        update_data["bio"] = bio_data
        
        # Add metadata
        update_data["last_bio_update"] = datetime.now(timezone.utc)
        update_data["test_upload"] = True  # Mark as test
        
        print(f"📤 Prepared update data with {len(update_data)} fields")
        print(f"   🏗️  Bio structure: {list(bio_data.keys())}")
        print(f"   📊 Bio sample: Name={bio_data.get('Name')}, Team={bio_data.get('Team')}")
        
        # Perform the upload
        print(f"🚀 Performing upload...")
        start_time = time.time()
        
        doc_ref.set(update_data, merge=True)
        
        upload_time = time.time() - start_time
        print(f"✅ Upload completed in {upload_time:.2f} seconds")
        
        # Verify the upload
        print(f"🔍 Verifying upload...")
        time.sleep(1)  # Give Firestore a moment
        
        updated_doc = doc_ref.get()
        if updated_doc.exists:
            updated_data = updated_doc.to_dict()
            print(f"✅ Document verified - now has {len(updated_data)} fields")
            
            # Check specific fields
            if "bio" in updated_data:
                updated_bio = updated_data["bio"]
                print(f"✅ Bio structure verified: {list(updated_bio.keys())}")
                print(f"   📊 Bio sample: Name={updated_bio.get('Name')}, Team={updated_bio.get('Team')}")
            else:
                print(f"❌ Bio structure missing from uploaded document")
                return False
            
            if "last_bio_update" in updated_data:
                print(f"✅ Timestamp verified: {updated_data['last_bio_update']}")
            
            if "test_upload" in updated_data:
                print(f"✅ Test marker verified")
            
            # Check if grades were preserved
            if existing_doc.exists and "overall_grade" in existing_data:
                if "overall_grade" in updated_data:
                    print(f"✅ Existing grade preserved: {updated_data['overall_grade']}")
                else:
                    print(f"⚠️  Existing grade was lost during upload")
            
        else:
            print(f"❌ Document not found after upload - upload failed")
            return False
        
        print(f"🎉 Single player upload test SUCCESSFUL")
        return True
        
    except Exception as e:
        print(f"❌ Single player upload test FAILED: {e}")
        print(f"🔍 Error type: {type(e).__name__}")
        return False

def main():
    """Main function with comprehensive logging"""
    print("🔧 ENHANCED BIO UPLOAD DEBUGGER")
    print("Providing detailed logging to identify upload issues")
    print("=" * 60)
    
    # Initialize Firebase with logging
    db, project_id, client_email = init_firebase_with_verbose_logging()
    
    # Find and analyze player data
    data_file, players = find_and_analyze_player_data()
    
    # Test single player upload first
    test_player_id, test_player_data = list(players.items())[0]
    single_success = test_single_player_upload(db, test_player_id, test_player_data, project_id)
    
    if not single_success:
        print(f"\n❌ Single player test failed - stopping here")
        print(f"💡 Fix the single player upload issue before proceeding with bulk upload")
        sys.exit(1)
    
    print(f"\n✅ Single player test successful - ready for bulk upload")
    print(f"💡 Run the regular bio upload script now:")
    print(f"   python3 scripts/upload/push_bio_and_contract.py")
    
    # Clean up test document
    print(f"\n🧹 Cleaning up test document...")
    try:
        doc_ref = db.collection("players").document(test_player_id)
        doc_ref.update({"test_upload": firestore.DELETE_FIELD})
        print(f"✅ Removed test marker from {test_player_id}")
    except Exception as e:
        print(f"⚠️  Could not clean up test marker: {e}")

if __name__ == "__main__":
    main()