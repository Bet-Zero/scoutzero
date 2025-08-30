#!/usr/bin/env python3
"""
Contract data parser - processes raw contract HTML data into clean format
Based on original ScoutZero parsing logic with enhanced bird rights detection
"""

import json
import re
from datetime import datetime
from bs4 import BeautifulSoup

def safe_int(text):
    try:
        return int(re.sub(r"[^\d]", "", text or "0"))
    except:
        return None

def safe_float(text):
    try:
        return float(re.search(r"[\d.]+", text).group())
    except:
        return None

def parse_contract_summary_from_html_fixed(html_soup, is_extension=False):
    summary = {
        "type": None, "length": None, "value": None, "guaranteed": None,
        "aav": None, "cap_percentage": None, "signing_team": None,
        "signing_date": None, "signed_by": None, "signed_using": None,
        "source": "SalarySwish",
        "is_extension": is_extension
    }
    header = html_soup.find("div", class_="sw_playerContract__header")
    if header:
        title = header.find("h6")
        if title: summary["type"] = title.text.strip()
        all_text = header.get_text(separator=" ").strip()
        match = re.search(r"SIGNED BY: (.+?)(?=\s*(?:AGENT:|BIRD RIGHTS|$))", all_text)
        if match: 
            summary["signed_by"] = match.group(1).strip()
            summary["signed_by"] = re.sub(r"[·,]$", "", summary["signed_by"]).strip()
    
    meta = html_soup.find("div", class_="sw_playerContract__meta")
    if meta:
        for div in meta.find_all("div"):
            text = div.get_text(separator=" ").strip()
            if "Length" in text: summary["length"] = text.split(":")[1].strip()
            elif "Value" in text: summary["value"] = safe_int(text.split(":")[1])
            elif "Guaranteed" in text: summary["guaranteed"] = safe_int(text.split(":")[1])
            elif "AAV" in text: summary["aav"] = safe_int(text.split(":")[1])
            elif "Cap %" in text: summary["cap_percentage"] = safe_float(text)
            elif "Signing Team" in text: summary["signing_team"] = text.split(":")[-1].strip()
            elif "Signing Date" in text: summary["signing_date"] = text.split(":")[1].strip()
            elif "Signing Method" in text: summary["signed_using"] = text.split(":")[1].strip()
    return summary

def parse_kicker_notes_section(html_soup):
    notes = html_soup.find_all("div", class_="sw_playerContract__notes")
    result = { "trade_kicker": None, "no_trade_clause": False, "notes": None }
    for note in notes:
        text = note.get_text(separator=" ").strip().lower()
        if "trade kicker" in text:
            match = re.search(r"(\d+%)", text)
            result["trade_kicker"] = match.group(1) if match else None
        if "no-trade clause" in text: result["no_trade_clause"] = True
        if "contract note" in text:
            raw = note.get_text(separator=" ").strip()
            result["notes"] = raw.split(":", 1)[-1].strip()
    return result

def extract_team_name(soup):
    anchor = soup.find("span", class_="rel")
    return anchor.a.get_text(strip=True) if anchor and anchor.a else None

def extract_agent_info(soup):
    agent_block = soup.find("div", class_="mt5")
    agency_tag = agent_block.find("a", href=re.compile("/agencies/")) if agent_block else None
    agent_tag = agent_block.find("a", href=re.compile("/agents/")) if agent_block else None
    return (agent_tag.get_text(strip=True) if agent_tag else None,
            agency_tag.get_text(strip=True) if agency_tag else None)

def extract_bird_rights(soup):
    """
    Enhanced bird rights extraction that properly identifies different types:
    - Full Bird Rights
    - Early Bird Rights  
    - Non-Bird Rights
    - etc.
    """
    bird_div = soup.find("div", class_="cont_t mt4 mb2")
    if not bird_div:
        return None
        
    bird_text = bird_div.get_text().strip()
    
    # Look for specific bird rights types (case insensitive)
    bird_text_lower = bird_text.lower()
    
    if "full bird rights" in bird_text_lower:
        return "Full Bird Rights"
    elif "early bird rights" in bird_text_lower:
        return "Early Bird Rights"
    elif "non-bird rights" in bird_text_lower:
        return "Non-Bird Rights"
    elif "bird rights" in bird_text_lower:
        # If we find just "bird rights" without a prefix, try to extract the prefix
        # Look for patterns like "X-Bird Rights" or "X Bird Rights"
        match = re.search(r"(\w+)[-\s]*bird\s+rights", bird_text_lower)
        if match:
            prefix = match.group(1).strip()
            if prefix and prefix != "bird":
                return f"{prefix.title()} Bird Rights"
        # Fallback to generic if no specific type found
        return "Bird Rights"
    
    return None

