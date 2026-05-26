/**
 * FILE: src/features/architect/cockpit/Workbench.tsx
 * PURPOSE: Central area of the Architect cockpit. Wraps the active section
 *          in a RoomFrame.
 * OWNERSHIP: Feature: architect/cockpit
 *
 * Phase 1 notes:
 *  - RoomFrame composition lives here — section files do NOT import
 *    RoomFrame and do not change their public shape.
 *  - The Workbench renders the currently-active room synchronously. No
 *    staged cross-fade — Phase 1 prioritizes "not flashy" over animated
 *    transitions, and synchronous swapping keeps tests that rerender with
 *    a new activeTab and probe new content stable.
 */
import type { ReactNode } from 'react';
import { RoomFrame } from './RoomFrame';
import type { ActiveTab } from '@/features/architect/GMDashboard/hooks/useArchitectState.types';

export interface RoomDescriptor {
  id: ActiveTab;
  title: string;
  subtitle?: string;
  content: ReactNode;
}

interface WorkbenchProps {
  activeTab: ActiveTab;
  rooms: Record<ActiveTab, RoomDescriptor>;
}

export const Workbench = ({ activeTab, rooms }: WorkbenchProps) => {
  const room = rooms[activeTab];

  return (
    <main
      className="relative flex flex-1 min-h-0 flex-col overflow-hidden"
      data-testid="cockpit-workbench"
      data-active-tab={activeTab}
    >
      <RoomFrame title={room.title} subtitle={room.subtitle}>
        {room.content}
      </RoomFrame>
    </main>
  );
};
