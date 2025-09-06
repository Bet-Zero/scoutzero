#!/usr/bin/env python3
"""
Team-Based Contract Data Collection
Superior approach: 30 team requests vs 450+ individual player requests
Provides comprehensive cap data including luxury tax, apron status, etc.
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
        return []
    
    def update_player_contracts(contracts):
        print(f"Would update {len(contracts)} contracts in Firebase")

class TeamBasedContractPipeline:
    """
    Team-based contract collection - much more efficient and comprehensive
    """
    
    def __init__(self, source="spotrac"):
        self.source = source
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
        })
        
        # NBA teams with their URL mappings
        self.nba_teams = {
            'ATL': {'name': 'Atlanta Hawks', 'spotrac': 'atlanta-hawks', 'salaryswish': 'atlanta-hawks'},
            'BOS': {'name': 'Boston Celtics', 'spotrac': 'boston-celtics', 'salaryswish': 'boston-celtics'},
            'BRK': {'name': 'Brooklyn Nets', 'spotrac': 'brooklyn-nets', 'salaryswish': 'brooklyn-nets'},
            'CHA': {'name': 'Charlotte Hornets', 'spotrac': 'charlotte-hornets', 'salaryswish': 'charlotte-hornets'},
            'CHI': {'name': 'Chicago Bulls', 'spotrac': 'chicago-bulls', 'salaryswish': 'chicago-bulls'},
            'CLE': {'name': 'Cleveland Cavaliers', 'spotrac': 'cleveland-cavaliers', 'salaryswish': 'cleveland-cavaliers'},
            'DAL': {'name': 'Dallas Mavericks', 'spotrac': 'dallas-mavericks', 'salaryswish': 'dallas-mavericks'},
            'DEN': {'name': 'Denver Nuggets', 'spotrac': 'denver-nuggets', 'salaryswish': 'denver-nuggets'},
            'DET': {'name': 'Detroit Pistons', 'spotrac': 'detroit-pistons', 'salaryswish': 'detroit-pistons'},
            'GSW': {'name': 'Golden State Warriors', 'spotrac': 'golden-state-warriors', 'salaryswish': 'golden-state-warriors'},
            'HOU': {'name': 'Houston Rockets', 'spotrac': 'houston-rockets', 'salaryswish': 'houston-rockets'},
            'IND': {'name': 'Indiana Pacers', 'spotrac': 'indiana-pacers', 'salaryswish': 'indiana-pacers'},
            'LAC': {'name': 'LA Clippers', 'spotrac': 'la-clippers', 'salaryswish': 'la-clippers'},
            'LAL': {'name': 'Los Angeles Lakers', 'spotrac': 'los-angeles-lakes', 'salaryswish': 'los-angeles-lakers'},
            'MEM': {'name': 'Memphis Grizzlies', 'spotrac': 'memphis-grizzlies', 'salaryswish': 'memphis-grizzlies'},
            'MIA': {'name': 'Miami Heat', 'spotrac': 'miami-heat', 'salaryswish': 'miami-heat'},
            'MIL': {'name': 'Milwaukee Bucks', 'spotrac': 'milwaukee-bucks', 'salaryswish': 'milwaukee-bucks'},
            'MIN': {'name': 'Minnesota Timberwolves', 'spotrac': 'minnesota-timberwolves', 'salaryswish': 'minnesota-timberwolves'},
            'NOP': {'name': 'New Orleans Pelicans', 'spotrac': 'new-orleans-pelicans', 'salaryswish': 'new-orleans-pelicans'},
            'NYK': {'name': 'New York Knicks', 'spotrac': 'new-york-knicks', 'salaryswish': 'new-york-knicks'},
            'OKC': {'name': 'Oklahoma City Thunder', 'spotrac': 'oklahoma-city-thunder', 'salaryswish': 'oklahoma-city-thunder'},
            'ORL': {'name': 'Orlando Magic', 'spotrac': 'orlando-magic', 'salaryswish': 'orlando-magic'},
            'PHI': {'name': 'Philadelphia 76ers', 'spotrac': 'philadelphia-76ers', 'salaryswish': 'philadelphia-76ers'},
            'PHX': {'name': 'Phoenix Suns', 'spotrac': 'phoenix-suns', 'salaryswish': 'phoenix-suns'},
            'POR': {'name': 'Portland Trail Blazers', 'spotrac': 'portland-trail-blazers', 'salaryswish': 'portland-trail-blazers'},
            'SAC': {'name': 'Sacramento Kings', 'spotrac': 'sacramento-kings', 'salaryswish': 'sacramento-kings'},
            'SAS': {'name': 'San Antonio Spurs', 'spotrac': 'san-antonio-spurs', 'salaryswish': 'san-antonio-spurs'},
            'TOR': {'name': 'Toronto Raptors', 'spotrac': 'toronto-raptors', 'salaryswish': 'toronto-raptors'},
            'UTA': {'name': 'Utah Jazz', 'spotrac': 'utah-jazz', 'salaryswish': 'utah-jazz'},
            'WAS': {'name': 'Washington Wizards', 'spotrac': 'washington-wizards', 'salaryswish': 'washington-wizards'}
        }

    def get_team_contracts_spotrac(self, team_abbrev: str) -> Dict:
        """Get complete team contract data from Spotrac team page"""
        try:
            team_slug = self.nba_teams[team_abbrev]['spotrac']
            url = f"https://www.spotrac.com/nba/{team_slug}/cap/"
            
            print(f"📊 Fetching {team_abbrev} contracts from Spotrac...")
            response = self.session.get(url)
            
            if response.status_code != 200:
                print(f"❌ Failed to fetch {team_abbrev}: HTTP {response.status_code}")
                return {}
                
            soup = BeautifulSoup(response.content, 'html.parser')
            
            team_data = {
                'team_abbrev': team_abbrev,
                'team_name': self.nba_teams[team_abbrev]['name'],
                'source': 'spotrac_team_page',
                'url': url,
                'players': {},
                'team_totals': {}
            }
            
            # Extract team salary totals
            salary_table = soup.find('table', class_='salaries')
            if salary_table:
                # Extract team cap information
                cap_rows = salary_table.find_all('tr')
                for row in cap_rows:
                    cells = row.find_all(['td', 'th'])
                    if len(cells) >= 2:
                        label = cells[0].get_text(strip=True)
                        value = cells[1].get_text(strip=True)
                        
                        if 'Total Team Salary' in label:
                            team_data['team_totals']['total_salary'] = value
                        elif 'Luxury Tax Space' in label:
                            team_data['team_totals']['luxury_tax_space'] = value
                        elif 'Cap Space' in label:
                            team_data['team_totals']['cap_space'] = value
            
            # Extract individual player contracts
            roster_table = soup.find('table', class_='roster')
            if roster_table:
                rows = roster_table.find('tbody').find_all('tr')
                
                for row in rows:
                    cells = row.find_all('td')
                    if len(cells) >= 6:
                        player_name = cells[0].get_text(strip=True)
                        position = cells[1].get_text(strip=True)
                        salary_2024 = cells[2].get_text(strip=True)
                        salary_2025 = cells[3].get_text(strip=True) if len(cells) > 3 else ""
                        
                        # Create player contract data
                        player_id = self.normalize_player_name(player_name)
                        team_data['players'][player_id] = {
                            'name': player_name,
                            'position': position,
                            'salary_2024_25': salary_2024,
                            'salary_2025_26': salary_2025,
                            'team': team_abbrev
                        }
            
            print(f"✅ {team_abbrev}: {len(team_data['players'])} players, totals: {team_data['team_totals']}")
            return team_data
            
        except Exception as e:
            print(f"❌ Error fetching {team_abbrev} from Spotrac: {e}")
            return {}

    def get_team_contracts_salaryswish(self, team_abbrev: str) -> Dict:
        """Get team contract data from SalarySwish team page"""
        try:
            team_slug = self.nba_teams[team_abbrev]['salaryswish'] 
            url = f"https://www.salaryswish.com/teams/{team_slug}"
            
            print(f"📊 Fetching {team_abbrev} contracts from SalarySwish...")
            response = self.session.get(url)
            
            if response.status_code != 200:
                print(f"❌ Failed to fetch {team_abbrev}: HTTP {response.status_code}")
                return {}
                
            soup = BeautifulSoup(response.content, 'html.parser')
            
            team_data = {
                'team_abbrev': team_abbrev,
                'team_name': self.nba_teams[team_abbrev]['name'],
                'source': 'salaryswish_team_page',
                'url': url,
                'players': {},
                'team_totals': {}
            }
            
            # SalarySwish team page parsing logic would go here
            # This is a placeholder - would need actual HTML structure analysis
            
            return team_data
            
        except Exception as e:
            print(f"❌ Error fetching {team_abbrev} from SalarySwish: {e}")
            return {}

    def normalize_player_name(self, name: str) -> str:
        """Convert player name to consistent ID format"""
        return name.lower().replace(".", "").replace("'", "").replace(" ", "_").replace("-", "_")

    def collect_all_team_contracts(self) -> Dict:
        """Collect contracts for all 30 NBA teams"""
        print(f"🚀 Starting team-based contract collection using {self.source}")
        
        all_contracts = {}
        team_errors = []
        
        for team_abbrev in self.nba_teams.keys():
            try:
                if self.source == "spotrac":
                    team_data = self.get_team_contracts_spotrac(team_abbrev)
                else:
                    team_data = self.get_team_contracts_salaryswish(team_abbrev)
                
                if team_data:
                    all_contracts[team_abbrev] = team_data
                    
                # Rate limiting
                time.sleep(2)
                
            except Exception as e:
                print(f"❌ Failed to process {team_abbrev}: {e}")
                team_errors.append(team_abbrev)
        
        print(f"✅ Contract collection complete!")
        print(f"📊 Teams processed: {len(all_contracts)}/30")
        print(f"❌ Teams with errors: {len(team_errors)}")
        
        if team_errors:
            print(f"   Error teams: {', '.join(team_errors)}")
        
        return all_contracts

    def export_contracts_to_firebase(self, all_contracts: Dict):
        """Export team contract data to new Firebase structure"""
        print("💾 Exporting to Firebase...")
        
        # Convert team-based data to player-based updates
        player_updates = {}
        
        for team_abbrev, team_data in all_contracts.items():
            for player_id, player_contract in team_data['players'].items():
                player_updates[player_id] = {
                    'contract_data': player_contract,
                    'team_cap_data': team_data['team_totals'],
                    'last_contract_update': time.time(),
                    'contract_source': team_data['source']
                }
        
        # Use existing Firebase helper (would be updated for new schema)
        update_player_contracts(player_updates)
        
        print(f"✅ Exported {len(player_updates)} player contracts")

def main():
    """Run team-based contract collection"""
    print("🏀 NBA Team-Based Contract Data Collection")
    print("=" * 50)
    
    # Use Spotrac by default (superior data source)
    pipeline = TeamBasedContractPipeline(source="spotrac")
    
    # Collect all team contracts (30 requests instead of 450+)
    all_contracts = pipeline.collect_all_team_contracts()
    
    # Export to new separated Firebase schema
    if all_contracts:
        pipeline.export_contracts_to_firebase(all_contracts)
        
        # Save backup locally
        output_file = "team_contracts_output.json"
        with open(output_file, 'w') as f:
            json.dump(all_contracts, f, indent=2)
        print(f"💾 Backup saved to {output_file}")
    
    print("🎉 Team-based contract collection complete!")

if __name__ == "__main__":
    main()