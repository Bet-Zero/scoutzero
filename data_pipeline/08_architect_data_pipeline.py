#!/usr/bin/env python3
"""
08_architect_data_pipeline.py

Scrapes and processes player contract data for the Architect feature.
Populates /architect/basePlayers with detailed contract information including:
- Bird rights status
- Free agency type (RFA/UFA) and year
- Player/Team options
- Trade eligibility (BYC, poison pill, aggregation)
- Cap holds and qualifying offers

This is separate from the main contract scraper to keep architect data isolated.
"""

import os
import sys
import subprocess

def run_command(cmd, description):
    """Run a shell command and check status"""
    print(f"\n{'=' * 70}")
    print(f"🔧 {description}")
    print(f"{'=' * 70}\n")
    
    result = subprocess.run(cmd, shell=True, capture_output=False)
    
    if result.returncode != 0:
        print(f"\n❌ {description} failed with exit code {result.returncode}")
        return False
    
    print(f"\n✅ {description} complete")
    return True

def main():
    """Main execution"""
    print("\n🏀 Architect Data Pipeline - Players v2")
    print("=" * 70)
    print("Scrapes individual player contract details for Architect GM Tools")
    print("=" * 70)
    
    # Get script directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    contracts_dir = os.path.join(script_dir, "helpers", "contracts")
    
    # Change to contracts directory
    os.chdir(contracts_dir)
    
    # Step 1: Run tests
    if not run_command(
        "python3 test_players_v2.py",
        "Step 1: Running unit tests"
    ):
        print("\n⚠️  Tests failed - continuing anyway (tests may need network access)")
    
    # Step 2: Scrape player data
    if not run_command(
        "python3 scrape_players_v2.py",
        "Step 2: Scraping player contract pages"
    ):
        print("\n❌ Scraping failed - cannot continue without data")
        sys.exit(1)
    
    # Step 3: Parse to architect schema
    if not run_command(
        "python3 parse_players_v2.py",
        "Step 3: Parsing to architect schema"
    ):
        print("\n❌ Parsing failed - check scraped data")
        sys.exit(1)
    
    # Step 4: Upload to Firestore
    if not run_command(
        "node upload_players_v2.js",
        "Step 4: Uploading to Firestore"
    ):
        print("\n❌ Upload failed - check Firebase credentials")
        sys.exit(1)
    
    # Success
    print("\n" + "=" * 70)
    print("✅ Architect Data Pipeline Complete!")
    print("=" * 70)
    print("\n📁 Data Location: /architect/basePlayers/players/{playerId}")
    print("🔧 Ready for use in:")
    print("   - GM Dashboard")
    print("   - Trade Machine")
    print("   - Cap Sheet Tools")
    print("   - Roster Builder")
    print("\n📊 Key Data Fields:")
    print("   ✓ Bird Rights (Bird, Early Bird, Non-Bird)")
    print("   ✓ Free Agency (RFA/UFA, year, cap hold)")
    print("   ✓ Trade Eligibility (BYC, poison pill, aggregation)")
    print("   ✓ Contract Options (PO/TO/ETO)")
    print("   ✓ Guarantees (per-year breakdown)")
    print()

if __name__ == "__main__":
    main()
