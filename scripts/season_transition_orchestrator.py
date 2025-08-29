#!/usr/bin/env python3
"""
Complete Season Transition Orchestrator

This script coordinates the full process of transitioning from one NBA season
to the next, ensuring all user data is preserved while updating contracts,
bios, and preparing for new stats.

Usage:
    python3 scripts/season_transition_orchestrator.py --from-season 2024 --to-season 2025
"""

import subprocess
import os
import sys
import argparse
from datetime import datetime

def run_command(command, description, check_success=True):
    """Run a command and handle success/failure"""
    print(f"\n{'='*60}")
    print(f"🔹 {description}")
    print(f"Command: {command}")
    print('='*60)
    
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        print(result.stdout)
        if result.stderr:
            print("STDERR:", result.stderr)
        print(f"✅ {description} - SUCCESS")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} - FAILED")
        print(f"Error code: {e.returncode}")
        print(f"STDOUT: {e.stdout}")
        print(f"STDERR: {e.stderr}")
        
        if check_success:
            print(f"\n🚨 STOPPING - {description} failed and is required for safe transition")
            sys.exit(1)
        return False

def confirm_action(message):
    """Get user confirmation for important actions"""
    response = input(f"\n❓ {message} (y/N): ").lower().strip()
    return response in ['y', 'yes']

def show_pre_transition_checklist():
    """Show important pre-transition checklist"""
    print("\n" + "="*60)
    print("🚨 PRE-TRANSITION CHECKLIST")
    print("="*60)
    print("Before starting the season transition, ensure:")
    print("✓ You have a backup of your Firestore database")
    print("✓ You've tested this process in a development environment")
    print("✓ You have the Firebase service account key at src/serviceAccountKey.json")
    print("✓ You understand that this process will modify your production data")
    print("✓ You're prepared to validate the results thoroughly")
    print("\n⚠️  This process should be run during the NBA offseason")
    print("⚠️  Do NOT run stats updates until the new season starts")
    print("="*60)

