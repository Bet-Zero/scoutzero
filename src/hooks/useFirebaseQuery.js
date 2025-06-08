import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/firebaseConfig';

const useFirebaseQuery = (collectionName) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, collectionName));
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
  }, [collectionName]);

  return { data, loading, error };
};

export default useFirebaseQuery;
