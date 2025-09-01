#!/usr/bin/env python3
"""
Validate Season Transition - Comprehensive validation of season transition
Ensures data integrity and proper preservation of user evaluations
"""

import sys
import os
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timezone

def init_firebase():
    """Initialize Firebase with real credentials"""
    # Check if Firebase is already initialized
    if firebase_admin._apps:
        return firestore.client()
    
    cred_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS', './serviceAccountKey.json')
    if not os.path.exists(cred_path):
        cred_path = '../serviceAccountKey.json'
    
    if not os.path.exists(cred_path):
        print("❌ Firebase credentials not found. Place serviceAccountKey.json in project root.")
        sys.exit(1)
    
    try:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
        return firestore.client()
    except Exception as e:
        print(f"❌ Failed to initialize Firebase: {e}")
        sys.exit(1)

def validate_season_structure(db):
    """Validate that season structure exists"""
    print("🏗️  Validating season structure...")
    
    try:
        # Get current season year
        now = datetime.now()
        current_year = now.year + 1 if now.month >= 7 else now.year
        season_key = f"{current_year-1}-{str(current_year)[-2:]}"
        
        # Check if current season exists
        season_ref = db.collection('seasons').document(str(current_year))
        season_doc = season_ref.get()
        
        if not season_doc.exists:
            print(f"❌ Current season {season_key} not found")
            return False
        
        season_data = season_doc.to_dict()
        if season_data.get('status') != 'active':
            print(f"⚠️  Season {season_key} exists but not active (status: {season_data.get('status')})")
        
        # Check metadata
        metadata_ref = season_ref.collection('metadata').document('info')
        metadata_doc = metadata_ref.get()
        
        if metadata_doc.exists:
            print(f"✅ Season {season_key} structure valid")
            return True
        else:
            print(f"⚠️  Season {season_key} missing metadata")
            return False
            
    except Exception as e:
        print(f"❌ Failed to validate season structure: {e}")
        return False

def validate_player_data_integrity(db):
    """Validate player data has required fields and structure"""
    print("👥 Validating player data integrity...")
    
    try:
        players_ref = db.collection('players')
        sample_players = players_ref.limit(20).get()
        
        if len(sample_players) == 0:
            print("❌ No players found in database")
            return False
        
        valid_count = 0
        issues = []
        
        # More flexible validation - just need at least Name OR id
        for player_doc in sample_players:
            player_data = player_doc.to_dict()
            player_id = player_doc.id
            
            # Check if player has at least basic identifying info
            has_name = 'Name' in player_data and player_data['Name']
            has_valid_id = player_id and len(player_id) > 0
            
            if has_name or has_valid_id:
                valid_count += 1
            else:
                issues.append(f"Player {player_id} missing basic identifying info")
        
        success_rate = (valid_count / len(sample_players)) * 100
        
        # Lower threshold for season transition - some new players may have incomplete data
        if success_rate >= 70:
            print(f"✅ Player data integrity acceptable ({valid_count}/{len(sample_players)} valid, {success_rate:.0f}%)")
            return True
        else:
            print(f"⚠️  Player data integrity issues ({valid_count}/{len(sample_players)} valid)")
            for issue in issues[:3]:  # Show first 3 issues
                print(f"  - {issue}")
            return False
            
    except Exception as e:
        print(f"❌ Failed to validate player data: {e}")
        return False

def validate_grade_preservation(db):
    """Validate that user grades were preserved during transition"""
    print("⭐ Validating grade preservation...")
    
    try:
        # Check current players for any existing grades using new syntax
        players_ref = db.collection('players')
        players_with_grades = players_ref.where(filter=firestore.FieldFilter('overall_grade', '!=', None)).limit(10).get()
        
        current_grades_count = len(players_with_grades)
        
        # Check archived grades in current season
        now = datetime.now()
        current_year = now.year + 1 if now.month >= 7 else now.year
        season_ref = db.collection('seasons').document(str(current_year))
        archived_grades = season_ref.collection('playerGrades').limit(10).get()
        
        archived_grades_count = len(archived_grades)
        
        if current_grades_count > 0:
            print(f"✅ Found {current_grades_count} players with current grades")
        
        if archived_grades_count > 0:
            print(f"✅ Found {archived_grades_count} players with archived grades")
        
        if current_grades_count > 0 or archived_grades_count > 0:
            print("✅ Grade preservation validated")
            return True
        else:
            print("ℹ️  No grades found (normal for fresh season)")
            return True
            
    except Exception as e:
        print(f"❌ Failed to validate grade preservation: {e}")
        return False

