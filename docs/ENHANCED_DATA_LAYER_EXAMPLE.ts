/**
 * Enhanced Data Layer Implementation Example
 * 
 * This file demonstrates how the improved data architecture would work
 * in practice, showing concrete implementations of the recommended patterns.
 */

// ==========================================
// 1. OPTIMIZED FIRESTORE SCHEMA EXAMPLE
// ==========================================

/**
 * New player document structure - optimized for performance
 */
interface PlayerDocumentV2 {
  // Immutable identity data
  identity: {
    player_id: string;
    name: string;
    display_name: string;
    draft: {
      year: number;
      round: number;
      pick: number;
      team: string;
    };
  };

  // Hot path data (frequently accessed)
  current: {
    bio: {
      age: number;
      height: string;
      weight: number;
      position: string;
      team: string;
      years_pro: number;
    };
    stats: {
      gp: number;
      pts: number;
      reb: number;
      ast: number;
      fg_pct: number;
      three_pct: number;
      ft_pct: number;
      // ... other stats
    };
    contract: {
      total_value: number;
      years_remaining: number;
      current_salary: number;
      fa_year: number;
      fa_type: string;
    };
    evaluation: {
      overall_grade: number | string;
      traits: Record<string, number>;
      roles: {
        offense1: string;
        defense1: string;
      };
      badges: string[];
    };
  };

  // Pre-computed fields (calculated server-side)
  computed: {
    salary_by_year: Record<number, number>;
    formatted_position: string;
    height_inches: number;
    headshot_url: string;
    trade_value: number;
    cap_hit_current: number;
    is_tradeable: boolean;
    contract_efficiency: number;
  };

  // Metadata
  version: string;
  last_updated: string;
  schema_version: "2.0";
}

/**
 * Lightweight player index for lists and tables
 */
interface PlayerIndex {
  player_id: string;
  name: string;
  display_name: string;
  position: string;
  team: string;
  age: number;
  salary_current: number;
  overall_grade: number | string;
  status: string;
  last_updated: string;
}

// ==========================================
// 2. MULTI-TIER CACHING IMPLEMENTATION
// ==========================================

/**
 * Enhanced caching service with multiple tiers
 */
class DataCacheService {
  private memoryCache = new Map<string, any>();
  private persistentCache: IDBDatabase | null = null;
  private cacheConfig = {
    memory: {
      maxSize: 1000,
      ttl: 5 * 60 * 1000, // 5 minutes
    },
    persistent: {
      ttl: 24 * 60 * 60 * 1000, // 24 hours
    },
  };

  async init() {
    // Initialize IndexedDB for persistent caching
    this.persistentCache = await this.openDB();
  }

  /**
   * Get data with multi-tier lookup
   */
  async get<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    // Tier 1: Memory cache
    const memoryData = this.memoryCache.get(key);
    if (memoryData && !this.isExpired(memoryData.timestamp, this.cacheConfig.memory.ttl)) {
      return memoryData.data;
    }

    // Tier 2: Persistent cache (IndexedDB)
    const persistentData = await this.getFromPersistent(key);
    if (persistentData && !this.isExpired(persistentData.timestamp, this.cacheConfig.persistent.ttl)) {
      // Promote to memory cache
      this.memoryCache.set(key, persistentData);
      return persistentData.data;
    }

    // Tier 3: Fetch fresh data
    const freshData = await fetcher();
    await this.set(key, freshData);
    return freshData;
  }

  /**
   * Set data in all cache tiers
   */
  async set(key: string, data: any) {
    const cacheEntry = {
      data,
      timestamp: Date.now(),
    };

    // Memory cache
    this.memoryCache.set(key, cacheEntry);
    this.enforceMemoryLimit();

    // Persistent cache
    await this.setToPersistent(key, cacheEntry);
  }

  /**
   * Invalidate cache entries
   */
  invalidate(pattern: string | RegExp) {
    // Clear memory cache
    if (typeof pattern === 'string') {
      this.memoryCache.delete(pattern);
    } else {
      for (const key of this.memoryCache.keys()) {
        if (pattern.test(key)) {
          this.memoryCache.delete(key);
        }
      }
    }

    // Clear persistent cache
    this.clearFromPersistent(pattern);
  }

  private isExpired(timestamp: number, ttl: number): boolean {
    return Date.now() - timestamp > ttl;
  }

  private enforceMemoryLimit() {
    if (this.memoryCache.size > this.cacheConfig.memory.maxSize) {
      // Remove oldest entries
      const entries = Array.from(this.memoryCache.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp);
      
      const toRemove = entries.slice(0, entries.length - this.cacheConfig.memory.maxSize);
      toRemove.forEach(([key]) => this.memoryCache.delete(key));
    }
  }

  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ScoutZeroCache', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'key' });
        }
      };
    });
  }

  private async getFromPersistent(key: string): Promise<any> {
    if (!this.persistentCache) return null;
    
    return new Promise((resolve) => {
      const transaction = this.persistentCache!.transaction(['cache'], 'readonly');
      const store = transaction.objectStore('cache');
      const request = store.get(key);
      
      request.onsuccess = () => {
        resolve(request.result?.value || null);
      };
      request.onerror = () => resolve(null);
    });
  }

  private async setToPersistent(key: string, value: any): Promise<void> {
    if (!this.persistentCache) return;
    
    return new Promise((resolve) => {
      const transaction = this.persistentCache!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      store.put({ key, value });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve(); // Fail silently
    });
  }

  private async clearFromPersistent(pattern: string | RegExp): Promise<void> {
    if (!this.persistentCache) return;
    
    const transaction = this.persistentCache.transaction(['cache'], 'readwrite');
    const store = transaction.objectStore('cache');
    const request = store.getAllKeys();
    
    request.onsuccess = () => {
      const keys = request.result;
      keys.forEach(key => {
        const keyStr = key.toString();
        const shouldDelete = typeof pattern === 'string' 
          ? keyStr === pattern 
          : pattern.test(keyStr);
        
        if (shouldDelete) {
          store.delete(key);
        }
      });
    };
  }
}

