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
    
    # Clean the name and create base variant
    clean_name = re.sub(r'[^\w\s\-.]', '', base_name)
    base_variant = re.sub(r'[-\s]+', '-', clean_name)
    name_variants.append(base_variant)
    
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
    
    # Handle hyphenated last names
    if '-' in player_name and ' ' in player_name:
        # Try with and without spaces around hyphens
        no_space_hyphens = re.sub(r'\s*-\s*', '-', clean_name)
        no_space_hyphens = re.sub(r'[-\s]+', '-', no_space_hyphens)
        name_variants.append(no_space_hyphens)
        
        # Try removing internal hyphens
        no_internal_hyphens = re.sub(r'(?<!^)(?<!-)(-)+(?!$)', '', clean_name)
        no_internal_hyphens = re.sub(r'[-\s]+', '-', no_internal_hyphens)
        name_variants.append(no_internal_hyphens)
    
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

def create_fallback_contract_data(player_key, player_data):
    """Create contract data structure from existing player info"""
    name = player_data.get("Name", "").strip() or player_key.replace("_", " ").title()
    
    # Use existing team data (already updated in bio step - no need for NBA API calls)
    team = player_data.get("Team", "")
    
    # Extract contract info from existing data
    contract_str = player_data.get("Contract", "")
    free_agent = player_data.get("Free Agent", "")
    
    # Parse basic contract information
    contract_value = None
    contract_years = None
    
    if contract_str:
        # Try to extract value and years from format like "$6.0M / 1 yr"
        value_match = re.search(r'\$([0-9.]+)M', contract_str)
        years_match = re.search(r'(\d+)\s*yr', contract_str)
        
        if value_match:
            contract_value = float(value_match.group(1)) * 1000000  # Convert to dollars
        if years_match:
            contract_years = int(years_match.group(1))
    
    # Parse free agency year
    fa_year = None
    if free_agent:
        year_match = re.search(r'(\d{4})', free_agent)
        if year_match:
            fa_year = int(year_match.group(1))
    
    return {
        "name": name,
        "contractData": {
            "team": team,  # Use existing team info (already updated in bio step)
            "contract_string": contract_str,
            "free_agent_info": free_agent,
            "estimated_value": contract_value,
            "estimated_years": contract_years,
            "free_agency_year": fa_year,
            "source": "existing_data"
        },
        "source": "fallback_enhanced"
    }

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
    """Main execution with fallback logic"""
    print("🏀 Enhanced Contract Scraping with Smart URL Detection")
    print("=" * 55)
    
    # Load player data from multiple possible sources
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(script_dir))
    
    players_file_paths = [
        os.path.join(project_root, "data", "players_merged_with_discoveries.json"),
        os.path.join(project_root, "public", "players.json"),
        os.path.join(project_root, "data", "merged_players.json"),
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
    
    # Process players with smart URL detection
    output = {}
    scraped_count = 0
    fallback_count = 0
    total = len(players)
    
    # Test if external scraping service is working with smart URL detection
    print(f"\n🔍 Testing smart URL detection with sample players...")
    test_players = [
        ("jayson_tatum", players.get("jayson_tatum", {"Name": "Jayson Tatum"})),
        ("stephen_curry", players.get("stephen_curry", {"Name": "Stephen Curry"})),
        ("michael_porter_jr", players.get("michael_porter_jr", {"Name": "Michael Porter Jr"})),
    ]
    
    external_working = False
    successful_urls = []
    
    for key, player in test_players:
        if key in players:
            player = players[key]
        name = player.get("Name", key.replace("_", " ").title())
        print(f"\n  🧪 Testing URL variants for {name}:")
        scraped_data = try_scrape_contract_with_fallbacks(key, player)
        if scraped_data:
            external_working = True
            successful_urls.append(scraped_data.get("url_used", "unknown"))
            print(f"  ✅ SUCCESS: Found working URL pattern!")
        else:
            print(f"  ❌ No working URLs found for {name}")
    
    if external_working:
        print(f"\n🚀 Smart URL detection working! Found {len(successful_urls)} successful patterns")
        print(f"   Sample working URLs:")
        for url in successful_urls[:3]:
            print(f"   - {url}")
        print(f"\n📡 Will attempt to scrape ALL {total} players with smart URL detection")
        use_external = True
    else:
        print(f"\n⚠️ Smart URL detection failed - external service may be down")
        print(f"⚡ Using existing data fallback for all players")
        use_external = False
    
    # Process all players based on service availability
    for idx, (key, player) in enumerate(players.items(), 1):
        name = player.get("Name", key.replace("_", " ").title())
        
        if idx % 25 == 0 or idx <= 10:  # More frequent progress updates
            print(f"\n[{idx}/{total}] Processing {name}...")
        
        if use_external:
            # Try smart URL detection for all players
            scraped_data = try_scrape_contract_with_fallbacks(key, player)
            if scraped_data:
                output[key] = scraped_data
                scraped_count += 1
                continue
        
        # Use fallback (either external failed for this player, or service unavailable)
        fallback_data = create_fallback_contract_data(key, player)
        output[key] = fallback_data
        fallback_count += 1
    
    # Ensure output directory exists
    os.makedirs(os.path.join(project_root, "data"), exist_ok=True)
    
    # Save processed data
    output_path = os.path.join(project_root, "data", "raw_contract_html.json")
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)
    
    print(f"\n🎉 Contract processing complete!")
    print(f"=" * 55)
    print(f"📊 Final Results:")
    print(f"   📡 Successfully scraped: {scraped_count} players")
    print(f"   🔄 Used fallback data: {fallback_count} players")
    print(f"   📁 Total processed: {len(output)} players")
    print(f"   💾 Saved to: {output_path}")
    
    # Calculate success rate
    if scraped_count > 0:
        success_rate = (scraped_count / total) * 100
        print(f"   📈 Scraping success rate: {success_rate:.1f}%")
    
    # Create summary for next pipeline step
    summary = {
        "scraped_players": scraped_count,
        "fallback_players": fallback_count,
        "total_players": len(output),
        "external_service_working": scraped_count > 0,
        "scraping_success_rate": (scraped_count / total) * 100 if total > 0 else 0,
        "processing_date": time.time(),
        "method": "smart_url_detection"
    }
    
    summary_path = os.path.join(project_root, "data", "contract_processing_summary.json")
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2)
    
    print(f"   📋 Processing summary: {summary_path}")
    
    if scraped_count > 0:
        print(f"\n🚀 Ready for contract parsing! Run:")
        print(f"   python3 scripts/contracts/parse_contract_data_enhanced.py")
    else:
        print(f"\n⚠️ No contracts were scraped. Check network connection or service availability.")

if __name__ == "__main__":
    main()