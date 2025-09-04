#!/usr/bin/env python3
"""
Contract Scraping with Fallback - Enhanced for 2025-26 Season
Tests external scraping service availability. If working, scrapes all players.
If not working, uses existing contract data without redundant NBA API calls.
"""

import os
import json
import requests
import time
import unicodedata
import re

# Manual overrides for edge cases (same as original)
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
    # ... (other entries from original file)
}

def normalize_slug(name):
    """Convert player name to URL-friendly slug"""
    slug = unicodedata.normalize("NFD", name.lower())
    slug = "".join(c for c in slug if unicodedata.category(c) != "Mn")
    slug = re.sub(r"[^\w\s-]", "", slug).strip()
    slug = re.sub(r"[-\s]+", "-", slug)
    
    return manual_slug_overrides.get(name, slug)

def generate_url_variants(player_key, player_name):
    """Generate multiple URL variants for a player name to handle inconsistent patterns"""
    base_name = player_name.lower().strip()
    variants = []
    
    # Start with the player_key as baseline (underscores to hyphens)
    baseline = player_key.replace("_", "-")
    variants.append(baseline)
    
    # Generate variants for the actual name
    name_variants = []
    
    # Clean the name and create base variant - FIXED: Remove Unicode chars first
    clean_name = re.sub(r'[^\w\s\-.]', '', base_name)
    # Also create ASCII-only version by removing diacritics
    ascii_name = unicodedata.normalize('NFD', base_name)
    ascii_name = ''.join(c for c in ascii_name if unicodedata.category(c) != 'Mn')
    ascii_name = re.sub(r'[^\w\s\-.]', '', ascii_name)
    
    base_variant = re.sub(r'[-\s]+', '-', clean_name)
    ascii_variant = re.sub(r'[-\s]+', '-', ascii_name)
    
    name_variants.append(base_variant)
    if ascii_variant != base_variant:
        name_variants.append(ascii_variant)
    
    # Handle suffixes (Jr, Sr, II, III, etc.)
    suffix_patterns = [
        # Jr variations
        (r'\b(jr\.?|junior)\b', ['-jr', 'jr']),
        (r'\b(sr\.?|senior)\b', ['-sr', 'sr']),
        # Roman numerals
        (r'\b(ii)\b', ['-ii', 'ii']),
        (r'\b(iii)\b', ['-iii', 'iii']),
        (r'\b(iv)\b', ['-iv', 'iv']),
    ]
    
    for pattern, replacements in suffix_patterns:
        if re.search(pattern, clean_name):
            for replacement in replacements:
                variant = re.sub(pattern, replacement, clean_name)
                variant = re.sub(r'[-\s]+', '-', variant)
                name_variants.append(variant)
        if re.search(pattern, ascii_name):
            for replacement in replacements:
                variant = re.sub(pattern, replacement, ascii_name)
                variant = re.sub(r'[-\s]+', '-', variant)
                name_variants.append(variant)
    
    # Handle hyphenated last names
    if '-' in player_name and ' ' in player_name:
        # Try with and without spaces around hyphens
        no_space_hyphens = re.sub(r'\s*-\s*', '-', clean_name)
        no_space_hyphens = re.sub(r'[-\s]+', '-', no_space_hyphens)
        name_variants.append(no_space_hyphens)
        
        ascii_no_space = re.sub(r'\s*-\s*', '-', ascii_name)
        ascii_no_space = re.sub(r'[-\s]+', '-', ascii_no_space)
        name_variants.append(ascii_no_space)
        
        # Try removing internal hyphens
        no_internal_hyphens = re.sub(r'(?<!^)(?<!-)(-)+(?!$)', '', clean_name)
        no_internal_hyphens = re.sub(r'[-\s]+', '-', no_internal_hyphens)
        name_variants.append(no_internal_hyphens)
        
        ascii_no_internal = re.sub(r'(?<!^)(?<!-)(-)+(?!$)', '', ascii_name)
        ascii_no_internal = re.sub(r'[-\s]+', '-', ascii_no_internal)
        name_variants.append(ascii_no_internal)
    
    # Add all name variants to main variants list
    variants.extend(name_variants)
    
    # Remove duplicates while preserving order
    seen = set()
    unique_variants = []
    for variant in variants:
        variant = variant.strip('-')  # Clean leading/trailing hyphens
        if variant and variant not in seen:
            seen.add(variant)
            unique_variants.append(variant)
    
    return unique_variants

def try_scrape_contract_with_fallbacks(player_key, player_data, max_attempts=2):
    """Try to scrape contract data with multiple URL variants"""
    name = player_data.get("Name", "").strip() or player_key.replace("_", " ").title()
    
    # Generate all possible URL variants
    url_variants = generate_url_variants(player_key, name)
    
    print(f"    🔍 Trying {len(url_variants)} URL variants for {name}")
    
    for i, slug in enumerate(url_variants):
        url = f"https://www.salaryswish.com/players/{slug}"
        
        for attempt in range(max_attempts):
            try:
                response = requests.get(url, timeout=10)
                if response.status_code == 200:
                    # Check if we got a real player page (not "Player not found")
                    if "Player not found" not in response.text:
                        print(f"    ✅ Found contract data for {name} at variant {i+1}: {slug}")
                        return {
                            "name": name,
                            "contractHtml": response.text,
                            "source": "scraped",
                            "url_used": url
                        }
                    else:
                        print(f"    ⚠️ Variant {i+1} ({slug}) returned 'Player not found'")
                        break  # No need to retry this URL
                else:
                    print(f"    ❌ Variant {i+1} ({slug}) returned HTTP {response.status_code}")
                    
            except Exception as e:
                if attempt == 0:
                    print(f"    ⚠️ Variant {i+1} ({slug}) failed: {str(e)[:50]}...")
                time.sleep(0.5)
    
    print(f"    ❌ No working URL found for {name} after trying {len(url_variants)} variants")
    return None