// ==========================================
// 3. OPTIMIZED DATA HOOKS
// ==========================================

/**
 * Lightweight hook for player lists and tables
 */
function usePlayerIndex() {
  const cache = useContext(CacheContext);
  const [players, setPlayers] = useState<PlayerIndex[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchPlayerIndex = async () => {
      try {
        setLoading(true);
        
        const data = await cache.get('player_index', async () => {
          // Try optimized index collection first
          const indexSnap = await getDocs(collection(db, 'player_index'));
          if (indexSnap.size > 0) {
            return indexSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          }
          
          // Fallback to full player collection with field selection
          const playersSnap = await getDocs(query(
            collection(db, 'players_v2'),
            orderBy('name')
          ));
          
          return playersSnap.docs.map(doc => {
            const data = doc.data();
            return {
              player_id: data.identity.player_id,
              name: data.identity.name,
              display_name: data.identity.display_name,
              position: data.computed.formatted_position,
              team: data.current.bio.team,
              age: data.current.bio.age,
              salary_current: data.computed.cap_hit_current,
              overall_grade: data.current.evaluation.overall_grade,
              status: data.current.contract.fa_type || 'Signed',
              last_updated: data.last_updated,
            };
          });
        });
        
        setPlayers(data);
      } catch (err) {
        setError(err as Error);
        console.error('Error fetching player index:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayerIndex();
  }, [cache]);

  return { players, loading, error };
}

/**
 * Full player data hook for detailed views
 */
function usePlayerDetails(playerId: string) {
  const cache = useContext(CacheContext);
  const [player, setPlayer] = useState<PlayerDocumentV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!playerId) return;

    const fetchPlayerDetails = async () => {
      try {
        setLoading(true);
        
        const data = await cache.get(`player_details_${playerId}`, async () => {
          const docSnap = await getDoc(doc(db, 'players_v2', playerId));
          if (!docSnap.exists()) {
            throw new Error(`Player ${playerId} not found`);
          }
          return { id: docSnap.id, ...docSnap.data() } as PlayerDocumentV2;
        });
        
        setPlayer(data);
      } catch (err) {
        setError(err as Error);
        console.error('Error fetching player details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayerDetails();
  }, [playerId, cache]);

  return { player, loading, error };
}

/**
 * Optimized team roster hook with pre-joined data
 */
function useTeamRoster(teamId: string) {
  const cache = useContext(CacheContext);
  const [roster, setRoster] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!teamId) return;

    const fetchTeamRoster = async () => {
      try {
        setLoading(true);
        
        const data = await cache.get(`team_roster_${teamId}`, async () => {
          // Try pre-computed roster view first
          const rosterSnap = await getDoc(doc(db, 'team_rosters', teamId));
          if (rosterSnap.exists()) {
            return rosterSnap.data();
          }
          
          // Fallback to joining team + player data
          const [teamSnap, playersSnap] = await Promise.all([
            getDoc(doc(db, 'teams_v2', teamId)),
            getDocs(query(
              collection(db, 'players_v2'),
              where('current.bio.team', '==', teamId)
            ))
          ]);
          
          const teamData = teamSnap.data();
          const playersData = playersSnap.docs.map(doc => doc.data());
          
          return {
            team: teamData,
            players: playersData,
            last_updated: new Date().toISOString(),
          };
        });
        
        setRoster(data);
      } catch (err) {
        setError(err as Error);
        console.error('Error fetching team roster:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTeamRoster();
  }, [teamId, cache]);

  return { roster, loading, error };
}

// ==========================================
// 4. PROGRESSIVE LOADING STRATEGY
// ==========================================

/**
 * Progressive data loader that prioritizes critical data
 */
class ProgressiveDataLoader {
  private cache: DataCacheService;
  private loadingStates = new Map<string, 'idle' | 'loading' | 'loaded' | 'error'>();

  constructor(cache: DataCacheService) {
    this.cache = cache;
  }

  /**
   * Load data in priority order
   */
  async loadApplicationData() {
    // Phase 1: Critical data (immediate)
    await this.loadCriticalData();
    
    // Phase 2: Important data (background)
    this.loadImportantData();
    
    // Phase 3: Optional data (on-demand)
    // Loaded as needed by components
  }

  private async loadCriticalData() {
    const criticalTasks = [
      this.loadPlayerIndex(),
      this.loadUserPreferences(),
      this.loadTeamBasics(),
    ];

    await Promise.all(criticalTasks);
  }

  private loadImportantData() {
    // Run in background without blocking UI
    setTimeout(() => {
      const importantTasks = [
        this.loadFullPlayerData(),
        this.loadTeamRosters(),
        this.loadTradeExceptions(),
      ];

      Promise.all(importantTasks).catch(console.error);
    }, 100);
  }

  private async loadPlayerIndex() {
    this.loadingStates.set('player_index', 'loading');
    
    try {
      await this.cache.get('player_index', async () => {
        const response = await fetch('/api/players/index');
        return response.json();
      });
      
      this.loadingStates.set('player_index', 'loaded');
    } catch (error) {
      this.loadingStates.set('player_index', 'error');
      console.error('Failed to load player index:', error);
    }
  }

  private async loadUserPreferences() {
    this.loadingStates.set('user_preferences', 'loading');
    
    try {
      const prefs = localStorage.getItem('user_preferences');
      if (prefs) {
        await this.cache.set('user_preferences', JSON.parse(prefs));
      }
      
      this.loadingStates.set('user_preferences', 'loaded');
    } catch (error) {
      this.loadingStates.set('user_preferences', 'error');
      console.error('Failed to load user preferences:', error);
    }
  }

  private async loadTeamBasics() {
    this.loadingStates.set('team_basics', 'loading');
    
    try {
      await this.cache.get('team_basics', async () => {
        const response = await fetch('/api/teams/basic');
        return response.json();
      });
      
      this.loadingStates.set('team_basics', 'loaded');
    } catch (error) {
      this.loadingStates.set('team_basics', 'error');
      console.error('Failed to load team basics:', error);
    }
  }

  private async loadFullPlayerData() {
    // Load full player data in chunks
    const playerIds = await this.cache.get('player_ids', async () => {
      const index = await this.cache.get('player_index', () => Promise.resolve([]));
      return index.map((p: any) => p.player_id);
    });

    const chunkSize = 50;
    for (let i = 0; i < playerIds.length; i += chunkSize) {
      const chunk = playerIds.slice(i, i + chunkSize);
      await this.loadPlayerChunk(chunk);
      
      // Small delay to avoid overwhelming the client
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  private async loadPlayerChunk(playerIds: string[]) {
    const tasks = playerIds.map(async (playerId) => {
      try {
        await this.cache.get(`player_details_${playerId}`, async () => {
          const response = await fetch(`/api/players/${playerId}`);
          return response.json();
        });
      } catch (error) {
        console.warn(`Failed to load player ${playerId}:`, error);
      }
    });

    await Promise.all(tasks);
  }

  private async loadTeamRosters() {
    // Similar chunked loading for team rosters
    // ... implementation
  }

  private async loadTradeExceptions() {
    // Load trade exception data
    // ... implementation
  }

  getLoadingState(key: string) {
    return this.loadingStates.get(key) || 'idle';
  }
}

// ==========================================
// 5. CONTEXT PROVIDER FOR DATA LAYER
// ==========================================

const CacheContext = createContext<DataCacheService | null>(null);
const LoaderContext = createContext<ProgressiveDataLoader | null>(null);

interface DataProviderProps {
  children: React.ReactNode;
}

export function DataProvider({ children }: DataProviderProps) {
  const [cache] = useState(() => new DataCacheService());
  const [loader] = useState(() => new ProgressiveDataLoader(cache));
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const initializeData = async () => {
      await cache.init();
      await loader.loadApplicationData();
      setInitialized(true);
    };

    initializeData();
  }, [cache, loader]);

  if (!initialized) {
    return <div>Loading application data...</div>;
  }

  return (
    <CacheContext.Provider value={cache}>
      <LoaderContext.Provider value={loader}>
        {children}
      </LoaderContext.Provider>
    </CacheContext.Provider>
  );
}

// Export hooks for component use
export { usePlayerIndex, usePlayerDetails, useTeamRoster };