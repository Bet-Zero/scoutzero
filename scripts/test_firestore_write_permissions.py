#!/usr/bin/env python3
"""
Firestore Write Permission Tester
Tests actual write permissions and identifies why bio data uploads might be failing silently
"""

import json
import os
import sys
import time
from datetime import datetime, timezone

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
        return env_path
    
    # Check file paths
    for path in possible_paths:
        if os.path.exists(path):
            return path
    
    return None

def test_firestore_write_operations():
    """Test actual Firestore write operations"""
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
        
        print("🔍 Testing Firestore Write Permissions")
        print("=" * 50)
        
        # Find and load credentials
        key_path = find_service_key()
        if not key_path:
            print("❌ No service account key found")
            return False
        
        print(f"🔑 Using credentials: {key_path}")
        
        # Initialize Firebase
        try:
            app = firebase_admin.get_app()
            firebase_admin.delete_app(app)
        except ValueError:
            pass  # No app to clean up
        
        cred = credentials.Certificate(key_path)
        app = firebase_admin.initialize_app(cred)
        db = firestore.client()
        
        print("✅ Firebase initialized successfully")
        
        # Test 1: Read permission on players collection
        print("\n📖 Testing READ permissions...")
        try:
            players_ref = db.collection("players")
            docs = players_ref.limit(1).get()
            if docs:
                first_doc = docs[0]
                print(f"✅ Successfully read document: {first_doc.id}")
                print(f"📊 Document has {len(first_doc.to_dict())} fields")
            else:
                print("⚠️  'players' collection is empty or doesn't exist")
            
        except Exception as e:
            print(f"❌ READ permission failed: {e}")
            return False
        
        # Test 2: Write permission with a test document
        print("\n✍️  Testing WRITE permissions...")
        test_doc_id = f"test_write_{int(time.time())}"
        test_data = {
            "test": True,
            "timestamp": datetime.now(timezone.utc),
            "message": "Testing write permissions"
        }
        
        try:
            # Try to write a test document
            test_ref = db.collection("players").document(test_doc_id)
            test_ref.set(test_data)
            print(f"✅ Successfully WROTE test document: {test_doc_id}")
            
            # Verify the write by reading it back
            time.sleep(1)  # Give Firestore a moment
            written_doc = test_ref.get()
            if written_doc.exists:
                written_data = written_doc.to_dict()
                print(f"✅ Successfully READ BACK written document")
                print(f"📝 Test data verified: {written_data.get('message')}")
            else:
                print("❌ Write appeared successful but document not found on read-back")
                return False
            
            # Clean up test document
            test_ref.delete()
            print(f"🧹 Cleaned up test document")
            
        except Exception as e:
            print(f"❌ WRITE permission failed: {e}")
            print(f"🔍 Error type: {type(e).__name__}")
            
            # Provide specific guidance based on error type
            error_str = str(e).lower()
            if 'permission denied' in error_str or 'insufficient permission' in error_str:
                print("\n💡 PERMISSION ISSUE DETECTED:")
                print("   1. Service account lacks Firestore write permissions")
                print("   2. Go to Firebase Console → IAM & Admin → IAM")
                print("   3. Find your service account email")
                print("   4. Ensure it has 'Firebase Admin SDK Administrator Service Agent' role")
                print("   5. Or assign 'Firestore Database Admin' role")
            elif 'security rules' in error_str or 'rules' in error_str:
                print("\n💡 FIRESTORE RULES ISSUE:")
                print("   1. Firestore security rules are blocking writes")
                print("   2. Go to Firebase Console → Firestore → Rules")
                print("   3. Check if rules allow writes to 'players' collection")
                print("   4. For testing, you could temporarily use:")
                print("      rules_version = '2';")
                print("      service cloud.firestore {")
                print("        match /databases/{database}/documents {")
                print("          match /{document=**} {")
                print("            allow read, write: if true;")
                print("          }")
                print("        }")
                print("      }")
            else:
                print(f"\n💡 UNKNOWN WRITE ERROR:")
                print(f"   Full error: {e}")
            
            return False
        
        # Test 3: Batch operation (like the bio upload script uses)
        print("\n📦 Testing BATCH operations...")
        try:
            batch = db.batch()
            
            # Create multiple test documents in a batch
            test_batch_ids = [f"test_batch_{i}_{int(time.time())}" for i in range(3)]
            for i, doc_id in enumerate(test_batch_ids):
                doc_ref = db.collection("players").document(doc_id)
                test_data = {
                    "batch_test": True,
                    "batch_index": i,
                    "timestamp": datetime.now(timezone.utc)
                }
                batch.set(doc_ref, test_data)
            
            # Commit the batch
            batch.commit()
            print(f"✅ Successfully committed BATCH with {len(test_batch_ids)} documents")
            
            # Verify batch write
            time.sleep(1)
            verified_count = 0
            for doc_id in test_batch_ids:
                doc_ref = db.collection("players").document(doc_id)
                if doc_ref.get().exists:
                    verified_count += 1
            
            print(f"✅ Verified {verified_count}/{len(test_batch_ids)} batch documents")
            
            # Clean up batch test documents
            cleanup_batch = db.batch()
            for doc_id in test_batch_ids:
                doc_ref = db.collection("players").document(doc_id)
                cleanup_batch.delete(doc_ref)
            cleanup_batch.commit()
            print(f"🧹 Cleaned up batch test documents")
            
        except Exception as e:
            print(f"❌ BATCH operation failed: {e}")
            return False
        
        # Test 4: Merge operation (like bio upload uses)
        print("\n🔀 Testing MERGE operations...")
        try:
            merge_test_id = f"test_merge_{int(time.time())}"
            merge_ref = db.collection("players").document(merge_test_id)
            
            # First set some initial data
            initial_data = {"initial_field": "initial_value", "shared_field": "original"}
            merge_ref.set(initial_data)
            print("✅ Set initial document for merge test")
            
            # Then merge additional data
            merge_data = {"new_field": "new_value", "shared_field": "updated"}
            merge_ref.set(merge_data, merge=True)
            print("✅ Successfully performed MERGE operation")
            
            # Verify merge worked correctly
            time.sleep(1)
            final_doc = merge_ref.get()
            if final_doc.exists:
                final_data = final_doc.to_dict()
                has_initial = "initial_field" in final_data
                has_new = "new_field" in final_data
                shared_updated = final_data.get("shared_field") == "updated"
                
                if has_initial and has_new and shared_updated:
                    print("✅ MERGE operation worked correctly")
                    print(f"📊 Final document: {final_data}")
                else:
                    print("❌ MERGE operation didn't work as expected")
                    print(f"📊 Final document: {final_data}")
                    return False
            
            # Clean up
            merge_ref.delete()
            print("🧹 Cleaned up merge test document")
            
        except Exception as e:
            print(f"❌ MERGE operation failed: {e}")
            return False
        
        # Clean up Firebase app
        firebase_admin.delete_app(app)
        
        print(f"\n🎉 ALL TESTS PASSED!")
        print(f"✅ Your service account has full Firestore read/write permissions")
        print(f"✅ Batch operations work correctly")
        print(f"✅ Merge operations work correctly")
        print(f"\n🤔 If bio upload still fails, the issue might be:")
        print(f"   1. Bio data format/structure problems")
        print(f"   2. Silent errors in the upload script")
        print(f"   3. Incorrect player document IDs")
        print(f"   4. Missing source data files")
        
        return True
        
    except ImportError:
        print("❌ firebase-admin package not installed")
        print("💡 Run: pip install firebase-admin")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

def main():
    """Main function"""
    print("🧪 FIRESTORE WRITE PERMISSION TESTER")
    print("Testing if bio upload failures are due to permission issues")
    print("=" * 70)
    
    success = test_firestore_write_operations()
    
    print("\n" + "=" * 70)
    if success:
        print("🎯 CONCLUSION: Firestore permissions are working correctly")
        print("💡 Bio upload issues are likely due to other factors")
        print("\n📋 NEXT STEPS:")
        print("   1. Run bio upload with verbose logging")
        print("   2. Check source data format")
        print("   3. Verify player document structure")
    else:
        print("🎯 CONCLUSION: Firestore permission issues detected") 
        print("💡 Fix the permission issues above before trying bio upload")
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())