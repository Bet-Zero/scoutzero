/**
 * FILE: src/features/architect/tradeMachine/EntitlementPicksList.tsx
 * PURPOSE: Render a list of entitlements for a team in Trade Machine (read-only).
 * OWNERSHIP: Feature: architect/tradeMachine (Phase 11.0)
 */

import React, { useMemo, useState } from 'react';
import EntitlementPickRow from './EntitlementPickRow';
import { getKindSortPriority } from '@/features/architect/utils/entitlements/formatEntitlement';
import { EntitlementEditorCreateButton } from '@/features/architect/admin/EntitlementEditorCreateButton';

type EntitlementLike = {
  id?: string | number | null;
  entitlementId?: string | number | null;
  identityKey?: string | null;
  underlyingStatus?: string | null;
  seasonYear?: number | string | null;
  round?: number | string | null;
  kind?: string | null;
  secondaryText?: string | null;
};

type OutgoingEntitlementLike = {
  id?: string | number | null;
  entitlementId?: string | number | null;
  toTeamId?: string | number | null;
};

type TeamOptionLike = {
  id?: string | number | null;
  teamName?: string | null;
  teamCode?: string | null;
};

interface EntitlementPicksListProps {
  entitlements?: EntitlementLike[];
  teamId: string;
  showPooled?: boolean;
  onToggleEntitlement?: ((entitlement: EntitlementLike) => void) | null;
  selectedEntitlementIds?: Array<string | number>;
  pickRulesById?: Record<string, unknown>;
  emptyStateHint?: string;
  otherTeams?: TeamOptionLike[];
  entitlementsOut?: OutgoingEntitlementLike[];
  onSetDestination?: (...args: unknown[]) => void;
  onEditEntitlement?: (...args: unknown[]) => void;
  onViewDetails?: (...args: unknown[]) => void;
  onCreateEntitlement?: (() => void) | null;
  isVacuumMode?: boolean;
  onRevertEntitlementEdit?: (...args: unknown[]) => void;
  onDeleteSessionEntitlement?: (...args: unknown[]) => void;
  compact?: boolean;
}

export const EntitlementPicksList = ({
  entitlements = [],
  teamId,
  showPooled = false,
  onToggleEntitlement,
  selectedEntitlementIds = [],
  pickRulesById = {},
  emptyStateHint,
  otherTeams = [],
  entitlementsOut = [],
  onSetDestination,
  onEditEntitlement,
  onViewDetails,
  onCreateEntitlement,
  isVacuumMode = false,
  onRevertEntitlementEdit,
  onDeleteSessionEntitlement,
  compact = false,
}: EntitlementPicksListProps) => {
  const [openMenu, setOpenMenu] = useState<string | number | null>(null);

  const sortedEntitlements = useMemo(() => {
    if (!Array.isArray(entitlements) || entitlements.length === 0) {
      return [];
    }

    const filtered = showPooled
      ? entitlements
      : entitlements.filter((e) => e.underlyingStatus !== 'pooled');

    const deduped: EntitlementLike[] = [];
    const seenKeys = new Map<string, number>();
    for (const ent of filtered) {
      const key = ent.identityKey;
      if (key) {
        const existingIdx = seenKeys.get(key);
        if (existingIdx !== undefined) {
          deduped[existingIdx] = ent;
          continue;
        }
        seenKeys.set(key, deduped.length);
      }
      deduped.push(ent);
    }

    return [...deduped].sort((a, b) => {
      const yearA = Number(a.seasonYear || 0) || 0;
      const yearB = Number(b.seasonYear || 0) || 0;
      if (yearA !== yearB) return yearA - yearB;

      const roundA = Number(a.round || 0) || 0;
      const roundB = Number(b.round || 0) || 0;
      if (roundA !== roundB) return roundA - roundB;

      const kindPriorityA = getKindSortPriority(a.kind);
      const kindPriorityB = getKindSortPriority(b.kind);
      return kindPriorityA - kindPriorityB;
    });
  }, [entitlements, showPooled]);

  const groupedByYear = useMemo(() => {
    const groups = new Map<number | string, EntitlementLike[]>();
    for (const entitlement of sortedEntitlements) {
      const year = entitlement.seasonYear || 'Unknown';
      if (!groups.has(year)) {
        groups.set(year, []);
      }
      groups.get(year)?.push(entitlement);
    }
    return groups;
  }, [sortedEntitlements]);

  const toTeamIdByEntitlement = useMemo(() => {
    const map: Record<string, string | number | null> = {};
    for (const e of entitlementsOut) {
      const id = e.id || e.entitlementId;
      if (id) {
        map[String(id)] = e.toTeamId || null;
      }
    }
    return map;
  }, [entitlementsOut]);

  if (sortedEntitlements.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-sm text-white/70">Draft Assets (Entitlements)</h4>
          {onCreateEntitlement && (
            <EntitlementEditorCreateButton
              onClick={onCreateEntitlement}
              size="sm"
            />
          )}
        </div>
        <div className="text-xs text-white/40 px-1">
          No entitlements loaded.
          {emptyStateHint && (
            <span className="block mt-1 text-white/30 text-[10px]">
              {emptyStateHint}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-sm text-white/70">Draft Assets (Entitlements)</h4>
        {onCreateEntitlement && (
          <EntitlementEditorCreateButton
            onClick={onCreateEntitlement}
            size="sm"
          />
        )}
      </div>
      <div className="space-y-3 max-h-[375px] overflow-y-auto pr-1">
        {Array.from(groupedByYear.entries()).map(([year, yearEntitlements]) => (
          <div key={year} className="space-y-1">
            <div className="text-[10px] text-white/50 uppercase tracking-wide px-1 pt-1">
              {year}
            </div>
            {yearEntitlements.map((entitlement) => {
              const entitlementId = entitlement.id || entitlement.entitlementId;
              const isSelected = selectedEntitlementIds.includes(
                entitlementId ?? ''
              );

              return (
                <EntitlementPickRow
                  key={
                    entitlement.id ||
                    `${entitlement.seasonYear}-${entitlement.round}-${entitlement.kind}`
                  }
                  entitlement={entitlement}
                  teamId={teamId}
                  isSelected={isSelected}
                  onToggle={onToggleEntitlement}
                  pickRulesById={pickRulesById}
                  otherTeams={otherTeams}
                  currentToTeamId={toTeamIdByEntitlement[String(entitlementId)]}
                  onSetDestination={onSetDestination}
                  onEdit={onEditEntitlement}
                  onViewDetails={onViewDetails}
                  openMenu={openMenu}
                  setOpenMenu={setOpenMenu}
                  isVacuumMode={isVacuumMode}
                  onRevertEdit={onRevertEntitlementEdit}
                  onDeleteSessionPickRight={onDeleteSessionEntitlement}
                  compact={compact}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default EntitlementPicksList;
