import os
import json
import logging
import re
import unicodedata
from difflib import get_close_matches

# Configure logging - only log warnings for failures
log_dir = "../data"
if not os.path.exists(log_dir):
    os.makedirs(log_dir, exist_ok=True)

logging.basicConfig(
    filename=os.path.join(log_dir, 'merge_log.txt'),
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
    """Load stats CSV and prepare normalized player ID mapping - simplified version without pandas"""
    if not os.path.exists(stats_path):
        print(f"⚠️  Stats file not found: {stats_path}")
        return {}
    
    try:
        import csv
        stat_map = {}
        
        with open(stats_path, 'r', encoding='utf-8', errors='replace') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                if 'Player' not in row:
                    continue
                    
                original_name = row['Player']
                player_id = normalize_player_id(original_name)
                
                # Skip if no games played
                games = row.get('G', '0')
                try:
                    if float(games) == 0:
                        continue
                except (ValueError, TypeError):
                    continue
                
                # Convert numeric fields
                stats = {}
                for col, val in row.items():
                    if col == 'Player':
                        continue
                    if val and val != '':
                        try:
                            # Try to convert to float
                            stats[col] = float(val)
                        except (ValueError, TypeError):
                            stats[col] = val
                
                stat_map[player_id] = {
                    "stats": stats,
                    "original_name": original_name,
                    "display_name": get_proper_display_name(player_id)
                }
        
        return stat_map
        
    except Exception as e:
        print(f"⚠️  Error loading stats CSV: {e}")
        return {}

def merge_player_data(contracts_path=None, bios_path=None, stats_path=None, output_path=None):
    """Main function to merge all data sources - works with available data"""
    
    # Default paths with fallbacks
    data_dir = "../data"
    if not os.path.exists(data_dir):
        os.makedirs(data_dir, exist_ok=True)
    
    # Try multiple sources for input data
    input_sources = [
        "../../public/players.json",
        "../public/players.json", 
        "../data/players.json",
        "players.json"
    ]
    
    base_players = None
    for source in input_sources:
        try:
            with open(source, "r") as f:
                base_players = json.load(f)
                print(f"✅ Loaded base player data from: {source}")
                break
        except FileNotFoundError:
            continue
    
    if base_players is None:
        print("❌ No base player data found. Tried:")
        for source in input_sources:
            print(f"  - {source}")
        return {}
    
    # Initialize data structures
    contracts = {}
    bios = {}
    stats_map = {}
    
    # Load contracts if available
    if contracts_path and os.path.exists(contracts_path):
        try:
            with open(contracts_path, "r") as f:
                contracts_data = json.load(f)
                print(f"✅ Loaded contracts from: {contracts_path}")
                # Convert to expected format if needed
                if isinstance(contracts_data, list):
                    contracts = {item.get("player_id", ""): item for item in contracts_data}
                else:
                    contracts = contracts_data
        except Exception as e:
            print(f"⚠️  Failed to load contracts: {e}")
    
    # Load bios if available
    if bios_path and os.path.exists(bios_path):
        try:
            with open(bios_path, "r") as f:
                bios = json.load(f)
                print(f"✅ Loaded bios from: {bios_path}")
        except Exception as e:
            print(f"⚠️  Failed to load bios: {e}")
    
    # Load stats if available
    if stats_path and os.path.exists(stats_path):
        try:
            stats_map = load_and_prepare_stats(stats_path)
            print(f"✅ Loaded stats from: {stats_path}")
        except Exception as e:
            print(f"⚠️  Failed to load stats: {e}")
    
    # Process base players data
    merged_players = {}
    
    for player_id, player_data in base_players.items():
        merged = {
            "player_id": player_id,
            "display_name": player_data.get("Name", get_proper_display_name(player_id)),
            "system": {}
        }
        
        # Copy base data fields (bio info)
        bio_fields = ["Name", "HT", "WT", "AGE", "Years Pro", "Team", "Position", "Contract", "Free Agent"]
        for field in bio_fields:
            if field in player_data:
                merged[field] = player_data[field]
        
        # Copy stats fields
        stats_fields = ["MIN", "PPG", "RPG", "APG", "FG%", "3PT%", "FT%", "EFG%", "Games Played"]
        stats_data = {}
        for field in stats_fields:
            if field in player_data:
                stats_data[field] = player_data[field]
        
        if stats_data:
            merged["system"]["stats"] = stats_data
        
        # Merge contract data if available
        if player_id in contracts:
            contract_info = contracts[player_id]
            for key, value in contract_info.items():
                if key not in merged:  # Don't overwrite existing data
                    merged[key] = value
        
        # Merge bio data if available
        if player_id in bios:
            bio_info = bios[player_id]
            if "bio" in bio_info:
                merged["bio"] = bio_info["bio"]
            if "status" in bio_info:
                merged["status"] = bio_info["status"]
        
        # Merge stats data if available
        normalized_id = normalize_player_id(player_id)
        if normalized_id in stats_map:
            merged["system"]["stats"] = stats_map[normalized_id]["stats"]
        
        merged_players[player_id] = merged
    
    # Set output path
    if not output_path:
        output_path = os.path.join(data_dir, "players_merged.json")
    
    # Save merged data
    with open(output_path, "w") as f:
        json.dump(merged_players, f, indent=2)
    
    print(f"\n{'='*50}")
    print(f"✅ Successfully processed {len(merged_players)} players")
    print(f"📁 Base data: {len(base_players)} players")
    print(f"📄 Contract data: {len(contracts)} entries")
    print(f"👤 Bio data: {len(bios)} entries") 
    print(f"📊 Stats data: {len(stats_map)} entries")
    print(f"💾 Output saved to {output_path}")
    print(f"{'='*50}")
    
    return merged_players

if __name__ == "__main__":
    DATA_DIR = "../data"
    
    # Check for available data files - use None if not found
    contracts_path = os.path.join(DATA_DIR, "contracts_parsed.json")
    if not os.path.exists(contracts_path):
        print(f"⚠️  Contracts file not found: {contracts_path}")
        contracts_path = None
    
    bios_path = os.path.join(DATA_DIR, "players_bios_2025.json")
    if not os.path.exists(bios_path):
        print(f"⚠️  Bios file not found: {bios_path}")
        bios_path = None
    
    stats_path = os.path.join(DATA_DIR, "nba_per_game_2025.csv")
    if not os.path.exists(stats_path):
        print(f"⚠️  Stats file not found: {stats_path}")
        stats_path = None
    
    output_path = os.path.join(DATA_DIR, "players_merged.json")
    
    print("🔄 Starting player data merge with available sources...")
    
    merged_data = merge_player_data(
        contracts_path=contracts_path,
        bios_path=bios_path,
        stats_path=stats_path,
        output_path=output_path
    )
    
    if merged_data:
        print("\n✅ Merge completed successfully!")
    else:
        print("\n❌ Merge failed!")
        exit(1)