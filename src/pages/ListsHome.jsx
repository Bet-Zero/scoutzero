// ListsHome.jsx

import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { db } from '@/firebaseConfig';

const ListsHome = () => {
  const [lists, setLists] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLists = async () => {
      const snapshot = await getDocs(collection(db, 'lists'));
      const results = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setLists(results);
      setIsLoading(false);
    };

    fetchLists();
  }, []);

  return (
    <div className="max-w-[800px] mx-auto">
        <h1 className="text-3xl font-bold text-white mb-4">Your Saved Lists</h1>

        {isLoading ? (
          <div className="text-white/60">Loading lists...</div>
        ) : lists.length === 0 ? (
          <div className="text-white/40">
            You haven't created any lists yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lists.map((list) => (
              <Link
                key={list.id}
                to={`/lists/${list.id}`}
                className="p-4 bg-[#1a1a1a] hover:bg-[#232323] border border-white/10 rounded transition block"
              >
                <h2 className="text-lg font-bold text-white mb-1">
                  {list.name}
                </h2>
                {list.description && (
                  <p className="text-sm text-white/50 mb-2">
                    {list.description}
                  </p>
                )}
                <div className="text-xs text-white/30">
                  {list.playerIds?.length || 0} players • Last updated{' '}
                  {list.updatedAt?.toDate?.().toLocaleDateString?.() || '—'}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ListsHome;
