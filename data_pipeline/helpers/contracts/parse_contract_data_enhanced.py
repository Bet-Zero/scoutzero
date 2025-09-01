#!/usr/bin/env python3
"""
Enhanced Contract Data Parser - Handles both scraped HTML and fallback data
Streamlined for 2025-26 season transition
"""

import json
import re
import os
from bs4 import BeautifulSoup

def parse_existing_contract_string(contract_str):
    """Parse contract string like '$6.0M / 1 yr' or '$34.8M / 2 yrs'"""
    if not contract_str:
        return None, None, None
    
    value_match = re.search(r'\$([0-9.]+)M', contract_str)
    years_match = re.search(r'(\d+)\s*yrs?', contract_str)
    
    value = float(value_match.group(1)) * 1000000 if value_match else None
    years = int(years_match.group(1)) if years_match else None
    aav = value / years if (value and years) else value
    
    return value, years, aav

def parse_free_agent_info(fa_str):
    """Parse free agent string like '2025 (UFA)' or '2026 (RFA)'"""
    if not fa_str:
        return None, None
    
    year_match = re.search(r'(\d{4})', fa_str)
    type_match = re.search(r'\(([URA]FA)\)', fa_str)
    
    year = int(year_match.group(1)) if year_match else None
    fa_type = type_match.group(1) if type_match else None
    
    return year, fa_type

def create_fallback_contract_data(player_id, player_data):
    """Create contract data from existing player information"""
    contract_str = player_data.get("contractData", {}).get("contract_string", "")
    fa_info = player_data.get("contractData", {}).get("free_agent_info", "")
    team = player_data.get("contractData", {}).get("team", "")
    
    value, years, aav = parse_existing_contract_string(contract_str)
    fa_year, fa_type = parse_free_agent_info(fa_info)
    
    # Create annual salaries estimate using END YEAR format for consistency
    annual_salaries = []
    if value and years and fa_year:
        # fa_year is when player becomes free agent, so last contract year is fa_year - 1
        last_contract_end_year = fa_year - 1
        first_contract_end_year = last_contract_end_year - years + 1
        yearly_salary = int(value / years)
        for i in range(years):
            annual_salaries.append({
                "year": first_contract_end_year + i,  # Store using END YEAR format
                "salary": yearly_salary,
                "guaranteed": True,
                "option": None
            })
    
    return {
        "player_id": player_id,
        "name": player_data.get("name", ""),
        "team": team,
        "position": None,
        "status": "Active",
        "bio": {
            "birthdate": None,
            "birthplace": None,
            "nationality": None,
            "height": None,
            "weight_lbs": None,
            "age": None,
            "shoots": None,
            "years_pro": None
        },
        "agent": {"name": None, "agency": None},
        "draft": {"year": None, "round": None, "pick": None, "team": None},
        "bird_rights": None,
        "free_agent_type": fa_type,
        "free_agency_year": fa_year,
        "cap_hold": 0,
        "qualifying_offer": None,
        "signed_using": None,
        "trade_kicker": None,
        "no_trade_clause": False,
        "contract_summary": {
            "type": "Standard Contract",
            "length": f"{years} years" if years else None,
            "value": int(value) if value else None,
            "guaranteed": int(value) if value else None,
            "aav": int(aav) if aav else None,
            "cap_percentage": None,
            "signing_team": team,
            "signing_date": None,
            "signed_by": team,
            "signed_using": None,
            "source": "Fallback",
            "is_extension": False
        },
        "contract": {
            "annual_salaries": annual_salaries,
            "options": [],
            "total_value": int(value) if value else 0,
            "contract_length": years or 0,
            "signed_year": annual_salaries[0]["year"] - 1 if annual_salaries else None,  # Convert back to start year
            "signing_team": team,
            "guaranteed_years": years or 0,
            "average_annual_value": int(aav) if aav else 0,
            "incentives": {"likely": 0, "unlikely": 0},
            "notes": f"Parsed from: {contract_str}",
            "extension": None,
            "free_agency_year": fa_year
        },
        "source_url": None,
        "data_source": "fallback"
    }

