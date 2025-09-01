#!/usr/bin/env python3
"""
Enhanced Contracts Update Pipeline - Streamlined for 2025-26 Season
Uses fallback mechanisms when external data sources are unavailable
"""

import subprocess
import os
import sys

def run_script(script_path, description="", required=True):
    """Run a script with error handling"""
    print(f"\n🔹 {description}")
    print(f"   Running: {script_path}")
    
    try:
        result = subprocess.run(["python3", script_path], 
                              check=True, 
                              capture_output=True, 
                              text=True)
        
        if result.stdout:
            # Print last few lines of output for feedback
            lines = result.stdout.strip().split('\n')
            for line in lines[-3:]:
                if line.strip():
                    print(f"   {line}")
        
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Error in {script_path}:")
        if e.stdout:
            print(f"   stdout: {e.stdout}")
        if e.stderr:
            print(f"   stderr: {e.stderr}")
        
        if required:
            print(f"❌ Pipeline failed at {description}")
            sys.exit(1)
        else:
            print(f"⚠️ Optional step failed: {description}")
            return False

def check_prerequisites():
    """Check if required files exist"""
    print("🔍 Checking prerequisites...")
    
    required_files = [
        ("public/players.json", "Base player data"),
        ("data/players_merged_with_discoveries.json", "Merged player data")
    ]
    
    missing_files = []
    for file_path, description in required_files:
        if not os.path.exists(file_path):
            missing_files.append((file_path, description))
        else:
            print(f"   ✅ {description}: {file_path}")
    
    if missing_files:
        print(f"❌ Missing required files:")
        for file_path, description in missing_files:
            print(f"   - {description}: {file_path}")
        print(f"\n💡 Run player discovery first:")
        print(f"   python3 scripts/discover_and_merge_players.py")
        return False
    
    return True

def main():
    """Main pipeline execution"""
    print("🏀 Enhanced Contracts Update Pipeline")
    print("=" * 50)
    print("Streamlined for 2025-26 season with fallback mechanisms")
    
    # Check prerequisites
    if not check_prerequisites():
        sys.exit(1)
    
    # Get script directory
    base_dir = os.path.dirname(__file__)
    
    # Pipeline steps with fallbacks
    steps = [
        {
            "script": os.path.join(base_dir, "contracts/scrape_all_contracts_fallback.py"),
            "description": "Step 1: Contract data collection (with fallbacks)",
            "required": True
        },
        {
            "script": os.path.join(base_dir, "contracts/parse_contract_data_enhanced.py"),
            "description": "Step 2: Parse contract data",
            "required": True
        },
        {
            "script": os.path.join(base_dir, "merge/merge_universal_player_data.py"),
            "description": "Step 3: Merge with universal player data",
            "required": True
        }
    ]
    
    # Execute pipeline steps
    completed_steps = 0
    for step in steps:
        success = run_script(step["script"], step["description"], step["required"])
        if success:
            completed_steps += 1
    
    # Try Firebase upload if credentials are available
    print(f"\n🔹 Step 4: Upload to Firebase (optional)")
    upload_script = os.path.join(base_dir, "upload/push_bio_and_contract.py")
    
    if os.path.exists("serviceAccountKey.json") or os.environ.get('GOOGLE_APPLICATION_CREDENTIALS'):
        print("   🔑 Firebase credentials found - attempting upload...")
        run_script(upload_script, "Upload to Firebase", required=False)
    else:
        print("   ⚠️ No Firebase credentials - skipping upload")
        print("   💡 Place serviceAccountKey.json in project root to enable uploads")
    
    # Try cap sheets generation
    print(f"\n🔹 Step 5: Generate cap sheets (optional)")
    capsheets_script = os.path.join(base_dir, "capsheets/generateCapSheets.js")
    
    if os.path.exists(capsheets_script):
        try:
            print(f"   Running: {capsheets_script}")
            result = subprocess.run(["node", capsheets_script], 
                                  check=True, 
                                  capture_output=True, 
                                  text=True)
            print("   ✅ Cap sheets generated")
        except subprocess.CalledProcessError as e:
            print(f"   ⚠️ Cap sheets generation failed: {e}")
        except FileNotFoundError:
            print("   ⚠️ Node.js not available for cap sheets")
    else:
        print(f"   ⚠️ Cap sheets script not found: {capsheets_script}")
    
    # Summary
    print(f"\n🏁 Contracts Update Pipeline Complete")
    print("=" * 50)
    print(f"   ✅ Completed steps: {completed_steps}/{len(steps)}")
    
    if completed_steps == len(steps):
        print(f"   🎉 All core steps successful!")
        print(f"   📁 Contract data ready for 2025-26 season")
    else:
        print(f"   ⚠️ Some steps failed - check logs above")
    
    print(f"\n📊 Output files:")
    output_files = [
        ("data/raw_contract_html.json", "Raw contract data"),
        ("data/contracts_parsed.json", "Parsed contract data"),
        ("data/players_merged.json", "Final merged player data")
    ]
    
    for file_path, description in output_files:
        if os.path.exists(file_path):
            print(f"   ✅ {description}: {file_path}")
        else:
            print(f"   ❌ {description}: {file_path} (not created)")

if __name__ == "__main__":
    main()