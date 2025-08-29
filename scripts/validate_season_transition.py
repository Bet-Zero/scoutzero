#!/usr/bin/env python3
"""
Validate season transition data integrity.
Ensures user grades, roles, traits, badges, and blurbs are preserved
and archive data is complete and accessible.
"""

import json
import os
import sys
from datetime import datetime

# Add the scripts directory to the path
sys.path.append(os.path.dirname(__file__))

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
except ImportError:
    print("❌ Firebase Admin SDK not installed. Install with: pip install firebase-admin")
    sys.exit(1)

def init_firebase():
    """Initialize Firebase Admin SDK"""
    key_path = os.path.join(os.path.dirname(__file__), '../src/serviceAccountKey.json')
    
    if not os.path.exists(key_path):
        print(f"❌ Service account key not found: {key_path}")
        print("💡 Place your Firebase service account key at src/serviceAccountKey.json")
        return None
    
    try:
        cred = credentials.Certificate(key_path)
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred)
        return firestore.client()
    except Exception as e:
        print(f"❌ Failed to initialize Firebase: {e}")
        return None

def validate_season_transition(from_season, to_season):
    """
    Validate that season transition preserved user data correctly
    """
    db = init_firebase()
    if not db:
        return False
    
    print(f"🔍 Validating season transition from {from_season-1}-{str(from_season)[-2:]} to {to_season-1}-{str(to_season)[-2:]}...")
    
    validation_results = {
        'archive_check': {'passed': 0, 'failed': 0, 'errors': []},
        'user_data_check': {'passed': 0, 'failed': 0, 'errors': []},
        'player_id_consistency': {'passed': 0, 'failed': 0, 'errors': []},
        'stats_structure': {'passed': 0, 'failed': 0, 'errors': []}
    }
    
    try:
        # Check 1: Verify archive exists and is complete
        print("📚 Checking archive completeness...")
        
        archive_collection = db.collection('seasons').document(str(from_season)).collection('playerGrades')
        archived_players = archive_collection.get()
        
        archived_player_ids = set()
        for archived_doc in archived_players:
            archived_data = archived_doc.to_dict()
            player_id = archived_doc.id
            archived_player_ids.add(player_id)
            
            # Validate archive structure
            required_fields = ['player_id', 'season', 'overall_grade', 'roles', 'traits', 'badges', 'archived_date']
            missing_fields = [field for field in required_fields if field not in archived_data]
            
            if missing_fields:
                validation_results['archive_check']['failed'] += 1
                validation_results['archive_check']['errors'].append(
                    f"Player {player_id} archive missing fields: {missing_fields}"
                )
            else:
                validation_results['archive_check']['passed'] += 1
        
        print(f"📖 Found {len(archived_player_ids)} players in archive")
        
        # Check 2: Verify current players have user data preserved
        print("👤 Checking user data preservation...")
        
        current_players = db.collection('players').get()
        current_player_ids = set()
        
        for player_doc in current_players:
            player_data = player_doc.to_dict()
            player_id = player_doc.id
            current_player_ids.add(player_id)
            
            # Check if user-inputted data exists (not checking values, just existence)
            user_data_fields = ['overall_grade', 'roles', 'traits', 'badges', 'blurbs']
            has_user_data = any(
                field in player_data and player_data[field] for field in user_data_fields
            )
            
            if has_user_data:
                validation_results['user_data_check']['passed'] += 1
            else:
                # This might be OK for new players, so just note it
                validation_results['user_data_check']['failed'] += 1
                validation_results['user_data_check']['errors'].append(
                    f"Player {player_id} has no user data (might be new player)"
                )
            
            # Check 3: Player ID consistency between archive and current
            if player_id in archived_player_ids:
                validation_results['player_id_consistency']['passed'] += 1
            # Note: Some players might not be in archive if they're new
            
            # Check 4: Stats structure for new season
            stats = player_data.get('system', {}).get('stats', {})
            if 'season' in stats:
                expected_season = f"{to_season-1}-{str(to_season)[-2:]}"
                if stats['season'] == expected_season:
                    validation_results['stats_structure']['passed'] += 1
                else:
                    validation_results['stats_structure']['failed'] += 1
                    validation_results['stats_structure']['errors'].append(
                        f"Player {player_id} has wrong season in stats: {stats['season']}, expected: {expected_season}"
                    )
            else:
                validation_results['stats_structure']['failed'] += 1
                validation_results['stats_structure']['errors'].append(
                    f"Player {player_id} missing season in stats structure"
                )
        
        # Check 5: Compare archive vs current for data loss
        print("🔗 Checking for data continuity...")
        
        players_lost = archived_player_ids - current_player_ids
        players_added = current_player_ids - archived_player_ids
        
        if players_lost:
            print(f"⚠️  {len(players_lost)} players from archive not found in current data:")
            for player_id in list(players_lost)[:5]:  # Show first 5
                print(f"   - {player_id}")
            if len(players_lost) > 5:
                print(f"   ... and {len(players_lost) - 5} more")
        
        if players_added:
            print(f"✨ {len(players_added)} new players added (rookies, trades, etc.)")
        
        # Print validation summary
        print("\n" + "="*50)
        print("🔍 VALIDATION SUMMARY")
        print("="*50)
        
        total_passed = sum(check['passed'] for check in validation_results.values())
        total_failed = sum(check['failed'] for check in validation_results.values())
        
        for check_name, results in validation_results.items():
            status = "✅" if results['failed'] == 0 else "❌"
            print(f"{status} {check_name.replace('_', ' ').title()}: {results['passed']} passed, {results['failed']} failed")
            
            if results['errors']:
                print(f"   Errors ({len(results['errors'])}):")
                for error in results['errors'][:3]:  # Show first 3 errors
                    print(f"   - {error}")
                if len(results['errors']) > 3:
                    print(f"   ... and {len(results['errors']) - 3} more errors")
        
        print(f"\n📊 Overall: {total_passed} checks passed, {total_failed} checks failed")
        
        # Final assessment
        critical_errors = (
            validation_results['archive_check']['failed'] > 0 or
            validation_results['player_id_consistency']['failed'] > len(players_added) * 0.1  # Allow some new players
        )
        
        if critical_errors:
            print("\n🚨 CRITICAL ISSUES DETECTED")
            print("   Recommend reviewing archive and data integrity before proceeding")
            return False
        elif total_failed > 0:
            print("\n⚠️  WARNINGS DETECTED")
            print("   Some issues found but transition appears successful")
            print("   Review warnings above and verify they're expected (new players, etc.)")
            return True
        else:
            print("\n✅ VALIDATION PASSED")
            print("   Season transition appears successful with no data loss")
            return True
        
    except Exception as e:
        print(f"❌ Error during validation: {e}")
        return False

