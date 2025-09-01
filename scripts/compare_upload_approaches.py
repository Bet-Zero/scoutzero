#!/usr/bin/env python3
"""
Bio Upload Approach Comparison
Answers the question: Service key vs other options?
"""

import os
import json

def check_service_key_approach():
    """Analyze the service key approach"""
    print("🔑 SERVICE ACCOUNT KEY APPROACH")
    print("=" * 50)
    
    # Check if service key exists
    service_key_paths = [
        "./serviceAccountKey.json",
        "./scripts/serviceAccountKey.json", 
        "./src/serviceAccountKey.json",
        "../serviceAccountKey.json"
    ]
    
    key_found = None
    for path in service_key_paths:
        if os.path.exists(path):
            key_found = path
            break
    
    print("✅ ADVANTAGES:")
    print("   • Server-side admin access (full Firestore permissions)")
    print("   • Batch operations (faster for large datasets)")
    print("   • No security rule dependencies")
    print("   • Production-grade approach")
    
    print("\n❌ REQUIREMENTS:")
    print("   • serviceAccountKey.json file must be present")
    print("   • Python firebase-admin package: pip install firebase-admin")
    print("   • Proper key placement and permissions")
    
    print(f"\n📍 SERVICE KEY STATUS:")
    if key_found:
        print(f"   ✅ Found: {key_found}")
        try:
            with open(key_found, 'r') as f:
                data = json.load(f)
            if 'private_key' in data and 'project_id' in data:
                print(f"   ✅ Valid format - Project: {data.get('project_id', 'N/A')}")
                return True, key_found
            else:
                print(f"   ❌ Invalid format (not a service account key)")
                return False, None
        except Exception as e:
            print(f"   ❌ Error reading: {e}")
            return False, None
    else:
        print("   ❌ No service account key found")
        return False, None

def check_client_side_approach():
    """Analyze the client-side approach"""
    print("\n🌐 CLIENT-SIDE APPROACH")
    print("=" * 50)
    
    # Check if .env or environment variables exist
    env_vars = [
        'VITE_FIREBASE_API_KEY',
        'VITE_FIREBASE_AUTH_DOMAIN', 
        'VITE_FIREBASE_PROJECT_ID',
        'VITE_FIREBASE_STORAGE_BUCKET',
        'VITE_FIREBASE_MESSAGING_SENDER_ID',
        'VITE_FIREBASE_APP_ID'
    ]
    
    env_available = []
    env_missing = []
    
    for var in env_vars:
        if os.environ.get(var):
            env_available.append(var)
        else:
            env_missing.append(var)
    
    print("✅ ADVANTAGES:")
    print("   • Uses same credentials as React app")
    print("   • No service account key needed")
    print("   • Works with existing .env setup")
    print("   • Easier for developers to use")
    
    print("\n❌ LIMITATIONS:")
    print("   • May require Firestore security rule updates")
    print("   • Slower than server-side batch operations")
    print("   • Limited to client SDK permissions")
    
    print(f"\n📍 ENVIRONMENT VARIABLES STATUS:")
    print(f"   ✅ Available: {len(env_available)}/{len(env_vars)}")
    print(f"   ❌ Missing: {len(env_missing)}")
    
    if env_missing:
        print("   📋 Missing variables:")
        for var in env_missing:
            print(f"      • {var}")
    
    return len(env_missing) == 0

def provide_recommendations():
    """Provide specific recommendations based on current state"""
    print("\n💡 RECOMMENDATIONS")
    print("=" * 50)
    
    key_available, key_path = check_service_key_approach()
    env_available = check_client_side_approach()
    
    print(f"\n📊 CURRENT STATE:")
    print(f"   Service Key: {'✅ Available' if key_available else '❌ Missing'}")
    print(f"   Environment: {'✅ Ready' if env_available else '❌ Missing vars'}")
    
    print(f"\n🎯 BEST APPROACH FOR YOU:")
    
    if key_available:
        print("   🏆 USE SERVICE KEY APPROACH (RECOMMENDED)")
        print("      • You have the key and it's properly located")
        print("      • This is the fastest and most reliable method")
        print("      • Just ensure firebase-admin is installed:")
        print("        pip install firebase-admin")
        print(f"      • Run: python3 scripts/upload/push_bio_and_contract.py")
        print(f"      • Key location: {key_path}")
    elif env_available:
        print("   🥈 USE CLIENT-SIDE APPROACH")
        print("      • Your environment variables are ready")
        print("      • Good fallback when service key isn't available")
        print("      • Run: node scripts/create_client_side_uploader.js")
    else:
        print("   🔧 SETUP REQUIRED")
        print("      Choose one of these options:")
        print()
        print("      OPTION 1: Service Key (Recommended)")
        print("      1. Download serviceAccountKey.json from Firebase Console")
        print("      2. Place it in project root directory")
        print("      3. Run: python3 scripts/upload/push_bio_and_contract.py")
        print()
        print("      OPTION 2: Environment Variables")
        print("      1. Create .env file with VITE_FIREBASE_* variables")
        print("      2. Run: node scripts/create_client_side_uploader.js")

def troubleshoot_service_key():
    """Specific troubleshooting for service key issues"""
    print("\n🔧 SERVICE KEY TROUBLESHOOTING")
    print("=" * 50)
    
    print("If you have the key but it's not working:")
    print()
    print("1. ✅ CHECK LOCATION:")
    print("   Place serviceAccountKey.json in one of these locations:")
    print("   • Project root: ./serviceAccountKey.json (RECOMMENDED)")
    print("   • Scripts dir: ./scripts/serviceAccountKey.json")
    print("   • Src dir: ./src/serviceAccountKey.json")
    print()
    print("2. ✅ CHECK FILE FORMAT:")
    print("   • File should be valid JSON")
    print("   • Must contain 'private_key' and 'project_id' fields")
    print("   • Downloaded from Firebase Console > Project Settings > Service Accounts")
    print()
    print("3. ✅ CHECK PERMISSIONS:")
    print("   • File should be readable by Python script")
    print("   • Run: ls -la serviceAccountKey.json")
    print()
    print("4. ✅ CHECK DEPENDENCIES:")
    print("   • Run: pip install firebase-admin")
    print("   • Or: pip3 install firebase-admin")
    print()
    print("5. ✅ TEST SETUP:")
    print("   • Run: python3 scripts/upload_bio_solution.py --test")
    print("   • Should show 'Ready for real upload when Firebase credentials are available'")

if __name__ == "__main__":
    print("🩺 BIO UPLOAD APPROACH ANALYSIS")
    print("Answering: Service key vs other options?\n")
    
    provide_recommendations()
    troubleshoot_service_key()
    
    print("\n" + "=" * 70)
    print("📞 QUICK ANSWER:")
    print("Service key approach is better IF you have the key in the right location.")
    print("If the key isn't working, it's likely a location or format issue.")
    print("Run the diagnostic tools above to identify the specific problem.")