import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, query, QueryConstraint } from 'firebase/firestore';
import { db } from '@/firebaseConfig';

interface FirebaseQueryOptions {
  enabled?: boolean;
}

export interface UseFirebaseQueryResult<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
}

const useFirebaseQuery = <T = Record<string, unknown>>(
  collectionName: string,
  queryConstraints: QueryConstraint[] = [],
  options: FirebaseQueryOptions = {}
): UseFirebaseQueryResult<T> => {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const { enabled = true } = options;
  // Serialize constraints to detect changes without causing infinite re-renders
  const constraintsKey = useRef<string>('');
  const newKey = JSON.stringify(
    queryConstraints.map((c) => (c as unknown as Record<string, unknown>).type ?? String(c))
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
        const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as T));
        setData(items);
      } catch (err) {
        console.error('Error fetching from Firebase:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [collectionName, newKey, enabled]);

  return { data, loading, error };
};

export default useFirebaseQuery;
