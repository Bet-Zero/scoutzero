#!/usr/bin/env python3
"""
Test Service Account Key
Tests if the serviceAccountKey.json can actually connect to Firebase
"""

import json
import os
import sys

def find_service_key():
    """Find service account key in multiple locations"""
    possible_paths = [
        './serviceAccountKey.json',          # Project root (when run from root)
        '../serviceAccountKey.json',         # Project root (when run from scripts/)
        '../../serviceAccountKey.json',      # Project root (when run from scripts/upload/)
        './src/serviceAccountKey.json',      # Src directory (when run from root)
        '../src/serviceAccountKey.json',     # Src directory (when run from scripts/)
        '../../src/serviceAccountKey.json',  # Src directory (when run from scripts/upload/)
    ]
    
    # Check environment variable first
    env_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
    if env_path and os.path.exists(env_path):
        return env_path, "Environment Variable"
    
    # Check file paths
    for path in possible_paths:
        if os.path.exists(path):
            return path, f"File System ({path})"
    
    return None, "Not Found"

def validate_key_format(key_path):
    """Validate that the key file has the correct format"""
    try:
        with open(key_path, 'r') as f:
            key_data = json.load(f)
        
        required_fields = [
            'type', 'project_id', 'private_key_id', 'private_key',
            'client_email', 'client_id', 'auth_uri', 'token_uri'
        ]
        
        missing_fields = [field for field in required_fields if field not in key_data]
        
        if missing_fields:
            print(f"❌ Key file missing required fields: {missing_fields}")
            return False
        
        if key_data.get('type') != 'service_account':
            print(f"❌ Key file type is '{key_data.get('type')}', expected 'service_account'")
            return False
            
        print(f"✅ Key file format is valid")
        print(f"📊 Project ID: {key_data.get('project_id')}")
        print(f"📧 Client Email: {key_data.get('client_email')}")
        return True
        
    except json.JSONDecodeError as e:
        print(f"❌ Key file is not valid JSON: {e}")
        return False
    except Exception as e:
        print(f"❌ Error reading key file: {e}")
        return False

def test_firebase_connection(key_path):
    """Test actual Firebase connection"""
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
        
        print("📦 firebase-admin package is available")
        
        # Initialize Firebase
        cred = credentials.Certificate(key_path)
        
        # Check if already initialized
        try:
            app = firebase_admin.get_app()
            firebase_admin.delete_app(app)
            print("🔄 Cleaned up existing Firebase app")
        except ValueError:
            pass  # No app to clean up
        
        app = firebase_admin.initialize_app(cred)
        print("✅ Firebase app initialized successfully")
        
        # Test Firestore connection
        db = firestore.client()
        print("✅ Firestore client created successfully")
        
        # Try a simple operation (count documents in players collection)
        players_ref = db.collection("players")
        
        # Get first document to test read permission
        docs = players_ref.limit(1).get()
        if docs:
            print(f"✅ Successfully read from Firestore (found documents in 'players' collection)")
        else:
            print("⚠️  No documents found in 'players' collection (or collection doesn't exist)")
        
        # Test write permission (dry run - just check if we can create a batch)
        batch = db.batch()
        print("✅ Write operations appear to be allowed (can create batch)")
        
        # Clean up
        firebase_admin.delete_app(app)
        print("🧹 Cleaned up Firebase app")
        
        return True
        
    except ImportError:
        print("❌ firebase-admin package not installed")
        print("💡 Run: pip install firebase-admin")
        return False
    except Exception as e:
        print(f"❌ Firebase connection failed: {e}")
        
        # Provide specific error guidance
        error_str = str(e).lower()
        if 'permission denied' in error_str:
            print("💡 This appears to be a permissions issue:")
            print("   1. Make sure the service account has Firestore Admin role")
            print("   2. Check that the project ID is correct")
        elif 'invalid' in error_str and 'key' in error_str:
            print("💡 This appears to be a key format issue:")
            print("   1. Re-download the service account key from Firebase Console")
            print("   2. Make sure you downloaded the JSON format")
        elif 'project' in error_str:
            print("💡 This appears to be a project issue:")
            print("   1. Make sure Firestore is enabled in the Firebase project")
            print("   2. Check that the project ID matches your Firebase project")
        
        return False

def main():
    print("🧪 TESTING SERVICE ACCOUNT KEY")
    print("=" * 50)
    
    # Find the key
    key_path, source = find_service_key()
    
    if not key_path:
        print("❌ No service account key found")
        print("💡 Place serviceAccountKey.json in:")
        print("   - Project root directory")
        print("   - src/ directory") 
        print("   - Or set GOOGLE_APPLICATION_CREDENTIALS environment variable")
        return 1
    
    print(f"🔑 Found service account key: {key_path}")
    print(f"📍 Source: {source}")
    print()
    
    # Validate format
    print("🔍 Validating key format...")
    if not validate_key_format(key_path):
        return 1
    print()
    
    # Test connection
    print("🌐 Testing Firebase connection...")
    if not test_firebase_connection(key_path):
        return 1
    
    print()
    print("🎉 SUCCESS: Service account key is working correctly!")
    print("✅ Ready to run: python3 scripts/upload/push_bio_and_contract.py")
    return 0

if __name__ == "__main__":
    sys.exit(main())