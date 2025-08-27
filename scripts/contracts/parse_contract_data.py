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
    bird_div = soup.find("div", class_="cont_t mt4 mb2")
    return "Bird" if bird_div and "BIRD RIGHTS" in bird_div.get_text() else None

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
                bio["birthdate"] = text.replace("BORN:", "").strip()
            elif "BIRTHPLACE:" in text:
                bio["birthplace"] = text.replace("BIRTHPLACE:", "").strip()
            elif "NATIONALITY:" in text:
                nationalities = [span.text.strip() for span in div.find_all("span", class_="mr10")]
                bio["nationality"] = ", ".join(nationalities) if nationalities else None
            elif "HEIGHT:" in text:
                height_div = div.find("div", style="width:50px")
                if height_div:
                    bio["height"] = height_div.text.strip()
            elif "WEIGHT:" in text:
                weight_div = div.find("div", style="width:50px")
                if weight_div:
                    bio["weight_lbs"] = safe_int(weight_div.text.strip())
            elif "AGE:" in text:
                bio["age"] = safe_int(text.replace("AGE:", "").strip())
            elif "SHOOTS:" in text:
                bio["shoots"] = text.replace("SHOOTS:", "").strip()

    # Draft Section
    draft_container = soup.find("div", id="pld_cc")
    if draft_container:
        for div in draft_container.find_all("div", class_="pld_c3"):
            text = div.get_text(strip=True)
            if not text:
                continue
                
            if "DRAFT YEAR:" in text:
                draft["year"] = safe_int(div.find("a").text) if div.find("a") else None
            elif "DRAFTED OVERALL:" in text:
                draft["pick"] = safe_int(text.replace("DRAFTED OVERALL:", "").strip())
            elif "DRAFT ROUND:" in text:
                draft["round"] = safe_int(text.replace("DRAFT ROUND:", "").strip())
            elif "DRAFTED BY:" in text:
                draft["team"] = text.replace("DRAFTED BY:", "").strip()

    return bio, draft

def extract_cap_hold(soup):
    cap_section = soup.find("div", class_="sw_playerContract__financialDetails")
    if cap_section:
        match = re.search(r"Cap Hold [\d-]+: \$([\d,]+)", cap_section.get_text())
        if match:
            return int(match.group(1).replace(",", ""))
    return 0

def parse_salary_table(soup):
    salaries = []
    table = soup.find("table")
    if not table: return salaries
    rows = table.find_all("tr")[1:]
    for row in rows:
        cells = row.find_all("td")
        if not cells or "TOTAL" in cells[0].text: continue
        try:
            year = int(re.match(r"\d{4}", cells[0].text).group())
            salary = int(re.sub(r"[^\d]", "", cells[3].text))
            option = None
            if cells[1].find("span", class_="contract_tag contract_option"):
                option = "Player Option" if "player" in cells[1].text.lower() else "Team Option"
            if year > 2000 and salary > 0:
                salaries.append({ "year": year, "salary": salary, "guaranteed": True, "option": option })
        except:
            continue
    return salaries

def parse_all_contracts(input_file, output_file):
    with open(input_file, "r") as f:
        data = json.load(f)

    parsed_players = []
    for player_id, player_data in data.items():
        name = player_data.get("name")
        raw_html = player_data.get("contractHtml", "")
        if not raw_html.strip(): continue
        soup = BeautifulSoup(raw_html, "html.parser")
        body = soup.find("div", class_="sw_bodyContent")
        scoped = body if body else soup
        
        # Find all contract sections (current + extensions)
        contract_sections = scoped.find_all("div", class_="sw_playerContract")
        if not contract_sections: continue
            
        # Parse current contract (first section)
        current_contract = contract_sections[0]
        summary = parse_contract_summary_from_html_fixed(current_contract)
        notes = parse_kicker_notes_section(current_contract)
        salaries = parse_salary_table(current_contract)
        
        # Parse extension if exists
        extension = None
        extension_salaries = []
        if len(contract_sections) > 1 and "extension" in contract_sections[1].get_text().lower():
            extension_contract = contract_sections[1]
            extension_summary = parse_contract_summary_from_html_fixed(extension_contract, is_extension=True)
            extension_notes = parse_kicker_notes_section(extension_contract)
            extension_salaries = parse_salary_table(extension_contract)
            
            extension = {
                "summary": extension_summary,
                "notes": extension_notes,
                "annual_salaries": extension_salaries,
                "options": [{"year": s["year"], "type": s["option"]} for s in extension_salaries if s.get("option")],
                "total_value": sum(s["salary"] for s in extension_salaries),
                "contract_length": len(extension_salaries),
                "signed_year": extension_salaries[0]["year"] if extension_salaries else None,
                "signing_team": extension_summary["signing_team"],
                "guaranteed_years": len([s for s in extension_salaries if s["guaranteed"]]),
                "average_annual_value": int(sum(s["salary"] for s in extension_salaries)/len(extension_salaries)) if extension_salaries else None,
            }

        # Calculate free agency year
        free_agency_year = None
        if extension_salaries:
            free_agency_year = max(s["year"] for s in extension_salaries) + 1
        elif salaries:
            free_agency_year = max(s["year"] for s in salaries) + 1

        # Get other player data
        team = extract_team_name(scoped)
        agent_name, agency = extract_agent_info(scoped)
        bird_rights = extract_bird_rights(scoped)
        bio, draft = extract_bio_and_draft(scoped)
        cap_hold = extract_cap_hold(scoped)

        # Build final player object
        parsed = {
            "player_id": player_id,
            "name": name,
            "team": team,
            "position": None,
            "status": None,
            "bio": bio,
            "agent": {"name": agent_name, "agency": agency},
            "draft": draft,
            "bird_rights": bird_rights,
            "free_agent_type": "UFA" if "ufa" in raw_html.lower() else "RFA" if "rfa" in raw_html.lower() else None,
            "free_agency_year": free_agency_year,  # New explicit field
            "cap_hold": cap_hold,
            "qualifying_offer": None,
            "signed_using": summary["signed_using"],
            "trade_kicker": notes["trade_kicker"],
            "no_trade_clause": notes["no_trade_clause"],
            "contract_summary": summary,
            "contract": {
                "annual_salaries": salaries,
                "options": [{"year": s["year"], "type": s["option"]} for s in salaries if s.get("option")],
                "total_value": sum(s["salary"] for s in salaries),
                "contract_length": len(salaries),
                "signed_year": salaries[0]["year"] if salaries else None,
                "signing_team": summary["signing_team"],
                "guaranteed_years": len([s for s in salaries if s["guaranteed"]]),
                "average_annual_value": int(sum(s["salary"] for s in salaries)/len(salaries)) if salaries else None,
                "incentives": {"likely": 0, "unlikely": 0},
                "notes": notes["notes"],
                "extension": extension,  # None if no extension exists
                "free_agency_year": free_agency_year  # Also in contract for easy access
            },
            "source_url": f"https://www.salaryswish.com/players/{player_id.replace('_', '-')}"
        }

        parsed_players.append(parsed)

    with open(output_file, "w") as f:
        json.dump(parsed_players, f, indent=2)

if __name__ == "__main__":
    parse_all_contracts("../data/raw_contract_html.json", "../data/contracts_parsed.json")