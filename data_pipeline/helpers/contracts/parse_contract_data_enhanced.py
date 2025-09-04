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

def detect_contract_extension(scoped, summary_type):
    """Detect if this is a contract extension based on HTML content"""
    all_text = scoped.get_text().lower()
    
    # Check for extension keywords in the contract type or content
    extension_keywords = [
        'extension', 'extend', 'extended', 'rookie extension', 
        'max extension', 'supermax', 'designated veteran extension',
        'veteran extension', 'contract extension'
    ]
    
    # Check contract type first
    if summary_type and any(keyword in summary_type.lower() for keyword in extension_keywords):
        return True
    
    # Check page content for extension indicators
    if any(keyword in all_text for keyword in extension_keywords):
        return True
    
    # Look for specific extension patterns in text
    extension_patterns = [
        r'signed.*extension',
        r'extension.*signed',
        r'rookie.*extension',
        r'max.*extension',
        r'supermax.*extension',
        r'designated.*veteran.*extension'
    ]
    
    for pattern in extension_patterns:
        if re.search(pattern, all_text, re.IGNORECASE):
            return True
    
    return False

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
        "is_extension": False  # Will be updated by extension detection
    }
    
    # Try to extract basic info
    contract_type = "Standard Contract"
    header = scoped.find("div", class_="sw_playerContract__header")
    if header:
        title = header.find("h6")
        if title:
            contract_type = title.text.strip()
            summary["type"] = contract_type
    
    # Detect if this is an extension - NOW ACTUALLY IMPLEMENTED
    is_extension = detect_contract_extension(scoped, contract_type)
    summary["is_extension"] = is_extension
    
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
    
    # FIXED: Create extension object when extension is detected
    extension_data = None
    if is_extension:
        # Extract extension details from the page content
        all_text = scoped.get_text().lower()
        
        # Determine extension type
        extension_type = "Contract Extension"
        if "rookie extension" in all_text:
            extension_type = "Rookie Extension"
        elif "max extension" in all_text or "supermax" in all_text:
            extension_type = "Max Extension"
        elif "designated veteran" in all_text:
            extension_type = "Designated Veteran Extension"
        elif contract_type and "extension" in contract_type.lower():
            extension_type = contract_type
        
        # Create extension object with available data
        extension_data = {
            "type": extension_type,
            "is_extension": True,
            "total_value": total_value,
            "years": contract_length,
            "aav": aav,
            "notes": f"Extension detected from contract type: {contract_type}" if contract_type else "Extension detected from page content"
        }
    
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
            "extension": extension_data,  # FIXED: Now properly stores extension data instead of None
            "free_agency_year": max(s["year"] for s in salaries) if salaries else None
        },
        "data_source": "scraped"
    }

def parse_all_contracts(input_file, output_file):
    """Parse contracts from REAL scraped data only"""
    print("🔄 Parsing contract data from REAL scraped sources only...")
    
    with open(input_file, "r") as f:
        data = json.load(f)
    
    parsed_players = []
    scraped_count = 0
    skipped_count = 0
    
    for player_id, player_data in data.items():
        source = player_data.get("source", "unknown")
        
        # ONLY parse actual scraped HTML data
        if source == "scraped" and player_data.get("contractHtml"):
            parsed = parse_scraped_contract_html(player_id, player_data)
            if parsed:
                parsed_players.append(parsed)
                scraped_count += 1
            else:
                print(f"⚠️ Failed to parse HTML for {player_data.get('name', player_id)}")
                skipped_count += 1
        else:
            # Skip anything that's not real scraped data
            skipped_count += 1
    
    # Save parsed data
    with open(output_file, "w") as f:
        json.dump(parsed_players, f, indent=2)
    
    print(f"✅ Contract parsing complete!")
    print(f"   📡 Parsed from real scraped data: {scraped_count}")
    print(f"   ⏭️ Skipped non-scraped data: {skipped_count}")
    print(f"   📁 Total valid contracts: {len(parsed_players)}")
    print(f"   💾 Output: {output_file}")
    
    if scraped_count == 0:
        print(f"\n🛑 NO REAL CONTRACT DATA TO PARSE!")
        print(f"   This means the scraper didn't find any actual contract data")
        print(f"   Check if SalarySwish is accessible and working")
    
    return len(parsed_players) > 0

def main():
    """Main execution"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(script_dir)))  # Go up from helpers/contracts/ to project root
    data_pipeline_dir = os.path.join(project_root, "data_pipeline")
    
    # Use the correct pipeline locations
    input_file = os.path.join(data_pipeline_dir, "resources", "data", "raw_contract_html.json")
    output_file = os.path.join(data_pipeline_dir, "resources", "data", "contracts_parsed.json")
    
    if not os.path.exists(input_file):
        print(f"❌ Input file not found: {input_file}")
        print("Run scrape_all_contracts.py first")
        return
    
    parse_all_contracts(input_file, output_file)

if __name__ == "__main__":
    main()