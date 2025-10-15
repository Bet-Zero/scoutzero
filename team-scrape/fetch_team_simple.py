#!/usr/bin/env python3
"""
Simple HTTP-based team data fetcher for SalarySwish

This is a lightweight alternative to the Playwright-based fetch_page.ts that keeps timing out.
Uses standard HTTP requests instead of a headless browser - much faster and more reliable.

Usage:
    python3 team-scrape/fetch_team_simple.py --url https://www.salaryswish.com/teams/lakers
    
    Or via npm:
    TEAM_URL="https://www.salaryswish.com/teams/lakers" npm run fetch:simple
"""

import argparse
import os
import sys
import requests
from pathlib import Path

def fetch_team_page(url: str, output_file: str = "page.html", timeout: int = 30) -> bool:
    """
    Fetch a SalarySwish team page using simple HTTP request
    
    Args:
        url: SalarySwish team page URL (e.g., https://www.salaryswish.com/teams/lakers)
        output_file: Output file path (default: page.html)
        timeout: Request timeout in seconds (default: 30)
    
    Returns:
        bool: True if successful, False otherwise
    """
    print(f"🏀 Fetching team page: {url}")
    print(f"📝 Output file: {output_file}")
    print(f"⏱️  Timeout: {timeout}s")
    print()
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
    }
    
    try:
        print("📡 Sending HTTP request...")
        response = requests.get(url, headers=headers, timeout=timeout, allow_redirects=True)
        response.raise_for_status()
        
        print(f"✅ Response received: {response.status_code}")
        print(f"📊 Content length: {len(response.text)} characters")
        
        # Write to file
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(response.text)
        
        print(f"✅ Saved to {output_file}")
        print()
        print("⚠️  NOTE: This fetches the static HTML only.")
        print("   Some dynamic content (like draft picks) may not be fully rendered.")
        print("   If you need dynamic content, the TypeScript/Playwright approach is required.")
        print()
        print("Next steps:")
        print("  1. Inspect the page: npm run inspect")
        print("  2. Parse to JSON: npm run parse")
        
        return True
        
    except requests.exceptions.Timeout:
        print(f"❌ Request timed out after {timeout}s")
        print("   Try increasing the timeout or check your internet connection")
        return False
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return False
        
    except IOError as e:
        print(f"❌ Failed to write output file: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(
        description="Fetch SalarySwish team page using simple HTTP request"
    )
    parser.add_argument(
        '--url',
        type=str,
        default=os.environ.get('TEAM_URL'),
        help='SalarySwish team page URL (or set TEAM_URL env var)'
    )
    parser.add_argument(
        '--output',
        type=str,
        default='page.html',
        help='Output file path (default: page.html)'
    )
    parser.add_argument(
        '--timeout',
        type=int,
        default=30,
        help='Request timeout in seconds (default: 30)'
    )
    
    args = parser.parse_args()
    
    if not args.url:
        print("❌ Error: TEAM_URL is required")
        print()
        print("Usage:")
        print("  python3 team-scrape/fetch_team_simple.py --url https://www.salaryswish.com/teams/lakers")
        print("  Or:")
        print('  TEAM_URL="https://www.salaryswish.com/teams/lakers" python3 team-scrape/fetch_team_simple.py')
        sys.exit(1)
    
    # Change to the team-scrape directory if output is relative path
    if not os.path.isabs(args.output):
        script_dir = Path(__file__).parent
        os.chdir(script_dir)
    
    success = fetch_team_page(args.url, args.output, args.timeout)
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
