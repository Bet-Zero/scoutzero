/**
 * FILE: src/features/architect/GMDashboard/postActionHandoff/types.ts
 * PURPOSE: Stage 2B post-action receipt model + pure derivation from committed mutation results.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * The receipt is a session-scoped UI signal: a derived view of what just
 * committed. It is NEVER a source of truth, never persisted, and never written
 * to Firestore. Authority remains with the mutation pipeline / committed world
 * event stream; this type only restates what the pipeline already returned.
 */

import type { PersistMutationResult } from '../hooks/useArchitectActions.types';
import type { WorldAdvanceAftermath } from '../components/SeasonAdvanceModal';

export type ArchitectPostActionReceiptKind =
  | 'trade'
  | 'signing'
  | 'signAndTrade'
  | 'offerSheet'
  | 'contractAction'
  | 'seasonAdvance';

export interface ArchitectPostActionReceipt {
  kind: ArchitectPostActionReceiptKind;
  eventId: string | null;
  occurredAt: string | null;
  headline: string;
  changedTeamCodes: string[];
  primaryTeamCode: string | null;
  primaryPlayerIds: string[];
  message?: string;
  authority?: 'committed-world';
}

const HEADLINE_BY_KIND: Record<ArchitectPostActionReceiptKind, string> = {
  trade: 'Trade applied',
  signing: 'Free agent signed',
  signAndTrade: 'Sign-and-trade applied',
  offerSheet: 'Offer sheet updated',
  contractAction: 'Contract updated',
  seasonAdvance: 'Season advanced',
};

const KIND_BY_MUTATION_TYPE: Record<string, ArchitectPostActionReceiptKind> = {
  executeTrade: 'trade',
  signFreeAgent: 'signing',
  signAndTrade: 'signAndTrade',
  storeOfferSheet: 'offerSheet',
  matchOfferSheet: 'offerSheet',
  declineOfferSheet: 'offerSheet',
  finalizeMatchedOfferSheet: 'offerSheet',
  finalizeDeclinedOfferSheet: 'offerSheet',
};

export function kindForMutationType(
  mutationType: string
): ArchitectPostActionReceiptKind {
  return KIND_BY_MUTATION_TYPE[mutationType] ?? 'contractAction';
}

function extractEventId(result: PersistMutationResult): string | null {
  const event = result?.event;
  if (!event) return null;
  if (typeof (event as { eventId?: string }).eventId === 'string') {
    return (event as { eventId: string }).eventId;
  }
  if (typeof (event as { id?: string }).id === 'string') {
    return (event as { id: string }).id;
  }
  return null;
}

function extractChangedTeamCodes(
  result: PersistMutationResult
): string[] {
  const teams = result?.changedTeams || [];
  const codes: string[] = [];
  const seen = new Set<string>();
  for (const entry of teams) {
    const code = typeof entry?.teamCode === 'string' ? entry.teamCode : null;
    if (code && !seen.has(code)) {
      seen.add(code);
      codes.push(code);
    }
  }
  if (codes.length === 0 && Array.isArray(result?.writesSummary?.teamCodes)) {
    for (const code of result.writesSummary.teamCodes) {
      if (typeof code === 'string' && code && !seen.has(code)) {
        seen.add(code);
        codes.push(code);
      }
    }
  }
  return codes;
}

function extractPrimaryPlayerIds(
  result: PersistMutationResult
): string[] {
  const updates = result?.changedPlayers || [];
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const entry of updates) {
    const id = typeof entry?.playerId === 'string' ? entry.playerId : null;
    if (id && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  if (ids.length === 0 && Array.isArray(result?.writesSummary?.playerIds)) {
    for (const id of result.writesSummary.playerIds) {
      if (typeof id === 'string' && id && !seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
  }
  return ids;
}

export interface DeriveReceiptFromMutationResultArgs {
  mutationType: string;
  result: PersistMutationResult;
  primaryTeamCode?: string | null;
  occurredAt?: string | null;
  headlineOverride?: string;
}

/**
 * Derive a post-action receipt from an already-successful mutation result.
 * Returns null if the result is missing or unsuccessful — the receipt must
 * never represent a failed/throwing apply.
 */
export function deriveReceiptFromMutationResult({
  mutationType,
  result,
  primaryTeamCode = null,
  occurredAt = null,
  headlineOverride,
}: DeriveReceiptFromMutationResultArgs): ArchitectPostActionReceipt | null {
  if (!result || result.success !== true) {
    return null;
  }

  const kind = kindForMutationType(mutationType);
  const changedTeamCodes = extractChangedTeamCodes(result);
  const primaryPlayerIds = extractPrimaryPlayerIds(result);
  const eventId = extractEventId(result);
  const headline = headlineOverride || HEADLINE_BY_KIND[kind];

  return {
    kind,
    eventId,
    occurredAt: occurredAt || null,
    headline,
    changedTeamCodes,
    primaryTeamCode: primaryTeamCode || null,
    primaryPlayerIds,
    authority: 'committed-world',
  };
}

export interface DeriveSeasonAdvanceReceiptArgs {
  aftermath: WorldAdvanceAftermath;
  primaryTeamCode?: string | null;
}

/**
 * Derive a conservative receipt for a successful committed offseason
 * advance from authoritative aftermath data. Headline includes the next
 * season label when available.
 */
export function deriveSeasonAdvanceReceipt({
  aftermath,
  primaryTeamCode = null,
}: DeriveSeasonAdvanceReceiptArgs): ArchitectPostActionReceipt | null {
  if (!aftermath || typeof aftermath.nextWorldSeason !== 'string') {
    return null;
  }
  const headline = aftermath.nextWorldSeason
    ? `Season advanced to ${aftermath.nextWorldSeason}`
    : HEADLINE_BY_KIND.seasonAdvance;
  return {
    kind: 'seasonAdvance',
    eventId: null,
    occurredAt: null,
    headline,
    changedTeamCodes: primaryTeamCode ? [primaryTeamCode] : [],
    primaryTeamCode: primaryTeamCode || null,
    primaryPlayerIds: [],
    authority: 'committed-world',
  };
}
