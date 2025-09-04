#!/usr/bin/env python3
"""
Enhanced Contracts Update Pipeline - Streamlined for 2025-26 Season
Uses fallback mechanisms when external data sources are unavailable
"""

import subprocess
import os
import sys
import json
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timezone

def run_script(script_path, description="", required=True):
    """Run a script with error handling"""
    print(f"\n🔹 {description}")
    print(f"   Running: {script_path}")
    
    try:
        result = subprocess.run(["python3", script_path], 
                              check=True, 
                              capture_output=True, 
                              text=True)
        
        if result.stdout:
            # Print last few lines of output for feedback
            lines = result.stdout.strip().split('\n')
            for line in lines[-3:]:
                if line.strip():
                    print(f"   {line}")
        
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Error in {script_path}:")
        if e.stdout:
            print(f"   stdout: {e.stdout}")
        if e.stderr:
            print(f"   stderr: {e.stderr}")
        
        if required:
            print(f"❌ Pipeline failed at {description}")
            sys.exit(1)
        else:
            print(f"⚠️ Optional step failed: {description}")
            return False

def check_prerequisites():
    """Check if required files exist"""
    print("🔍 Checking prerequisites...")
    
    base_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(base_dir)

    required_files = [
        (os.path.join(project_root, "public", "players.json"), "Base player data"),
    ]

    # Check for merged data but don't require it
    optional_files = [
        (os.path.join(base_dir, "resources", "data", "players_merged_with_discoveries.json"), "Merged player data")
    ]
    
    missing_files = []
    for file_path, description in required_files:
        if not os.path.exists(file_path):
            missing_files.append((file_path, description))
        else:
            print(f"   ✅ {description}: {file_path}")
    
    for file_path, description in optional_files:
        if os.path.exists(file_path):
            print(f"   ✅ {description}: {file_path}")
        else:
            print(f"   ⚠️ Optional file missing: {description}")
    
    if missing_files:
        print(f"❌ Missing required files:")
        for file_path, description in missing_files:
            print(f"   - {description}: {file_path}")
        return False
    
    return True

def direct_firebase_upload():
    """Direct merge and upload of contract data to Firebase"""
    print("🔧 Direct contract merge and Firebase upload...")
    
    try:
        # Check for Firebase credentials
        base_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(base_dir)
        if not os.path.exists(os.path.join(project_root, "serviceAccountKey.json")):
            print("   ⚠️ No Firebase credentials - skipping direct upload")
            return False

        # Load base player data
        print("   📁 Loading base player data...")
        with open(os.path.join(project_root, 'public', 'players.json'), 'r') as f:
            base_players = json.load(f)
        print(f"   ✅ Loaded {len(base_players)} base players")
        
        # Load correctly parsed contracts
        contracts_path = os.path.join(base_dir, 'resources', 'data', 'contracts_parsed.json')
        if not os.path.exists(contracts_path):
            print("   ❌ No parsed contracts found")
            return False
        print("   📄 Loading parsed contracts...")
        with open(contracts_path, 'r') as f:
            contracts = json.load(f)
        print(f"   ✅ Loaded {len(contracts)} contract records")
        
        # Create contract lookup
        contract_lookup = {}
        for contract in contracts:
            player_id = contract.get('player_id')
            if player_id:
                contract_lookup[player_id] = contract
        
        print(f"   📋 Created contract lookup: {len(contract_lookup)} entries")
        
        # Initialize Firebase
        print("   🔥 Initializing Firebase...")
        cred = credentials.Certificate('./serviceAccountKey.json')
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        
        # Merge and upload
        print("   📤 Merging and uploading to Firebase...")
        batch = db.batch()
        batch_count = 0
        updated_count = 0
        bird_rights_count = 0
        
        for player_id, player_data in base_players.items():
            # Start with base player data
            merged_data = dict(player_data)
            
            # Add contract data if available
            if player_id in contract_lookup:
                contract_data = contract_lookup[player_id]
                
                # Add Bird Rights and contract fields
                merged_data['bird_rights'] = contract_data.get('bird_rights')
                merged_data['free_agent_type'] = contract_data.get('free_agent_type')
                merged_data['free_agency_year'] = contract_data.get('free_agency_year')
                merged_data['contract_summary'] = contract_data.get('contract_summary')
                merged_data['contract'] = contract_data.get('contract')
                
                if contract_data.get('bird_rights'):
                    bird_rights_count += 1
            
            # Add metadata
            merged_data['last_bio_update'] = datetime.now(timezone.utc)
            
            # Add to batch
            doc_ref = db.collection("players").document(player_id)
            batch.set(doc_ref, merged_data, merge=True)
            
            batch_count += 1
            updated_count += 1
            
            # Show progress for first few and every 100 players
            if updated_count <= 5 or updated_count % 100 == 0:
                name = player_data.get('Name', player_id)
                bird_rights = merged_data.get('bird_rights', 'None')
                print(f"      [{updated_count}/{len(base_players)}] {name}: {bird_rights}")
            
            # Commit batch every 450 operations
            if batch_count >= 450:
                batch.commit()
                batch = db.batch()
                batch_count = 0
                print(f"      📤 Committed batch ({updated_count} players processed)")
        
        # Commit final batch
        if batch_count > 0:
            batch.commit()
        
        print(f"   ✅ Direct upload complete!")
        print(f"      📤 Updated {updated_count} players")
        print(f"      🐦 Players with Bird Rights: {bird_rights_count}")
        return True
        
    except Exception as e:
        print(f"   ❌ Direct upload failed: {e}")
        return False

