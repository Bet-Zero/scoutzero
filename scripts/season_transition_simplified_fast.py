#!/usr/bin/env python3
"""
Simplified Season Transition - Fast version for user testing
Skips slow bio fetching and focuses on core functionality
"""

import subprocess
import os
import sys
import time

class SimplifiedSeasonTransition:
    def __init__(self):
        self.script_dir = os.path.dirname(os.path.abspath(__file__))
        self.project_root = os.path.dirname(self.script_dir)  # Go up from scripts/ to project root
        
    def log(self, message, level="INFO"):
        """Log messages with timestamp"""
        timestamp = time.strftime("%H:%M:%S")
        print(f"[{timestamp}] 🔹 {message}")
    
    def run_script(self, script_path, description, required=True, script_type="python"):
        """Execute a script with comprehensive error handling"""
        self.log(f"Step: {description}")
        
        try:
            if script_type == "python":
                cmd = ["python3", script_path]
            elif script_type == "node":
                cmd = ["node", script_path]
            else:
                raise ValueError(f"Unknown script type: {script_type}")
            
            result = subprocess.run(cmd, 
                                  capture_output=True, 
                                  text=True,
                                  cwd=self.project_root)
            
            if result.returncode == 0:
                self.log(f"✅ Completed: {description}")
                return True
            else:
                if required:
                    self.log(f"❌ Failed: {description}")
                    if result.stderr:
                        self.log(f"Error: {result.stderr}")
                    sys.exit(1)
                else:
                    self.log(f"⚠️  Optional step failed: {description}")
                    return False
                    
        except Exception as e:
            if required:
                self.log(f"❌ Exception in {description}: {e}")
                sys.exit(1)
            else:
                self.log(f"⚠️  Optional step exception: {description}: {e}")
                return False
    
    def check_prerequisites(self):
        """Verify required files and dependencies"""
        self.log("Checking prerequisites...")
        
        # Check main player data file
        player_file = os.path.join(self.project_root, "public", "players.json")
        if not os.path.exists(player_file):
            self.log(f"❌ Missing required file: {player_file}")
            return False
        self.log(f"✅ Found player data: {player_file}")
        
        # Check Python dependencies
        try:
            import firebase_admin
            self.log("✅ Python dependencies available")
        except ImportError:
            self.log("❌ Missing Python dependency: firebase_admin")
            return False
        
        # Create data directory if needed
        data_dir = os.path.join(self.project_root, "data")
        if not os.path.exists(data_dir):
            os.makedirs(data_dir)
            self.log(f"✅ Created data directory: {data_dir}")
        
        return True
    
    def run_simplified_transition(self):
        """Execute simplified season transition"""
        start_time = time.time()
        
        self.log("🏀 Starting Simplified NBA Season Transition")
        self.log("=" * 60)
        self.log("Fast version - skips slow bio fetching for user testing")
        self.log("=" * 60)
        
        # Prerequisites check
        if not self.check_prerequisites():
            self.log("Prerequisites check failed - aborting", "ERROR")
            sys.exit(1)
        
        # Step 1: Update contracts (this includes player discovery)
        contracts_script = os.path.join(self.script_dir, "updateContracts_enhanced.py")
        self.run_script(contracts_script, "Update contracts & merge player data")
        
        # Step 2: Update stats (merge available data)
        stats_script = os.path.join(self.script_dir, "update_stats.py")
        self.run_script(stats_script, "Update stats data")
        
        # Step 3: Generate cap sheets
        capsheets_script = os.path.join(self.script_dir, "capsheets", "generateCapSheets.js")
        self.run_script(capsheets_script, "Generate team cap sheets", required=False, script_type="node")
        
        # Success summary
        elapsed = time.time() - start_time
        self.log("🎉 Simplified Season Transition Complete!")
        self.log("=" * 60)
        self.log(f"⏱️  Total time: {elapsed:.1f} seconds")
        self.log("📁 Output files:")
        self.log("   ✅ data/players_merged.json - Updated player data")
        self.log("   ✅ data/contracts_parsed.json - Contract information")
        self.log("   ✅ data/team_cap_sheets.json - Team salary cap sheets")
        self.log("=" * 60)
        self.log("💡 Your player data is now updated for the new season!")
        self.log("💡 To enable Firebase uploads, place serviceAccountKey.json in project root")

def main():
    """Main entry point"""
    pipeline = SimplifiedSeasonTransition()
    pipeline.run_simplified_transition()

if __name__ == "__main__":
    main()