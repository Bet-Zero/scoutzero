#!/usr/bin/env python3
"""
Season Manager Test Mode - CLI for testing season operations without Firebase
Simulates Firebase operations for development/testing
"""

import sys
import json
import os
from datetime import datetime, timezone

def get_season_key(end_year):
    """Convert end year to season key format (2025 -> '2024-25')"""
    start_year = end_year - 1
    return f"{start_year}-{str(end_year)[-2:]}"

def get_current_season_year():
    """Get current season end year based on date"""
    now = datetime.now()
    year = now.year
    # NBA season flips July 1
    return year + 1 if now.month >= 7 else year

def create_season_test(year=None):
    """Simulate creating a new season"""
    if year is None:
        year = get_current_season_year()
    
    season_key = get_season_key(year)
    
    print(f"🧪 TEST MODE: Would create season {season_key} (ending in {year})")
    print(f"   - Season document: /seasons/{year}")
    print(f"   - Status: active")
    print(f"   - Display name: {season_key}")
    print(f"   - Created date: {datetime.now(timezone.utc).isoformat()}")
    print(f"   - Subcollections: playerGrades, teamData, metadata")
    print(f"✅ Test: Season creation would succeed")

def archive_season_test(year=None):
    """Simulate archiving a season"""
    if year is None:
        year = get_current_season_year() - 1
    
    season_key = get_season_key(year)
    
    print(f"🧪 TEST MODE: Would archive season {season_key}")
    print(f"   - Update /seasons/{year} status to 'archived'")
    print(f"   - Add archived_date: {datetime.now(timezone.utc).isoformat()}")
    print(f"✅ Test: Season archival would succeed")

def list_seasons_test():
    """Simulate listing seasons"""
    current_year = get_current_season_year()
    
    print("🧪 TEST MODE: Simulated seasons list")
    print("\n📋 Seasons:")
    print("=" * 50)
    
    # Simulate a few seasons
    for i in range(3):
        year = current_year - i
        season_key = get_season_key(year)
        status = "active" if i == 0 else "archived"
        status_emoji = "🟢" if status == "active" else "🟡"
        created_date = datetime.now().strftime('%Y-%m-%d')
        
        print(f"{status_emoji} {season_key} ({year}) - {status} - Created: {created_date}")
    
    print("\n✅ Test: Season listing would show real Firebase data")

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 season_manager_test.py <command> [year]")
        print("Commands:")
        print("  create [year]  - Test season creation (defaults to current)")
        print("  archive [year] - Test season archival (defaults to previous)")
        print("  list           - Test season listing")
        print("\nNOTE: This is TEST MODE - no actual Firebase operations are performed")
        sys.exit(1)
    
    command = sys.argv[1]
    year = int(sys.argv[2]) if len(sys.argv) > 2 else None
    
    print("🧪 SEASON MANAGER - TEST MODE")
    print("=" * 40)
    print("⚠️  Firebase operations are simulated only")
    print("   Use real season_manager.py with Firebase credentials for production")
    print()
    
    if command == 'create':
        create_season_test(year)
    elif command == 'archive':
        archive_season_test(year)
    elif command == 'list':
        list_seasons_test()
    else:
        print(f"❌ Unknown command: {command}")
        sys.exit(1)

if __name__ == "__main__":
    main()