def main():
    """Main pipeline execution"""
    print("🏀 Enhanced Contracts Update Pipeline")
    print("=" * 50)
    print("Streamlined for 2025-26 season with direct Bird Rights integration")
    
    # Check prerequisites
    if not check_prerequisites():
        sys.exit(1)
    
    # Get script directory
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Pipeline steps
    steps = [
        {
            "script": os.path.join(base_dir, "helpers", "contracts", "scrape_all_contracts.py"),  # FIXED: Remove "fallback" from name
            "description": "Step 1: Contract data collection (with smart URL detection)",
            "required": True
        },
        {
            "script": os.path.join(base_dir, "helpers", "contracts", "parse_contract_data_enhanced.py"),
            "description": "Step 2: Parse contract data",
            "required": True
        }
    ]
    
    # Execute pipeline steps
    completed_steps = 0
    for step in steps:
        success = run_script(step["script"], step["description"], step["required"])
        if success:
            completed_steps += 1
    
    # NEW: Direct contract merge and Firebase upload
    print(f"\n🔹 Step 3: Direct contract merge and Firebase upload")
    if os.path.exists("serviceAccountKey.json"):
        upload_success = direct_firebase_upload()
        if upload_success:
            completed_steps += 1
            print("   ✅ Bird Rights successfully uploaded to Firebase!")
        else:
            print("   ❌ Direct upload failed - trying legacy method...")
            # Fallback to old merge + upload
            merge_script = os.path.join(base_dir, "helpers", "merge", "merge_universal_player_data.py")
            upload_script = os.path.join(base_dir, "helpers", "upload", "push_bio_and_contract.py")
            
            print("   🔄 Running legacy merge...")
            run_script(merge_script, "Legacy merge step", required=False)
            
            print("   📤 Running legacy upload...")
            run_script(upload_script, "Legacy upload step", required=False)
    else:
        print("   ⚠️ No Firebase credentials - skipping upload")
        print("   💡 Place serviceAccountKey.json in project root to enable uploads")
    
    # Try cap sheets generation
    print(f"\n🔹 Step 4: Generate cap sheets (optional)")
    capsheets_script = os.path.join(base_dir, "helpers", "capsheets", "generateCapSheets.js")
    
    if os.path.exists(capsheets_script):
        try:
            print(f"   Running: {capsheets_script}")
            result = subprocess.run(["node", capsheets_script], 
                                  check=True, 
                                  capture_output=True, 
                                  text=True)
            print("   ✅ Cap sheets generated")
        except subprocess.CalledProcessError as e:
            print(f"   ⚠️ Cap sheets generation failed: {e}")
        except FileNotFoundError:
            print("   ⚠️ Node.js not available for cap sheets")
    else:
        print(f"   ⚠️ Cap sheets script not found: {capsheets_script}")
    
    # Summary
    print(f"\n🏁 Contracts Update Pipeline Complete")
    print("=" * 50)
    print(f"   ✅ Completed core steps: {completed_steps}/3")
    
    if completed_steps >= 3:
        print(f"   🎉 All steps successful - Bird Rights integrated!")
        print(f"   🐦 Check Firebase for proper Bird Rights classifications")
    else:
        print(f"   ⚠️ Some steps failed - check logs above")
    
    print(f"\n📊 Output files:")
    base_dir = os.path.dirname(os.path.abspath(__file__))
    output_files = [
        (os.path.join(base_dir, "resources", "data", "raw_contract_html.json"), "Raw contract data"),
        (os.path.join(base_dir, "resources", "data", "contracts_parsed.json"), "Parsed contract data")
    ]

    for file_path, description in output_files:
        if os.path.exists(file_path):
            print(f"   ✅ {description}: {file_path}")
        else:
            print(f"   ❌ {description}: {file_path} (not created)")

if __name__ == "__main__":
    main()