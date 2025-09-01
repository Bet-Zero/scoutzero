#!/usr/bin/env python3
"""
Direct Bird Rights Fix - Merge contract data and upload to Firebase
This bypasses the broken merge script and fixes the Bird Rights issue directly
"""

import json
import os
import sys
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timezone

def init_firebase():
    """Initialize Firebase"""
    try:
        cred = credentials.Certificate('./serviceAccountKey.json')
        firebase_admin.initialize_app(cred)
        return firestore.client()
    except Exception as e:
        print(f"❌ Firebase init failed: {e}")
        sys.exit(1)

def main():
    print("🔧 DIRECT BIRD RIGHTS FIX")
    print("=" * 50)
    
    # Load base player data
    print("📁 Loading base player data...")
    with open('public/players.json', 'r') as f:
        base_players = json.load(f)
    print(f"✅ Loaded {len(base_players)} base players")
    
    # Load correctly parsed contracts with Bird Rights
    print("📄 Loading parsed contracts...")
    with open('data/contracts_parsed.json', 'r') as f:
        contracts = json.load(f)
    print(f"✅ Loaded {len(contracts)} contract records")
    
    # Create contract lookup by player_id
    contract_lookup = {}
    for contract in contracts:
        player_id = contract.get('player_id')
        if player_id:
            contract_lookup[player_id] = contract
    
    print(f"📋 Created contract lookup: {len(contract_lookup)} entries")
    
    # Test sample Bird Rights
    print("\n🔍 Sample Bird Rights from parsed contracts:")
    samples = ['jayson_tatum', 'stephen_curry', 'luka_doncic']
    for player_id in samples:
        if player_id in contract_lookup:
            bird_rights = contract_lookup[player_id].get('bird_rights')
            name = contract_lookup[player_id].get('name', player_id)
            print(f"   {name}: {bird_rights}")
    
    # Initialize Firebase
    print("\n🔥 Initializing Firebase...")
    db = init_firebase()
    
    # Merge and upload data
    print("\n📤 Merging and uploading to Firebase...")
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
            
            # Add Bird Rights and other contract fields
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
        
        # Show progress
        if updated_count % 50 == 0 or updated_count <= 5:
            name = player_data.get('Name', player_id)
            bird_rights = merged_data.get('bird_rights', 'None')
            print(f"   [{updated_count}/{len(base_players)}] {name}: {bird_rights}")
        
        # Commit batch every 450 operations
        if batch_count >= 450:
            batch.commit()
            batch = db.batch()
            batch_count = 0
            print(f"   📤 Committed batch ({updated_count} players processed)")
    
    # Commit final batch
    if batch_count > 0:
        batch.commit()
    
    print(f"\n✅ BIRD RIGHTS FIX COMPLETE!")
    print(f"   📤 Updated {updated_count} players")
    print(f"   🐦 Players with Bird Rights: {bird_rights_count}")
    print(f"   🔥 Successfully uploaded to Firebase")

if __name__ == "__main__":
    main()