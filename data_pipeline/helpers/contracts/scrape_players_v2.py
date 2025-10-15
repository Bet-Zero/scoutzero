#!/usr/bin/env python3
"""
Enhanced Player Contract Scraper for Architect - players_v2
Extracts individual contract details from SalarySwish player pages
Populates /architect/basePlayers/{playerId} with:
- Bird rights status
- RFA/UFA status and free agency year
- PO/TO options and contract guarantees
- Trade eligibility data (BYC, poison pill, aggregation)
- Cap holds and qualifying offers
"""

import os
import json
import requests
import time
import re
from bs4 import BeautifulSoup

def scrape_player_page(player_id, player_slug):
    """Scrape detailed contract info from SalarySwish player page"""
    url = f"https://www.salaryswish.com/players/{player_slug}"
    
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            if "Player not found" not in response.text:
                return {
                    "playerId": player_id,
                    "slug": player_slug,
                    "html": response.text,
                    "url": url,
                    "source": "scraped"
                }
    except Exception as e:
        print(f"    ❌ Error scraping {player_id}: {str(e)[:50]}...")
    
    return None

def parse_player_html(player_id, html_data):
    """Parse HTML to extract comprehensive contract details"""
    soup = BeautifulSoup(html_data, 'html.parser')
    body = soup.find("div", class_="sw_bodyContent")
    scoped = body if body else soup
    
    # Initialize player data structure
    player_data = {
        "playerId": player_id,
        "displayName": extract_player_name(soup, scoped),  # Pass both soup and scoped
        "teamCode": extract_team_code(scoped),
        "teamName": extract_team_name(scoped),
        "bio": extract_bio(scoped),
        "contract": extract_contract_details(scoped),
        "source": {
            "provider": "SalarySwish",
            "scrapedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        },
        "lastUpdated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "version": "1.0"
    }
    
    return player_data

def extract_player_name(soup, scoped):
    """Extract player display name"""
    # Try soup first (h1 might be outside scoped div)
    name_elem = soup.find('h1')
    if name_elem:
        return name_elem.text.strip()
    
    # Fall back to scoped
    name_elem = scoped.find('h1')
    if name_elem:
        return name_elem.text.strip()
    
    return None

def extract_team_code(scoped):
    """Extract team code/abbreviation"""
    # Look for team link or breadcrumb
    team_link = scoped.find('a', href=re.compile(r'/teams/'))
    if team_link:
        href = team_link.get('href', '')
        # Extract team slug from /teams/{slug}
        match = re.search(r'/teams/([a-z-]+)', href)
        if match:
            slug_to_code = {
                'lakers': 'LAL', 'celtics': 'BOS', 'warriors': 'GSW',
                'nets': 'BKN', 'knicks': 'NYK', 'sixers': 'PHI',
                # Add more mappings as needed
            }
            return slug_to_code.get(match.group(1), match.group(1).upper()[:3])
    return None

def extract_team_name(scoped):
    """Extract team full name"""
    team_link = scoped.find('a', href=re.compile(r'/teams/'))
    if team_link:
        return team_link.text.strip()
    return None

def extract_bio(scoped):
    """Extract player bio information"""
    bio = {}
    
    # Look for player info section
    info_section = scoped.find('div', class_=re.compile(r'player.*info'))
    if info_section:
        text = info_section.get_text()
        
        # Extract position
        pos_match = re.search(r'Position:\s*([A-Z-]+)', text, re.IGNORECASE)
        if pos_match:
            bio['position'] = pos_match.group(1)
        
        # Extract height
        height_match = re.search(r'Height:\s*([\d-]+)', text, re.IGNORECASE)
        if height_match:
            bio['height'] = height_match.group(1)
        
        # Extract weight
        weight_match = re.search(r'Weight:\s*(\d+)', text, re.IGNORECASE)
        if weight_match:
            bio['weight'] = weight_match.group(1)
        
        # Extract age
        age_match = re.search(r'Age:\s*(\d+)', text, re.IGNORECASE)
        if age_match:
            bio['age'] = int(age_match.group(1))
        
        # Extract experience
        exp_match = re.search(r'Experience:\s*(\d+)', text, re.IGNORECASE)
        if exp_match:
            bio['experience'] = int(exp_match.group(1))
    
    return bio

def extract_contract_details(scoped):
    """Extract comprehensive contract details"""
    contract = {
        "contractType": extract_contract_type(scoped),
        "isExtension": detect_extension(scoped),
        "isRookieScale": detect_rookie_scale(scoped),
        "signedUsing": extract_signing_method(scoped),
        "signingTeam": extract_signing_team(scoped),
        "signingDate": extract_signing_date(scoped),
        "signedByCurrentTeam": True,  # Will need logic to determine
        "startSeason": None,
        "endSeason": None,
        "contractLength": 0,
        "yearsRemaining": 0,
        "totalValue": 0,
        "averageAnnualValue": 0,
        "guaranteedValue": 0,
        "guaranteedYears": 0,
        "salariesByYear": extract_salary_table(scoped),
        "noTradeClause": extract_ntc(scoped),
        "tradeKicker": extract_trade_kicker(scoped),
        "tradeRestrictions": [],
        "birdRights": extract_bird_rights_details(scoped),
        "freeAgency": extract_free_agency_info(scoped),
        "tradeEligibility": extract_trade_eligibility(scoped)
    }
    
    # Calculate derived values from salary table
    salaries = contract["salariesByYear"]
    if salaries:
        contract["startSeason"] = salaries[0].get("season")
        contract["endSeason"] = salaries[-1].get("season")
        contract["contractLength"] = len(salaries)
        contract["totalValue"] = sum(s.get("salary", 0) for s in salaries)
        guaranteed_total = sum(s.get("guaranteedAmount", 0) for s in salaries)
        contract["guaranteedValue"] = guaranteed_total
        contract["guaranteedYears"] = sum(1 for s in salaries if s.get("guaranteed", False))
        if contract["contractLength"] > 0:
            contract["averageAnnualValue"] = contract["totalValue"] // contract["contractLength"]
    
    return contract

def extract_contract_type(scoped):
    """Extract contract type"""
    header = scoped.find("div", class_="sw_playerContract__header")
    if header:
        title = header.find("h6")
        if title:
            return title.text.strip()
    return "STANDARD CONTRACT"

def detect_extension(scoped):
    """Detect if this is a contract extension"""
    text = scoped.get_text().lower()
    extension_keywords = ['extension', 'extend', 'extended', 'rookie extension']
    return any(keyword in text for keyword in extension_keywords)

def detect_rookie_scale(scoped):
    """Detect if this is a rookie scale contract"""
    text = scoped.get_text().lower()
    return 'rookie scale' in text or 'rookie contract' in text

def extract_signing_method(scoped):
    """Extract how the player was signed (Bird, MLE, Room, etc.)"""
    text = scoped.get_text()
    
    # Look for signing exception mentions
    if 'Bird Exception' in text or 'Bird Rights' in text:
        return 'Bird Exception'
    elif 'Early Bird' in text:
        return 'Early Bird Exception'
    elif 'Non-Bird' in text:
        return 'Non-Bird Exception'
    elif 'Mid-Level Exception' in text or 'MLE' in text:
        return 'Mid-Level Exception'
    elif 'Bi-Annual' in text or 'BAE' in text:
        return 'Bi-Annual Exception'
    elif 'Minimum' in text:
        return 'Minimum Salary Exception'
    elif 'Room Exception' in text:
        return 'Room Exception'
    
    return None

def extract_signing_team(scoped):
    """Extract the team that originally signed the player"""
    # This requires looking for signing history in the page
    # For now, return None - can be enhanced
    return None

def extract_signing_date(scoped):
    """Extract contract signing date"""
    text = scoped.get_text()
    
    # Look for date patterns like "Signed: July 1, 2023" or "July 1, 2023"
    date_pattern = r'(?:Signed:?\s*)?([A-Z][a-z]+\s+\d{1,2},\s+\d{4})'
    match = re.search(date_pattern, text)
    if match:
        return match.group(1)
    
    return None

def extract_salary_table(scoped):
    """Extract per-year salary breakdown with options and guarantees"""
    salaries = []
    
    table = scoped.find("table")
    if not table:
        return salaries
    
    rows = table.find_all("tr")[1:]  # Skip header
    
    for row in rows:
        cells = row.find_all("td")
        if len(cells) < 4:
            continue
        
        season_text = cells[0].text.strip()
        
        # Skip summary rows
        if "TOTAL" in season_text.upper() or not season_text:
            continue
        
        try:
            # Extract year and convert to season format (2025 -> "2025-26")
            year_match = re.search(r"(\d{4})", season_text)
            if not year_match:
                continue
            
            start_year = int(year_match.group(1))
            season = f"{start_year}-{str(start_year + 1)[-2:]}"
            
            # Extract salary (usually in column 3 or 4)
            salary_text = cells[3].text.strip() if len(cells) > 3 else cells[2].text.strip()
            salary_match = re.findall(r"[\d,]+", salary_text.replace("$", ""))
            if not salary_match:
                continue
            
            salary = int(salary_match[0].replace(",", ""))
            
            # Validate reasonable values
            if start_year < 2020 or start_year > 2035 or salary < 100000:
                continue
            
            # Extract option type (PO, TO, ETO)
            option = None
            option_text = cells[-1].text.strip() if len(cells) > 4 else ""
            if "Player Option" in option_text or "PO" in option_text:
                option = "PO"
            elif "Team Option" in option_text or "TO" in option_text:
                option = "TO"
            elif "Early Termination" in option_text or "ETO" in option_text:
                option = "ETO"
            
            # Extract guarantee info
            guaranteed = "Non-Guaranteed" not in season_text and "NG" not in season_text
            guaranteed_amount = salary if guaranteed else 0
            
            # Check for partial guarantees
            guarantee_match = re.search(r'\$?([\d,]+).*guaranteed', season_text, re.IGNORECASE)
            if guarantee_match:
                guaranteed_amount = int(guarantee_match.group(1).replace(",", ""))
            
            salaries.append({
                "season": season,
                "salary": salary,
                "capHit": salary,  # Will be adjusted for incentives if needed
                "guaranteed": guaranteed,
                "guaranteedAmount": guaranteed_amount,
                "option": option,
                "tradeBonus": None,  # Would need separate parsing
                "incentives": {
                    "likely": 0,
                    "unlikely": 0
                }
            })
            
        except (ValueError, IndexError) as e:
            continue
    
    return salaries

def extract_ntc(scoped):
    """Extract no-trade clause status"""
    text = scoped.get_text()
    return "No-Trade Clause" in text or "NTC" in text

def extract_trade_kicker(scoped):
    """Extract trade kicker percentage"""
    text = scoped.get_text()
    
    # Look for trade kicker/bonus percentage
    kicker_match = re.search(r'Trade\s+(?:Kicker|Bonus)[:\s]*(\d+)%', text, re.IGNORECASE)
    if kicker_match:
        return int(kicker_match.group(1))
    
    return None

def extract_bird_rights_details(scoped):
    """Extract Bird Rights status and related details"""
    text = scoped.get_text()
    
    bird_rights = {
        "status": None,
        "yearsOfService": None,
        "yearsWithTeam": None,
        "eligibleFor": []
    }
    
    # Extract Bird Rights status
    if "Full Bird" in text or "Bird Rights: Bird" in text:
        bird_rights["status"] = "Bird"
        bird_rights["eligibleFor"] = ["Bird Exception"]
    elif "Early Bird" in text:
        bird_rights["status"] = "Early Bird"
        bird_rights["eligibleFor"] = ["Early Bird Exception", "Bird Exception"]
    elif "Non-Bird" in text:
        bird_rights["status"] = "Non-Bird"
        bird_rights["eligibleFor"] = ["Non-Bird Exception"]
    else:
        bird_rights["status"] = "None"
    
    # Extract years of service (look for patterns like "3 years with team")
    years_match = re.search(r'(\d+)\s+years?\s+(?:with|on)\s+team', text, re.IGNORECASE)
    if years_match:
        bird_rights["yearsWithTeam"] = int(years_match.group(1))
    
    return bird_rights

def extract_free_agency_info(scoped):
    """Extract free agency type, year, cap hold, and qualifying offer"""
    text = scoped.get_text()
    
    free_agency = {
        "type": None,
        "year": None,
        "capHold": None,
        "qualifyingOffer": None,
        "earlyTerminationOption": None
    }
    
    # Extract FA type (UFA, RFA)
    if "Unrestricted Free Agent" in text or "UFA" in text:
        free_agency["type"] = "UFA"
    elif "Restricted Free Agent" in text or "RFA" in text:
        free_agency["type"] = "RFA"
    
    # Extract FA year
    fa_year_match = re.search(r'(?:Free Agent|FA).*?(\d{4})', text, re.IGNORECASE)
    if fa_year_match:
        free_agency["year"] = int(fa_year_match.group(1))
    
    # Extract cap hold
    cap_hold_match = re.search(r'Cap\s+Hold[:\s]*\$?([\d,]+)', text, re.IGNORECASE)
    if cap_hold_match:
        free_agency["capHold"] = int(cap_hold_match.group(1).replace(",", ""))
    
    # Extract qualifying offer (for RFAs)
    qo_match = re.search(r'Qualifying\s+Offer[:\s]*\$?([\d,]+)', text, re.IGNORECASE)
    if qo_match:
        free_agency["qualifyingOffer"] = int(qo_match.group(1).replace(",", ""))
    
    # Check for Early Termination Option
    if "Early Termination Option" in text or "ETO" in text:
        # Try to extract the year
        eto_year_match = re.search(r'ETO.*?(\d{4})', text)
        if eto_year_match:
            free_agency["earlyTerminationOption"] = int(eto_year_match.group(1))
    
    return free_agency

def extract_trade_eligibility(scoped):
    """Extract trade eligibility and restrictions"""
    text = scoped.get_text()
    
    eligibility = {
        "canBeTradedNow": True,  # Default to true
        "restrictedUntil": None,
        "reason": None,
        "rules": {
            "baseYearCompensation": False,
            "poisonPill": False,
            "aggregation": True  # Default to true
        }
    }
    
    # Check for trade restrictions
    if "Cannot be traded" in text or "Ineligible for trade" in text:
        eligibility["canBeTradedNow"] = False
        
        # Extract restriction date
        restriction_date_match = re.search(r'(?:until|before)\s+([A-Z][a-z]+\s+\d{1,2},\s+\d{4})', text)
        if restriction_date_match:
            eligibility["restrictedUntil"] = restriction_date_match.group(1)
        
        # Determine reason
        if "recently signed" in text.lower():
            eligibility["reason"] = "Recent signing"
        elif "recently traded" in text.lower():
            eligibility["reason"] = "Recent trade"
    
    # Check for Base Year Compensation (BYC) - only if NOT negated
    if "Base Year Compensation" in text or "BYC" in text:
        # Check if it's a negative statement
        if "No Base Year Compensation" not in text and "Not subject to Base Year Compensation" not in text:
            eligibility["rules"]["baseYearCompensation"] = True
    
    # Check for Poison Pill - only if NOT negated
    if "Poison Pill" in text:
        # Check if it's a negative statement
        if "Not subject to Poison Pill" not in text and "No Poison Pill" not in text:
            eligibility["rules"]["poisonPill"] = True
    
    # Check if player cannot be aggregated
    if "cannot be aggregated" in text.lower():
        eligibility["rules"]["aggregation"] = False
    
    return eligibility

def main():
    """Main execution"""
    print("🏀 Player Contract Scraper v2 for Architect - /architect/basePlayers")
    print("=" * 70)
    
    # Load player IDs
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(script_dir)))
    data_pipeline_dir = os.path.join(project_root, "data_pipeline")
    
    # Look for player IDs file
    player_ids_paths = [
        os.path.join(data_pipeline_dir, "resources", "data", "all_player_ids.json"),
        os.path.join(data_pipeline_dir, "all_player_ids.json"),
    ]
    
    player_ids = None
    for path in player_ids_paths:
        try:
            with open(path, "r") as f:
                player_ids = json.load(f)
                print(f"✅ Loaded {len(player_ids)} player IDs from: {path}")
                break
        except FileNotFoundError:
            continue
    
    if not player_ids:
        print("❌ No player IDs file found!")
        return
    
    # Test connectivity with a known player
    print(f"\n🔍 Testing SalarySwish connectivity...")
    test_player = "austin-reaves"
    test_data = scrape_player_page("austin_reaves", test_player)
    
    if not test_data or test_data.get("source") != "scraped":
        print("❌ SalarySwish is not accessible")
        print("🛑 Cannot proceed without access to player pages")
        return
    
    print(f"✅ SalarySwish is accessible!")
    
    # Scrape all players
    output = {}
    scraped_count = 0
    failed_count = 0
    
    print(f"\n📡 Scraping {len(player_ids)} players...")
    
    for idx, player_id in enumerate(player_ids, 1):
        # Convert player_id to slug (underscores to hyphens)
        player_slug = player_id.replace("_", "-")
        
        if idx % 50 == 0 or idx <= 10:
            print(f"[{idx}/{len(player_ids)}] Scraping {player_id}...")
        
        scraped_data = scrape_player_page(player_id, player_slug)
        
        if scraped_data and scraped_data.get("source") == "scraped":
            # Parse the HTML to extract structured data
            try:
                parsed_data = parse_player_html(player_id, scraped_data["html"])
                output[player_id] = parsed_data
                scraped_count += 1
            except Exception as e:
                print(f"    ❌ Error parsing {player_id}: {str(e)[:50]}...")
                failed_count += 1
        else:
            failed_count += 1
        
        # Rate limiting
        time.sleep(0.5)
    
    # Save output
    output_dir = os.path.join(data_pipeline_dir, "resources", "data")
    os.makedirs(output_dir, exist_ok=True)
    
    output_path = os.path.join(output_dir, "players_v2_contracts.json")
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)
    
    print(f"\n🎉 Player scraping complete!")
    print(f"=" * 70)
    print(f"📊 Results:")
    print(f"   ✅ Successfully scraped: {scraped_count} players")
    print(f"   ❌ Failed to scrape: {failed_count} players")
    print(f"   📈 Success rate: {(scraped_count/len(player_ids)*100):.1f}%")
    print(f"   💾 Saved to: {output_path}")
    
    # Create summary
    summary = {
        "scraped_players": scraped_count,
        "failed_players": failed_count,
        "total_players": len(player_ids),
        "success_rate": (scraped_count / len(player_ids)) * 100 if player_ids else 0,
        "processing_date": time.time(),
        "output_file": output_path,
        "data_fields": [
            "playerId", "displayName", "teamCode", "teamName",
            "bio", "contract.birdRights", "contract.freeAgency",
            "contract.tradeEligibility", "contract.salariesByYear"
        ]
    }
    
    summary_path = os.path.join(output_dir, "players_v2_scrape_summary.json")
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2)
    
    print(f"   📋 Summary: {summary_path}")

if __name__ == "__main__":
    main()
