/**
 * FILE: src/features/architect/cockpit/NavRail.tsx
 * PURPOSE: Left navigation rail for the Architect cockpit. Replaces the
 *          horizontal ArchitectTabBar visually while preserving the same
 *          activeTab state contract.
 * OWNERSHIP: Feature: architect/cockpit
 *
 * Phase 1 notes:
 *  - Active tab is still owned by useArchitectState (NavRail does not
 *    introduce a new source of truth).
 *  - Collapsed (64px) by default; pin toggle expands to 220px persisted via
 *    localStorage key `architect.navRail.pinned`.
 *  - All buttons carry aria-label even when only the icon is visible so test
 *    queries like getAllByRole('button', { name: /roster/i }) continue to work.
 */
import { useEffect, useState } from 'react';
import type { ActiveTab } from '@/features/architect/GMDashboard/hooks/useArchitectState.types';

export interface NavRailItem {
  id: ActiveTab;
  label: string;
  glyph: string;
  onActivate: () => void;
  testId?: string;
  title?: string;
  /**
   * Marks the home base (Full Cap Table). Home items are visually pinned at the
   * top and followed by a divider that separates them from supporting desks.
   */
  isHome?: boolean;
}

interface NavRailProps {
  activeTab: ActiveTab;
  items: NavRailItem[];
}

const PIN_STORAGE_KEY = 'architect.navRail.pinned';

function readPersistedPin(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage?.getItem(PIN_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writePersistedPin(value: boolean) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage?.setItem(PIN_STORAGE_KEY, value ? '1' : '0');
  } catch {
    // localStorage unavailable — silently ignore
  }
}

export const NavRail = ({ activeTab, items }: NavRailProps) => {
  const [pinned, setPinned] = useState<boolean>(() => readPersistedPin());
  const [hover, setHover] = useState(false);

  useEffect(() => {
    writePersistedPin(pinned);
  }, [pinned]);

  const expanded = pinned || hover;

  return (
    <nav
      className={`flex h-full shrink-0 flex-col border-r border-cockpit-edge bg-cockpit-bar transition-[width] duration-200 motion-reduce:transition-none ${expanded ? 'w-[220px]' : 'w-[64px]'}`}
      aria-label="Architect dashboard sections"
      data-testid="cockpit-nav-rail"
      data-expanded={expanded ? 'true' : 'false'}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        className="flex shrink-0 items-center justify-between px-3"
        style={{ height: 56 }}
      >
        <span
          className={`text-[10px] font-semibold uppercase tracking-wider text-cockpit-text-muted transition-opacity ${expanded ? 'opacity-100' : 'opacity-0'}`}
        >
          Sections
        </span>
        <button
          type="button"
          onClick={() => setPinned((value) => !value)}
          aria-pressed={pinned}
          aria-label={pinned ? 'Unpin navigation rail' : 'Pin navigation rail'}
          title={pinned ? 'Unpin' : 'Pin'}
          className="rounded p-1 text-cockpit-text-muted transition-colors hover:bg-cockpit-raised hover:text-cockpit-text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
          data-testid="cockpit-nav-rail-pin"
        >
          <span aria-hidden className="text-[12px]">{pinned ? '⤢' : '⤡'}</span>
        </button>
      </div>

      <ul
        role="tablist"
        aria-label="Architect dashboard sections"
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 pb-3"
      >
        {items.map((item, index) => {
          const isActive = activeTab === item.id;
          // A divider trails the last home item, separating the home base from
          // the supporting desks below it.
          const showHomeDivider =
            item.isHome && !items[index + 1]?.isHome;
          return (
            <li key={item.id} className="contents">
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-pressed={isActive}
                aria-label={item.label}
                title={item.title ?? item.label}
                data-testid={item.testId}
                onClick={item.onActivate}
                className={[
                  'group relative flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40',
                  isActive
                    ? 'bg-cockpit-raised text-cockpit-text-primary'
                    : 'text-cockpit-text-secondary hover:bg-cockpit-raised/60 hover:text-cockpit-text-primary',
                ].join(' ')}
              >
                <span
                  aria-hidden
                  className={`absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r ${isActive ? 'bg-[color:var(--team-primary,#4F46E5)]' : 'bg-transparent'}`}
                />
                <span
                  aria-hidden
                  className="flex h-6 w-6 shrink-0 items-center justify-center text-[13px] font-semibold uppercase tracking-wider text-cockpit-text-muted group-hover:text-cockpit-text-primary"
                >
                  {item.glyph}
                </span>
                <span
                  className={`truncate transition-opacity ${expanded ? 'opacity-100' : 'opacity-0'}`}
                >
                  {item.label}
                </span>
                {item.isHome ? (
                  <span
                    aria-hidden
                    className={`ml-auto text-[11px] text-cockpit-text-muted transition-opacity ${expanded ? 'opacity-100' : 'opacity-0'}`}
                    title="Home base"
                  >
                    ⌂
                  </span>
                ) : null}
              </button>
              {showHomeDivider ? (
                <span
                  aria-hidden
                  className="my-1 h-px w-full shrink-0 bg-cockpit-edge"
                  data-testid="cockpit-nav-rail-home-divider"
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