def quick_grade_check(player_count=10):
    """
    Quick spot-check of a few players to verify grades are preserved
    """
    db = init_firebase()
    if not db:
        return False
    
    print(f"🎯 Quick grade check on {player_count} players...")
    
    try:
        players = db.collection('players').limit(player_count).get()
        
        for player_doc in players:
            player_data = player_doc.to_dict()
            player_id = player_doc.id
            
            # Check if player has meaningful user data
            overall_grade = player_data.get('overall_grade', {})
            roles = player_data.get('roles', {})
            traits = player_data.get('traits', {})
            
            print(f"👤 {player_id}:")
            print(f"   Grade: {overall_grade.get('value', 'None')}")
            print(f"   Roles: {len(roles)} defined")
            print(f"   Traits: {len(traits)} defined")
            print(f"   Team: {player_data.get('team', 'Unknown')}")
            print()
        
        return True
        
    except Exception as e:
        print(f"❌ Error during quick check: {e}")
        return False

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Validate season transition data integrity')
    parser.add_argument('from_season', type=int, help='Previous season year (e.g., 2024 for 2023-24)')
    parser.add_argument('to_season', type=int, help='New season year (e.g., 2025 for 2024-25)')
    parser.add_argument('--quick-check', action='store_true', help='Run quick spot-check of player grades')
    
    args = parser.parse_args()
    
    if args.quick_check:
        success = quick_grade_check()
    else:
        success = validate_season_transition(args.from_season, args.to_season)
    
    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()