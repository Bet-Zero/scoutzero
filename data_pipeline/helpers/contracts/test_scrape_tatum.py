#!/usr/bin/env python3
"""
Test script to scrape and analyze Jayson Tatum's contract page
"""

import requests
from bs4 import BeautifulSoup
import json

def scrape_tatum():
    """Scrape Jayson Tatum's contract page"""
    url = "https://www.salaryswish.com/players/jayson-tatum"
    
    print(f"🔍 Fetching {url}...")
    response = requests.get(url, timeout=10)
    
    print(f"✅ Status: {response.status_code}")
    print(f"📦 Size: {len(response.text) / 1024:.2f} KB")
    
    # Parse HTML
    soup = BeautifulSoup(response.text, "html.parser")
    
    # Find the body content
    body = soup.find("div", class_="sw_bodyContent")
    if not body:
        print("❌ No sw_bodyContent found")
        return None
    
    print("✅ Found sw_bodyContent")
    
    # Look for tables
    tables = body.find_all("table")
    print(f"📊 Found {len(tables)} table(s)")
    
    # Inspect each table
    for i, table in enumerate(tables):
        print(f"\n🔍 Inspecting Table {i+1}:")
        
        # Get table classes
        table_classes = table.get("class", [])
        print(f"   Classes: {', '.join(table_classes) if table_classes else 'None'}")
        
        # Get header row
        headers = []
        header_row = table.find("tr")
        if header_row:
            headers = [th.text.strip() for th in header_row.find_all(["th", "td"])]
            print(f"   Headers: {headers}")
        
        # Get first data row
        rows = table.find_all("tr")[1:2]  # Get just first data row
        for row in rows:
            cells = row.find_all("td")
            if cells:
                cell_texts = [cell.text.strip() for cell in cells]
                print(f"   First row: {cell_texts}")
        
        # Count total rows
        all_rows = table.find_all("tr")
        print(f"   Total rows: {len(all_rows)}")
    
    # Save sample HTML for inspection
    sample_html = str(body)[:5000]  # First 5000 chars
    print(f"\n📝 Sample HTML (first 5000 chars):")
    print(sample_html)
    
    # Try to find salary data with different patterns
    print(f"\n🔍 Searching for salary patterns...")
    
    # Pattern 1: Look for $ amounts
    import re
    salary_patterns = re.findall(r'\$[\d,]+', body.get_text())
    unique_salaries = list(set(salary_patterns))[:10]  # First 10 unique
    print(f"   Found {len(unique_salaries)} unique salary amounts (showing first 10):")
    for sal in unique_salaries:
        print(f"      {sal}")
    
    # Pattern 2: Look for year patterns like "2025-26"
    year_patterns = re.findall(r'20\d{2}-\d{2}', body.get_text())
    unique_years = list(set(year_patterns))
    print(f"   Found {len(unique_years)} unique year patterns:")
    for year in unique_years:
        print(f"      {year}")
    
    # Save full HTML for debugging
    output_file = "/tmp/tatum_contract.html"
    with open(output_file, "w") as f:
        f.write(response.text)
    print(f"\n💾 Full HTML saved to: {output_file}")
    
    return response.text

if __name__ == "__main__":
    scrape_tatum()
