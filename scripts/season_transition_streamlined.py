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
        """Step 2: Update contract information"""
        script_path = os.path.join(self.script_dir, "updateContracts_enhanced.py")
        return self.run_script(script_path, "Update contract data (with fallbacks)")
    
    def merge_player_data(self):
        """Step 3: Merge all player data"""
        script_path = os.path.join(self.script_dir, "merge", "merge_universal_player_data.py")
        return self.run_script(script_path, "Merge universal player data")
    
    def upload_to_firebase(self):
        """Step 4: Upload to Firebase (optional)"""
        if os.path.exists("serviceAccountKey.json") or os.environ.get('GOOGLE_APPLICATION_CREDENTIALS'):
            script_path = os.path.join(self.script_dir, "upload", "push_bio_and_contract.py")
            return self.run_script(script_path, "Upload to Firebase", required=False)
        else:
            self.log("No Firebase credentials - skipping upload", "WARNING")
            self.log("Place serviceAccountKey.json in project root to enable uploads")
            return True
    
    def prepare_stats_structure(self):
        """Step 5: Prepare stats structure for new season"""
        script_path = os.path.join(self.script_dir, "prepare_new_season_stats.py")
        return self.run_script(script_path, "Prepare 2025-26 stats structure", required=False)
    
    def validate_transition(self):
        """Step 6: Validate the transition"""
        script_path = os.path.join(self.script_dir, "validate_season_transition.py")
        return self.run_script(script_path, "Validate season transition", required=False)
    
    def generate_summary_report(self):
        """Generate final summary of the transition"""
        self.log("Generating 2025-26 Season Transition Summary", "PROGRESS")
        
        # Check output files
        output_files = [
            ("data/players_merged_with_discoveries.json", "New players discovered & merged"),
            ("data/raw_contract_html.json", "Contract data collected"),
            ("data/contracts_parsed.json", "Contract data parsed"),
            ("data/players_merged.json", "Final merged player data")
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
        
        # Core pipeline steps
        pipeline_steps = [
            self.discover_new_players,
            self.update_contracts,
            self.merge_player_data,
            self.upload_to_firebase,
            self.prepare_stats_structure,
            self.validate_transition
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