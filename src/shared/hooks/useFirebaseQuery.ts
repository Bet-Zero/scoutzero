import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, query, QueryConstraint } from 'firebase/firestore';
import { db } from '@/firebaseConfig';

interface FirebaseQueryOptions {
  enabled?: boolean;
  // Constraint values are not part of the change key (only their types), so
  // pass what they depend on (e.g. the owner's uid) to refetch when it changes.
  key?: string | null;
}

export interface UseFirebaseQueryResult<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
}

const getConstraintKeyPart = (constraint: QueryConstraint): string => {
  if (constraint && typeof constraint === 'object' && 'type' in constraint) {
    const { type } = constraint as { type?: unknown };
    if (typeof type === 'string') {
      return type;
    }
  }

  return String(constraint);
};

export const useFirebaseQuery = <T = Record<string, unknown>>(
  collectionName: string,
  queryConstraints: QueryConstraint[] = [],
  options: FirebaseQueryOptions = {}
): UseFirebaseQueryResult<T> => {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const { enabled = true, key = null } = options;
  // Serialize constraints to detect changes without causing infinite re-renders
  const constraintsKey = useRef<string>('');
  const newKey = JSON.stringify(queryConstraints.map(getConstraintKeyPart));
  const lastKey = useRef<string | null>(key);

  useEffect(() => {
    constraintsKey.current = newKey;
    if (!enabled) {
      setData([]);
      setError(null);
      setLoading(false);
      return;
    }

    // Never show the previous key's (e.g. previous account's) data, even
    // briefly or after a failed fetch; ignore its slower responses too.
    if (lastKey.current !== key) {
      lastKey.current = key;
      setData([]);
      setError(null);
    }
    let stale = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const ref = collection(db, collectionName);
        const q =
          queryConstraints.length > 0 ? query(ref, ...queryConstraints) : ref;
        const snap = await getDocs(q);
        const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as T));
        if (!stale) setData(items);
      } catch (err) {
        console.error('Error fetching from Firebase:', err);
        if (!stale) setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (!stale) setLoading(false);
      }
    };
    fetchData();
    return () => {
      stale = true;
    };
  }, [collectionName, newKey, enabled, key]);

  return { data, loading, error };
};

