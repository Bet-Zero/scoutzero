#!/usr/bin/env python3
"""
Streamlined Season Transition Pipeline - 2025-26 NBA Season
Single command to handle complete data transition with enhanced error handling
"""

import os
import sys
import subprocess
import time
import json
from datetime import datetime

class SeasonTransitionPipeline:
    def __init__(self):
        self.script_dir = os.path.dirname(os.path.abspath(__file__))
        self.project_root = os.path.dirname(self.script_dir)  # Go up from scripts/ to project root
        self.step_count = 0
        self.failed_steps = []
        self.success_count = 0
        
    def log(self, message, level="INFO"):
        """Log messages with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        prefix = {
            "INFO": "🔹",
            "SUCCESS": "✅", 
            "ERROR": "❌",
            "WARNING": "⚠️",
            "PROGRESS": "📊"
        }.get(level, "🔹")
        
        print(f"[{timestamp}] {prefix} {message}")
    
    def run_script(self, script_path, description, required=True, script_type="python"):
        """Execute a script with comprehensive error handling"""
        self.step_count += 1
        self.log(f"Step {self.step_count}: {description}")
        
        if not os.path.exists(script_path):
            self.log(f"Script not found: {script_path}", "ERROR")
            if required:
                self.failed_steps.append(description)
                return False
            else:
                self.log(f"Skipping optional step: {description}", "WARNING")
                return False
        
        try:
            cmd = ["python3", script_path] if script_type == "python" else ["node", script_path]
            result = subprocess.run(cmd, 
                                  check=True, 
                                  capture_output=True, 
                                  text=True,
                                  cwd=self.project_root)
            
            # Show key output lines
            if result.stdout:
                lines = result.stdout.strip().split('\n')
                for line in lines[-2:]:  # Last 2 lines
                    if line.strip() and any(word in line for word in ['✅', '📊', '🎉', 'Total', 'Success']):
                        self.log(f"   {line.strip()}")
            
            self.success_count += 1
            self.log(f"Completed: {description}", "SUCCESS")
            return True
            
        except subprocess.CalledProcessError as e:
            self.log(f"Failed: {description}", "ERROR")
            if e.stderr:
                # Show only the essential error info
                error_lines = e.stderr.strip().split('\n')
                for line in error_lines[-3:]:  # Last 3 lines of error
                    if line.strip():
                        self.log(f"   {line.strip()}", "ERROR")
            
            if required:
                self.failed_steps.append(description)
                return False
            else:
                self.log(f"Optional step failed: {description}", "WARNING")
                return False
        
        except FileNotFoundError:
            self.log(f"Command not found for: {description}", "ERROR")
            if required:
                self.failed_steps.append(description)
                return False
            return False
    
    def check_prerequisites(self):
        """Verify required files and dependencies"""
        self.log("Checking prerequisites for 2025-26 season transition...")
        
        # Check core data files
        required_files = [
            "public/players.json"
        ]
        
        for file_path in required_files:
            full_path = os.path.join(self.project_root, file_path)
            if os.path.exists(full_path):
                self.log(f"   ✓ {file_path}", "SUCCESS")
            else:
                self.log(f"   ✗ Missing: {file_path}", "ERROR")
                return False
        
        # Check Python dependencies
        try:
            import requests
            import firebase_admin
            from bs4 import BeautifulSoup
            self.log("   ✓ Python dependencies", "SUCCESS")
        except ImportError as e:
            self.log(f"   ✗ Missing Python dependency: {e}", "ERROR")
            return False
        
        return True
    
    def discover_new_players(self):
        """Step 1: Discover and merge new NBA players for 2025-26"""
        script_path = os.path.join(self.script_dir, "discover_and_merge_players.py")
        return self.run_script(script_path, "Discover & merge new 2025-26 players")
    
    def update_contracts(self):
        """Step 3: Update contract information using scraping + fallbacks"""
        self.step_count += 1
        self.log(f"Step {self.step_count}: Update contract data using scraping + fallbacks")
        
        try:
            # Run the contract update pipeline which includes scraping
            script_path = os.path.join(self.script_dir, "updateContracts_enhanced.py")
            
            if not os.path.exists(script_path):
                self.log(f"Contract update script not found: {script_path}", "ERROR")
                self.failed_steps.append("Update contract data")
                return False
            
            self.log(f"   🕷️  This includes contract scraping for ALL players (rookies + veterans)")
            self.log(f"   📊 Progress will show scraping results vs fallback usage...")
            
            # Run the script with real-time output to see scraping progress
            cmd = ["python3", script_path]
            process = subprocess.Popen(cmd, 
                                     stdout=subprocess.PIPE, 
                                     stderr=subprocess.STDOUT,
                                     text=True,
                                     cwd=self.project_root,
                                     bufsize=1,
                                     universal_newlines=True)
            
            # Show real-time progress
            while True:
                output = process.stdout.readline()
                if output == '' and process.poll() is not None:
                    break
                if output:
                    # Forward the contract update script's output with our timestamp
                    clean_output = output.strip()
                    if clean_output:
                        self.log(f"   {clean_output}")
            
            return_code = process.poll()
            
            if return_code == 0:
                # Check if contract data was created
                contract_files = [
                    (os.path.join(self.script_dir, "data", "raw_contract_html.json"), "Raw contract data"),
                    (os.path.join(self.script_dir, "data", "contracts_parsed.json"), "Parsed contract data")
                ]

                for file_path, description in contract_files:
                    if os.path.exists(file_path):
                        with open(file_path, 'r') as f:
                            data = json.load(f)
                        self.log(f"   ✓ {description}: {len(data)} players")
                
                self.success_count += 1
                self.log("Completed: Update contract data using scraping + fallbacks", "SUCCESS")
                return True
            else:
                self.log(f"Contract update script returned error code: {return_code}", "ERROR")
                self.failed_steps.append("Update contract data")
                return False
            
        except Exception as e:
            self.log(f"Failed to update contract data: {e}", "ERROR")
            self.failed_steps.append("Update contract data")
            return False
    
    def merge_player_data(self):
        """Step 3: Merge all player data"""
        script_path = os.path.join(self.script_dir, "merge", "merge_universal_player_data.py")
        return self.run_script(script_path, "Merge universal player data")
    
    def update_bio_data(self):
        """Step 2: Update bio data for all players from NBA.com"""
        self.step_count += 1
        self.log(f"Step {self.step_count}: Update bio data from NBA.com")
        
        try:
            # Use the existing bio data fetching tool
            bio_script_path = os.path.join(self.script_dir, "tools", "get_all_bios_nba.py")
            
            if not os.path.exists(bio_script_path):
                self.log(f"Bio script not found: {bio_script_path}", "WARNING")
                self.log("Skipping bio data update", "WARNING")
                return True  # Don't fail the pipeline for this
            
            # Generate player ID mapping file needed by the bio script
            # Use the newly merged player data from step 1, not the old public file
            merged_players_file = os.path.join(self.script_dir, "data", "players_merged_with_discoveries.json")
            players_file = os.path.join(self.project_root, "public", "players.json")
            id_mapping_file = os.path.join(self.script_dir, "all_player_ids.json")
            
            # Check which file to use for player data
            if os.path.exists(merged_players_file):
                players_file = merged_players_file
                self.log(f"   📋 Using newly merged player data: {merged_players_file}")
            else:
                self.log(f"   📋 Using existing player data: {players_file}")
            
            # Create ID mapping from current players
            with open(players_file, 'r') as f:
                players = json.load(f)
            
            id_mapping = {}
            for player_key, player_data in players.items():
                if "nba_player_id" in player_data:
                    id_mapping[player_key] = player_data["nba_player_id"]
            
            with open(id_mapping_file, 'w') as f:
                json.dump(id_mapping, f, indent=2)
            
            self.log(f"   📋 Created ID mapping for {len(id_mapping)} players")
            self.log(f"   ⏱️  This will take 5-10 minutes to fetch bio data from NBA.com...")
            self.log(f"   📊 Progress will be shown as players are processed...")
            
            # Run the bio fetching script with real-time output
            cmd = ["python3", bio_script_path]
            process = subprocess.Popen(cmd, 
                                     stdout=subprocess.PIPE, 
                                     stderr=subprocess.STDOUT,
                                     text=True,
                                     cwd=self.project_root,
                                     bufsize=1,
                                     universal_newlines=True)
            
            # Show real-time progress
            while True:
                output = process.stdout.readline()
                if output == '' and process.poll() is not None:
                    break
                if output:
                    # Forward the bio script's output with our timestamp
                    clean_output = output.strip()
                    if clean_output:
                        self.log(f"   {clean_output}")
            
            return_code = process.poll()
            
            if return_code == 0:
                # Check if bio data was created
                bio_output = os.path.join(self.script_dir, "data", "players_bios_2025.json")
                if os.path.exists(bio_output):
                    with open(bio_output, 'r') as f:
                        bio_data = json.load(f)
                    self.log(f"   ✓ Fetched bio data for {len(bio_data)} players")
                    
                    # Now merge this bio data with the player file we used
                    # Read from the same file we used for ID mapping
                    with open(players_file, 'r') as f:
                        players = json.load(f)
                    
                    updated_count = 0
                    for player_key, bio_info in bio_data.items():
                        if player_key in players and "bio" in bio_info:
                            bio = bio_info["bio"]
                            # Update bio fields directly (flat structure)
                            for field in ["HT", "WT", "AGE", "Years Pro", "Team", "Position"]:
                                if field in bio and bio[field]:
                                    players[player_key][field] = bio[field]
                                    updated_count += 1
                    
                    # Save updated player data
                    with open(players_file, 'w') as f:
                        json.dump(players, f, indent=2)
                    
                    self.log(f"   ✓ Updated bio data for {updated_count} player fields")
                    
                self.success_count += 1
                self.log("Completed: Update bio data from NBA.com", "SUCCESS")
                return True
            else:
                self.log(f"Bio script returned error code: {return_code}", "WARNING")
                self.log("Continuing pipeline without bio update", "WARNING")
                return True  # Don't fail the pipeline
            
        except Exception as e:
            self.log(f"Failed to update bio data: {e}", "WARNING")
            self.log("Continuing pipeline without bio update", "WARNING")
            return True  # Don't fail the pipeline

    def update_main_player_file(self):
        """Step 5: Update main players.json with merged discoveries"""
        self.step_count += 1
        self.log(f"Step {self.step_count}: Update main player data file")
        
        try:
            # Source file with all the new discoveries and updates
            source_file = os.path.join(self.script_dir, "data", "players_merged_with_discoveries.json")
            # Destination file that the React app actually reads
            dest_file = os.path.join(self.project_root, "public", "players.json")
            
            if not os.path.exists(source_file):
                self.log(f"Source file not found: {source_file}", "ERROR")
                self.failed_steps.append("Update main player data file")
                return False
            
            # Load and validate the source data
            with open(source_file, 'r') as f:
                merged_data = json.load(f)
            
            player_count = len(merged_data) if isinstance(merged_data, dict) else len(merged_data) if isinstance(merged_data, list) else 0
            
            if player_count == 0:
                self.log("No player data found in merged file", "ERROR")
                self.failed_steps.append("Update main player data file")
                return False
            
            # Copy the merged data to the main file
            with open(dest_file, 'w') as f:
                json.dump(merged_data, f, indent=2)
            
            self.log(f"   ✓ Updated main player file with {player_count} players")
            self.log(f"   ✓ New rookies and team changes now available to app")
            
            self.success_count += 1
            self.log("Completed: Update main player data file", "SUCCESS")
            return True
            
        except Exception as e:
            self.log(f"Failed to update main player file: {e}", "ERROR")
            self.failed_steps.append("Update main player data file")
            return False

    def upload_to_firebase(self):
        """Step 6: Upload to Firebase using direct Bird Rights integration"""
        self.step_count += 1
        self.log(f"Step {self.step_count}: Upload complete player data to Firebase with Bird Rights")
        
        # Check for Firebase credentials
        if not os.path.exists(os.path.join(self.project_root, "serviceAccountKey.json")):
            self.log("❌ Firebase credentials not found!", "ERROR")
            self.log("   💡 Place serviceAccountKey.json in project root", "ERROR")
            self.failed_steps.append("Upload to Firebase")
            return False
        
        try:
            # Use the SAME direct integration from updateContracts_enhanced.py
            # This ensures Bird Rights are properly uploaded
            self.log("   🔧 Using direct Bird Rights integration for Firebase upload...")
            
            # Import the direct upload function from the enhanced contract script
            import sys
            sys.path.append(self.script_dir)
            
            # Load base player data
            players_file = os.path.join(self.project_root, "public", "players.json")
            with open(players_file, 'r') as f:
                base_players = json.load(f)
            self.log(f"   ✅ Loaded {len(base_players)} base players")
            
            # Load correctly parsed contracts with Bird Rights
            contracts_file = os.path.join(self.script_dir, "data", "contracts_parsed.json")
            if os.path.exists(contracts_file):
                with open(contracts_file, 'r') as f:
                    contracts = json.load(f)
                self.log(f"   ✅ Loaded {len(contracts)} contract records with Bird Rights")
                
                # Create contract lookup
                contract_lookup = {}
                for contract in contracts:
                    player_id = contract.get('player_id')
                    if player_id:
                        contract_lookup[player_id] = contract
            else:
                self.log("   ⚠️ No parsed contracts found - uploading without contract data", "WARNING")
                contract_lookup = {}
            
            # Initialize Firebase with direct integration
            import firebase_admin
            from firebase_admin import credentials, firestore
            from datetime import datetime, timezone
            
            cred = credentials.Certificate(os.path.join(self.project_root, "serviceAccountKey.json"))
            firebase_admin.initialize_app(cred)
            db = firestore.client()
            
            # Direct merge and upload with Bird Rights
            self.log("   📤 Merging and uploading with Bird Rights to Firebase...")
            batch = db.batch()
            batch_count = 0
            updated_count = 0
            bird_rights_count = 0
            
            for player_id, player_data in base_players.items():
                # Start with base player data
                merged_data = dict(player_data)
                
                # Add contract data if available (including Bird Rights)
                if player_id in contract_lookup:
                    contract_data = contract_lookup[player_id]
                    
                    # Add Bird Rights and contract fields
                    merged_data['bird_rights'] = contract_data.get('bird_rights')
                    merged_data['free_agent_type'] = contract_data.get('free_agent_type')
                    merged_data['free_agency_year'] = contract_data.get('free_agency_year')
                    merged_data['contract_summary'] = contract_data.get('contract_summary')
                    merged_data['contract'] = contract_data.get('contract')
                    
                    if contract_data.get('bird_rights'):
                        bird_rights_count += 1
                
                # Add metadata
                merged_data['last_bio_update'] = datetime.now(timezone.utc)
                
                # Add to batch
                doc_ref = db.collection("players").document(player_id)
                batch.set(doc_ref, merged_data, merge=True)
                
                batch_count += 1
                updated_count += 1
                
                # Show progress for first few and every 100 players
                if updated_count <= 5 or updated_count % 100 == 0:
                    name = player_data.get('Name', player_id)
                    bird_rights = merged_data.get('bird_rights', 'None')
                    self.log(f"      [{updated_count}/{len(base_players)}] {name}: {bird_rights}")
                
                # Commit batch every 450 operations
                if batch_count >= 450:
                    batch.commit()
                    batch = db.batch()
                    self.log(f"      📤 Committed batch ({updated_count} players processed)")
            
            # Commit final batch
            if batch_count > 0:
                batch.commit()
            
            self.log(f"   ✅ Direct upload complete!")
            self.log(f"      📤 Updated {updated_count} players")
            self.log(f"      🐦 Players with Bird Rights: {bird_rights_count}")
            self.log("   🎯 Bird Rights properly integrated in Firebase!", "SUCCESS")
            
            self.success_count += 1
            return True
            
        except Exception as e:
            self.log(f"   ❌ Direct upload failed: {e}", "ERROR")
            # Fallback to old upload method
            self.log("   🔄 Trying fallback upload method...", "WARNING")
            script_path = os.path.join(self.script_dir, "upload", "push_bio_and_contract.py")
            return self.run_script(script_path, "Fallback Firebase upload", required=False)

    def prepare_stats_structure(self):
        """Step 7: Prepare stats structure for new season"""
        script_path = os.path.join(self.script_dir, "prepare_new_season_stats.py")
        return self.run_script(script_path, "Prepare 2025-26 stats structure", required=False)
    
    def validate_transition(self):
        """Step 8: Validate the transition"""
        script_path = os.path.join(self.script_dir, "validate_season_transition.py")
        return self.run_script(script_path, "Validate season transition", required=False)
    
    def generate_summary_report(self):
        """Generate final summary of the transition"""
        self.log("Generating 2025-26 Season Transition Summary", "PROGRESS")
        
        # Check output files - updated to match actual file names created by the pipeline
        output_files = [
            (os.path.join(self.script_dir, "data", "players_merged_with_discoveries.json"), "New players discovered & merged"),
            (os.path.join(self.script_dir, "data", "raw_contract_html.json"), "Contract data collected"),
            (os.path.join(self.script_dir, "data", "contracts_parsed.json"), "Contract data parsed"),
            (os.path.join(self.project_root, "public", "players.json"), "Updated main player data")  # This is the actual final merged data file
        ]

        existing_files = 0
        for file_path, description in output_files:
            if os.path.exists(file_path):
                try:
                    with open(file_path, 'r') as f:
                        data = json.load(f)
                    count = len(data) if isinstance(data, (dict, list)) else "N/A"
                    self.log(f"   ✓ {description}: {count} items", "SUCCESS")
                    existing_files += 1
                except:
                    self.log(f"   ✓ {description}: Created", "SUCCESS")
                    existing_files += 1
            else:
                self.log(f"   ✗ {description}: Not created", "ERROR")
        
        # Final report
        self.log("=" * 60, "PROGRESS")
        self.log("🏀 2025-26 NBA Season Transition Complete!", "SUCCESS")
        self.log(f"   📊 Pipeline steps completed: {self.success_count}/{self.step_count}")
        self.log(f"   📁 Output files created: {existing_files}/{len(output_files)}")
        
        if self.failed_steps:
            self.log(f"   ⚠️ Failed steps: {', '.join(self.failed_steps)}", "WARNING")
        else:
            self.log("   🎉 All critical steps successful!", "SUCCESS")
        
        self.log("=" * 60, "PROGRESS")
        
        # Next steps guidance
        if existing_files >= 3:  # Core files created
            self.log("🎯 Ready for 2025-26 season! Next steps:")
            self.log("   1. Review data/players_merged_with_discoveries.json for new players")
            self.log("   2. Run manual validation checks if needed")
            self.log("   3. Set up Firebase credentials for live data uploads")
            self.log("   4. Update season-specific configurations")
        else:
            self.log("⚠️ Pipeline partially completed. Check logs for issues.")
    
    def run_full_pipeline(self):
        """Execute the complete season transition pipeline"""
        start_time = time.time()
        
        self.log("🏀 Starting 2025-26 NBA Season Transition Pipeline")
        self.log("=" * 60)
        self.log("This will update all player data for the upcoming season")
        self.log("Including new players, contracts, and Firebase upload")
        self.log("=" * 60)
        
        # Prerequisites check
        if not self.check_prerequisites():
            self.log("Prerequisites check failed - aborting pipeline", "ERROR")
            sys.exit(1)
        
        # Core pipeline steps - FIXED: Firebase upload is now REQUIRED
        pipeline_steps = [
            (self.discover_new_players, True),      # Step 1: Find all players (existing + new)
            (self.update_bio_data, False),          # Step 2: Get fresh bio data (optional)
            (self.update_contracts, True),          # Step 3: SCRAPE contracts for ALL players 
            (self.merge_player_data, True),         # Step 4: Merge all data sources
            (self.update_main_player_file, True),   # Step 5: Copy merged data to main app file
            (self.upload_to_firebase, True),        # Step 6: Upload to Firebase (REQUIRED!)
            (self.prepare_stats_structure, False), # Step 7: Prepare stats structure (optional)
            (self.validate_transition, False)       # Step 8: Validate everything (optional)
        ]
        
        # Execute all steps with proper failure handling
        critical_failures = []
        for step_func, is_required in pipeline_steps:
            success = step_func()
            
            if not success and is_required:
                # Critical step failed - this should stop the pipeline
                step_name = step_func.__name__.replace('_', ' ').title()
                critical_failures.append(step_name)
                self.log(f"💥 CRITICAL FAILURE: {step_name}", "ERROR")
                self.log("🛑 Pipeline cannot continue with failed critical steps", "ERROR")
                break
            elif not success:
                # Optional step failed - log but continue
                step_name = step_func.__name__.replace('_', ' ').title()
                self.log(f"⚠️ Optional step failed: {step_name}", "WARNING")
        
        # Generate summary
        self.generate_summary_report()
        
        # Final timing and status
        duration = time.time() - start_time
        self.log(f"Pipeline completed in {duration:.1f} seconds", "PROGRESS")
        
        # Exit with proper status
        if critical_failures:
            self.log("=" * 60, "ERROR")
            self.log("❌ PIPELINE FAILED - Critical steps could not complete:", "ERROR")
            for failure in critical_failures:
                self.log(f"   - {failure}", "ERROR")
            self.log("🔧 Fix the above issues and re-run the pipeline", "ERROR")
            self.log("=" * 60, "ERROR")
            sys.exit(1)
        elif self.failed_steps:
            self.log("=" * 60, "WARNING")
            self.log("⚠️ PIPELINE COMPLETED WITH WARNINGS", "WARNING")
            self.log("✅ All critical steps succeeded, but some optional steps failed", "WARNING")
            self.log("=" * 60, "WARNING")
        else:
            self.log("=" * 60, "SUCCESS")
            self.log("🎉 PIPELINE COMPLETED SUCCESSFULLY!", "SUCCESS")
            self.log("✅ All data has been processed and uploaded to Firebase", "SUCCESS")
            self.log("🚀 Your application is ready for the 2025-26 season!", "SUCCESS")
            self.log("=" * 60, "SUCCESS")

def main():
    """Main entry point"""
    pipeline = SeasonTransitionPipeline()
    pipeline.run_full_pipeline()

if __name__ == "__main__":
    main()