/**
 * FILE: src/features/architect/utils/freeAgentRights.ts
 * PURPOSE: Canonical, single-source resolver for a free agent's Bird rights,
 *   cap hold, signing lane, and cap-sheet placement.
 * OWNERSHIP: Feature: architect
 *
 * FOUNDATION PRINCIPLE — derive, never freeze:
 *   The PLAYER RECORD is the single source of truth for Bird rights and free
 *   agency status (`contract.birdRights`, `contract.freeAgency`). A cap hold is
 *   a DERIVED VIEW of a player, not a place to copy a frozen Bird tier or a
 *   stale dollar amount. Every surface (the Free Agent Pool and the Full Cap
 *   Table's inline cap-hold rows) resolves a free agent by joining `playerId`
 *   to the player record and calling into this module — so there is exactly one
 *   place that understands Bird rights, and advancing a season / trading /
 *   renouncing always recomputes from the player instead of trusting a copy.
 *
 * This module folds together logic that previously lived in three places:
 *   - deriveBirdType()            (buildRuleContext.helpers.ts)
 *   - calculateCapHold()          (capHolds.ts — reused here, not duplicated)
 *   - getFreeAgentSigningContext()(freeAgency/FreeAgentPool — to delegate here)
 */

import type { BirdType } from '@/features/architect/types/ruleContext';
import {
  calculateCapHold,
  type CapHoldPlayerInput,
} from '@/features/architect/utils/capHolds';

type UnknownRecord = Record<string, unknown>;

/**
 * Where a cap hold belongs in the UI.
 *  - 'main' : the team's own free agent for the season being planned — a
 *             re-sign decision you make NOW. Renders inline in the Full Cap
 *             Table alongside signed contracts.
 *  - 'side' : future-year holds and renounced holds — the collapsible section.
 *  - 'dead' : zombie holds for departed/retired players the team never bothered
 *             to renounce (e.g. Carmelo, Dwight). Technically real per the CBA,
 *             practically meaningless. Parked in the side section, marked dead,
 *             and bulk-renounce-able.
 */
export type CapHoldPlacement = 'main' | 'side' | 'dead';

/** Signing lane, mirrors the Free Agent Pool surface vocabulary. */
export type FreeAgentSigningLane =
  | 'bird-rights'
  | 'restricted-rights'
  | 'option-decision'
  | 'cap-space-exception'
  | 'rights-renounced';

/** Loose player shape — playersMap values arrive as `unknown` from storage. */
export interface FreeAgentPlayerInput {
  renounced?: boolean;
  playerId?: unknown;
  player_id?: unknown;
  id?: unknown;
  bio?: {
    yearsExperience?: number;
  } | null;
  draft?: {
    pick?: number;
    round?: number;
  } | null;
  contract?: {
    birdRights?: {
      status?: string;
    };
    salariesByYear?: Array<{
      season?: string;
      salary?: number | null;
      capHit?: number | null;
    }> | null;
    freeAgency?: {
      type?: string;
      year?: number;
      capHold?: number;
      qualifyingOffer?: number | null;
      hasOption?: boolean;
      optionType?: string | null;
    };
  } | null;
}

/** Team-scoped context that the player record cannot supply on its own. */
export interface FreeAgentResolveContext {
  /** Start year of the season being planned, e.g. 2026 for '2026-27'. */
  activeSeasonStartYear?: number | null;
  /** `type` from the team's stored cap-hold record, e.g. 'UFA' | 'FA Cap Hold'. */
  holdType?: string | null;
  /** Start year from the cap-hold record's `season`, fallback for FA year. */
  holdSeasonStartYear?: number | null;
  /** Is the player still a rostered/controlled player (vs. departed)? */
  isOnRoster?: boolean;
  /** Has the team renounced this free agent's rights? */
  renounced?: boolean;
}

export interface FreeAgentRights {
  birdType: BirdType;
  /** UFA | RFA | PO | TO | None — normalized free-agent classification. */
  freeAgentType: string;
  /** Calendar year the player reaches free agency (from the player record). */
  freeAgencyYear: number | null;
  /** Cap hold amount, derived live from the player; never a stored snapshot. */
  capHoldAmount: number;
  /** Human-readable reason for the hold amount (e.g. "Full Bird Rights"). */
  capHoldReason: string;
  lane: FreeAgentSigningLane;
  /** Can the team re-sign this player USING their retained rights? */
  canResignWithRights: boolean;
  /** The mechanism a re-sign would use. */
  signingMechanism: BirdType | 'Cap Space' | 'Minimum';
  placement: CapHoldPlacement;
  isDeadHold: boolean;
}

const asRecord = (value: unknown): UnknownRecord | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[$,]/g, '').trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

/**
 * Canonical Bird-tier derivation. Reads `contract.birdRights.status` and maps
 * SalarySwish's vocabulary ("Bird" === Full Bird) onto the BirdType model.
 * This is the single implementation; legacy copies should delegate here.
 */
