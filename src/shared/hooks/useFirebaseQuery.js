import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '@/firebaseConfig';

/**
 * Hook to fetch all documents from a Firestore collection.
 * E4: Accepts optional queryConstraints (e.g. where clauses) for scoped reads.
 * @param {string} collectionName - Firestore collection name
 * @param {import('firebase/firestore').QueryConstraint[]} [queryConstraints=[]] - Optional Firestore query constraints
 * @param {{ enabled?: boolean }} [options]
 * @returns {{ data: Array, loading: boolean, error: Error|null }}
 */
const useFirebaseQuery = (collectionName, queryConstraints = [], options = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { enabled = true } = options;
  // Serialize constraints to detect changes without causing infinite re-renders
  const constraintsKey = useRef('');
  const newKey = JSON.stringify(
    queryConstraints.map((c) => c.type || String(c))
  );

  useEffect(() => {
    constraintsKey.current = newKey;
    if (!enabled) {
      setData([]);
      setError(null);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const ref = collection(db, collectionName);
        const q =
          queryConstraints.length > 0 ? query(ref, ...queryConstraints) : ref;
        const snap = await getDocs(q);
        const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setData(items);
      } catch (err) {
        console.error('Error fetching from Firebase:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [collectionName, newKey, enabled]);

  return { data, loading, error };
};

export default useFirebaseQuery;
