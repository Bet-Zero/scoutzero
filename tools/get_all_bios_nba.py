# ===============================================
# SCSP™ FULL FILE REPLACEMENT — tools/get_all_bios_nba.py
# ===============================================
#!/usr/bin/env python3
"""
NBA-only Bio Fetcher (no fallbacks)
- Reads player IDs from scripts/all_player_ids.json
- Fetches bios from stats.nba.com/commonplayerinfo
- Prints per-player progress live (✅/❌)
- Never aborts on a single timeout/error
- Saves to data/players_bios_2025.json (merge can ingest)
"""

from __future__ import annotations

import json
import math
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional

import requests
from requests.adapters import HTTPAdapter
from requests.exceptions import (
    ReadTimeout,
    ConnectTimeout,
    ConnectionError as ReqConnectionError,
)
from urllib3.util.retry import Retry

# ---------- PATHS ----------
PROJECT_ROOT = Path(__file__).resolve().parent.parent  # tools/ -> project root
PLAYER_ID_FILE = PROJECT_ROOT / "scripts" / "all_player_ids.json"
OUTPUT_DIR = PROJECT_ROOT / "data"
OUTPUT_FILE = OUTPUT_DIR / "players_bios_2025.json"
EXISTING_PLAYERS_FILE = PROJECT_ROOT / "public" / "players.json"  # optional, not used for fallbacks

# ---------- NBA ENDPOINT ----------
NBA_URL = "https://stats.nba.com/stats/commonplayerinfo"

# ---------- SESSION / RETRIES ----------
def make_session() -> requests.Session:
    """Create a requests session with robust retries for connect/read/timeouts."""
    s = requests.Session()
    retries = Retry(
        total=6,
        connect=6,
        read=6,
        backoff_factor=0.8,  # 0.8, 1.6, 3.2, ...
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=["GET"],
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retries, pool_connections=50, pool_maxsize=50)
    s.mount("https://", adapter)
    s.mount("http://", adapter)
    return s

def nba_headers(player_id: str) -> Dict[str, str]:
    """Headers that minimize 403/blocked responses."""
    return {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Origin": "https://www.nba.com",
        "Referer": f"https://www.nba.com/player/{player_id}",
        "x-nba-stats-origin": "stats",
        "x-nba-stats-token": "true",
        # extra hints some networks expect
        "Sec-Fetch-Site": "same-site",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Dest": "empty",
        "Connection": "keep-alive",
        "Pragma": "no-cache",
        "Cache-Control": "no-cache",
    }

# ---------- HELPERS ----------
def calc_age(birthdate_iso: Optional[str]) -> Optional[int]:
    if not birthdate_iso:
        return None
    try:
        d = birthdate_iso.split("T")[0]
        b = datetime.strptime(d, "%Y-%m-%d").date()
        t = datetime.today().date()
        return t.year - b.year - ((t.month, t.day) < (b.month, b.day))
    except Exception:
        return None

def fetch_bio_from_nba(session: requests.Session, player_id: str, timeout_s: float = 25.0) -> Optional[Dict[str, Any]]:
    """Fetch a single player's bio from stats.nba.com. Returns dict or None on failure."""
    params = {"PlayerID": player_id}
    try:
        r = session.get(NBA_URL, headers=nba_headers(player_id), params=params, timeout=timeout_s)
    except (ReadTimeout, ConnectTimeout, ReqConnectionError):
        return None

    if r.status_code != 200:
        return None

    try:
        data = r.json()
    except Exception:
        return None

    sets = data.get("resultSets") or []
    if not sets:
        return None

    rs0 = sets[0]
    headers = rs0.get("headers") or []
    rows = rs0.get("rowSet") or []
    if not rows:
        return None

    row = rows[0]
    mapped = {h: row[i] if i < len(row) else None for i, h in enumerate(headers)}

    team_name = (mapped.get("TEAM_NAME") or "").strip()
    season_exp = mapped.get("SEASON_EXP")
    if isinstance(season_exp, str) and season_exp.isdigit():
        season_exp = int(season_exp)

    return {
        "HT": mapped.get("HEIGHT") or "",
        "WT": str(mapped.get("WEIGHT")) if mapped.get("WEIGHT") is not None else "",
        "AGE": calc_age(mapped.get("BIRTHDATE")),
        "Years Pro": season_exp if isinstance(season_exp, (int, float)) else None,
        "Team": team_name.split()[-1] if team_name else "",
        "Position": mapped.get("POSITION") or "",
    }

