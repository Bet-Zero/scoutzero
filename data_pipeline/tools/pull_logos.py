import os
import requests

# ESPN logo base URL
BASE_URL = "https://a.espncdn.com/i/teamlogos/nba/500/"

# Team abbreviations mapped to your local filenames
teams = {
    'ATL': 'hawks',
    'BOS': 'celtics',
    'BKN': 'nets',
    'CHA': 'hornets',
    'CHI': 'bulls',
    'CLE': 'cavaliers',
    'DAL': 'mavericks',
    'DEN': 'nuggets',
    'DET': 'pistons',
    'GSW': 'warriors',
    'HOU': 'rockets',
    'IND': 'pacers',
    'LAC': 'clippers',
    'LAL': 'lakers',
    'MEM': 'grizzlies',
    'MIA': 'heat',
    'MIL': 'bucks',
    'MIN': 'timberwolves',
    'NO': 'pelicans',
    'NYK': 'knicks',
    'OKC': 'thunder',
    'ORL': 'magic',
    'PHI': 'sixers',
    'PHX': 'suns',
    'POR': 'blazers',
    'SAC': 'kings',
    'SAS': 'spurs',
    'TOR': 'raptors',
    'UTAH': 'jazz',
    'WAS': 'wizards'
}

# Output folder
TOOLS_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(os.path.dirname(TOOLS_DIR))
output_dir = os.path.join(PROJECT_ROOT, "public", "assets", "logos")
os.makedirs(output_dir, exist_ok=True)

for abbr, filename in teams.items():
    url = f"{BASE_URL}{abbr.lower()}.png"
    dest_path = os.path.join(output_dir, f"{filename}.png")

    try:
        response = requests.get(url)
        if response.status_code == 200:
            with open(dest_path, "wb") as f:
                f.write(response.content)
            print(f"✅ Downloaded {filename}.png")
        else:
            print(f"❌ Failed to download {filename}.png (status code {response.status_code})")
    except Exception as e:
        print(f"❌ Error downloading {filename}.png: {e}")