def safe_int(text):
    """Safely convert text to integer"""
    try:
        return int(re.sub(r"[^\d]", "", text or "0"))
    except:
        return None

def safe_float(text):
    """Safely convert text to float"""
    try:
        return float(re.search(r"[\d.]+", text).group())
    except:
        return None

def extract_bird_rights(scoped):
    """Extract Bird Rights at contract expiry"""
    all_text = scoped.get_text()
    
    # Look for Bird Rights in the player summary section specifically
    # The pattern should be "Bird Rights: [type] ([qualifier])" not just "Bird Rights:"
    patterns = [
        r"Bird Rights:\s*([A-Za-z-]+(?:\s+[A-Za-z-]+)*)\s*\([^)]+\)",  # "Bird Rights: Bird (QVFA)"
        r"Bird Rights:\s*([A-Za-z-]+(?:\s+[A-Za-z-]+)*)",              # "Bird Rights: Early-Bird" 
        r"BIRD RIGHTS:\s*([A-Za-z-]+(?:\s+[A-Za-z-]+)*)",              # Backup pattern
    ]
    
    for pattern in patterns:
        matches = re.findall(pattern, all_text, re.IGNORECASE)
        # Filter out navigation menu matches and look for actual bird rights types
        for match in matches:
            match_clean = match.strip()
            # Skip if it's clearly from navigation (like just "B" from "Bird Rights Calculator")
            if len(match_clean) <= 1 or match_clean.lower() in ['calculator', 'qualifying', 'offer', 'hold']:
                continue
            
            # This looks like a real Bird Rights type
            bird_rights_mapping = {
                "BIRD": "Bird",
                "FULL BIRD": "Full Bird",
                "FULL-BIRD": "Full Bird", 
                "EARLY BIRD": "Early Bird",
                "EARLY-BIRD": "Early Bird",
                "NON-BIRD": "Non-Bird",
                "NON BIRD": "Non-Bird",
                "NONE": None,
                "N/A": None,
            }
            
            match_upper = match_clean.upper()
            if match_upper in bird_rights_mapping:
                return bird_rights_mapping[match_upper]
            
            # Return the cleaned match if it's not in our mapping but looks valid
            return match_clean
    
    return None

