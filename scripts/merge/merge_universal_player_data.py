import os
import json
import pandas as pd
import logging
import re
import unicodedata
from difflib import get_close_matches

# Configure logging - only log warnings for failures
logging.basicConfig(
    filename='../data/merge_log.txt',
    level=logging.WARNING,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

CURRENT_YEAR = 2025

def format_display_name(name):
    """Capitalize suffixes in final display names (II, III, Jr, etc.)"""
    if not isinstance(name, str):
        return ""
        
    suffixes = {
        ' ii': ' II',
        ' iii': ' III',
        ' iv': ' IV',
        ' jr': ' Jr',
        ' sr': ' Sr'
    }
    for suffix, replacement in suffixes.items():
        if name.lower().endswith(suffix):
            return name[:-len(suffix)].strip() + replacement
    return name

# Alias list for mismatched keys (converted to underscore format)
alias_map = {
    "vit_krejci": "vit_krejci",
    "ron_holland": "ronald_holland_ii",
    "jimmy_butler": "jimmy_butler_iii",
    "trey_jemison": "trey_jemison_iii",
    "luka_doni": "luka_doncic",
    "dario_ari": "dario_saric",
    "deaaron_fox": "de'aaron_fox",
    "deandre_hunter": "de'andre_hunter",
    "pj_washington": "p.j._washington",
    "dangelo_russell": "d'angelo_russell",
    "deanthony_melton": "de'anthony_melton",
    "kelel_ware": "kel'el_ware",
    "royce_oneale": "royce_o'neale",
    "jakobe_walter": "ja'kobe_walter",
    "dayron_sharpe": "day'ron_sharpe",
    "naeqwan_tomlin": "nae'qwan_tomlin",
    "jaesean_tate": "jae'sean_tate",
    "dj_carton": "d.j._carton",
    "nfaly_dante": "n'faly_dante",
}

# Full special_cases dictionary (converted to underscore format)
special_cases = {
    # International characters
    "moussa_diabaté": "Moussa Diabaté",
    "nikola_jović": "Nikola Jović",
    "karlo_matković": "Karlo Matković",
    "vasilije_micić": "Vasilije Micić",
    "jusuf_nurkić": "Jusuf Nurkić",
    "lester_quiñones": "Lester Quiñones",
    "tidjane_salaün": "Tidjane Salaün",
    "dennis_schröder": "Dennis Schröder",
    "alperen_şengün": "Alperen Şengün",
    "jonas_valančiūnas": "Jonas Valančiūnas",
    "nikola_vučević": "Nikola Vučević",
    "luka_dončić": "Luka Dončić",
    "xavier_tillman": "Xavier Tillman Sr",
    "brandon_boston": "Brandon Boston Jr",

    # ASCII fallbacks
    "moussa_diabate": "Moussa Diabaté",
    "nikola_jovic": "Nikola Jović",
    "karlo_matkovic": "Karlo Matković",
    "vasilije_micic": "Vasilije Micić",
    "jusuf_nurkic": "Jusuf Nurkić",
    "lester_quinones": "Lester Quiñones",
    "tidjane_salaun": "Tidjane Salaün",
    "dennis_schroder": "Dennis Schröder",
    "alperen_sengun": "Alperen Şengün",
    "jonas_valanciunas": "Jonas Valančiūnas",
    "nikola_vucevic": "Nikola Vučević",
    "luka_doncic": "Luka Dončić",
    "dario_saric": "Dario Šarić",
    
    # Add the specific CSV encoding variants
    "luka_doni": "Luka Dončić",
    "dario_ari": "Dario Šarić",
    
    # Suffixes and special cases
    "gg_jackson_ii": "GG Jackson II",
    "xavier_tillman_sr": "Xavier Tillman Sr.",
    "brandon_boston_jr": "Brandon Boston Jr.",
    "ron_holland_ii": "Ronald Holland II",
    "trey_murphy_iii": "Trey Murphy III",
    "lonnie_walker_iv": "Lonnie Walker IV",
    "dereck_lively_ii": "Dereck Lively II",
    "lindy_waters_iii": "Lindy Waters III",
    "marvin_bagley_iii": "Marvin Bagley III",
    
    # Bi-capitalization and special characters
    "lamelo_ball": "LaMelo Ball",
    "lebron_james": "LeBron James",
    "demar_derozan": "DeMar DeRozan",
    "de'aaron_fox": "De'Aaron Fox",
    "deaaron_fox": "De'Aaron Fox",
    "zach_lavine": "Zach LaVine",
    "cj_mccollum": "CJ McCollum",
    "og_anunoby": "OG Anunoby",
    "de'andre_hunter": "De'Andre Hunter",
    "deandre_hunter": "De'Andre Hunter",
    "p.j._washington": "P.J. Washington",
    "pj_washington": "P.J. Washington",
    "fred_vanvleet": "Fred VanVleet",
    "d'angelo_russell": "D'Angelo Russell",
    "dangelo_russell": "D'Angelo Russell",
    "rj_barrett": "RJ Barrett",
    "jaren_jackson_jr": "Jaren Jackson Jr",
    "michael_porter_jr": "Michael Porter Jr",
    "kelly_oubre_jr": "Kelly Oubre Jr",
    "jaden_mcdaniels": "Jaden McDaniels",
    "jabari_smith_jr": "Jabari Smith Jr",
    "caris_levert": "Caris LeVert",
    "donte_divincenzo": "Donte DiVincenzo",
    "gary_trent_jr": "Gary Trent Jr",
    "tim_hardaway_jr": "Tim Hardaway Jr",
    "kevin_porter_jr": "Kevin Porter Jr",
    "de'anthony_melton": "De'Anthony Melton",
    "deanthony_melton": "De'Anthony Melton",
    "keion_brooks_jr": "Keion Brooks Jr",
    "derrick_jones_jr": "Derrick Jones Jr",
    "scotty_pippen_jr": "Scotty Pippen Jr",
    "nick_smith_jr": "Nick Smith Jr",
    "miles_mcbride": "Miles McBride",
    "nickeil_alexander-walker": "Nickeil Alexander-Walker",
    "kel'el_ware": "Kel'el Ware",
    "kelel_ware": "Kel'el Ware",
    "wendell_carter_jr": "Wendell Carter Jr",
    "a.j._lawson": "A.J. Lawson",
    "aj_lawson": "A.J. Lawson",
    "t.j._mcconnell": "T.J. McConnell",
    "tj_mcconnell": "T.J. McConnell",
    "royce_o'neale": "Royce O'Neale",
    "royce_oneale": "Royce O'Neale",
    "dorian_finney-smith": "Dorian Finney-Smith",
    "kentavious_caldwell-pope": "Kentavious Caldwell-Pope",
    "jaime_jaquez_jr": "Jaime Jaquez Jr",
    "ja'kobe_walter": "Ja'Kobe Walter",
    "jakobe_walter": "Ja'Kobe Walter",
    "larry_nance_jr": "Larry Nance Jr",
    "day'ron_sharpe": "Day'Ron Sharpe",
    "dayron_sharpe": "Day'Ron Sharpe",
    "kj_simpson": "KJ Simpson",
    "aj_johnson": "AJ Johnson",
    "a.j._green": "A.J. Green",
    "aj_green": "A.J. Green",
    "ricky_council_iv": "Ricky Council IV",
    "nae'qwan_tomlin": "Nae'Qwan Tomlin",
    "naeqwan_tomlin": "Nae'Qwan Tomlin",
    "jalen_hood-schifino": "Jalen Hood-Schifino",
    "jake_laravia": "Jake LaRavia",
    "daquan_jeffries": "DaQuan Jeffries",
    "trayce_jackson-davis": "Trayce Jackson-Davis",
    "vince_williams_jr": "Vince Williams Jr",
    "talen_horton-tucker": "Talen Horton-Tucker",
    "gary_payton_ii": "Gary Payton II",
    "kj_martin": "KJ Martin",
    "jeremiah_robinson-earl": "Jeremiah Robinson-Earl",
    "n'faly_dante": "N'Faly Dante",
    "nfaly_dante": "N'Faly Dante",
    "terrence_shannon_jr": "Terrence Shannon Jr",
    "wendell_moore_jr": "Wendell Moore Jr",
    "ron_harper_jr": "Ron Harper Jr",
    "olivier-maxence_prosper": "Olivier-Maxence Prosper",
    "deandre_jordan": "DeAndre Jordan",
    "craig_porter_jr": "Craig Porter Jr",
    "jt_thor": "JT Thor",
    "jae'sean_tate": "Jae'Sean Tate",
    "jaesean_tate": "Jae'Sean Tate",
    "doug_mcdermott": "Doug McDermott",
    "andre_jackson_jr": "Andre Jackson Jr",
    "p.j._tucker": "P.J. Tucker",
    "pj_tucker": "P.J. Tucker",
    "rayj_dennis": "RayJ Dennis",
    "david_duke_jr": "David Duke Jr",
    "marjon_beauchamp": "MarJon Beauchamp",
    "patrick_baldwin_jr": "Patrick Baldwin Jr",
    "tyty_washington_jr": "TyTy Washington Jr",
    "jordan_mclaughlin": "Jordan McLaughlin",
    "jd_davison": "JD Davison",
    "ej_liddell": "EJ Liddell",
    "pj_hall": "PJ Hall",
    "jack_mcveigh": "Jack McVeigh",
    "kevin_mccullar_jr": "Kevin McCullar Jr",
    "bryce_mcgowens": "Bryce McGowens",
    "d.j._carton": "D.J. Carton",
    "dj_carton": "D.J. Carton",
    "pj_dozier": "PJ Dozier",
    "mac_mcclung": "Mac McClung",
    "jalen_mcdaniels": "Jalen McDaniels",
    "shai_gilgeous-alexander": "Shai Gilgeous-Alexander",
    "jeenathan_williams": "Nate Williams",
    "karl-anthony_towns": "Karl-Anthony Towns"
}

def normalize_player_id(name):
    """
    Convert player names to consistent underscore-separated IDs.
    Handles special characters, suffixes, and known aliases.
    """
    if not isinstance(name, str):
        return ""
    
    if "_i_" in name:
        name = name.replace("_i_", "ci")
        
    if "*ari*" in name:
        name = name.replace("*ari*", "sari")
    
    name = unicodedata.normalize("NFKD", name)
    name = ''.join(c for c in name if not unicodedata.combining(c))
    
    normalized = name.lower()
    normalized = re.sub(r"[^a-zA-Z0-9' ]", "", normalized).strip()
    normalized = re.sub(r"\s(jr|sr|ii|iii|iv|v|\.)", "", normalized)
    normalized = normalized.replace(" ", "_")
    normalized_no_apostrophe = normalized.replace("'", "")
    
    if normalized in alias_map:
        return alias_map[normalized]
    elif normalized_no_apostrophe in alias_map:
        return alias_map[normalized_no_apostrophe]
    
    return normalized

def get_proper_display_name(player_id):
    """Convert player_id to properly formatted display name using all special cases"""
    lookup_id = player_id.lower().replace("-", "_")
    lookup_with_apostrophes = lookup_id
    lookup_without_apostrophes = lookup_id.replace("'", "").replace(".", "")
    
    if lookup_with_apostrophes in special_cases:
        return special_cases[lookup_with_apostrophes]
    elif lookup_without_apostrophes in special_cases:
        return special_cases[lookup_without_apostrophes]
    
    parts = player_id.split("_")
    if len(parts) > 1 and parts[-1] in ["jr", "sr", "ii", "iii", "iv"]:
        base = " ".join(parts[:-1]).title()
        suffix = parts[-1].upper() if parts[-1] in ["ii", "iii", "iv"] else parts[-1].title()
        return f"{base} {suffix}"
    
    return " ".join(parts).title()

def load_and_prepare_stats(stats_path):
    """Load stats CSV and prepare normalized player ID mapping"""
    try:
        stats_df = pd.read_csv(stats_path, encoding="ISO-8859-1")
    except:
        stats_df = pd.read_csv(stats_path, encoding="utf-8", errors="replace")
    
    problematic_players = ["Don_i_", "*ari*"]
    for term in problematic_players:
        matches = stats_df[stats_df["Player"].str.contains(term, na=False, regex=False)]
        if not matches.empty:
            for _, row in matches.iterrows():
                original_name = row["Player"]
                normalized = normalize_player_id(original_name)
                logging.info(f"Special case - Player '{original_name}' normalized to '{normalized}'")
    
    stat_map = {}
    
    for _, row in stats_df.iterrows():
        original_name = row["Player"]
        player_id = normalize_player_id(original_name)
        
        if pd.isna(row["G"]) or row["G"] == 0:
            continue
            
        stats = {
            col: float(val) if isinstance(val, (int, float)) or str(val).replace('.', '', 1).isdigit() else val
            for col, val in row.items()
            if col != "Player" and not pd.isna(val)
        }
        
        stat_map[player_id] = {
            "stats": stats,
            "original_name": original_name,
            "display_name": get_proper_display_name(player_id)
        }
    
    return stat_map

def merge_player_data(contracts_path, bios_path, stats_path, output_path):
    """Main function to merge all data sources"""
    with open(contracts_path, "r") as f:
        contracts = json.load(f)
    
    with open(bios_path, "r") as f:
        bios = json.load(f)
    
    logging.info("Starting to load stats CSV...")
    try:
        stat_map = load_and_prepare_stats(stats_path)
    except Exception as e:
        logging.error(f"Error loading stats: {e}")
        raise
        
    merged_players = {}
    stats_matches = 0
    stats_misses = []
    bios_matches = 0
    bios_misses = []
    
    # Known injured players who won't have stats but should have bios and contracts
    injured_players = {
        "saddiq_bey": {"status": "Injured - Torn ACL", "games_played": 0},
        "daron_holmes_ii": {"status": "Injured - Foot Fracture", "games_played": 0},
        "nikola_topic": {"status": "Injured - Knee Surgery", "games_played": 0}
    }
    
    for player in contracts:
        player_id = player["player_id"]
        merged = player.copy()
        merged["system"] = merged.get("system", {})
        merged["display_name"] = get_proper_display_name(player_id)
        
        # Handle injured players first
        if player_id in injured_players:
            merged["system"]["stats"] = {
                "status": injured_players[player_id]["status"],
                "G": injured_players[player_id]["games_played"],
                "note": "Injured - No stats available for current season"
            }
            stats_misses.append(player_id)
        else:
            # Try to match stats for non-injured players
            normalized_id = normalize_player_id(player_id)
            
            if player_id == "luka_doncic":
                normalized_id = "luka_doni"
                if "luka_doni" in stat_map:
                    merged["system"]["stats"] = stat_map["luka_doni"]["stats"]
                    stats_matches += 1
                else:
                    stats_misses.append(player_id)
                    logging.warning(f"Manual match for Luka Dončić failed")
            elif player_id == "dario_saric":
                normalized_id = "dario_ari"
                if "dario_ari" in stat_map:
                    merged["system"]["stats"] = stat_map["dario_ari"]["stats"]
                    stats_matches += 1
                else:
                    stats_misses.append(player_id)
                    logging.warning(f"Manual match for Dario Šarić failed")
            elif normalized_id in stat_map:
                merged["system"]["stats"] = stat_map[normalized_id]["stats"]
                stats_matches += 1
            else:
                possible_matches = get_close_matches(
                    normalized_id, stat_map.keys(), n=1, cutoff=0.85
                )
                if possible_matches:
                    matched_id = possible_matches[0]
                    merged["system"]["stats"] = stat_map[matched_id]["stats"]
                    stats_matches += 1
                else:
                    stats_misses.append(player_id)
                    logging.warning(f"No stats match for: {player_id} ({merged['display_name']})")
        
        # Attach bio information (for all players, including injured ones)
        if player_id in bios:
            merged.update({
                "bio": bios[player_id].get("bio", {}),
                "status": bios[player_id].get("status")
            })
            bios_matches += 1
        else:
            bios_misses.append(player_id)
            logging.warning(f"No bio match for: {player_id} ({merged['display_name']})")
        
        merged_players[player_id] = merged
    
    with open(output_path, "w") as f:
        json.dump(merged_players, f, indent=2)
    
    print(f"\n{'='*50}")
    print(f"✅ Successfully merged {len(contracts)} players")
    print(f"📊 Stats attached: {stats_matches}/{len(contracts)}")
    print(f"👤 Bios attached: {bios_matches}/{len(contracts)}")
    print(f"{'='*50}")
    
    if stats_misses:
        print("\n⚠️ Players missing stats:")
        for i, pid in enumerate(stats_misses, 1):
            print(f"{i}. {pid} ({get_proper_display_name(pid)})")
    
    if bios_misses:
        print("\n⚠️ Players missing bios:")
        for i, pid in enumerate(bios_misses, 1):
            print(f"{i}. {pid} ({get_proper_display_name(pid)})")
    
    print(f"\n💾 Output saved to {output_path}")
    return merged_players

if __name__ == "__main__":
    DATA_DIR = "../data"
    contracts_path = os.path.join(DATA_DIR, "contracts_parsed.json")
    bios_path = os.path.join(DATA_DIR, "players_bios_2025.json")
    stats_path = os.path.join(DATA_DIR, "nba_per_game_2025.csv")
    output_path = os.path.join(DATA_DIR, "players.json")
    
    merge_player_data(
        contracts_path=contracts_path,
        bios_path=bios_path,
        stats_path=stats_path,
        output_path=output_path
    )