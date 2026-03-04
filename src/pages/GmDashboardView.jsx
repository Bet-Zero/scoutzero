import React from 'react';
import GMDashboard from '@/features/architect/GMDashboard';
import { useAuth } from '@/shared/hooks/useAuth';

const GmDashboardView = () => {
  const { loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="px-4 pt-4 pb-10">
        <div className="max-w-[1100px] mx-auto text-white/80 text-sm">
          Signing in...
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-10">
      <div className="max-w-[1100px] mx-auto">
        <GMDashboard />
      </div>
    </div>
  );
};

export default GmDashboardView;
