#!/usr/bin/env python3

import subprocess
import os

def run(script, required=True):
    print(f"\n🔹 Running: {script}")
    try:
        subprocess.run(["python3", script], check=True)
    except subprocess.CalledProcessError as e:
        if required:
            print(f"❌ Error while running {script}: {e}")
            exit(1)
        else:
            print(f"⚠️ Optional step failed {script}: {e}")
            print("💡 This is expected if Firebase credentials are not configured")

def main():
    base = os.path.dirname(__file__)  # current scripts/ path

    # Merge data (using existing contract data)
    run(os.path.join(base, "merge/merge_universal_player_data.py"))
    
    # Firebase upload (optional - may fail without credentials)
    run(os.path.join(base, "upload/push_stat_data.py"), required=False)

    print("\n✅ Stats update pipeline complete.")
    print("💡 If Firebase steps failed, provide credentials at src/serviceAccountKey.json")

if __name__ == "__main__":
    main()