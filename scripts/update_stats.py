#!/usr/bin/env python3

import subprocess
import os

def run(script):
    print(f"\n🔹 Running: {script}")
    try:
        subprocess.run(["python3", script], check=True)
    except subprocess.CalledProcessError as e:
        print(f"❌ Error while running {script}: {e}")
        exit(1)

def main():
    base = os.path.dirname(__file__)  # current scripts/ path

    run(os.path.join(base, "merge/merge_universal_player_data.py"))
    run(os.path.join(base, "upload/push_stat_data.py"))

    print("\n✅ Stat update complete.\n")

if __name__ == "__main__":
    main()
