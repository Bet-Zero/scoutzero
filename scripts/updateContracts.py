#!/usr/bin/env python3

import subprocess
import os

def run(script, type="python", required=True):
    print(f"\n🔹 Running: {script}")
    try:
        if type == "python":
            subprocess.run(["python3", script], check=True)
        elif type == "node":
            subprocess.run(["node", script], check=True)
    except subprocess.CalledProcessError as e:
        if required:
            print(f"❌ Error while running {script}: {e}")
            exit(1)
        else:
            print(f"⚠️ Optional step failed {script}: {e}")
            print("💡 This is expected if Firebase credentials are not configured")

def main():
    base = os.path.dirname(__file__)  # current scripts/ path

    # Core pipeline steps (required)
    run(os.path.join(base, "contracts/scrape_all_contracts.py"))
    run(os.path.join(base, "contracts/parse_contract_data.py"))
    run(os.path.join(base, "merge/merge_universal_player_data.py"))
    
    # Firebase upload (optional - may fail without credentials)
    run(os.path.join(base, "upload/push_bio_and_contract.py"), required=False)
    
    # Cap sheets generation (optional - may fail without Firebase access)
    run(os.path.join(base, "capsheets/generateCapSheets.js"), type="node", required=False)

    print("\n✅ Contract update pipeline complete.")
    print("💡 If Firebase steps failed, provide credentials at src/serviceAccountKey.json")

if __name__ == "__main__":
    main()