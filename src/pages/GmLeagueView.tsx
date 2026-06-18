import React from 'react';
import { LeagueView } from '@/features/architect/shared/LeagueView';
import { useAuth } from '@/shared/hooks/useAuth';

const GmLeagueView = () => {
  const { loading: authLoading, userId } = useAuth();

  if (authLoading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center text-sm text-white/80">
        Signing in...
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="flex min-h-[240px] items-center justify-center text-sm text-white/80">
        Sign in to load Architect League View.
      </div>
    );
  }

  return (
    <div className="px-4 pt-4">
      <div className="max-w-[1100px] mx-auto">
        <LeagueView />
      </div>
    </div>
  );
};

export default GmLeagueView;
