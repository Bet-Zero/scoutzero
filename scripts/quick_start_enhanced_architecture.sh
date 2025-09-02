#!/bin/bash
# Quick Start Implementation Script for ScoutZero Data Architecture
# This script sets up the foundation for the enhanced data architecture

echo "🏀 ScoutZero Data Architecture Quick Start"
echo "=========================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the ScoutZero root directory"
    exit 1
fi

echo "📁 Creating directory structure..."

# Create enhanced data pipeline directories
mkdir -p data_pipeline/enhanced_acquisition
mkdir -p data_pipeline/orchestrator
mkdir -p data_pipeline/migration
mkdir -p data_pipeline/validation
mkdir -p src/utils/caching
mkdir -p scripts/setup

echo "✅ Directory structure created"

echo ""
echo "📦 Installing additional dependencies..."

# Install caching dependencies
npm install --save idb workbox-sw

# Install Python pipeline dependencies (if requirements.txt exists)
if [ -f "requirements.txt" ]; then
    echo "Installing Python dependencies..."
    pip3 install asyncio dataclasses pandas beautifulsoup4
else
    echo "⚠️  No requirements.txt found - you may need to install Python dependencies manually"
fi

echo ""
echo "🔧 Creating starter files..."

# Create a basic enhanced data collector
cat > data_pipeline/enhanced_acquisition/basic_collector.py << 'EOF'
#!/usr/bin/env python3
"""
Basic Enhanced Data Collector
A starting point for the improved data acquisition system
"""

import requests
import time
import json
from datetime import datetime
from typing import Dict, List, Optional

class BasicNBAStatsCollector:
    """Simple NBA stats collector with rate limiting"""
    
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        self.rate_limit_delay = 0.6  # 600ms between requests
    
    def get_player_list(self) -> List[Dict]:
        """Get list of all active players"""
        url = "https://stats.nba.com/stats/playerindex"
        params = {
            'College': '',
            'Country': '',
            'DraftPick': '',
            'DraftRound': '',
            'DraftYear': '',
            'Height': '',
            'Historical': '0',
            'LeagueID': '00',
            'Season': '2024-25',
            'SeasonType': 'Regular Season',
            'TeamID': '0',
            'Weight': ''
        }
        
        try:
            response = requests.get(url, headers=self.headers, params=params, timeout=30)
            time.sleep(self.rate_limit_delay)
            
            if response.status_code == 200:
                data = response.json()
                # Extract player data from response
                headers = data['resultSets'][0]['headers']
                rows = data['resultSets'][0]['rowSet']
                
                players = []
                for row in rows:
                    player = dict(zip(headers, row))
                    players.append({
                        'player_id': player.get('PERSON_ID'),
                        'name': player.get('PLAYER_FIRST_NAME', '') + ' ' + player.get('PLAYER_LAST_NAME', ''),
                        'team': player.get('TEAM_ABBREVIATION'),
                        'position': player.get('POSITION'),
                        'age': player.get('AGE'),
                        'height': player.get('HEIGHT'),
                        'weight': player.get('WEIGHT'),
                        'years_pro': player.get('YEARS_PRO')
                    })
                
                return players
            else:
                print(f"❌ NBA API error: {response.status_code}")
                return []
                
        except Exception as e:
            print(f"❌ Error fetching player list: {e}")
            return []
    
    def save_players_to_file(self, players: List[Dict], filename: str = None):
        """Save player data to JSON file"""
        if filename is None:
            filename = f"data_pipeline/raw/players_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        with open(filename, 'w') as f:
            json.dump({
                'players': players,
                'collected_at': datetime.now().isoformat(),
                'count': len(players)
            }, f, indent=2)
        
        print(f"✅ Saved {len(players)} players to {filename}")

if __name__ == "__main__":
    collector = BasicNBAStatsCollector()
    players = collector.get_player_list()
    
    if players:
        collector.save_players_to_file(players)
        print(f"🎉 Successfully collected data for {len(players)} players")
    else:
        print("❌ Failed to collect player data")
EOF

# Create basic cache manager
cat > src/utils/caching/BasicCacheManager.ts << 'EOF'
/**
 * Basic Cache Manager Implementation
 * Simple starting point for the multi-tier caching strategy
 */

interface BasicCacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class BasicCacheManager {
  private memoryCache = new Map<string, BasicCacheItem<any>>();
  private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes
  
  get<T>(key: string): T | null {
    const item = this.memoryCache.get(key);
    
    if (!item) {
      return null;
    }
    
    // Check if expired
    if (Date.now() - item.timestamp > item.ttl) {
      this.memoryCache.delete(key);
      return null;
    }
    
    return item.data;
  }
  
  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    const item: BasicCacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttl
    };
    
    this.memoryCache.set(key, item);
    
    // Simple cleanup - remove expired items periodically
    this.cleanup();
  }
  
  clear(): void {
    this.memoryCache.clear();
  }
  
  private cleanup(): void {
    const now = Date.now();
    
    for (const [key, item] of this.memoryCache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.memoryCache.delete(key);
      }
    }
  }
  
  // Get cache statistics
  getStats() {
    return {
      itemCount: this.memoryCache.size,
      keys: Array.from(this.memoryCache.keys())
    };
  }
}

// Export singleton instance
export const basicCache = new BasicCacheManager();
EOF

# Create setup script for Firebase schema
cat > scripts/setup/setup_basic_schema.js << 'EOF'
#!/usr/bin/env node
/**
 * Basic Schema Setup for Enhanced Architecture
 * Sets up the foundation for the optimized Firestore schema
 */

import { db } from '../../scripts/firebaseConfig.node.js';
import { doc, setDoc } from 'firebase/firestore';

