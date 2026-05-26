import React from 'react';
import { GMDashboard } from '@/features/architect/GMDashboard/GMDashboard';
import { useAuth } from '@/shared/hooks/useAuth';

const GmDashboardView = () => {
  const { loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center text-sm text-white/80">
        Signing in...
      </div>
    );
  }

  // Cockpit owns the viewport: full width, full height, no centering wrapper.
  // SiteLayout suppresses the global site header on /gm/:teamId routes so the
  // cockpit TopBar is the only top chrome.
  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <GMDashboard />
    </div>
  );
};

export default GmDashboardView;
