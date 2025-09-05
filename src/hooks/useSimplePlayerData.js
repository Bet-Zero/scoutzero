// New Separated Schema Firebase Data Hook
// Reads ONLY from new separated collections - no fallback to old schema

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebaseConfig';

/**
 * Player data hook for new separated schema architecture
 * - NBA data from 'nba_players' 
 * - Contracts from 'player_contracts'
 * - User evaluations from 'player_evaluations'
 * NO FALLBACK - uses new schema exclusively
 */
const useSimplePlayerData = () => {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Use new separated schema exclusively
    console.log('📡 Using new separated schema collections (no fallback)');
    
    const nbaPlayersRef = collection(db, 'nba_players');
    // Fixed: Use 'Name' instead of 'name' for ordering
    const playersQuery = query(nbaPlayersRef, orderBy('Name'));
    
    const unsubscribe = onSnapshot(
      playersQuery,
      async (snapshot) => {
        if (snapshot.empty) {
          console.warn('⚠️  No data in nba_players collection. Run data population script.');
          setPlayers([]);
          setLoading(false);
          setError('No NBA data found. Please populate NBA data first.');
          return;
        }

        try {
          await setupSeparatedListener(snapshot);
        } catch (err) {
          console.error('Error setting up separated listener:', err);
          setError(err.message);
          setLoading(false);
        }
      },
      (err) => {
        console.error('Error accessing nba_players collection:', err);
        setError(`Cannot access NBA data: ${err.message}`);
        setLoading(false);
      }
    );

    // Setup listener for separated collections
    const setupSeparatedListener = async (nbaSnapshot) => {
      try {
        // Get NBA data
        const nbaPlayers = nbaSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        console.log(`📊 Loaded ${nbaPlayers.length} players from nba_players collection`);

        // Combine with contracts and evaluations
        const combinedPlayers = await Promise.all(
          nbaPlayers.map(async (player) => {
            // Get contract data
            const contractDoc = await getDoc(doc(db, 'player_contracts', player.id));
            const contractData = contractDoc.exists() ? contractDoc.data() : {};

            // Get evaluation data  
            const evaluationDoc = await getDoc(doc(db, 'player_evaluations', player.id));
            const evaluationData = evaluationDoc.exists() ? evaluationDoc.data() : {};

            // Combine all data
            return {
              ...player,
              ...contractData,
              ...evaluationData,
              // Ensure backward compatibility with field names
              Name: player.name || player.Name,
              Team: player.team || player.Team,
              Position: player.position || player.Position
            };
          })
        );

        console.log(`✅ Combined data for ${combinedPlayers.length} players`);
        setPlayers(combinedPlayers);
        setLoading(false);
      } catch (err) {
        console.error('Error combining separated data:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return { players, loading, error };
};

export default useSimplePlayerData;