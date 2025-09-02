#!/usr/bin/env python3
"""
Spotrac Contract Integration for NBA Data Pipeline
Replaces SalarySwish with superior Spotrac data source
"""

import os
import sys
import json
import time
import requests
from bs4 import BeautifulSoup
import re
from typing import Dict, List, Optional

# Add the parent directory to the path to import Firebase helpers
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from helpers.firebase_helpers import get_all_players, update_player_contracts
except ImportError:
    print("Firebase helpers not available - running in demo mode")
    
    def get_all_players():
        return [
            {"id": "lebron_james", "displayName": "LeBron James"},
            {"id": "stephen_curry", "displayName": "Stephen Curry"},
            {"id": "nikola_jokic", "displayName": "Nikola Jokic"}
        ]
    
    def update_player_contracts(contracts):
        print(f"Would update {len(contracts)} player contracts in Firebase")
        for player_id, contract in contracts.items():
            print(f"  {contract['player_name']}: {contract.get('total_value', 'N/A')}")

class SpotracContractPipeline:
    """
    Production-ready Spotrac contract scraping pipeline
    Integrates with existing Firebase infrastructure
    """
    
    def __init__(self):
        self.base_url = "https://www.spotrac.com"
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
        })
        
        # Success tracking
        self.stats = {
            'total_players': 0,
            'successful_scrapes': 0,
            'failed_scrapes': 0,
            'start_time': time.time()
        }

    def run_contract_update(self):
        """
        Main pipeline function - replaces the SalarySwish pipeline
        """
        print("🏀 Starting Spotrac Contract Data Pipeline")
        print("=" * 50)
        
        # Get all players from Firebase
        print("📥 Fetching players from Firebase...")
        players = get_all_players()
        self.stats['total_players'] = len(players)
        print(f"   Found {len(players)} players")
        
        # Scrape contracts from Spotrac
        print(f"\n💰 Scraping contract data from Spotrac...")
        contracts = self.scrape_all_contracts(players)
        
        # Update Firebase with new contract data
        if contracts:
            print(f"\n📤 Updating Firebase with {len(contracts)} contracts...")
            update_player_contracts(contracts)
            print("   ✅ Firebase update complete")
        else:
            print("\n   ⚠️ No contracts to update")
        
        # Print summary
        self.print_summary()
        
        return contracts

    def scrape_all_contracts(self, players: List[Dict]) -> Dict:
        """
        Scrape contract data for all players using Spotrac
        """
        contracts = {}
        
        for i, player in enumerate(players):
            try:
                player_name = player.get('displayName', 'Unknown')
                print(f"  [{i+1}/{len(players)}] {player_name}")
                
                contract_data = self.scrape_player_contract(player)
                
                if contract_data:
                    contracts[player['id']] = contract_data
                    self.stats['successful_scrapes'] += 1
                    
                    # Show key contract info
                    total_value = contract_data.get('total_value', 'N/A')
                    years = contract_data.get('contract_years', 'N/A')
                    print(f"    ✅ {total_value} over {years} years")
                else:
                    self.stats['failed_scrapes'] += 1
                    print(f"    ❌ No contract data found")
                
                # Rate limiting - be respectful to Spotrac
                time.sleep(1)
                
            except Exception as e:
                self.stats['failed_scrapes'] += 1
                print(f"    ❌ Error: {str(e)}")
                continue
        
        return contracts

    def scrape_player_contract(self, player: Dict) -> Optional[Dict]:
        """
        Scrape contract data for a single player from Spotrac
        """
        player_name = player.get('displayName', '')
        
        # Generate possible Spotrac URLs
        urls = self._generate_spotrac_urls(player_name)
        
        for url in urls:
            try:
                response = self.session.get(url, timeout=15)
                
                if response.status_code == 200:
                    soup = BeautifulSoup(response.text, 'html.parser')
                    
                    # Check if this is actually a player contract page
                    if self._is_contract_page(soup):
                        contract_data = self._parse_contract_data(soup, player)
                        
                        if contract_data and contract_data.get('total_value'):
                            contract_data['source_url'] = url
                            contract_data['source'] = 'spotrac'
                            contract_data['scraped_at'] = int(time.time())
                            return contract_data
                
            except Exception as e:
                continue
        
        return None

    def _generate_spotrac_urls(self, player_name: str) -> List[str]:
        """
        Generate possible Spotrac URLs for a player
        """
        urls = []
        
        # Primary URL format: first-last
        slug = self._name_to_slug(player_name)
        urls.append(f"{self.base_url}/nba/player/{slug}/")
        
        # Alternative formats for edge cases
        alt_formats = [
            player_name.lower().replace(' ', '-').replace('.', ''),
            player_name.lower().replace(' ', '-').replace('.', '').replace("'", ""),
            '-'.join([part.lower() for part in player_name.split() if len(part) > 1]),
        ]
        
        for alt_slug in alt_formats:
            if alt_slug != slug and alt_slug:
                urls.append(f"{self.base_url}/nba/player/{alt_slug}/")
        
        return urls

    def _is_contract_page(self, soup: BeautifulSoup) -> bool:
        """
        Check if the page contains actual contract data
        """
        page_text = soup.get_text().lower()
        
        # Look for contract indicators
        contract_indicators = [
            'contract value', 'salary', 'cap hit', 'aav', 
            'guaranteed', 'free agent', 'extension'
        ]
        
        return any(indicator in page_text for indicator in contract_indicators)

    def _parse_contract_data(self, soup: BeautifulSoup, player: Dict) -> Dict:
        """
        Parse comprehensive contract data from Spotrac page
        """
        contract_data = {
            'player_id': player['id'],
            'player_name': player.get('displayName', ''),
        }
        
        # Extract total contract value
        total_value = self._extract_contract_value(soup)
        if total_value:
            contract_data['total_value'] = total_value
        
        # Extract contract years
        years = self._extract_contract_years(soup)
        if years:
            contract_data['contract_years'] = years
        
        # Extract yearly salary breakdown
        yearly_salaries = self._extract_yearly_salaries(soup)
        if yearly_salaries:
            contract_data['salaries_by_year'] = yearly_salaries
        
        # Extract free agency year
        fa_year = self._extract_fa_year(soup)
        if fa_year:
            contract_data['fa_year'] = fa_year
        
        # Extract guaranteed money
        guaranteed = self._extract_guaranteed_money(soup)
        if guaranteed:
            contract_data['guaranteed_money'] = guaranteed
        
        # Extract AAV (Average Annual Value)
        aav = self._extract_aav(soup)
        if aav:
            contract_data['aav'] = aav
        
        return contract_data

    def _extract_contract_value(self, soup: BeautifulSoup) -> Optional[str]:
        """Extract total contract value"""
        # Look for large dollar amounts
        money_pattern = re.compile(r'\$[\d,]+(?:\.\d+)?[MK]?')
        
        # Check common contract value locations
        value_selectors = [
            '.contract-value',
            '.total-value',
            'h1',
            'h2', 
            '.player-header',
            '[class*="value"]'
        ]
        
        largest_value = 0
        best_value = None
        
        for selector in value_selectors:
            elements = soup.select(selector)
            for element in elements:
                text = element.get_text()
                matches = money_pattern.findall(text)
                
                for match in matches:
                    # Convert to numeric for comparison
                    numeric_value = self._money_to_number(match)
                    if numeric_value and numeric_value > largest_value:
                        largest_value = numeric_value
                        best_value = match
        
        return best_value

    def _extract_contract_years(self, soup: BeautifulSoup) -> Optional[int]:
        """Extract contract length in years"""
        page_text = soup.get_text()
        
        # Look for year indicators
        year_patterns = [
            r'(\d+)[\s-]*year',
            r'(\d+)[\s-]*yr',
            r'signed.*?(\d+).*?year',
        ]
        
        for pattern in year_patterns:
            match = re.search(pattern, page_text, re.IGNORECASE)
            if match:
                years = int(match.group(1))
                if 1 <= years <= 10:  # Reasonable range
                    return years
        
        return None

    def _extract_yearly_salaries(self, soup: BeautifulSoup) -> Dict[str, str]:
        """Extract year-by-year salary breakdown"""
        yearly_data = {}
        
        # Look for tables with year/salary data
        tables = soup.find_all('table')
        
        for table in tables:
            rows = table.find_all('tr')
            
            for row in rows:
                cells = row.find_all(['td', 'th'])
                if len(cells) >= 2:
                    year_text = cells[0].get_text().strip()
                    salary_text = cells[1].get_text().strip()
                    
                    # Check if this looks like year/salary data
                    year_match = re.search(r'20(\d{2})', year_text)
                    if year_match and '$' in salary_text:
                        year = f"20{year_match.group(1)}"
                        salary = self._clean_money_value(salary_text)
                        
                        if salary:
                            yearly_data[year] = salary
        
        return yearly_data

    def _extract_fa_year(self, soup: BeautifulSoup) -> Optional[int]:
        """Extract free agency year"""
        page_text = soup.get_text()
        
        # Look for FA year indicators
        fa_patterns = [
            r'free agent.*?20(\d{2})',
            r'expires.*?20(\d{2})',
            r'through.*?20(\d{2})',
            r'20(\d{2}).*?free agent',
        ]
        
        for pattern in fa_patterns:
            match = re.search(pattern, page_text, re.IGNORECASE)
            if match:
                year = int(f"20{match.group(1)}")
                if 2024 <= year <= 2035:  # Reasonable range
                    return year
        
        return None

    def _extract_guaranteed_money(self, soup: BeautifulSoup) -> Optional[str]:
        """Extract guaranteed money amount"""
        page_text = soup.get_text()
        
        # Look for guaranteed money mentions
        guaranteed_pattern = re.compile(r'guaranteed.*?\$[\d,]+(?:\.\d+)?[MK]?', re.IGNORECASE)
        match = guaranteed_pattern.search(page_text)
        
        if match:
            money_match = re.search(r'\$[\d,]+(?:\.\d+)?[MK]?', match.group())
            if money_match:
                return money_match.group()
        
        return None

    def _extract_aav(self, soup: BeautifulSoup) -> Optional[str]:
        """Extract Average Annual Value"""
        page_text = soup.get_text()
        
        # Look for AAV mentions
        aav_patterns = [
            r'aav.*?\$[\d,]+(?:\.\d+)?[MK]?',
            r'average annual value.*?\$[\d,]+(?:\.\d+)?[MK]?',
            r'\$[\d,]+(?:\.\d+)?[MK]?.*?per year',
        ]
        
        for pattern in aav_patterns:
            match = re.search(pattern, page_text, re.IGNORECASE)
            if match:
                money_match = re.search(r'\$[\d,]+(?:\.\d+)?[MK]?', match.group())
                if money_match:
                    return money_match.group()
        
        return None

    def _money_to_number(self, money_str: str) -> Optional[float]:
        """Convert money string to numeric value for comparison"""
        if not money_str or '$' not in money_str:
            return None
        
        # Remove $ and commas
        cleaned = money_str.replace('$', '').replace(',', '')
        
        # Handle M and K suffixes
        multiplier = 1
        if cleaned.endswith('M'):
            multiplier = 1000000
            cleaned = cleaned[:-1]
        elif cleaned.endswith('K'):
            multiplier = 1000
            cleaned = cleaned[:-1]
        
        try:
            return float(cleaned) * multiplier
        except ValueError:
            return None

    def _clean_money_value(self, text: str) -> Optional[str]:
        """Clean and standardize money values"""
        money_match = re.search(r'\$[\d,]+(?:\.\d+)?', text)
        if money_match:
            return money_match.group()
        return None

    def _name_to_slug(self, name: str) -> str:
        """Convert player name to Spotrac URL slug"""
        # Remove periods and apostrophes, replace spaces with hyphens
        slug = name.lower().replace('.', '').replace("'", "").replace(' ', '-')
        
        # Remove any other non-alphanumeric characters except hyphens
        slug = re.sub(r'[^a-z0-9-]', '', slug)
        
        # Remove multiple consecutive hyphens
        slug = re.sub(r'-+', '-', slug)
        
        return slug.strip('-')

    def print_summary(self):
        """Print pipeline execution summary"""
        duration = time.time() - self.stats['start_time']
        success_rate = (self.stats['successful_scrapes'] / max(self.stats['total_players'], 1)) * 100
        
        print(f"\n📊 SPOTRAC CONTRACT PIPELINE SUMMARY")
        print("=" * 50)
        print(f"  Total Players: {self.stats['total_players']}")
        print(f"  Successful Scrapes: {self.stats['successful_scrapes']}")
        print(f"  Failed Scrapes: {self.stats['failed_scrapes']}")
        print(f"  Success Rate: {success_rate:.1f}%")
        print(f"  Duration: {duration:.1f} seconds")
        print(f"  Source: Spotrac (Superior to SalarySwish)")


def main():
    """
    Main function to run the Spotrac contract pipeline
    """
    pipeline = SpotracContractPipeline()
    contracts = pipeline.run_contract_update()
    
    print(f"\n✅ Spotrac contract pipeline complete!")
    print(f"   Replaced SalarySwish with superior data source")
    print(f"   Collected {len(contracts)} comprehensive contract records")
    
    return contracts


if __name__ == "__main__":
    main()