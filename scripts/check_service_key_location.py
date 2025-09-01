#!/usr/bin/env python3
"""
Service Account Key Location Checker
Helps diagnose where the user should place their serviceAccountKey.json
"""

import os
import json
from pathlib import Path

def check_possible_locations():
    """Check all possible locations where the service key could be placed"""
    print("🔍 Checking possible serviceAccountKey.json locations...")
    print("=" * 60)
    
    # Current working directory
    cwd = os.getcwd()
    print(f"📍 Current directory: {cwd}")
    print()
    
    # Define all possible locations the scripts check
    locations = [
        # From environment variable
        ("Environment Variable", os.environ.get('GOOGLE_APPLICATION_CREDENTIALS', 'Not set')),
        
        # From upload scripts (all possible relative paths)
        ("Project Root (from root)", "./serviceAccountKey.json"),
        ("Project Root (from scripts/)", "../serviceAccountKey.json"), 
        ("Project Root (from scripts/upload/)", "../../serviceAccountKey.json"),
        ("Src Directory (from root)", "./src/serviceAccountKey.json"),
        ("Src Directory (from scripts/)", "../src/serviceAccountKey.json"),
        ("Src Directory (from scripts/upload/)", "../../src/serviceAccountKey.json"),
        
        # Additional common locations
        ("Scripts Directory", "./scripts/serviceAccountKey.json"),
        ("Home Directory", os.path.expanduser("~/serviceAccountKey.json")),
        ("Current Working Dir", os.path.join(cwd, "serviceAccountKey.json")),
    ]
    
    print("📋 Checking each location:")
    print("-" * 40)
    
    found_any = False
    for name, path in locations:
        exists = os.path.exists(path) if path != 'Not set' else False
        status = "✅ FOUND" if exists else "❌ Missing"
        abs_path = os.path.abspath(path) if path != 'Not set' else 'Not set'
        
        print(f"{name}:")
        print(f"  Path: {path}")
        print(f"  Absolute: {abs_path}")
        print(f"  Status: {status}")
        print()
        
        if exists:
            found_any = True
            # Try to validate it's a valid JSON
            try:
                with open(path, 'r') as f:
                    data = json.load(f)
                if 'private_key' in data and 'project_id' in data:
                    print(f"  ✅ Valid service account key format")
                    print(f"  📊 Project ID: {data.get('project_id', 'N/A')}")
                else:
                    print(f"  ⚠️  File exists but may not be a valid service account key")
            except Exception as e:
                print(f"  ❌ Error reading file: {e}")
            print()
    
    print("💡 RECOMMENDATIONS:")
    print("=" * 60)
    
    if found_any:
        print("✅ Service account key was found!")
        print("🔧 If upload still fails, check:")
        print("   1. File has correct permissions (readable)")
        print("   2. Python has firebase-admin installed: pip install firebase-admin")
        print("   3. Key has proper Firestore write permissions")
    else:
        print("❌ No service account key found")
        print("📋 TO FIX:")
        print("   1. Download serviceAccountKey.json from Firebase Console:")
        print("      - Go to Project Settings → Service Accounts")
        print("      - Click 'Generate new private key'")
        print("      - Save the downloaded file")
        print()
        print("   2. Place it in one of these locations:")
        print("      📍 RECOMMENDED: Project root")
        print(f"         {os.path.join(cwd, 'serviceAccountKey.json')}")
        print("      📍 Alternative: Set environment variable")
        print("         export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json")
        print()
        print("   3. Ensure it's NOT committed to git (should be in .gitignore)")
    
    print()
    print("🧪 TO TEST: python3 scripts/upload_bio_solution.py --test")
    print("🚀 TO UPLOAD: python3 scripts/upload/push_bio_and_contract.py")

if __name__ == "__main__":
    check_possible_locations()