import { useMemo, useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { enrichPlayerData } from '@/utils/roster';
import { PLAYERS_COLLECTION } from '@/constants/collections';

/**
 * @deprecated Use usePlayerData or useSimplePlayerData instead
 * 
 * LEGACY: Enhanced hook that supports both legacy /players collection and new season-based structure
 * This hook is deprecated as part of data layer consolidation.
 * All components should use the simplified usePlayerData or useSimplePlayerData hooks.
 * 
 * Migration guide:
 * - Replace useSeasonPlayerData() with useSimplePlayerData() for direct access
 * - Replace useSeasonPlayerData(season) with usePlayerData() (season param deprecated)
 */
const useSeasonPlayerData = (season = null) => {
  console.warn('🚨 useSeasonPlayerData is DEPRECATED. Use usePlayerData or useSimplePlayerData instead.');
  
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [diagnostics, setDiagnostics] = useState({
    source: null,
    collectionsChecked: [],
    playerCount: 0,
    fallbackUsed: false
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      const diag = {
        source: null,
        collectionsChecked: [],
        playerCount: 0,
        fallbackUsed: false
      };

      try {
        let players = [];
        
        // Strategy 1: Try current season data if season specified
        if (season) {
          try {
            diag.collectionsChecked.push(`/seasons/${season}/players`);
            const seasonPlayersSnap = await getDocs(collection(db, 'seasons', season, 'players'));
            if (seasonPlayersSnap.size > 0) {
              players = seasonPlayersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
              diag.source = `/seasons/${season}/players`;
              diag.playerCount = players.length;
            }
          } catch (err) {
            console.warn(`Season ${season} players collection not accessible:`, err.message);
          }
        }
        
        // Strategy 2: Try active season detection if no explicit season or no data found
        if (players.length === 0) {
          try {
            diag.collectionsChecked.push('/seasons');
            const seasonsSnap = await getDocs(collection(db, 'seasons'));
            
            // Look for active season
            for (const seasonDoc of seasonsSnap.docs) {
              const seasonData = seasonDoc.data();
              if (seasonData.status === 'active') {
                diag.collectionsChecked.push(`/seasons/${seasonDoc.id}/players`);
                try {
                  const activeSeasonPlayersSnap = await getDocs(collection(db, 'seasons', seasonDoc.id, 'players'));
                  if (activeSeasonPlayersSnap.size > 0) {
                    players = activeSeasonPlayersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
                    diag.source = `/seasons/${seasonDoc.id}/players`;
                    diag.playerCount = players.length;
                    break;
                  }
                } catch (err) {
                  console.warn(`Active season ${seasonDoc.id} players not accessible:`, err.message);
                }
              }
            }
          } catch (err) {
            console.warn('Seasons collection not accessible:', err.message);
          }
        }
        
        // Strategy 3: Fallback to legacy /players collection
        if (players.length === 0) {
          try {
            diag.collectionsChecked.push(`/${PLAYERS_COLLECTION}`);
            const playersSnap = await getDocs(collection(db, PLAYERS_COLLECTION));
            if (playersSnap.size > 0) {
              players = playersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
              diag.source = `/${PLAYERS_COLLECTION}`;
              diag.playerCount = players.length;
              diag.fallbackUsed = true;
            }
          } catch (err) {
            console.warn('Legacy players collection not accessible:', err.message);
          }
        }
        
        // Strategy 4: Use local data as ultimate fallback
        if (players.length === 0) {
          try {
            diag.collectionsChecked.push('local:/public/players.json');
            const response = await fetch('/players.json');
            if (response.ok) {
              const localData = await response.json();
              players = Object.keys(localData).map(id => ({
                id,
                ...localData[id]
              }));
              diag.source = 'local:/public/players.json';
              diag.playerCount = players.length;
              diag.fallbackUsed = true;
            }
          } catch (err) {
            console.warn('Local players.json not accessible:', err.message);
          }
        }
        
        setData(players);
        setDiagnostics(diag);
        
        // Log diagnostic information
        console.log('🔍 Player Data Loading Diagnostics:', diag);
        
        if (players.length === 0) {
          throw new Error('No player data found in any location. Please check Firestore configuration or run season data population.');
        }
        
      } catch (err) {
        console.error('Error fetching player data:', err);
        setError(err);
        setDiagnostics(diag);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [season]);

  const players = useMemo(() => {
    if (!data.length) return [];
    return data.map(enrichPlayerData);
  }, [data]);

  return { 
    players, 
    loading, 
    error, 
    diagnostics,
    // Helper methods for troubleshooting
    isEmpty: players.length === 0,
    isUsingFallback: diagnostics.fallbackUsed,
    dataSource: diagnostics.source
  };
};

export default useSeasonPlayerData;