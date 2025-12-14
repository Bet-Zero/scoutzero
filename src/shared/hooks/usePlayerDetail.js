import { useState, useEffect } from 'react';
import { getDoc, getDocs } from 'firebase/firestore';
import {
  playerRef,
  contractsCol,
  seasonsCol,
  evalsCol,
} from '@/data/firestorePaths.js';
// Dev-only schema validation
// eslint-disable-next-line import/no-relative-packages
import { PlayerMainDocZ, ContractDocZ, SeasonDocZ, EvaluationDocZ } from '@/schemas/players_v2';

/**
 * Hook for fetching full player details including subcollections
 *
 * Fetches:
 * 1. Main player document (bio, etc.)
 * 2. All contract documents (in parallel)
 * 3. All season documents (in parallel)
 * 4. All evaluation documents (in parallel)
 *
 * Returns v2 schema structure directly - no legacy flattening
 *
 * @param {string} playerId - Player document ID
 * @returns {Object} { player, loading, error }
 */
const usePlayerDetail = (playerId) => {
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!playerId) {
      setPlayer(null);
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchPlayerDetail = async () => {
      setLoading(true);
      setError(null);

      try {
        // Step 1: Fetch main document
        const mainDocRef = playerRef(playerId);
        const mainDocSnap = await getDoc(mainDocRef);

        if (!mainDocSnap.exists()) {
          throw new Error(`Player ${playerId} not found`);
        }

        const mainDoc = mainDocSnap.data();
        if (import.meta.env.DEV) {
          const res = PlayerMainDocZ.safeParse(mainDoc);
          if (!res.success) {
            // Non-blocking: log for awareness
            // eslint-disable-next-line no-console
            console.warn('players_v2 main doc failed schema validation', playerId, res.error?.issues);
          }
        }

        // Step 2: Fetch all subcollections in parallel
        const [contractsSnap, seasonsSnap, evalsSnap] = await Promise.all([
          getDocs(contractsCol(playerId)),
          getDocs(seasonsCol(playerId)),
          getDocs(evalsCol(playerId)),
        ]);

        // Step 3: Convert subcollections to records
        const contracts = {};
        contractsSnap.forEach((doc) => {
          // Filter out metadata fields like last_updated
          if (!doc.id.startsWith('last_')) {
            const data = doc.data();
            if (import.meta.env.DEV) {
              const r = ContractDocZ.safeParse(data);
              if (!r.success) {
                // eslint-disable-next-line no-console
                console.warn('contract doc failed schema validation', playerId, doc.id, r.error?.issues);
              }
            }
            contracts[doc.id] = data;
          }
        });

        const seasons = {};
        seasonsSnap.forEach((doc) => {
          const data = doc.data();
          if (import.meta.env.DEV) {
            const r = SeasonDocZ.safeParse(data);
            if (!r.success) {
              // eslint-disable-next-line no-console
              console.warn('season doc failed schema validation', playerId, doc.id, r.error?.issues);
            }
          }
          seasons[doc.id] = data;
        });

        const evaluations = {};
        evalsSnap.forEach((doc) => {
          const data = doc.data();
          if (import.meta.env.DEV) {
            const r = EvaluationDocZ.safeParse(data);
            if (!r.success) {
              // eslint-disable-next-line no-console
              console.warn('evaluation doc failed schema validation', playerId, doc.id, r.error?.issues);
            }
          }
          evaluations[doc.id] = data;
        });

        // Step 4: Build v2 player structure with spread pattern for easier access
        const playerV2 = {
          id: playerId,
          ...mainDoc, // Spread main doc fields (bio, etc.) at top level
          contracts: Object.keys(contracts).length > 0 ? contracts : undefined,
          seasons: Object.keys(seasons).length > 0 ? seasons : undefined,
          evaluations:
            Object.keys(evaluations).length > 0 ? evaluations : undefined,
        };

        if (isMounted) {
          setPlayer(playerV2);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error fetching player detail:', err);
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    fetchPlayerDetail();

    return () => {
      isMounted = false;
    };
  }, [playerId]);

  return { player, loading, error };
};

export default usePlayerDetail;
