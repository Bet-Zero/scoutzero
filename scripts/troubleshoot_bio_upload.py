#!/usr/bin/env python3
"""
Bio Upload Troubleshooter
Comprehensive troubleshooting for bio upload issues with actionable solutions
"""

import json
import os
import sys
from pathlib import Path

def check_issue_symptoms():
    """Identify specific symptoms of the upload issue"""
    print("🩺 DIAGNOSING BIO UPLOAD SYMPTOMS")
    print("=" * 50)
    
    symptoms = {
        "service_key_present": False,
        "service_key_locations": [],
        "firebase_admin_installed": False,
        "bio_data_exists": False,
        "bio_data_count": 0,
        "upload_script_exists": False
    }
    
    # Check 1: Service key presence
    print("1. 🔑 Checking service account key presence...")
    key_locations = [
        ("Root directory", "./serviceAccountKey.json"),
        ("Src directory", "./src/serviceAccountKey.json"),
        ("Scripts directory", "./scripts/serviceAccountKey.json"),
        ("Environment variable", os.environ.get('GOOGLE_APPLICATION_CREDENTIALS', '')),
    ]
    
    for name, path in key_locations:
        if path and os.path.exists(path):
            symptoms["service_key_present"] = True
            symptoms["service_key_locations"].append(name)
            print(f"   ✅ Found in: {name} ({path})")
        else:
            print(f"   ❌ Not found in: {name}")
    
    # Check 2: Dependencies
    print("\n2. 📦 Checking dependencies...")
    try:
        import firebase_admin
        symptoms["firebase_admin_installed"] = True
        print("   ✅ firebase-admin package installed")
    except ImportError:
        print("   ❌ firebase-admin package missing")
    
    # Check 3: Bio data
    print("\n3. 📊 Checking bio data availability...")
    if os.path.exists("public/players.json"):
        with open("public/players.json", 'r') as f:
            players = json.load(f)
        symptoms["bio_data_exists"] = True
        symptoms["bio_data_count"] = len(players)
        print(f"   ✅ Bio data exists: {symptoms['bio_data_count']} players")
    else:
        print("   ❌ public/players.json not found")
    
    # Check 4: Upload script
    print("\n4. 🚀 Checking upload script...")
    if os.path.exists("scripts/upload/push_bio_and_contract.py"):
        symptoms["upload_script_exists"] = True
        print("   ✅ Upload script exists")
    else:
        print("   ❌ Upload script missing")
    
    return symptoms

def diagnose_specific_issue(symptoms):
    """Provide specific diagnosis based on symptoms"""
    print("\n🔬 SPECIFIC DIAGNOSIS")
    print("=" * 30)
    
    # Common issue patterns
    if symptoms["service_key_present"] and not symptoms["firebase_admin_installed"]:
        return "DEPENDENCY_MISSING", "Service key exists but firebase-admin package is missing"
    
    elif symptoms["service_key_present"] and symptoms["firebase_admin_installed"]:
        return "KEY_PERMISSION_ISSUE", "Service key and dependencies exist - likely permission/format issue"
    
    elif not symptoms["service_key_present"]:
        return "KEY_NOT_FOUND", "Service account key not found in expected locations"
    
    elif not symptoms["bio_data_exists"]:
        return "DATA_MISSING", "Bio data source file is missing"
    
    elif not symptoms["upload_script_exists"]:
        return "SCRIPT_MISSING", "Upload script is missing"
    
    else:
        return "UNKNOWN", "All components appear present - need deeper investigation"

def provide_targeted_solution(issue_type, description):
    """Provide step-by-step solution for the specific issue"""
    print(f"🎯 ISSUE: {description}")
    print(f"📋 SOLUTION FOR: {issue_type}")
    print("-" * 50)
    
    if issue_type == "DEPENDENCY_MISSING":
        print("IMMEDIATE FIX:")
        print("1. Install firebase-admin:")
        print("   pip install firebase-admin")
        print("\n2. Test the fix:")
        print("   python3 scripts/test_service_key.py")
        print("\n3. If test passes, upload bio data:")
        print("   python3 scripts/upload/push_bio_and_contract.py")
    
    elif issue_type == "KEY_PERMISSION_ISSUE":
        print("DEBUGGING STEPS:")
        print("1. Test the service key:")
        print("   python3 scripts/test_service_key.py")
        print("\n2. If key test fails, check:")
        print("   - Key file is valid JSON format")
        print("   - Service account has Firestore Admin role in Firebase Console")
        print("   - Project ID in key matches your Firebase project")
        print("\n3. If key test passes but upload fails:")
        print("   - Check Firestore rules allow writes")
        print("   - Verify 'players' collection exists")
        print("   - Run upload in test mode first:")
        print("     python3 scripts/upload_bio_solution.py --test")
    
    elif issue_type == "KEY_NOT_FOUND":
        print("SETUP STEPS:")
        print("1. Download service account key:")
        print("   - Go to Firebase Console → Project Settings → Service Accounts")
        print("   - Click 'Generate new private key'")
        print("   - Save the JSON file")
        print("\n2. Place the key file:")
        print("   - Rename to 'serviceAccountKey.json'")
        print("   - Put in project root directory OR src/ directory")
        print("   - Ensure it's in .gitignore (don't commit it)")
        print("\n3. Verify placement:")
        print("   python3 scripts/check_service_key_location.py")
    
    elif issue_type == "DATA_MISSING":
        print("DATA PREPARATION:")
        print("1. Bio data file 'public/players.json' is missing")
        print("2. This file should contain player bio information")
        print("3. Run data preparation scripts if they exist")
        print("4. Or manually create the bio data file")
    
    elif issue_type == "SCRIPT_MISSING":
        print("SCRIPT RESTORATION:")
        print("1. Upload script is missing from scripts/upload/")
        print("2. Restore from repository or recreate")
        print("3. Ensure all required scripts are present")
    
    else:
        print("COMPREHENSIVE DEBUGGING:")
        print("1. Run full diagnostic:")
        print("   python3 scripts/diagnose_bio_upload.py")
        print("\n2. Test service key:")
        print("   python3 scripts/test_service_key.py")
        print("\n3. Test upload logic:")
        print("   python3 scripts/upload_bio_solution.py --test")
        print("\n4. Check detailed error logs when running upload")

def main():
    print("🔧 BIO UPLOAD TROUBLESHOOTER")
    print("Identifying and fixing bio upload issues")
    print("=" * 60)
    
    # Get current symptoms
    symptoms = check_issue_symptoms()
    
    # Diagnose the specific issue
    issue_type, description = diagnose_specific_issue(symptoms)
    
    # Provide targeted solution
    provide_targeted_solution(issue_type, description)
    
    print("\n" + "=" * 60)
    print("🧪 TESTING COMMANDS:")
    print("- Test service key: python3 scripts/test_service_key.py")
    print("- Check key location: python3 scripts/check_service_key_location.py") 
    print("- Full diagnostic: python3 scripts/diagnose_bio_upload.py")
    print("- Test upload logic: python3 scripts/upload_bio_solution.py --test")
    print("- Actual upload: python3 scripts/upload/push_bio_and_contract.py")

if __name__ == "__main__":
    main()