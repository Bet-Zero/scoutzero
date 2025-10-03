// Simplified Firebase Data Hook with players_v2 subcollection support
// This replaces the complex useSeasonPlayerData with fallback strategies

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/firebaseConfig';

/**
 * Batch process an array of items with a concurrency limit
 * @param {Array} items - Items to process
 * @param {Function} processor - Async function to process each item
 * @param {number} batchSize - Number of items to process concurrently
 * @returns {Promise<Array>} Results from processing
 */
const batchProcess = async (items, processor, batchSize = 50) => {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }
  return results;
};

/**
 * Fetch subcollection data for a single player
 * @param {string} playerId - Player document ID
 * @returns {Promise<Object>} Subcollection data (contracts, seasons, evaluations)
 */
const fetchPlayerSubcollections = async (playerId) => {
  try {
    const subcollectionData = {};

    // Fetch all subcollections in parallel for better performance
    const [contractsSnapshot, seasonsSnapshot, evaluationsSnapshot] = await Promise.all([
      getDocs(collection(db, 'players_v2', playerId, 'contracts')).catch(() => ({ docs: [] })),
      getDocs(collection(db, 'players_v2', playerId, 'seasons')).catch(() => ({ docs: [] })),
      getDocs(collection(db, 'players_v2', playerId, 'evaluations')).catch(() => ({ docs: [] }))
    ]);

    // Process contracts
    const contracts = contractsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (contracts.length > 0) {
      // Prefer standard contract (std_*), otherwise use first available
      subcollectionData.contract = contracts.find(c => c.id.startsWith('std_')) || contracts[0];
    }

    // Process seasons
    const seasons = seasonsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (seasons.length > 0) {
      // Use the most recent season (sorted by ID which should be like "2025-26")
      subcollectionData.season = seasons.sort((a, b) => b.id.localeCompare(a.id))[0];
    }

    // Process evaluations
    const evaluations = evaluationsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (evaluations.length > 0) {
      // Use 'current' evaluation or the first one
      subcollectionData.evaluation = evaluations.find(e => e.id === 'current') || evaluations[0];
    }

    return subcollectionData;
  } catch (err) {
    console.error(`Error fetching subcollections for player ${playerId}:`, err);
    return {};
  }
};

/**
 * Normalize player data from players_v2 structure to flat structure
 * @param {Object} mainDoc - Main player document from players_v2
 * @param {Object} subcollections - Data from subcollections
 * @returns {Object} Normalized player data in flat format
 */
const normalizePlayerV2Data = (mainDoc, subcollections) => {
  const { contract = {}, season = {}, evaluation = {} } = subcollections;

  // Map new structure to old flat structure that components expect
  const normalized = {
    id: mainDoc.id,
    player_id: mainDoc.id,
    
    // Preserve any additional fields from main document first
    ...mainDoc,
    
    // Bio data (from main document) - override with enhanced version
    // Handle both old and new field names
    bio: {
      ...mainDoc.bio,
      // Ensure display_name is available for legacy code
      display_name: mainDoc.bio?.displayName || mainDoc.bio?.display_name || '',
    },
    display_name: mainDoc.bio?.displayName || mainDoc.bio?.display_name || '',
    name: mainDoc.bio?.displayName || mainDoc.bio?.display_name || mainDoc.bio?.name || '',
    
    // Contract data (from contracts subcollection)
    contract: contract?.id ? {
      total_value: contract.contractValue || contract.total_value || 0,
      annual_salaries: contract.annual_salaries || [],
      bird_rights: contract.bird_rights || null,
      averageAnnualValue: contract.averageAnnualValue || 0
    } : {
      total_value: 0,
      annual_salaries: [],
      bird_rights: null,
      averageAnnualValue: 0
    },
    
    // Stats data (from seasons subcollection)
    system: {
      stats: season?.stats || {},
      team: season?.team || null
    },
    
    // Evaluation data (from evaluations subcollection)
    traits: evaluation?.traits || {},
    roles: evaluation?.roles || {},
    shootingProfile: evaluation?.shootingProfile || '—',
    subRoles: evaluation?.subRoles || { offense: [], defense: [] },
    badges: evaluation?.badges || [],
    overallGrade: evaluation?.overallGrade || null,
  };

  return normalized;
};

/**
 * Simple, reliable player data hook with real-time updates
 * Now fetches from players_v2 collection with subcollections
 */
const useSimplePlayerData = () => {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Fetch from players_v2 collection
    // Note: We can't orderBy 'bio.displayName' because it may not exist on all documents
    // Firestore will throw an error if the field doesn't exist on all docs in the result set
    const playersQuery = query(
      collection(db, 'players_v2')
    );

    // Real-time updates - data stays fresh automatically
    const unsubscribe = onSnapshot(
      playersQuery,
      async (snapshot) => {
        try {
          // Get main documents first
          const mainDocs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

          console.log(`📥 Fetching subcollections for ${mainDocs.length} players from players_v2...`);

          // Fetch subcollections for each player in batches to avoid overwhelming the system
          const playersWithSubcollections = await batchProcess(
            mainDocs,
            async (mainDoc) => {
              const subcollections = await fetchPlayerSubcollections(mainDoc.id);
              return normalizePlayerV2Data(mainDoc, subcollections);
            },
            50 // Process 50 players at a time
          );

          // Sort players by name after fetching
          playersWithSubcollections.sort((a, b) => {
            const nameA = (a.display_name || a.name || '').toLowerCase();
            const nameB = (b.display_name || b.name || '').toLowerCase();
            return nameA.localeCompare(nameB);
          });

          console.log(`✅ Successfully loaded ${playersWithSubcollections.length} players from players_v2`);
          setPlayers(playersWithSubcollections);
          setLoading(false);
        } catch (err) {
          console.error('Error processing player data:', err);
          setError(err.message);
          setLoading(false);
        }
      },
      (err) => {
        console.error('Player data error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { players, loading, error };
};

export default useSimplePlayerData;