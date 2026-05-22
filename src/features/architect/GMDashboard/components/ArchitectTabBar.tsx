/**
 * FILE: src/features/architect/GMDashboard/components/ArchitectTabBar.tsx
 * PURPOSE: Stage 5A polish — small read-only tab bar for the Architect dashboard.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * Renders the existing active-tab buttons with consistent styling, button
 * semantics (`type="button"`), `aria-pressed`, `role="tab"` semantics, and
 * keyboard focus rings. No mutation authority. No new tabs. No new state.
 *
 * Stage 5A only polishes presentation — the parent dashboard still owns
 * `activeTab` and the click handlers.
 */
import type { ReactNode } from 'react';
import type { ActiveTab } from '../hooks/useArchitectState.types';

export interface ArchitectTabDescriptor {
  id: ActiveTab;
  label: string;
  onActivate: () => void;
  testId?: string;
  title?: string;
}

interface ArchitectTabBarProps {
  tabs: ArchitectTabDescriptor[];
  activeTab: ActiveTab;
}

const baseClass =
  'px-3.5 py-1.5 rounded-md text-sm font-semibold transition-colors ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ' +
  'focus-visible:ring-offset-1 focus-visible:ring-offset-[#0d0d0d]';

const activeClass = 'bg-lakers/90 text-black shadow-sm';
const inactiveClass = 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white';

export const ArchitectTabBar = ({
  tabs,
  activeTab,
}: ArchitectTabBarProps): ReactNode => (
  <div
    className="tab-bar mb-6 flex flex-wrap items-center gap-x-2 gap-y-2"
    role="tablist"
    aria-label="Architect dashboard sections"
    data-testid="architect-tab-bar"
  >
    {tabs.map((tab) => {
      const isActive = activeTab === tab.id;
      return (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-pressed={isActive}
          aria-selected={isActive}
          onClick={tab.onActivate}
          data-testid={tab.testId}
          title={tab.title}
          className={`${baseClass} ${isActive ? activeClass : inactiveClass}`}
        >
          {tab.label}
        </button>
      );
    })}
  </div>
);