# ---------- MAIN ----------
def main() -> int:
    # Make sure paths exist
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Load player IDs
    if not PLAYER_ID_FILE.exists():
        print(f"❌ Player ID file not found: {PLAYER_ID_FILE}")
        print("   (Run your pipeline step that generates scripts/all_player_ids.json)")
        return 1

    try:
        with open(PLAYER_ID_FILE, "r", encoding="utf-8") as f:
            player_ids: Dict[str, Any] = json.load(f)
    except Exception as e:
        print(f"❌ Failed to read {PLAYER_ID_FILE}: {e}")
        return 1

    total = len(player_ids)
    print("🚀 Starting NBA bio fetch (no fallbacks)…")
    print("📁 Output:", OUTPUT_FILE)
    print(f"🔁 Fetching NBA bios for {total} players (no fallbacks)…")
    print("📊 Progress will be shown as players are processed...")

    # Optional: verify we can read existing players (not used as fallback)
    if EXISTING_PLAYERS_FILE.exists():
        try:
            with open(EXISTING_PLAYERS_FILE, "r", encoding="utf-8") as f:
                _ = json.load(f)
        except Exception:
            pass

    session = make_session()
    bios: Dict[str, Dict[str, Any]] = {}
    ok = 0
    fail = 0

    # ~2 req/sec + tiny jitter to avoid burst patterns
    per_call_sleep = 0.48

    # Iterate deterministically for reproducible ordering
    items = list(player_ids.items())

    for i, (name_key, pid) in enumerate(items, 1):
        pid_str = str(pid)
        # print the line header before calling the network, so you see immediate movement
        print(f"🧠 [{i}/{total}] {name_key} (ID {pid_str}) … ", end="", flush=True)

        bio: Optional[Dict[str, Any]] = None
        try:
            bio = fetch_bio_from_nba(session, pid_str, timeout_s=25.0)
        except Exception:
            bio = None  # hard guard — never crash on a single player

        if bio and any(v not in (None, "", "None") for v in bio.values()):
            bios[name_key] = {"bio": bio}
            ok += 1
            # Nice inline detail: show team + position if available
            team = bio.get("Team") or ""
            pos = bio.get("Position") or ""
            extra = f" ({team} – {pos})" if team or pos else ""
            print(f"✅{extra}")
        else:
            fail += 1
            print("❌")

        # pacing
        time.sleep(per_call_sleep + (0.06 * math.sin(i)))

        # periodic snapshot
        if i % 50 == 0:
            print(f"📊 Progress: {i}/{total} | successes: {ok} | failures: {fail}")

    # Save results
    try:
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(bios, f, indent=2)
    except Exception as e:
        print(f"❌ Failed to write {OUTPUT_FILE}: {e}")
        return 1

    print("\n🎉 Done!")
    print(f"   ✅ Success: {ok}")
    print(f"   ❌ Failures: {fail}")
    print(f"📁 Saved to: {OUTPUT_FILE}")
    return 0

if __name__ == "__main__":
    # Force unbuffered stdout if invoked as a subprocess that might buffer output
    # (also recommend running `python3 -u tools/get_all_bios_nba.py` from the shell)
    try:
        sys.stdout.reconfigure(line_buffering=True)
    except Exception:
        pass
    sys.exit(main())
# ===============================================
