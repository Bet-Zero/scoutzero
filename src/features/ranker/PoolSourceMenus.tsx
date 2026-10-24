/**
 * FILE: src/features/ranker/PoolSourceMenus.tsx
 * PURPOSE: Workbench toolbar menus to add a whole team or one of the user's lists to the ranker pool, and (owners) reopen saved rankings
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-21: Team and list pickers created as PoolSourceControls.tsx (extracted from RankingBuilder.tsx)
 *  - 2026-10-24: Dropdown menus in the workbench toolbar, plus the owner's Saved menu
 *
 * LINKS:
 *  - Used in: src/features/ranker/RankingBuilder.tsx
 */
import React from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { TeamListFull } from '@/constants/teamList';
import type { RankerSession } from '@/firebase/rankerHelpers';
import type { OwnerPlayerList } from './hooks/useOwnerPlayerLists';
import { SavedSessionsPanel } from './SavedSessionsPanel';
import { ToolbarMenu } from './ToolbarMenu';

type PoolSourceMenusProps = {
  lists: OwnerPlayerList[];
  signedIn: boolean;
  onAddTeam: (teamId: string) => void;
  onAddList: (listId: string) => void;
  // Owner-only saved rankings; omitted for everyone else
  saved?: {
    sessions: RankerSession[];
    loading: boolean;
    onOpen: (sessionId: string) => void;
    onDelete: (sessionId: string) => void;
  };
};

export const PoolSourceMenus = ({
  lists,
  signedIn,
  onAddTeam,
  onAddList,
  saved,
}: PoolSourceMenusProps) => (
  <>
    <ToolbarMenu
      title="Add a whole roster"
      label={
        <>
          <Plus className="w-4 h-4" /> Team
        </>
      }
    >
      {(close) => (
        <div className="grid grid-cols-5 gap-1.5">
          {TeamListFull.map((team) => (
            <button
              key={team.id}
              onClick={() => {
                onAddTeam(team.id);
                close();
              }}
              title={`Add the ${team.teamName} roster`}
              aria-label={`Add the ${team.teamName} roster`}
              className="h-9 rounded-lg border border-white/[0.07] bg-white/[0.03] text-xs font-semibold text-white/70 hover:bg-white/[0.12] hover:text-white transition-colors"
            >
              {team.code}
            </button>
          ))}
        </div>
      )}
    </ToolbarMenu>

    <ToolbarMenu
      title="Import one of your lists"
      label={
        <>
          <Plus className="w-4 h-4" /> List
        </>
      }
    >
      {(close) =>
        lists.length === 0 ? (
          <p className="px-1 py-2 text-sm text-white/40">
            {signedIn
              ? 'You have no saved lists yet.'
              : 'Sign in to import your saved lists.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {lists.map((list) => (
              <li
                key={list.id}
                className="flex items-center justify-between gap-3 px-2 py-2 rounded-lg hover:bg-white/[0.05]"
              >
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{list.name}</p>
                  <p className="text-xs text-white/40">
                    {list.playerIds.length} players
                  </p>
                </div>
                <button
                  onClick={() => {
                    onAddList(list.id);
                    close();
                  }}
                  aria-label={`Import ${list.name}`}
                  className="px-3 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium"
                >
                  Import
                </button>
              </li>
            ))}
          </ul>
        )
      }
    </ToolbarMenu>

    {saved && (
      <ToolbarMenu
        title="Saved rankings"
        label={
          <>
            Saved <ChevronDown className="w-4 h-4" />
          </>
        }
      >
        {(close) => (
          <SavedSessionsPanel
            sessions={saved.sessions}
            loading={saved.loading}
            onOpen={(id) => {
              close();
              saved.onOpen(id);
            }}
            onDelete={saved.onDelete}
          />
        )}
      </ToolbarMenu>
    )}
  </>
);