def parse_scraped_contract_html(player_id, player_data):
    """Parse scraped HTML contract data - FIXED VERSION"""
    raw_html = player_data.get("contractHtml", "")
    if not raw_html.strip():
        return None
    
    soup = BeautifulSoup(raw_html, "html.parser")
    body = soup.find("div", class_="sw_bodyContent")
    scoped = body if body else soup
    
    # Basic contract summary parsing
    summary = {
        "type": "Standard Contract",
        "length": None,
        "value": None,
        "guaranteed": None,
        "aav": None,
        "source": "SalarySwish",
        "is_extension": False
    }
    
    # Try to extract basic info
    header = scoped.find("div", class_="sw_playerContract__header")
    if header:
        title = header.find("h6")
        if title:
            summary["type"] = title.text.strip()
    
    # Extract Bird Rights at contract expiry
    bird_rights = extract_bird_rights(scoped)
    
    # Extract salary table if present - FIXED PARSING LOGIC
    salaries = []
    table = scoped.find("table")
    if table:
        rows = table.find_all("tr")[1:]  # Skip header
        for row in rows:
            cells = row.find_all("td")
            if len(cells) < 4:  # Need at least 4 columns
                continue
            
            season_text = cells[0].text.strip()
            cap_hit_text = cells[3].text.strip()  # "Cap Hit" column
            
            # Skip summary rows
            if "TOTAL" in season_text.upper() or not season_text:
                continue
            
            try:
                # Extract year from season and convert to END YEAR format
                # e.g., "2025-26 Max" -> 2026 (end year of 2025-26 season)
                year_match = re.search(r"(\d{4})", season_text)
                if not year_match:
                    continue
                start_year = int(year_match.group(1))
                end_year = start_year + 1  # Convert to end year format for consistency
                
                # Extract salary from cap hit (e.g., "$54,126,450" -> 54126450)
                salary_numbers = re.findall(r"[\d,]+", cap_hit_text.replace("$", ""))
                if not salary_numbers:
                    continue
                salary = int(salary_numbers[0].replace(",", ""))
                
                # Validate reasonable values
                if start_year < 2020 or start_year > 2035 or salary < 100000:
                    continue
                
                salaries.append({
                    "year": end_year,  # Store using END YEAR format
                    "salary": salary,
                    "guaranteed": True,
                    "option": None
                })
                
            except (ValueError, IndexError, AttributeError) as e:
                # Skip rows that can't be parsed
                continue
    
    # Calculate contract totals
    total_value = sum(s["salary"] for s in salaries) if salaries else 0
    contract_length = len(salaries)
    aav = int(total_value / contract_length) if contract_length > 0 else 0
    
    # Update summary with calculated values
    summary.update({
        "length": f"{contract_length} years" if contract_length > 0 else None,
        "value": total_value,
        "guaranteed": total_value,
        "aav": aav
    })
    
    return {
        "player_id": player_id,
        "name": player_data.get("name", ""),
        "team": None,
        "position": None,
        "status": "Active",
        "bio": {},
        "agent": {"name": None, "agency": None},
        "draft": {},
        "bird_rights": bird_rights,  # Bird Rights at contract expiry
        "free_agent_type": None,
        "free_agency_year": max(s["year"] for s in salaries) if salaries else None,
        "cap_hold": 0,
        "contract_summary": summary,
        "contract": {
            "annual_salaries": salaries,
            "options": [],
            "total_value": total_value,
            "contract_length": contract_length,
            "signed_year": salaries[0]["year"] - 1 if salaries else None,  # Convert back to start year for signing year
            "signing_team": None,
            "guaranteed_years": contract_length,
            "average_annual_value": aav,
            "incentives": {"likely": 0, "unlikely": 0},
            "notes": None,
            "extension": None,
            "free_agency_year": max(s["year"] for s in salaries) if salaries else None
        },
        "data_source": "scraped"
    }

def parse_all_contracts(input_file, output_file):
    """Parse contracts from mixed scraped/fallback data"""
    print("🔄 Parsing contract data...")
    
    with open(input_file, "r") as f:
        data = json.load(f)
    
    parsed_players = []
    scraped_count = 0
    fallback_count = 0
    
    for player_id, player_data in data.items():
        source = player_data.get("source", "unknown")
        
        if source == "scraped" and player_data.get("contractHtml"):
            # Parse scraped HTML data
            parsed = parse_scraped_contract_html(player_id, player_data)
            if parsed:
                parsed_players.append(parsed)
                scraped_count += 1
        else:
            # Use fallback parsing
            parsed = create_fallback_contract_data(player_id, player_data)
            parsed_players.append(parsed)
            fallback_count += 1
    
    # Save parsed data
    with open(output_file, "w") as f:
        json.dump(parsed_players, f, indent=2)
    
    print(f"✅ Contract parsing complete!")
    print(f"   📡 Scraped contracts: {scraped_count}")
    print(f"   🔄 Fallback contracts: {fallback_count}")
    print(f"   📁 Total players: {len(parsed_players)}")
    print(f"   💾 Output: {output_file}")

def main():
    """Main execution"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(script_dir))
    input_file = os.path.join(project_root, "data", "raw_contract_html.json")
    output_file = os.path.join(project_root, "data", "contracts_parsed.json")
    
    if not os.path.exists(input_file):
        print(f"❌ Input file not found: {input_file}")
        print("Run scrape_all_contracts.py first")
        return
    
    parse_all_contracts(input_file, output_file)

if __name__ == "__main__":
    main()