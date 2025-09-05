// Separated Schema Firebase Data Hook
// Reads from new separated collections and combines data

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebaseConfig';

/**
 * Enhanced player data hook that combines separated collections
 * - NBA data from 'nba_players' 
 * - Contracts from 'player_contracts'
 * - User evaluations from 'player_evaluations'
 * Falls back to original 'players' collection if new ones don't exist
 */
const useSimplePlayerData = () => {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Try new separated schema first, fallback to original
    const checkCollections = async () => {
      try {
        // Test if new collections exist
        const nbaPlayersRef = collection(db, 'nba_players');
        const testQuery = query(nbaPlayersRef, orderBy('name'));
        
        // Try to get a document to see if collection exists
        const unsubscribe = onSnapshot(
          testQuery,
          async (snapshot) => {
            if (snapshot.empty) {
              // New collections don't exist, use original
              console.log('📡 Using original players collection (new schema not migrated yet)');
              setupOriginalListener();
            } else {
              // New collections exist, use separated schema
              console.log('📡 Using new separated schema collections');
              await setupSeparatedListener(snapshot);
            }
          },
          (err) => {
            console.log('📡 New collections not found, using original players collection');
            setupOriginalListener();
          }
        );

        return unsubscribe;
      } catch (err) {
        console.log('📡 Error checking collections, using original');
        setupOriginalListener();
      }
    };

    // Setup listener for original unified collection
    const setupOriginalListener = () => {
      const playersQuery = query(
        collection(db, 'players'),
        orderBy('Name')
      );

      return onSnapshot(
        playersQuery,
        (snapshot) => {
          const playerData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          setPlayers(playerData);
          setLoading(false);
        },
        (err) => {
          console.error('Player data error:', err);
          setError(err.message);
          setLoading(false);
        }
      );
    };

    // Setup listener for separated collections
    const setupSeparatedListener = async (nbaSnapshot) => {
      try {
        // Get NBA data
        const nbaPlayers = nbaSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

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

        setPlayers(combinedPlayers);
        setLoading(false);
      } catch (err) {
        console.error('Error combining separated data:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    let unsubscribe;
    checkCollections().then(unsub => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return { players, loading, error };
};

export default useSimplePlayerData;