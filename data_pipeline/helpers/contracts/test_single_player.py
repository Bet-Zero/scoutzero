#!/usr/bin/env python3
"""
Quick test script to validate player scraping with a single player
Usage: python3 test_single_player.py [player-slug]
Example: python3 test_single_player.py jayson-tatum
"""

import sys
import os
import json

# Add helpers to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_single_player_scrape(player_slug="jayson-tatum"):
    """Test scraping and parsing for a single player"""
    
    print(f"🏀 Testing Player Scrape: {player_slug}")
    print("=" * 60)
    
    # Try to import Playwright
    try:
        from playwright.sync_api import sync_playwright
        PLAYWRIGHT_AVAILABLE = True
        print("✅ Playwright is available")
    except ImportError:
        PLAYWRIGHT_AVAILABLE = False
        print("⚠️ Playwright not available - using requests")
        import requests
    
    # Step 1: Scrape the page
    print(f"\n📡 Step 1: Scraping {player_slug}...")
    url = f"https://www.salaryswish.com/players/{player_slug}"
    
    html_content = None
    
    if PLAYWRIGHT_AVAILABLE:
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                page = browser.new_page()
                page.goto(url, wait_until="networkidle", timeout=30000)
                
                try:
                    page.wait_for_selector("table", timeout=10000)
                    print("   ✅ Salary table loaded")
                except:
                    print("   ⚠️ No salary table found (may be normal)")
                
                html_content = page.content()
                browser.close()
                
                print(f"   ✅ Fetched {len(html_content) / 1024:.2f} KB with Playwright")
        except Exception as e:
            print(f"   ❌ Playwright error: {str(e)[:80]}...")
    
    if not html_content:
        try:
            import requests
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                html_content = response.text
                print(f"   ✅ Fetched {len(html_content) / 1024:.2f} KB with requests")
            else:
                print(f"   ❌ HTTP {response.status_code}")
        except Exception as e:
            print(f"   ❌ Requests error: {str(e)[:80]}...")
    
    if not html_content:
        print("\n❌ Failed to fetch HTML. Cannot continue.")
        return False
    
    # Step 2: Verify HTML contains salary data
    print(f"\n🔍 Step 2: Verifying HTML content...")
    
    import re
    salaries = re.findall(r'\$[\d,]+', html_content)
    years = re.findall(r'20\d{2}-\d{2}', html_content)
    
    print(f"   Found {len(set(salaries))} unique salary amounts")
    print(f"   Found {len(set(years))} unique year patterns")
    
    if salaries and years:
        print("   ✅ HTML contains salary data")
        print(f"   Sample salaries: {', '.join(list(set(salaries))[:5])}")
        print(f"   Sample years: {', '.join(list(set(years))[:5])}")
    else:
        print("   ⚠️ HTML may not contain salary data")
    
    # Step 3: Parse the data
    print(f"\n⚙️ Step 3: Parsing contract data...")
    
    from parse_contract_data_enhanced import parse_scraped_contract_html
    
    player_data = {
        "name": player_slug.replace("-", " ").title(),
        "contractHtml": html_content,
        "source": "scraped"
    }
    
    result = parse_scraped_contract_html(player_slug, player_data)
    
    if not result:
        print("   ❌ Parser returned None")
        return False
    
    print("   ✅ Parsing successful!")
    
    # Step 4: Display results
    print(f"\n📊 Step 4: Results Summary")
    print("   " + "=" * 56)
    
    print(f"   Player: {result.get('name', 'Unknown')}")
    print(f"   Contract Type: {result['contract_summary']['type']}")
    print(f"   Is Extension: {result['contract_summary']['is_extension']}")
    print(f"   Bird Rights: {result.get('bird_rights', 'N/A')}")
    
    print(f"\n   📈 Contract Details:")
    print(f"      Length: {result['contract_summary']['length']}")
    print(f"      Total Value: ${result['contract_summary']['value']:,}" if result['contract_summary']['value'] else "      Total Value: N/A")
    print(f"      AAV: ${result['contract_summary']['aav']:,}" if result['contract_summary']['aav'] else "      AAV: N/A")
    
    salaries = result['contract']['annual_salaries']
    
    if salaries:
        print(f"\n   💰 Annual Salaries ({len(salaries)} years):")
        for s in salaries:
            print(f"      {s['year']}: ${s['salary']:,}")
    else:
        print(f"\n   ❌ No annual salaries parsed!")
    
    # Save to file for inspection
    output_file = f"/tmp/{player_slug}_parsed.json"
    with open(output_file, "w") as f:
        json.dump(result, f, indent=2)
    
    print(f"\n💾 Full result saved to: {output_file}")
    
    # Final verdict
    print(f"\n{'=' * 60}")
    if salaries and len(salaries) > 0:
        print("✅ SUCCESS: Parser extracted salary data correctly!")
        return True
    else:
        print("❌ FAILURE: Parser did not extract salary data!")
        return False

if __name__ == "__main__":
    player_slug = sys.argv[1] if len(sys.argv) > 1 else "jayson-tatum"
    success = test_single_player_scrape(player_slug)
    exit(0 if success else 1)
