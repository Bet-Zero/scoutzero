#!/usr/bin/env python3
"""
Contract data parser - processes raw contract HTML data into clean format
Based on original ScoutZero parsing logic with enhanced bird rights detection
"""

import json
import re
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
    Parse raw HTML contract data into structured format
    """
    print("🔧 Starting enhanced contract data parsing...")
    
    import os
    data_dir = os.path.join(os.path.dirname(__file__), '../../data')
    raw_contracts_file = os.path.join(data_dir, 'raw_contract_html.json')
    parsed_contracts_file = os.path.join(data_dir, 'parsed_contracts.json')
    
    if not os.path.exists(raw_contracts_file):
        print(f"❌ Raw contracts HTML file not found: {raw_contracts_file}")
        print("💡 Run scrape_all_contracts.py first")
        return None
    
    with open(raw_contracts_file, 'r') as f:
        raw_data = json.load(f)
    
    parsed_players = {}
    
    for player_id, raw_html in raw_data.get('players', {}).items():
        if not raw_html:
            continue
            
        try:
            soup = BeautifulSoup(raw_html, 'html.parser')
            
            # Extract player name
            name_tag = soup.find("h1") or soup.find("h2") or soup.find("h3")
            name = name_tag.get_text(strip=True) if name_tag else "Unknown"
            
            # Parse contract sections
            summary = parse_contract_summary_from_html_fixed(soup)
            notes = parse_kicker_notes_section(soup)
            
            # Extract other data
            team = extract_team_name(soup)
            agent_name, agency = extract_agent_info(soup)
            bird_rights = extract_bird_rights(soup)  # Enhanced parsing here
            bio, draft = extract_bio_and_draft(soup)
            cap_hold = extract_cap_hold(soup)
            
            # Build final player object
            parsed = {
                "player_id": player_id,
                "name": name,
                "team": team,
                "bio": bio,
                "agent": {"name": agent_name, "agency": agency},
                "draft": draft,
                "bird_rights": bird_rights,  # Now properly parsed
                "cap_hold": cap_hold,
                "signed_using": summary["signed_using"],
                "trade_kicker": notes["trade_kicker"],
                "no_trade_clause": notes["no_trade_clause"],
                "contract_summary": summary,
                "source": "enhanced_parser"
            }
            
            parsed_players[player_id] = parsed
            
        except Exception as e:
            print(f"❌ Error parsing player {player_id}: {e}")
            continue
    
    # Save parsed data
    result = {
        "last_updated": "2024-01-01T00:00:00",
        "players": parsed_players,
        "total_parsed": len(parsed_players)
    }
    
    with open(parsed_contracts_file, 'w') as f:
        json.dump(result, f, indent=2)
    
    print(f"✅ Enhanced parsing complete! Processed {len(parsed_players)} players")
    print(f"📄 Results saved to {parsed_contracts_file}")
    
    return parsed_contracts_file

if __name__ == "__main__":
    parse_contract_data()