def main():
    parser = argparse.ArgumentParser(description='Complete Season Transition Orchestrator')
    parser.add_argument('--from-season', type=int, required=True, 
                        help='Previous season year (e.g., 2024 for 2023-24 season)')
    parser.add_argument('--to-season', type=int, required=True,
                        help='New season year (e.g., 2025 for 2024-25 season)')
    parser.add_argument('--skip-archive', action='store_true',
                        help='Skip archiving step (if already done)')
    parser.add_argument('--skip-contracts', action='store_true',
                        help='Skip contract update step')
    parser.add_argument('--skip-stats-prep', action='store_true',
                        help='Skip stats preparation step')
    parser.add_argument('--dry-run', action='store_true',
                        help='Show what would be done without making changes')
    parser.add_argument('--auto-confirm', action='store_true',
                        help='Skip confirmation prompts (use with caution)')
    
    args = parser.parse_args()
    
    # Validate arguments
    if args.to_season <= args.from_season:
        print("❌ To-season must be greater than from-season")
        sys.exit(1)
    
    from_display = f"{args.from_season-1}-{str(args.from_season)[-2:]}"
    to_display = f"{args.to_season-1}-{str(args.to_season)[-2:]}"
    
    print(f"🏀 Season Transition Orchestrator")
    print(f"📅 Transitioning from {from_display} to {to_display}")
    
    if args.dry_run:
        print("🔍 DRY RUN MODE - No changes will be made")
    
    # Show pre-transition checklist
    show_pre_transition_checklist()
    
    if not args.auto_confirm:
        if not confirm_action(f"Ready to begin transition from {from_display} to {to_display}?"):
            print("👋 Transition cancelled by user")
            sys.exit(0)
    
    # Track overall progress
    steps_completed = []
    steps_failed = []
    
    try:
        # Phase 1: Archive Current Season
        if not args.skip_archive:
            print(f"\n🏁 PHASE 1: Archive {from_display} Season Data")
            if args.dry_run:
                print("🔍 Would run: Archive current season")
                steps_completed.append("Archive (dry run)")
            else:
                success = run_command(
                    f"npm run season:archive {args.from_season}",
                    f"Archive {from_display} season data"
                )
                if success:
                    steps_completed.append("Archive current season")
                else:
                    steps_failed.append("Archive current season")
        else:
            print(f"\n⏭️  SKIPPING: Archive {from_display} Season Data")
            steps_completed.append("Archive (skipped)")
        
        # Phase 2: Create New Season
        print(f"\n🆕 PHASE 2: Create {to_display} Season")
        if args.dry_run:
            print("🔍 Would run: Create new season")
            steps_completed.append("Create season (dry run)")
        else:
            success = run_command(
                f"npm run season:create {args.to_season}",
                f"Create {to_display} season"
            )
            if success:
                steps_completed.append("Create new season")
            else:
                steps_failed.append("Create new season")
        
        # Phase 3: Update Contracts and Bio Data
        if not args.skip_contracts:
            print(f"\n📄 PHASE 3: Update Contracts and Bio Data")
            if args.dry_run:
                print("🔍 Would run: Contract update pipeline")
                steps_completed.append("Contract updates (dry run)")
            else:
                success = run_command(
                    "npm run contracts:update",
                    "Update player contracts and bio data"
                )
                if success:
                    steps_completed.append("Update contracts and bio data")
                else:
                    steps_failed.append("Update contracts and bio data")
        else:
            print(f"\n⏭️  SKIPPING: Contract and Bio Updates")
            steps_completed.append("Contract updates (skipped)")
        
        # Phase 4: Prepare Stats Structure
        if not args.skip_stats_prep:
            print(f"\n📊 PHASE 4: Prepare Stats Structure for {to_display}")
            if args.dry_run:
                print("🔍 Would run: Prepare stats structure")
                steps_completed.append("Stats preparation (dry run)")
            else:
                success = run_command(
                    f"npm run season:prepare-stats --season {args.to_season}",
                    f"Prepare stats structure for {to_display}"
                )
                if success:
                    steps_completed.append("Prepare stats structure")
                else:
                    steps_failed.append("Prepare stats structure")
        else:
            print(f"\n⏭️  SKIPPING: Stats Structure Preparation")
            steps_completed.append("Stats preparation (skipped)")
        
        # Phase 5: Validation
        print(f"\n🔍 PHASE 5: Validate Transition")
        if args.dry_run:
            print("🔍 Would run: Validate transition")
            steps_completed.append("Validation (dry run)")
        else:
            success = run_command(
                f"npm run season:validate {args.from_season} {args.to_season}",
                "Validate season transition data integrity",
                check_success=False  # Don't exit on validation failure, just report
            )
            if success:
                steps_completed.append("Validation passed")
            else:
                steps_failed.append("Validation failed")
        
        # Final Summary
        print("\n" + "="*60)
        print("🏁 SEASON TRANSITION SUMMARY")
        print("="*60)
        
        print(f"✅ Completed Steps ({len(steps_completed)}):")
        for step in steps_completed:
            print(f"   - {step}")
        
        if steps_failed:
            print(f"\n❌ Failed Steps ({len(steps_failed)}):")
            for step in steps_failed:
                print(f"   - {step}")
        
        if not steps_failed:
            print(f"\n🎉 SUCCESS: {from_display} → {to_display} transition completed!")
            print(f"\n📋 Next Steps:")
            print(f"   1. Manually verify a few players have their grades preserved")
            print(f"   2. Check that contract/team updates look correct")
            print(f"   3. Wait for {to_display} season to start before running stats updates")
            print(f"   4. When ready for stats: npm run stats:update")
        else:
            print(f"\n⚠️  PARTIAL SUCCESS: Some steps failed")
            print(f"   Review the failed steps above and consider:")
            print(f"   - Re-running specific failed phases")
            print(f"   - Checking error logs for details")
            print(f"   - Validating data integrity manually")
        
        print("\n💡 For detailed guidance, see: docs/SEASON_TRANSITION_GUIDE.md")
        
    except KeyboardInterrupt:
        print("\n\n🛑 Process interrupted by user")
        print("⚠️  Transition may be incomplete - check data integrity")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Unexpected error: {e}")
        print("⚠️  Transition may be incomplete - check data integrity")
        sys.exit(1)

if __name__ == '__main__':
    main()