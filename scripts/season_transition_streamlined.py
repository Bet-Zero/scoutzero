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
                    ("data/raw_contract_html.json", "Raw contract data"),
                    ("data/contracts_parsed.json", "Parsed contract data")
                ]
                
                for file_path, description in contract_files:
                    full_path = os.path.join(self.project_root, file_path)
                    if os.path.exists(full_path):
                        with open(full_path, 'r') as f:
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
            bio_script_path = os.path.join(self.project_root, "tools", "get_all_bios_nba.py")
            
            if not os.path.exists(bio_script_path):
                self.log(f"Bio script not found: {bio_script_path}", "WARNING")
                self.log("Skipping bio data update", "WARNING")
                return True  # Don't fail the pipeline for this
            
            # Generate player ID mapping file needed by the bio script
            players_file = os.path.join(self.project_root, "public", "players.json")
            id_mapping_file = os.path.join(self.script_dir, "all_player_ids.json")
            
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
                bio_output = os.path.join(self.project_root, "players_bios_2025.json")
                if os.path.exists(bio_output):
                    with open(bio_output, 'r') as f:
                        bio_data = json.load(f)
                    self.log(f"   ✓ Fetched bio data for {len(bio_data)} players")
                    
                    # Now merge this bio data with the main player file
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
            source_file = os.path.join(self.project_root, "data", "players_merged_with_discoveries.json")
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
        """Step 6: Upload to Firebase (optional)"""
        if os.path.exists("serviceAccountKey.json") or os.environ.get('GOOGLE_APPLICATION_CREDENTIALS'):
            script_path = os.path.join(self.script_dir, "upload", "push_bio_and_contract.py")
            return self.run_script(script_path, "Upload to Firebase", required=False)
        else:
            self.log("No Firebase credentials - skipping upload", "WARNING")
            self.log("Place serviceAccountKey.json in project root to enable uploads")
            return True
    
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
            ("data/players_merged_with_discoveries.json", "New players discovered & merged"),
            ("data/raw_contract_html.json", "Contract data collected"),
            ("data/contracts_parsed.json", "Contract data parsed"),
            ("public/players.json", "Updated main player data")  # This is the actual final merged data file
        ]
        
        existing_files = 0
        for file_path, description in output_files:
            full_path = os.path.join(self.project_root, file_path)
            if os.path.exists(full_path):
                try:
                    with open(full_path, 'r') as f:
                        data = json.load(f)
                    count = len(data) if isinstance(data, dict) else len(data) if isinstance(data, list) else "N/A"
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
        self.log("Including new players, contracts, and data structure preparation")
        self.log("=" * 60)
        
        # Prerequisites check
        if not self.check_prerequisites():
            self.log("Prerequisites check failed - aborting pipeline", "ERROR")
            sys.exit(1)
        
        # Core pipeline steps - CORRECTED ORDER
        pipeline_steps = [
            self.discover_new_players,      # Step 1: Find all players (existing + new)
            self.update_bio_data,           # Step 2: Get fresh bio data (teams, positions, etc.)
            self.update_contracts,          # Step 3: SCRAPE contracts for ALL players (rookies + veterans)
            self.merge_player_data,         # Step 4: Merge all data sources
            self.update_main_player_file,   # Step 5: Copy merged data to main app file
            self.upload_to_firebase,        # Step 6: Upload to Firebase
            self.prepare_stats_structure,   # Step 7: Prepare stats structure
            self.validate_transition        # Step 8: Validate everything
        ]
        
        # Execute all steps
        for step_func in pipeline_steps:
            if not step_func():
                # Continue even if optional steps fail
                pass
        
        # Generate summary
        self.generate_summary_report()
        
        # Final timing
        duration = time.time() - start_time
        self.log(f"Pipeline completed in {duration:.1f} seconds", "PROGRESS")

def main():
    """Main entry point"""
    pipeline = SeasonTransitionPipeline()
    pipeline.run_full_pipeline()

if __name__ == "__main__":
    main()