import { useMemo } from 'react';
import useFirebaseQuery from './useFirebaseQuery';
import { normalizePlayerData } from '@/utils/roster';

const usePlayerData = () => {
  const { data, loading, error } = useFirebaseQuery('players');

  const players = useMemo(() => data.map(normalizePlayerData), [data]);

  return { players, loading, error };
};

export default usePlayerData;
