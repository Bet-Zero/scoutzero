#!/usr/bin/env python3
"""
Bio Data Upload Diagnostic Script
Diagnoses why bio data isn't reaching Firestore
"""

import json
import os
import sys
from pathlib import Path

def check_local_bio_data():
    """Check if bio data exists locally"""
    print("🔍 Checking local bio data...")
    
    # Check public/players.json
    players_file = "public/players.json"
    if os.path.exists(players_file):
        print(f"✅ Found {players_file}")
        
        with open(players_file, 'r') as f:
            players = json.load(f)
        
        print(f"📊 Total players: {len(players)}")
        
        # Check a few players for bio data
        sample_players = list(players.items())[:5]
        bio_fields = ["Name", "Team", "Position", "HT", "WT", "AGE", "Years Pro"]
        
        players_with_bio = 0
        for player_id, data in sample_players:
            has_bio = all(field in data and data[field] for field in bio_fields[:4])  # Check required fields
            if has_bio:
                players_with_bio += 1
                print(f"✅ {data.get('Name', player_id)}: {data.get('Team', 'N/A')} - {data.get('Position', 'N/A')}")
            else:
                missing = [field for field in bio_fields if field not in data or not data[field]]
                print(f"❌ {data.get('Name', player_id)}: Missing {missing}")
        
        print(f"📈 Sample: {players_with_bio}/{len(sample_players)} players have bio data")
        
        # Check if bio data is nested or flat
        first_player = list(players.values())[0]
        has_nested_bio = "bio" in first_player
        print(f"🏗️  Bio structure: {'Nested under bio field' if has_nested_bio else 'Flat structure'}")
        
        return True, len(players), has_nested_bio
    else:
        print(f"❌ {players_file} not found")
        return False, 0, False

def check_bio_files():
    """Check for specialized bio files"""
    print("\n🔍 Checking for specialized bio files...")
    
    bio_files = [
        "data/players_bios_2025.json",
        "data/players_merged.json",
        "data/players_merged_with_discoveries.json"
    ]
    
    found_files = []
    for bio_file in bio_files:
        if os.path.exists(bio_file):
            print(f"✅ Found {bio_file}")
            found_files.append(bio_file)
            
            try:
                with open(bio_file, 'r') as f:
                    data = json.load(f)
                print(f"📊 Contains {len(data)} entries")
            except Exception as e:
                print(f"⚠️  Error reading {bio_file}: {e}")
        else:
            print(f"❌ {bio_file} not found")
    
    return found_files

def check_firebase_credentials():
    """Check Firebase credentials"""
    print("\n🔍 Checking Firebase credentials...")
    
    # Check for service account key
    service_key_paths = [
        "serviceAccountKey.json",                  # Root
        "scripts/serviceAccountKey.json",          # Scripts
        "src/serviceAccountKey.json",              # Src  
        "../serviceAccountKey.json",               # Parent (from scripts/)
        "../../serviceAccountKey.json",            # Root (from scripts/upload/)
        "../src/serviceAccountKey.json",           # Src (from scripts/)
        "../../src/serviceAccountKey.json"         # Src (from scripts/upload/)
    ]
    
    found_creds = False
    for path in service_key_paths:
        if os.path.exists(path):
            print(f"✅ Found credentials: {path}")
            found_creds = True
            break
    
    if not found_creds:
        print("❌ No serviceAccountKey.json found")
        print("💡 This is why bio data isn't uploading to Firestore")
    
    # Check environment variable
    gac = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
    if gac:
        print(f"✅ GOOGLE_APPLICATION_CREDENTIALS: {gac}")
        if os.path.exists(gac):
            print("✅ Credentials file exists")
            found_creds = True
        else:
            print("❌ Credentials file path doesn't exist")
    else:
        print("❌ GOOGLE_APPLICATION_CREDENTIALS not set")
    
    return found_creds

def check_upload_script():
    """Check upload script availability"""
    print("\n🔍 Checking upload script...")
    
    upload_script = "scripts/upload/push_bio_and_contract.py"
    if os.path.exists(upload_script):
        print(f"✅ Found {upload_script}")
        
        # Try to import firebase_admin to see if dependencies are installed
        try:
            import firebase_admin
            print("✅ firebase-admin package is installed")
            return True
        except ImportError:
            print("❌ firebase-admin package not installed")
            print("💡 Run: pip install firebase-admin")
            return False
    else:
        print(f"❌ {upload_script} not found")
        return False

def generate_solution():
    """Generate solution recommendations"""
    print("\n💡 SOLUTION RECOMMENDATIONS:")
    print("=" * 50)
    
    # Check current state
    has_local_data, player_count, has_nested = check_local_bio_data()
    bio_files = check_bio_files()
    has_creds = check_firebase_credentials()
    has_upload_script = check_upload_script()
    
    if has_local_data and player_count > 0:
        print("✅ GOOD: Bio data exists locally in players.json")
        print(f"📊 Found bio data for {player_count} players")
        
        if not has_creds:
            print("\n🔑 PRIMARY ISSUE: Missing Firebase credentials")
            print("   To fix:")
            print("   1. Obtain serviceAccountKey.json from Firebase Console")
            print("   2. Place it in project root directory")
            print("   3. Or set GOOGLE_APPLICATION_CREDENTIALS environment variable")
            print("   4. Then run: python3 scripts/upload/push_bio_and_contract.py")
        
        if not has_upload_script:
            print("\n📦 DEPENDENCY ISSUE: Missing firebase-admin package")
            print("   To fix: pip install firebase-admin")
        
        if has_creds and has_upload_script:
            print("\n🚀 READY TO UPLOAD: All requirements met!")
            print("   Run: python3 scripts/upload/push_bio_and_contract.py")
    
    else:
        print("❌ PROBLEM: No bio data found locally")
        if not bio_files:
            print("   Bio data needs to be fetched first")
            print("   Run the bio fetching pipeline")

def main():
    print("🩺 BIO DATA UPLOAD DIAGNOSTIC")
    print("=" * 40)
    print("Checking why bio data isn't reaching Firestore...")
    
    generate_solution()
    
    print(f"\n📍 Current directory: {os.getcwd()}")
    print("🔚 Diagnostic complete")

if __name__ == "__main__":
    main()