async function setupBasicSchema() {
  console.log('🏗️ Setting up basic enhanced schema...');
  
  try {
    // Create schema info document
    await setDoc(doc(db, 'system', 'schema_info'), {
      version: '2.0-basic',
      setup_date: new Date(),
      status: 'initializing',
      description: 'Basic enhanced schema setup',
      collections: {
        players_v2: 'Enhanced player documents (basic setup)',
        cache_metadata: 'Cache management metadata'
      }
    });
    
    console.log('✅ Schema info document created');
    
    // Create cache metadata collection
    await setDoc(doc(db, 'cache_metadata', 'config'), {
      cache_version: '1.0',
      ttl_defaults: {
        players: 300000, // 5 minutes
        teams: 600000,   // 10 minutes
        stats: 180000    // 3 minutes
      },
      last_updated: new Date()
    });
    
    console.log('✅ Cache metadata collection created');
    
    console.log('🎉 Basic schema setup complete!');
    console.log('');
    console.log('📝 Next steps:');
    console.log('   1. Run: python3 data_pipeline/enhanced_acquisition/basic_collector.py');
    console.log('   2. Test the basic cache with your React components');
    console.log('   3. Review the full implementation guide in docs/PRACTICAL_IMPLEMENTATION_GUIDE.md');
    
  } catch (error) {
    console.error('❌ Schema setup failed:', error);
    process.exit(1);
  }
}

setupBasicSchema().catch(console.error);
EOF

# Make scripts executable
chmod +x data_pipeline/enhanced_acquisition/basic_collector.py
chmod +x scripts/setup/setup_basic_schema.js

echo ""
echo "📋 Creating quick reference guide..."

cat > QUICK_START_GUIDE.md << 'EOF'
# 🚀 Quick Start Guide for Enhanced Data Architecture

## What Was Set Up

This quick start script has created the foundation for implementing the enhanced data architecture:

### 📁 Directory Structure
```
data_pipeline/
├── enhanced_acquisition/     # New data collection methods
├── orchestrator/            # Pipeline management (to be implemented)
├── migration/              # Schema migration tools (to be implemented)
└── validation/             # Data validation (to be implemented)

src/utils/caching/          # Caching implementation
scripts/setup/              # Setup utilities
```

### 🔧 Starter Files Created

1. **Basic NBA Stats Collector** (`data_pipeline/enhanced_acquisition/basic_collector.py`)
   - Simple rate-limited API client
   - Collects player list from NBA Stats API
   - Saves data to JSON files

2. **Basic Cache Manager** (`src/utils/caching/BasicCacheManager.ts`)
   - In-memory caching with TTL
   - Simple cleanup mechanism
   - Cache statistics

3. **Schema Setup Script** (`scripts/setup/setup_basic_schema.js`)
   - Creates foundation Firestore documents
   - Sets up cache metadata collection

## 🏃‍♂️ Quick Test Run

### 1. Test Data Collection
```bash
# Create raw data directory
mkdir -p data_pipeline/raw

# Run basic data collector
python3 data_pipeline/enhanced_acquisition/basic_collector.py
```

### 2. Setup Firebase Schema
```bash
# Run basic schema setup
node scripts/setup/setup_basic_schema.js
```

### 3. Test Basic Caching in React
```tsx
// In any React component
import { basicCache } from '@/utils/caching/BasicCacheManager';

// Cache some data
basicCache.set('test-key', { message: 'Hello ScoutZero!' });

// Retrieve cached data
const cached = basicCache.get('test-key');
console.log('Cached data:', cached);

// Check cache stats
console.log('Cache stats:', basicCache.getStats());
```

## 📈 Next Steps

1. **Review the Full Guide**: Read `docs/PRACTICAL_IMPLEMENTATION_GUIDE.md` for complete implementation details

2. **Implement Progressive Loading**: Add the enhanced data hooks to your existing components

3. **Set Up Pipeline Orchestration**: Implement the full pipeline management system

4. **Add Persistent Caching**: Extend the basic cache manager with IndexedDB support

5. **Deploy Service Worker**: Add offline support with the service worker implementation

## 🔍 Verification

To verify the setup worked:

1. Check that directories were created: `ls -la data_pipeline/`
2. Test the collector: `python3 data_pipeline/enhanced_acquisition/basic_collector.py`
3. Verify Firebase setup: `node scripts/setup/setup_basic_schema.js`
4. Check npm dependencies: `npm list idb workbox-sw`

## 🆘 Troubleshooting

### Common Issues:

1. **Python dependencies missing**: Install with `pip3 install requests pandas`
2. **Firebase credentials**: Ensure `serviceAccountKey.json` is in project root
3. **Node modules**: Run `npm install` if dependencies are missing

### Get Help:

- Review the comprehensive guide: `docs/PRACTICAL_IMPLEMENTATION_GUIDE.md`
- Check existing implementation patterns in `src/hooks/`
- Examine current data pipeline in `data_pipeline/`
EOF

echo "✅ Quick start setup complete!"
echo ""
echo "🎉 You now have the foundation for enhanced data architecture!"
echo ""
echo "📖 Next steps:"
echo "   1. Read QUICK_START_GUIDE.md for immediate testing"
echo "   2. Review docs/PRACTICAL_IMPLEMENTATION_GUIDE.md for full implementation"
echo "   3. Test the basic collector: python3 data_pipeline/enhanced_acquisition/basic_collector.py"
echo "   4. Set up Firebase schema: node scripts/setup/setup_basic_schema.js"
echo ""
echo "🔗 For detailed implementation, see the comprehensive guide in docs/"