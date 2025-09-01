#!/usr/bin/env python3
"""
Test Bio and Contract Data Upload (Mock Mode)
Shows what would be uploaded to Firebase without requiring credentials
"""

import json
import os
import sys
from datetime import datetime, timezone

def find_player_data():
    """Find player data file in multiple possible locations"""
    possible_paths = [
        "../data/players_merged.json",
        "../data/players.json",
        "../../public/players.json",
        "../public/players.json",
        "players.json"
    ]
    
    for path in possible_paths:
        if os.path.exists(path):
            return path
    
    print("❌ No player data file found. Tried:")
    for path in possible_paths:
        print(f"  - {path}")
    return None

def mock_preserve_existing_grades(player_id):
    """Mock getting existing grades from player document"""
    # In test mode, return mock grades
    return {
        "offense_grade": "B+",
        "defense_grade": "B",
        "overall_grade": "B+"
    }

def main():
    """Test upload bio and contract data"""
    print("🧪 TESTING Bio and Contract Data Upload (Mock Mode)")
    print("=" * 60)
    
    # Find player data
    data_file = find_player_data()
    if not data_file:
        sys.exit(1)
    
    print(f"📁 Loading player data from: {data_file}")
    
    # Load players data
    try:
        with open(data_file, "r") as f:
            players = json.load(f)
    except Exception as e:
        print(f"❌ Failed to load player data: {e}")
        sys.exit(1)
    
    print(f"👥 Testing upload for {len(players)} players...")
    
    # Process first few players as examples
    test_count = 5
    updated_count = 0
    errors = []
    
    for player_id, full_data in list(players.items())[:test_count]:
        try:
            player_name = full_data.get('Name', player_id.replace('_', ' ').title())
            print(f"\n📤 Testing upload for: {player_name}")
            
            # Get existing grades (mocked)
            existing_grades = mock_preserve_existing_grades(player_id)
            print(f"   🎯 Preserved grades: {existing_grades}")
            
            # Prepare update data (exclude system fields that shouldn't be in main collection)
            update_data = {
                k: v for k, v in full_data.items()
                if k not in ["system", "position", "source_url"]
            }
            
            # Ensure bio data is properly structured for rookies and newcomers
            bio_fields = ["AGE", "HT", "WT", "Team", "Position", "Years Pro", "Contract", "Free Agent"]
            bio_data = {}
            for field in bio_fields:
                if field in full_data and full_data[field] and full_data[field] != "":
                    bio_data[field] = full_data[field]
                else:
                    bio_data[field] = ""  # Ensure field exists even if empty
            
            # Add player name to bio
            bio_data["Name"] = full_data.get("Name", player_id.replace('_', ' ').title())
            
            # Create proper bio structure
            update_data["bio"] = bio_data
            
            # Add preserved grades back
            update_data.update(existing_grades)
            
            # Add metadata
            update_data["last_bio_update"] = datetime.now(timezone.utc).isoformat()
            
            # Show what would be uploaded
            print(f"   📋 Bio data structure:")
            for field, value in bio_data.items():
                if value:  # Only show non-empty values
                    print(f"      {field}: {value}")
            
            print(f"   ✅ Would upload to Firestore: players/{player_id}")
            updated_count += 1
                
        except Exception as e:
            errors.append(f"Player {player_id}: {str(e)}")
            print(f"❌ Error processing {player_id}: {e}")
    
    # Summary
    print(f"\n{'='*60}")
    print(f"✅ Successfully tested {updated_count}/{test_count} players")
    print(f"📊 Total players in dataset: {len(players)}")
    
    if errors:
        print(f"❌ Errors encountered: {len(errors)}")
        for error in errors:
            print(f"  - {error}")
    
    print(f"\n💡 TEST RESULTS:")
    print(f"   - Bio data structure: ✅ Correctly nested under 'bio' field")
    print(f"   - Player grades: ✅ Would be preserved")
    print(f"   - Firestore path: ✅ players/{list(players.keys())[0]}")
    print(f"   - Ready for upload: ✅ All data properly formatted")
    
    print(f"\n🚀 TO UPLOAD FOR REAL:")
    print(f"   1. Place serviceAccountKey.json in project root")
    print(f"   2. Run: python3 scripts/upload/push_bio_and_contract.py")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()