export function deriveBirdType(player: FreeAgentPlayerInput | null): BirdType {
  const status = player?.contract?.birdRights?.status;
  if (!status) return 'None';

  const normalized = String(status).toLowerCase().trim();
  if (normalized.includes('full') || normalized === 'bird') return 'Full Bird';
  if (normalized.includes('early')) return 'Early Bird';
  if (normalized.includes('non')) return 'Non-Bird';
  if (normalized === 'none') return 'None';

  // Unrecognized values are treated as no rights rather than silently mapped.
  return 'None';
}

const readFreeAgency = (player: FreeAgentPlayerInput | null) =>
  asRecord(player?.contract?.freeAgency);

/**
 * Cap hold amount from the player record. Staged player data carries
 * CBA-specific cap-hold truth, including max-salary limits that a simple
 * Bird-tier multiplier cannot infer. Use that player-record value when present,
 * and compute only as a fallback for missing source data.
 */
function resolveCapHoldAmount(
  player: FreeAgentPlayerInput | null,
  birdType: BirdType
): { amount: number; reason: string } {
  if (!player) return { amount: 0, reason: 'No player' };

  const sourceHold = toFiniteNumber(readFreeAgency(player)?.capHold);
  if (sourceHold != null && sourceHold > 0) {
    return { amount: sourceHold, reason: `${birdType} (source)` };
  }

  const computed = calculateCapHold(player as CapHoldPlayerInput);
  if (computed && computed.active && computed.amount > 0) {
    return { amount: computed.amount, reason: computed.reason };
  }

  return { amount: computed?.amount ?? 0, reason: computed?.reason ?? 'None' };
}

function resolveLane(
  freeAgentType: string,
  birdType: BirdType,
  renounced: boolean
): FreeAgentSigningLane {
  const type = freeAgentType.toUpperCase();
  if (renounced) return 'rights-renounced';
  if (type === 'PO' || type === 'TO') return 'option-decision';
  if (type === 'RFA') return 'restricted-rights';
  if (birdType !== 'None') return 'bird-rights';
  return 'cap-space-exception';
}

function resolvePlacement(
  context: FreeAgentResolveContext,
  freeAgencyYear: number | null,
  freeAgentType: string
): CapHoldPlacement {
  const {
    activeSeasonStartYear,
    holdType,
    isOnRoster = true,
    renounced,
  } = context;
  const normalizedHoldType = String(holdType ?? '').toLowerCase();

  // Zombie holds: generic "FA Cap Hold" placeholders for players who have
  // departed and were never renounced (Carmelo, Dwight). Not roster players,
  // and tagged to a season at/earlier than the one we're planning.
  const isGenericFaHold = normalizedHoldType.includes('fa cap hold');
  const isExpired =
    freeAgencyYear != null &&
    activeSeasonStartYear != null &&
    freeAgencyYear < activeSeasonStartYear;
  if (isGenericFaHold && !isOnRoster && (freeAgencyYear == null || isExpired)) {
    return 'dead';
  }

  // Renounced own free agents drop out of the active decision set.
  if (renounced) return 'side';

  // Own free agent for the season being planned → first-class cap-table row.
  if (
    isOnRoster &&
    freeAgencyYear != null &&
    activeSeasonStartYear != null &&
    freeAgencyYear === activeSeasonStartYear &&
    freeAgentType.toUpperCase() !== 'FA CAP HOLD'
  ) {
    return 'main';
  }

  return 'side';
}

/**
 * Resolve the complete free-agent rights context for a player + cap-hold.
 * The player supplies the rights/amount truth; `context` supplies the
 * team-scoped facts (which season we're planning, the stored hold type, roster
 * membership, renounce state) that the player record cannot know on its own.
 */
export function resolveFreeAgentRights(
  player: FreeAgentPlayerInput | null,
  context: FreeAgentResolveContext = {}
): FreeAgentRights {
  const freeAgency = readFreeAgency(player);
  const birdType = deriveBirdType(player);

  const freeAgencyYear =
    toFiniteNumber(freeAgency?.year) ?? context.holdSeasonStartYear ?? null;

  const freeAgentType =
    (typeof freeAgency?.type === 'string' && freeAgency.type.trim()) ||
    (typeof context.holdType === 'string' && context.holdType.trim()) ||
    'UFA';

  const renounced = Boolean(context.renounced);
  const lane = resolveLane(freeAgentType, birdType, renounced);
  const { amount, reason } = resolveCapHoldAmount(player, birdType);
  const placement = resolvePlacement(context, freeAgencyYear, freeAgentType);

  const signingMechanism: BirdType | 'Cap Space' | 'Minimum' =
    birdType !== 'None' ? birdType : 'Cap Space';

  return {
    birdType,
    freeAgentType,
    freeAgencyYear,
    capHoldAmount: amount,
    capHoldReason: reason,
    lane,
    canResignWithRights:
      lane === 'bird-rights' ||
      lane === 'restricted-rights' ||
      lane === 'option-decision',
    signingMechanism,
    placement,
    isDeadHold: placement === 'dead',
  };
}

/** Convenience: is this cap hold a renounce-able zombie? */
export function isDeadCapHold(
  player: FreeAgentPlayerInput | null,
  context: FreeAgentResolveContext = {}
): boolean {
  return resolveFreeAgentRights(player, context).placement === 'dead';
}
