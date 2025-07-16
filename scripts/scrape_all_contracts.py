import os
import json
import requests
import time
import unicodedata

# Manual overrides for edge cases
manual_slug_overrides = {
    "vit_krejci": "vit-krejci",
    "ronald_holland_ii": "ron-holland-ii",
    "nikola_jokic": "nikola-jokic",
    "kristaps_porzingis": "kristaps-porzingis",
    "dennis_schroder": "dennis-schroder",
    "dario_saric": "dario-saric",
    "vlatko_cancar": "vlatko-cancar",
    "luka_doncic": "luka-doncic",
    "moussa_diabate": "moussa-diabate",
    "bogdan_bogdanovic": "bogdan-bogdanovic",
    "karlo_matkovic": "karlo-matkovic",
    "vasilije_micic": "vasilije-micic",
    "monte_morris": "monte-morris",
    "nikola_jovic": "nikola-jovic",
    "nikola_vucevic": "nikola-vucevic",
    "jonas_valanciunas": "jonas-valanciunas",
    "tidjane_salaun": "tidjane-salaun",
    "lester_quinones": "lester-quinones",
    "brandon_boston": "brandon-boston-jr",
    "jimmy_butler_iii": "jimmy-butler",
    "bruce_brown": "bruce-brown-jr",
    "bub_carrington": "carlton-carrington",
    "cam_christie": "cameron-christie",
    "nic_claxton": "nicolas-claxton",
    "bones_hyland": "nahshon-bones-hyland",
    "gg_jackson": "gg-jackson-ii",
    "kj_martin": "kenyon-martinjr",
    "shake_milton": "malik-shake-milton",
    "svi_mykhailiuk": "sviatoslav-mykhailiuk",
    "cameron_payne": "cam-payne",
    "alex_sarr": "alexandre-sarr",
    "kj_simpson": "k-j-simpson",
    "tolu_smith": "tolu-smithiii",
    "xavier_tillman": "xavier-tillmansr",
    "jeenathan_williams": "nate-williams",
    "marvin_bagley_iii": "marvin-bagleyiii",
    "wendell_carter_jr": "wendell-carterjr",
    "jeff_dowtin_jr": "jeff-dowtin",
    "tim_hardaway_jr": "tim-hardawayjr",
    "daron_holmes_ii": "daron-holmes",
    "jaren_jackson_jr": "jaren-jacksonjr",
    "trey_jemison_iii": "trey-jemisoniii",
    "derrick_jones_jr": "derrick-jonesjr",
    "kevin_knox_ii": "kevin-knoxii",
    "larry_nance_jr": "larry-nancejr",
    "kelly_oubre_jr": "kelly-oubrejr",
    "gary_payton_ii": "gary-paytonii",
    "kevin_porter_jr": "kevin-porterjr",
    "michael_porter_jr": "michael-porterjr",
    "gary_trent_jr": "gary-trentjr",
    "lonnie_walker_iv": "lonnie-walkeriv",
    "robert_williams_iii": "robert-williamsiii",
    "jalen_hood-schifino": "jalen-hood-schifino",
    "trayce_jackson-davis": "trayce-jackson-davis",
    "trey_jemison_iii": "trey-jemison",
    "kevin_knox_ii": "kevin-knox",
    "kj_martin": "kenyon-martin-jr",
    "jeremiah_robinson-earl": "jeremiah-robinson-earl",
    "tolu_smith": "tolu-smith-iii",
    "xavier_tillman": "xavier-tillman-sr"
}


def normalize_slug(key):
    """Normalizes a player key to ASCII-safe slug, handling special cases."""
    # First check manual overrides
    if key in manual_slug_overrides:
        return manual_slug_overrides[key]
    
    # Handle standard cases
    ascii_key = unicodedata.normalize('NFKD', key).encode('ascii', 'ignore').decode('ascii')
    parts = ascii_key.split('_')
    
    # Remove hyphens from hyphenated last names (e.g., finney-smith -> finneysmith)
    if '-' in parts[-1]:
        last_name = parts[-1].replace('-', '')
        parts[-1] = last_name
    
    # Join with hyphens
    slug = '-'.join(parts)
    
    return slug

def get_player_url(slug):
    """Returns possible URL variations for a player slug."""
    variations = []
    
    # Base URL
    variations.append(f"https://www.salaryswish.com/players/{slug}")
    
    # For players with suffixes, try with and without hyphen before suffix
    suffix_list = ('jr', 'ii', 'iii', 'iv', 'sr')
    if any(suffix in slug for suffix in suffix_list):
        parts = slug.split('-')
        if len(parts) > 1:
            # Try with hyphen before suffix (if not already present)
            if not parts[-2].endswith(suffix_list) and not parts[-1].isdigit():
                new_slug = '-'.join(parts[:-1]) + parts[-1]
                variations.append(f"https://www.salaryswish.com/players/{new_slug}")
    
    return variations

# Load bios from JSON
with open("players_bios_2025.json", "r") as f:
    players = json.load(f)

output = {}
failed_players = []
total = len(players)

for idx, (key, player) in enumerate(players.items(), 1):
    name = key.replace("_", " ").title()
    slug = normalize_slug(key)
    url_variations = get_player_url(slug)
    
    print(f"[{idx}/{total}] Scraping {name}...")
    
    contract_html = None
    last_error = None
    
    for url in url_variations:
        try:
            res = requests.get(url)
            if res.status_code == 200:
                contract_html = res.text
                print(f"    ✓ Found at: {url}")
                break
            else:
                print(f"    ⚠️ Not found at: {url}")
        except Exception as e:
            last_error = str(e)
            print(f"    ⚠️ Error trying {url}: {e}")
    
    if contract_html:
        output[key] = {
            "name": name,
            "contractHtml": contract_html
        }
    else:
        print(f"❌ Failed all URL variations for {name}")
        failed_players.append(name)
    
    time.sleep(0.5)  # Be polite with requests

# Save final scraped data
with open("../data/raw_contract_html.json", "w") as f:
    json.dump(output, f, indent=2)

# Save list of failed players
if failed_players:
    with open("failed_players.txt", "w") as f:
        for name in failed_players:
            f.write(name + "\n")
    print(f"⚠️ {len(failed_players)} players failed. Logged to failed_players.txt")
else:
    print("✅ All players scraped successfully!")

print("✅ Done! Data saved to all_nba_players.json")