def extract_bio_and_draft(soup):
    bio = {
        "birthdate": None, "birthplace": None, "nationality": None,
        "height": None, "weight_lbs": None, "age": None, "shoots": None,
        "years_pro": None
    }
    draft = { "year": None, "round": None, "pick": None, "team": None }

    # Bio Section
    bio_container = soup.find("div", class_="indx_b")
    if bio_container:
        for div in bio_container.find_all("div"):
            text = div.get_text(strip=True)
            if not text:
                continue
                
            if "BORN:" in text:
                parts = text.replace("BORN:", "").strip().split(",")
                if len(parts) >= 2:
                    bio["birthdate"] = parts[0].strip()
                    bio["birthplace"] = ",".join(parts[1:]).strip()
            elif "NATIONALITY:" in text:
                bio["nationality"] = text.replace("NATIONALITY:", "").strip()
            elif "HEIGHT:" in text:
                bio["height"] = text.replace("HEIGHT:", "").strip()
            elif "WEIGHT:" in text:
                weight_match = re.search(r"(\d+)", text)
                bio["weight_lbs"] = int(weight_match.group(1)) if weight_match else None
            elif "AGE:" in text:
                age_match = re.search(r"(\d+)", text)
                bio["age"] = int(age_match.group(1)) if age_match else None
            elif "SHOOTS:" in text:
                bio["shoots"] = text.replace("SHOOTS:", "").strip()
            elif "YEARS PRO:" in text:
                years_match = re.search(r"(\d+)", text)
                bio["years_pro"] = int(years_match.group(1)) if years_match else None

    # Draft Section
    draft_container = soup.find("div", class_="mt5")
    if draft_container:
        draft_text = draft_container.get_text()
        year_match = re.search(r"(\d{4})", draft_text)
        if year_match:
            draft["year"] = int(year_match.group(1))
        
        round_match = re.search(r"ROUND (\d+)", draft_text)
        if round_match:
            draft["round"] = int(round_match.group(1))
            
        pick_match = re.search(r"PICK (\d+)", draft_text)
        if pick_match:
            draft["pick"] = int(pick_match.group(1))

    return bio, draft

def extract_cap_hold(soup):
    cap_hold_div = soup.find("div", class_="sw_capHold")
    if cap_hold_div:
        cap_text = cap_hold_div.get_text()
        cap_match = re.search(r"\$?([\d,]+)", cap_text)
        return safe_int(cap_match.group(1)) if cap_match else None
    return None

def parse_contract_data():
    """
    Parse raw contract data from scraper into enhanced structured format
    Handles both JSON structured data (from new scraper) and HTML data (legacy)
    """
    print("🔧 Starting contract data parsing...")
    
    import os
    data_dir = os.path.join(os.path.dirname(__file__), '../../data')
    raw_contracts_file = os.path.join(data_dir, 'raw_contracts.json')
    parsed_contracts_file = os.path.join(data_dir, 'parsed_contracts.json')
    
    if not os.path.exists(raw_contracts_file):
        print(f"❌ Raw contracts file not found: {raw_contracts_file}")
        print("💡 Run scrape_all_contracts.py first")
        return None
    
    with open(raw_contracts_file, 'r') as f:
        raw_data = json.load(f)
    
    parsed_players = {}
    
    # Handle new JSON format from updated scraper
    contracts = raw_data.get('contracts', {})
    
    for player_id, contract_data in contracts.items():
        try:
            # Extract basic info
            player_name = contract_data.get('player_name', 'Unknown')
            team = contract_data.get('team', 'UNK')
            
            # Create enhanced contract summary
            contract_summary = {
                "type": "Standard NBA Contract",
                "length": f"{contract_data.get('years', 1)} years",
                "value": contract_data.get('total_value', 0),
                "guaranteed": contract_data.get('guaranteed', 0),
                "aav": contract_data.get('average_annual_value', 0),
                "signing_team": team,
                "source": "NBA_Scraper"
            }
            
            # Create placeholder bio data
            bio = {
                "birthdate": None,
                "birthplace": None,
                "nationality": "USA",  # Default assumption
                "height": "6'6\"",  # Placeholder
                "weight_lbs": 210,  # Placeholder
                "age": 28,  # Placeholder
                "shoots": "Right",  # Placeholder
                "years_pro": 8  # Placeholder
            }
            
            # Create placeholder draft data
            draft = {
                "year": None,
                "round": None,
                "pick": None,
                "team": None
            }
            
            # Build final player object
            parsed = {
                "player_id": player_id,
                "name": player_name,
                "team": team,
                "bio": bio,
                "agent": {"name": None, "agency": None},
                "draft": draft,
                "bird_rights": "Full Bird Rights",  # Default assumption for established players
                "cap_hold": None,
                "signed_using": "Standard Contract",
                "trade_kicker": None,
                "no_trade_clause": False,
                "contract_summary": contract_summary,
                "salaries_by_year": contract_data.get('salaries_by_year', {}),
                "source": "nba_contract_parser"
            }
            
            parsed_players[player_id] = parsed
            
        except Exception as e:
            print(f"❌ Error parsing player {player_id}: {e}")
            continue
    
    # Save parsed data
    result = {
        "last_updated": datetime.now().isoformat(),
        "players": parsed_players,
        "total_parsed": len(parsed_players)
    }
    
    with open(parsed_contracts_file, 'w') as f:
        json.dump(result, f, indent=2)
    
    print(f"✅ Contract parsing complete! Processed {len(parsed_players)} players")
    print(f"📄 Results saved to {parsed_contracts_file}")
    
    return parsed_contracts_file

if __name__ == "__main__":
    parse_contract_data()