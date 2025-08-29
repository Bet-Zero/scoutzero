#!/usr/bin/env python3

import subprocess
import os

def run(script, type="python"):
    print(f"\n🔹 Running: {script}")
    try:
        if type == "python":
            subprocess.run(["python3", script], check=True)
        elif type == "node":
            subprocess.run(["node", script], check=True)
    except subprocess.CalledProcessError as e:
        print(f"❌ Error while running {script}: {e}")
        exit(1)

def main():
    base = os.path.dirname(__file__)  # current scripts/ path

    run(os.path.join(base, "contracts/scrape_all_contracts.py"))
    run(os.path.join(base, "contracts/parse_contract_data.py"))
    run(os.path.join(base, "merge/merge_universal_player_data.py"))
    run(os.path.join(base, "upload/push_bio_and_contract.py"))
    run(os.path.join(base, "capsheets/generateCapSheets.js"), type="node")

    print("\n✅ Contracts + CapSheets update complete.\n")

if __name__ == "__main__":
    main()