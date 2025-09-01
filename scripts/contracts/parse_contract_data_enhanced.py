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
    
    # Create annual salaries estimate (simplified)
    annual_salaries = []
    if value and years and fa_year:
        start_year = fa_year - years
        yearly_salary = int(value / years)
        for i in range(years):
            annual_salaries.append({
                "year": start_year + i,
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
            "signed_year": annual_salaries[0]["year"] if annual_salaries else None,
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

def parse_scraped_contract_html(player_id, player_data):
    """Parse scraped HTML contract data (original logic)"""
    raw_html = player_data.get("contractHtml", "")
    if not raw_html.strip():
        return None
    
    soup = BeautifulSoup(raw_html, "html.parser")
    body = soup.find("div", class_="sw_bodyContent")
    scoped = body if body else soup
    
    # Basic contract summary parsing (simplified from original)
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
    
    # Extract salary table if present
    salaries = []
    table = scoped.find("table")
    if table:
        rows = table.find_all("tr")[1:]  # Skip header
        for row in rows:
            cells = row.find_all("td")
            if not cells or "TOTAL" in cells[0].text:
                continue
            try:
                year = int(re.match(r"\d{4}", cells[0].text).group())
                salary = int(re.sub(r"[^\d]", "", cells[3].text))
                if year > 2000 and salary > 0:
                    salaries.append({
                        "year": year,
                        "salary": salary,
                        "guaranteed": True,
                        "option": None
                    })
            except:
                continue
    
    return {
        "player_id": player_id,
        "name": player_data.get("name", ""),
        "team": None,
        "position": None,
        "status": "Active",
        "bio": {},
        "agent": {"name": None, "agency": None},
        "draft": {},
        "bird_rights": None,
        "free_agent_type": None,
        "free_agency_year": max(s["year"] for s in salaries) + 1 if salaries else None,
        "cap_hold": 0,
        "contract_summary": summary,
        "contract": {
            "annual_salaries": salaries,
            "options": [],
            "total_value": sum(s["salary"] for s in salaries),
            "contract_length": len(salaries),
            "signed_year": salaries[0]["year"] if salaries else None,
            "signing_team": None,
            "guaranteed_years": len(salaries),
            "average_annual_value": int(sum(s["salary"] for s in salaries)/len(salaries)) if salaries else 0,
            "incentives": {"likely": 0, "unlikely": 0},
            "notes": None,
            "extension": None,
            "free_agency_year": max(s["year"] for s in salaries) + 1 if salaries else None
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
        print("Run scrape_all_contracts_fallback.py first")
        return
    
    parse_all_contracts(input_file, output_file)

if __name__ == "__main__":
    main()