def try_scrape_contract(player_key, player_data, max_attempts=2):
    """Try to scrape contract data with corrected URL mapping (underscores to hyphens)"""
    name = player_data.get("Name", "").strip() or player_key.replace("_", " ").title()
    
    # FIXED: Convert underscores to hyphens for proper URL formatting
    slug = player_key.replace("_", "-")
    url = f"https://www.salaryswish.com/players/{slug}"
    
    for attempt in range(max_attempts):
        try:
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                # Check if we got a real player page (not "Player not found")
                if "Player not found" not in response.text:
                    print(f"    ✓ Found contract data for {name}")
                    return {
                        "name": name,
                        "contractHtml": response.text,
                        "source": "scraped"
                    }
                else:
                    print(f"    ⚠️ Player not found for {name} ({slug})")
                    return None
            else:
                print(f"    ⚠️ HTTP {response.status_code} for {name}")
        except Exception as e:
            if attempt == 0:
                print(f"    ⚠️ Scraping failed for {name}: {str(e)[:50]}...")
            time.sleep(0.5)
    
    return None

def main():
    """Main execution - ONLY scrape real data, no fallback nonsense"""
    print("🏀 Contract Scraping - REAL DATA ONLY")
    print("=" * 50)
    
    # Load player data
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(script_dir)))
    data_pipeline_dir = os.path.join(project_root, "data_pipeline")
    
    players_file_paths = [
        os.path.join(data_pipeline_dir, "resources", "data", "players_merged_with_discoveries.json"),
        os.path.join(project_root, "public", "players.json"),
    ]
    
    players = None
    for path in players_file_paths:
        try:
            with open(path, "r") as f:
                players = json.load(f)
                print(f"✅ Loaded player data from: {path}")
                print(f"📊 Found {len(players)} players to process")
                break
        except FileNotFoundError:
            continue
    
    if players is None:
        print("❌ No player data file found!")
        return
    
    # Test if SalarySwish is working
    print(f"\n🔍 Testing SalarySwish connectivity...")
    test_players = ["jayson_tatum", "stephen_curry", "luka_doncic"]
    
    external_working = False
    for test_key in test_players:
        if test_key in players:
            scraped_data = try_scrape_contract_with_fallbacks(test_key, players[test_key])
            if scraped_data and scraped_data.get("source") == "scraped":
                external_working = True
                print(f"✅ SalarySwish is working! Successfully scraped {players[test_key].get('Name')}")
                break
    
    if not external_working:
        print("❌ SalarySwish is not accessible or returning data")
        print("🛑 STOPPING - No point in running a contract scraper that can't scrape")
        print("💡 Try again later when SalarySwish is back online")
        return
    
    # Process all players - ONLY with real scraping
    output = {}
    scraped_count = 0
    failed_count = 0
    total = len(players)
    
    print(f"\n📡 Scraping contracts for all {total} players...")
    
    for idx, (key, player) in enumerate(players.items(), 1):
        name = player.get("Name", key.replace("_", " ").title())
        
        if idx % 50 == 0 or idx <= 10:
            print(f"[{idx}/{total}] Processing {name}...")
        
        # ONLY try real scraping - no fallback nonsense
        scraped_data = try_scrape_contract_with_fallbacks(key, player)
        if scraped_data and scraped_data.get("source") == "scraped":
            output[key] = scraped_data
            scraped_count += 1
        else:
            failed_count += 1
    
    # Save ONLY the real scraped data
    output_dir = os.path.join(data_pipeline_dir, "resources", "data")
    os.makedirs(output_dir, exist_ok=True)
    
    output_path = os.path.join(output_dir, "raw_contract_html.json")
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)
    
    print(f"\n🎉 Contract scraping complete!")
    print(f"=" * 50)
    print(f"📊 REAL Results:")
    print(f"   ✅ Successfully scraped: {scraped_count} players")
    print(f"   ❌ Failed to scrape: {failed_count} players")
    print(f"   📈 Success rate: {(scraped_count/total)*100:.1f}%")
    print(f"   💾 Saved to: {output_path}")
    
    if scraped_count == 0:
        print(f"\n🛑 NO CONTRACTS SCRAPED!")
        print(f"   This means SalarySwish is completely inaccessible")
        print(f"   Don't pretend we have 'contract data' when we don't")
    elif scraped_count < total * 0.5:  # Less than 50% success
        print(f"\n⚠️  LOW SUCCESS RATE!")
        print(f"   Only {scraped_count}/{total} players have real contract data")
        print(f"   The rest will not have current contract information")
    else:
        print(f"\n🚀 Good success rate! Ready for parsing step.")
    
    # Create honest summary
    summary = {
        "scraped_players": scraped_count,
        "failed_players": failed_count,
        "total_players": total,
        "success_rate": (scraped_count / total) * 100 if total > 0 else 0,
        "processing_date": time.time(),
        "method": "real_scraping_only",
        "fallback_used": False,
        "data_integrity": "high" if scraped_count > 0 else "none"
    }
    
    summary_path = os.path.join(output_dir, "contract_processing_summary.json")
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2)
    
    print(f"   📋 Honest summary: {summary_path}")

# REMOVE the fallback function entirely
# def create_fallback_contract_data(player_key, player_data):
#     """This function was removed because it's fundamentally broken logic"""
#     pass

if __name__ == "__main__":
    main()