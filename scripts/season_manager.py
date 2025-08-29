#!/usr/bin/env python3
"""
Season management utility script
Provides commands for season initialization, archiving, and data management
"""

import argparse
import sys
import os
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

def create_season(year, start_date=None, end_date=None):
    """Create a new season"""
    db = init_firebase()
    if not db:
        return False
    
    try:
        season_data = {
            'season': year,
            'display_name': f"{year-1}-{str(year)[-2:]}",
            'created_date': datetime.now().isoformat(),
            'created_timestamp': datetime.now().timestamp(),
            'status': 'active',
            'start_date': start_date or f"{year-1}-10-01",
            'end_date': end_date or f"{year}-06-30",
            'trade_deadline': f"{year}-02-08",
            'data_snapshots': {
                'players_count': 0,
                'teams_count': 30,
                'last_updated': datetime.now().timestamp()
            }
        }
        
        # Create season document
        db.collection('seasons').document(str(year)).set(season_data)
        
        # Initialize metadata
        db.collection('seasons').document(str(year)).collection('metadata').document('info').set({
            'initialized_date': datetime.now().isoformat(),
            'version': '1.0',
            'collections_created': []
        })
        
        print(f"✅ Created season {season_data['display_name']} ({year})")
        return True
        
    except Exception as e:
        print(f"❌ Error creating season {year}: {e}")
        return False

def archive_season(year, include_players=True, include_teams=True):
    """Archive season data"""
    db = init_firebase()
    if not db:
        return False
    
    try:
        print(f"📦 Starting season archive for {year-1}-{str(year)[-2:]}...")
        
        results = {
            'players': {'success': 0, 'failed': 0},
            'teams': {'success': 0, 'failed': 0},
            'errors': []
        }
        
        # Archive player grades
        if include_players:
            print("📚 Archiving player grades...")
            players = db.collection('players').get()
            
            for player_doc in players:
                try:
                    player_data = player_doc.to_dict()
                    player_id = player_doc.id
                    
                    archive_data = {
                        'player_id': player_id,
                        'season': year,
                        'overall_grade': player_data.get('overall_grade'),
                        'roles': player_data.get('roles', {}),
                        'traits': player_data.get('traits', {}),
                        'badges': player_data.get('badges', []),
                        'team': player_data.get('team'),
                        'archived_date': datetime.now().isoformat(),
                        'reason': 'season_archive'
                    }
                    
                    db.collection('seasons').document(str(year)).collection('playerGrades').document(player_id).set(archive_data)
                    results['players']['success'] += 1
                    
                    if results['players']['success'] % 50 == 0:
                        print(f"📈 Archived {results['players']['success']} players...")
                    
                except Exception as e:
                    results['players']['failed'] += 1
                    results['errors'].append(f"Player {player_doc.id}: {str(e)}")
        
        # Archive team data
        if include_teams:
            print("🏀 Archiving team data...")
            teams = db.collection('teams').get()
            
            for team_doc in teams:
                try:
                    team_data = team_doc.to_dict()
                    team_id = team_doc.id
                    
                    archive_data = {
                        'team_id': team_id,
                        'season': year,
                        'capSheet': team_data.get('capSheet'),
                        'players': team_data.get('players'),
                        'totalSalaryByYear': team_data.get('totalSalaryByYear'),
                        'archived_date': datetime.now().isoformat(),
                        'reason': 'season_archive'
                    }
                    
                    db.collection('seasons').document(str(year)).collection('teamData').document(team_id).set(archive_data)
                    results['teams']['success'] += 1
                    
                except Exception as e:
                    results['teams']['failed'] += 1
                    results['errors'].append(f"Team {team_doc.id}: {str(e)}")
        
        # Update season status
        db.collection('seasons').document(str(year)).update({
            'status': 'archived',
            'archived_date': datetime.now().isoformat(),
            'archive_results': results
        })
        
        print(f"✅ Season {year-1}-{str(year)[-2:]} archived successfully")
        print(f"📊 Results: {results['players']['success']} players, {results['teams']['success']} teams")
        
        return True
        
    except Exception as e:
        print(f"❌ Error archiving season {year}: {e}")
        return False

def list_seasons():
    """List all seasons"""
    db = init_firebase()
    if not db:
        return False
    
    try:
        seasons = db.collection('seasons').order_by('season', direction=firestore.Query.DESCENDING).get()
        
        print("📅 Available Seasons:")
        print("=" * 50)
        
        for season_doc in seasons:
            data = season_doc.to_dict()
            print(f"{data['display_name']} ({data['season']}) - Status: {data['status']}")
            if 'created_date' in data:
                print(f"   Created: {data['created_date'][:10]}")
            if 'archive_results' in data:
                results = data['archive_results']
                print(f"   Archived: {results.get('players', {}).get('success', 0)} players, {results.get('teams', {}).get('success', 0)} teams")
            print()
        
        return True
        
    except Exception as e:
        print(f"❌ Error listing seasons: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description='Season Management Utility')
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Create season command
    create_parser = subparsers.add_parser('create', help='Create a new season')
    create_parser.add_argument('year', type=int, help='Season year (e.g., 2025 for 2024-25 season)')
    create_parser.add_argument('--start-date', help='Season start date (YYYY-MM-DD)')
    create_parser.add_argument('--end-date', help='Season end date (YYYY-MM-DD)')
    
    # Archive season command
    archive_parser = subparsers.add_parser('archive', help='Archive season data')
    archive_parser.add_argument('year', type=int, help='Season year to archive')
    archive_parser.add_argument('--no-players', action='store_true', help='Skip player data archiving')
    archive_parser.add_argument('--no-teams', action='store_true', help='Skip team data archiving')
    
    # List seasons command
    list_parser = subparsers.add_parser('list', help='List all seasons')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    if args.command == 'create':
        success = create_season(args.year, args.start_date, args.end_date)
        sys.exit(0 if success else 1)
    
    elif args.command == 'archive':
        success = archive_season(
            args.year, 
            include_players=not args.no_players,
            include_teams=not args.no_teams
        )
        sys.exit(0 if success else 1)
    
    elif args.command == 'list':
        success = list_seasons()
        sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()