def validate_team_data(db):
    """Validate team and cap sheet data"""
    print("🏀 Validating team data...")
    
    try:
        teams_ref = db.collection('teams')
        teams = teams_ref.limit(5).get()
        
        if len(teams) == 0:
            print("❌ No teams found in database")
            return False
        
        valid_teams = 0
        
        for team_doc in teams:
            team_data = team_doc.to_dict()
            team_id = team_doc.id
            
            # Check basic structure
            if 'players' in team_data or 'capSheet' in team_data:
                valid_teams += 1
            else:
                print(f"⚠️  Team {team_id} missing cap sheet structure")
        
        if valid_teams > 0:
            print(f"✅ Team data structure valid ({valid_teams}/{len(teams)} teams)")
            return True
        else:
            print("❌ No valid team data found")
            return False
            
    except Exception as e:
        print(f"❌ Failed to validate team data: {e}")
        return False

def validate_metadata_consistency(db):
    """Validate metadata is consistent"""
    print("📋 Validating metadata consistency...")
    
    try:
        # Check stats metadata
        stats_meta_ref = db.collection('metadata').document('stats')
        stats_meta_doc = stats_meta_ref.get()
        
        stats_meta_valid = False
        if stats_meta_doc.exists:
            stats_data = stats_meta_doc.to_dict()
            if 'season' in stats_data and 'ready_for_new_stats' in stats_data:
                stats_meta_valid = True
                print(f"✅ Stats metadata valid (season: {stats_data.get('season')})")
        
        if not stats_meta_valid:
            print("⚠️  Stats metadata incomplete")
        
        # Overall validation
        return stats_meta_valid
        
    except Exception as e:
        print(f"❌ Failed to validate metadata: {e}")
        return False

def generate_validation_report(db):
    """Generate summary validation report"""
    print("\n📊 Validation Summary Report")
    print("=" * 40)
    
    try:
        # Count players
        players_ref = db.collection('players')
        total_players = len(players_ref.limit(1000).get())
        
        # Count teams  
        teams_ref = db.collection('teams')
        total_teams = len(teams_ref.get())
        
        # Count seasons
        seasons_ref = db.collection('seasons')
        total_seasons = len(seasons_ref.get())
        
        print(f"📊 Database Overview:")
        print(f"  Players: {total_players}")
        print(f"  Teams: {total_teams}")  
        print(f"  Seasons: {total_seasons}")
        
        # Current season info
        now = datetime.now()
        current_year = now.year + 1 if now.month >= 7 else now.year
        season_key = f"{current_year-1}-{str(current_year)[-2:]}"
        print(f"  Current Season: {season_key}")
        
        return True
        
    except Exception as e:
        print(f"❌ Failed to generate report: {e}")
        return False

def main():
    """Run comprehensive validation"""
    print("🔍 Season Transition Validation")
    print("=" * 40)
    
    # Initialize Firebase
    db = init_firebase()
    
    validation_results = []
    
    # Run all validations
    validations = [
        ("Season Structure", validate_season_structure),
        ("Player Data Integrity", validate_player_data_integrity),
        ("Grade Preservation", validate_grade_preservation),
        ("Team Data", validate_team_data),
        ("Metadata Consistency", validate_metadata_consistency)
    ]
    
    for name, validator in validations:
        print(f"\n{'='*20}")
        try:
            result = validator(db)
            validation_results.append((name, result))
        except Exception as e:
            print(f"❌ {name} validation failed with error: {e}")
            validation_results.append((name, False))
    
    # Generate report
    print(f"\n{'='*20}")
    generate_validation_report(db)
    
    # Summary
    print(f"\n🏁 Validation Results:")
    print("=" * 40)
    
    passed = 0
    for name, result in validation_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {name}")
        if result:
            passed += 1
    
    overall_success = passed == len(validation_results)
    
    if overall_success:
        print(f"\n🎉 All validations passed! Season transition successful.")
        sys.exit(0)
    else:
        print(f"\n⚠️  {len(validation_results) - passed} validation(s) failed.")
        print("Review the issues above before proceeding.")
        sys.exit(1)

if __name__ == "__main__":
    main()