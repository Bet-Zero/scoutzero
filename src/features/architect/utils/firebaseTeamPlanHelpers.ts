/**
 * FILE: src/features/architect/utils/firebaseTeamPlanHelpers.ts
 * PURPOSE: Firebase helpers for loading base team/player data and free agents.
 * OWNERSHIP: Feature: architect/core
 *
 * ARCHITECT READ-STACK LAYER: base hydration authority.
 * - Owns base team/player/free-agent reads and hydrated base team shapes.
 * - Not world-aware; lineage fallback belongs in teamLoader.ts.
 * - Not a committed-write authority; world writes live in higher authorities.
 *
 * HISTORY:
 *  - 2025-12-25: Removed legacy teamPlans save/load functions (worlds-only cleanup)
 *  - 2026-01-21: Added entitlementIds pass-through for base team hydration
 *  - 2026-03-13: Migrated authoritative implementation to TypeScript without changing helper behavior
 *
 * NOTE: All team mutations now go through mutationPipeline.ts for world persistence.
 *       This file only handles READ operations for base data and free agents.
 */

import {
  doc,
  getDoc,
  collection,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import {
  baseTeamRef,
  baseTeamsCol,
  basePlayerRef,
} from '@/data/firestorePaths';
import { FREE_AGENTS_COLLECTION } from '@/constants/collections';
import {
  TeamListFull,
  TeamSlugToCode,
  TeamCodeMap,
} from '@/constants/teamList';
import { normalizeTeamExceptionOwnership } from '@/features/architect/utils/exceptions/exceptionOwnership';
import { normalizeTeamTpeSchema } from '@/features/architect/utils/persistenceContracts/normalizeTeamTpe';
import type { TeamTotals } from '@/features/architect/types';

type UnknownRecord = Record<string, unknown>;
type TeamIdLike = string | null | undefined;

interface LooseCapSheet extends UnknownRecord {
  capHolds?: unknown[] | null;
}

interface LooseExceptionValue extends UnknownRecord {
  totalAmount?: number | null;
  usedAmount?: number | null;
  remainingAmount?: number | null;
}

interface LooseTradeException extends LooseExceptionValue {
  id?: string;
  label?: string | null;
  createdFrom?: string | null;
  expiresOn?: string | null;
  expires?: string | null;
}

interface LooseExceptionData extends UnknownRecord {
  mle?: LooseExceptionValue | null;
  tpmle?: LooseExceptionValue | null;
  taxpayerMle?: LooseExceptionValue | null;
  tpMle?: LooseExceptionValue | null;
  nonTaxpayerMle?: LooseExceptionValue | null;
  fullMLE?: LooseExceptionValue | null;
  bae?: LooseExceptionValue | null;
  biAnnual?: LooseExceptionValue | null;
  room?: LooseExceptionValue | null;
  roomMLE?: LooseExceptionValue | null;
  roommle?: LooseExceptionValue | null;
  rmle?: LooseExceptionValue | null;
  dpe?: LooseExceptionValue | null;
  tpe?: LooseTradeException[] | null;
}

interface LooseBaseTeamDoc extends UnknownRecord {
  roster?: unknown[] | null;
  teamName?: string;
  season?: string;
  abbreviation?: string | null;
  capHolds?: unknown[] | null;
  draftPicks?: unknown[] | null;
  draftPicksInventory?: unknown[] | null;
  draftPicksObligations?: unknown[] | null;
  draftPicksContested?: unknown[] | null;
  draftAssets?: unknown;
  entitlementIds?: string[] | null;
  offerSheets?: unknown[] | null;
  incomingOfferSheets?: unknown[] | null;
  exceptions?: LooseExceptionData | null;
  tradeExceptions?: LooseTradeException[] | null;
  hardCapLevel?: string | null;
  hardCapReason?: string | null;
  hardCapTriggeredBy?: string | null;
  deadCap?: unknown[] | null;
  totals?:
    | (UnknownRecord & {
        hardCapLevel?: string | null;
        hardCapReason?: string | null;
        hardCapDetail?: string | null;
      })
    | null;
}

interface LooseBirdRights extends UnknownRecord {
  status?: string | null;
  yearsOfService?: number | null;
  yearsWithTeam?: number | null;
  eligibleFor?: string[] | null;
}

interface LooseContract extends UnknownRecord {
  salariesByYear?: unknown[] | null;
  yearsRemaining?: number | null;
  contractType?: string | null;
  isExtension?: boolean | null;
  isRookieScale?: boolean | null;
  signedUsing?: string | null;
  signingTeam?: string | null;
  signingDate?: string | null;
  totalValue?: number | null;
  birdRights?: LooseBirdRights | null;
  freeAgency?:
    | { year?: number | string | null; type?: string | null }
    | string
    | null;
}

interface LooseBio extends UnknownRecord {
  position?: string | null;
  age?: number | null;
  experience?: number | null;
}

interface LooseBasePlayerDoc extends UnknownRecord {
  playerId?: string;
  displayName?: string;
  bio?: LooseBio | null;
  teamCode?: string | null;
  teamName?: string | null;
  contract?: LooseContract | null;
  futureContract?: LooseContract | null;
  representation?: unknown;
}

interface LooseFreeAgent extends UnknownRecord {
  id?: string;
  name?: string;
}

// ===== Utility to Prepare Cap Sheet =====

// In the new model, cap holds are managed in the `capHolds` array in state.
// We no longer need to calculate them on every save from player attributes.
// Logic for creating them happens on "Decline Option" or similar events.
export const prepareCapSheet = <TCapSheet extends LooseCapSheet>(
  capSheet: TCapSheet /* , capProjections , year = 2025 */
) => {
  // Just pass through, or maybe sort the capHolds if needed?
  return {
    ...capSheet,
    capHolds: capSheet.capHolds || [],
    updatedAt: new Date().toISOString(),
  };
};

// ===== Load Real-World Base Team Data (read-only) =====

const resolveTeamCode = (teamId: TeamIdLike) => {
  if (!teamId) return null;
  if (TeamSlugToCode[teamId]) return TeamSlugToCode[teamId];
  if (TeamCodeMap[teamId]) return teamId;
  return teamId.toUpperCase();
};

// Simplified player entry builder - returns new schema format directly
const buildPlayerEntry = (
  playerId: string,
  playerData: LooseBasePlayerDoc | null
) => {
  if (!playerData) {
    return {
      id: playerId,
      player_id: playerId,
      name: playerId,
      displayName: playerId,
      contract: null as any, // load-bearing: placeholder satisfies broader player type at call sites without requiring full contract structure in fallback
      bio: {} as Record<string, unknown>,
      original: null as any, // load-bearing: same as contract — fallback path, callers expect field to exist but never read it here
    };
  }

  // Return player in new schema format - no conversion needed
  return {
    id: playerData.playerId || playerId,
    player_id: playerData.playerId || playerId,
    name: playerData.displayName || playerId,
    displayName: playerData.displayName || playerId,
    position: playerData.bio?.position || '',
    age: playerData.bio?.age || null,
    teamCode: playerData.teamCode || null,
    teamName: playerData.teamName || null,
    contract: playerData.contract || null,
    futureContract: playerData.futureContract || null,
    bio: {
      ...(playerData.bio || {}),
      playerId: playerData.playerId || playerId,
      displayName: playerData.displayName || playerId,
    },
    representation: playerData.representation || null,
    original: playerData,
  };
};

type HydratedBaseTeamPlayer = ReturnType<typeof buildPlayerEntry>;

type HydratedBaseTeamActiveContract = {
  name: HydratedBaseTeamPlayer['name'];
  player_id: HydratedBaseTeamPlayer['player_id'];
  contract: HydratedBaseTeamPlayer['contract'];
  years: number;
  type: string;
  signAndTrade: boolean;
  guaranteed: boolean;
  isMinimum: boolean;
  yearsOfService: number | null;
};

type HydratedBaseTeamExceptions = Pick<
  LooseExceptionData,
  'mle' | 'tpmle' | 'bae' | 'room' | 'dpe' | 'tpe'
>;

export type HydratedBaseTeamCapSheet = {
  id: string;
  teamCode: string;
  teamName?: string;
  season?: string;
  abbreviation: string;
  players: HydratedBaseTeamPlayer[];
  roster: HydratedBaseTeamPlayer[];
  activeContracts: HydratedBaseTeamActiveContract[];
  capHolds: NonNullable<LooseBaseTeamDoc['capHolds']>;
  draftPicks: NonNullable<LooseBaseTeamDoc['draftPicks']>;
  draftPicksInventory: NonNullable<LooseBaseTeamDoc['draftPicksInventory']>;
  draftPicksObligations: NonNullable<LooseBaseTeamDoc['draftPicksObligations']>;
  draftPicksContested: NonNullable<LooseBaseTeamDoc['draftPicksContested']>;
  draftAssets: LooseBaseTeamDoc['draftAssets'] | null;
  entitlementIds: NonNullable<LooseBaseTeamDoc['entitlementIds']>;
  offerSheets: NonNullable<LooseBaseTeamDoc['offerSheets']>;
  incomingOfferSheets: NonNullable<LooseBaseTeamDoc['incomingOfferSheets']>;
  exceptions: HydratedBaseTeamExceptions;
  hardCapLevel: string | null;
  hardCapReason: string | null;
  hardCapTriggeredBy: string | null;
  hardCapped: boolean;
  deadCap: NonNullable<LooseBaseTeamDoc['deadCap']>;
  baseline: LooseBaseTeamDoc;
  totals: TeamTotals;
};

/**
 * Layer 1 of the Architect read stack.
 *
 * Hydrates a base team document into the base-only team shape used by higher
 * read layers. This function deliberately does not resolve world lineage.
 */
export const hydrateBaseTeam = async (
  teamCode: string,
  baseDoc: LooseBaseTeamDoc
): Promise<HydratedBaseTeamCapSheet> => {
  const normalizedBaseDoc = normalizeTeamExceptionOwnership(
    normalizeTeamTpeSchema(baseDoc)
  ) as LooseBaseTeamDoc & {
    exceptions?: HydratedBaseTeamExceptions | null;
  };
  const players: HydratedBaseTeamPlayer[] = [];
  for (const rawPlayerId of normalizedBaseDoc.roster || []) {
    const playerId = String(rawPlayerId || '').trim();
    if (!playerId) {
      continue;
    }
    try {
      const playerSnap = await getDoc(basePlayerRef(playerId));
      if (!playerSnap.exists()) {
        players.push(buildPlayerEntry(playerId, null));
        continue;
      }

      const playerData = playerSnap.data() as LooseBasePlayerDoc;
      // Return player in new schema format - no conversion needed
      const playerEntry = buildPlayerEntry(playerId, playerData);
      players.push(playerEntry);
    } catch (err) {
      console.warn(`Failed to hydrate player ${playerId}`, err);
      players.push(buildPlayerEntry(playerId, null));
    }
  }

  // Build activeContracts from new schema format
  const activeContracts: HydratedBaseTeamActiveContract[] = players
    .filter((p) => p.contract?.salariesByYear?.length > 0)
    .map((p) => {
      const contract = p.contract;
      return {
        name: p.name,
        player_id: p.player_id,
        contract: contract,
        years: contract?.yearsRemaining || 0,
        type: contract?.contractType || 'Contract',
        signAndTrade: false,
        guaranteed: true,
        isMinimum: false,
        yearsOfService:
          p.bio?.experience || contract?.birdRights?.yearsOfService || null,
      };
    });

  const exceptionData =
    (normalizedBaseDoc.exceptions as HydratedBaseTeamExceptions | null) || {};

  const teamMeta = TeamCodeMap[teamCode] || null;
  const hardCapLevel =
    normalizedBaseDoc.hardCapLevel ||
    normalizedBaseDoc.totals?.hardCapLevel ||
    null;
  const hardCapReason =
    normalizedBaseDoc.hardCapReason ||
    normalizedBaseDoc.totals?.hardCapReason ||
    normalizedBaseDoc.totals?.hardCapDetail ||
    null;
  const hardCapTriggeredBy = normalizedBaseDoc.hardCapTriggeredBy || null;
  const hardCapped =
    hardCapLevel != null &&
    String(hardCapLevel).toLowerCase() !== 'none' &&
    String(hardCapLevel).toLowerCase() !== 'false';
  const totals = (normalizedBaseDoc.totals || {}) as TeamTotals;

  // Return team in new schema format - no conversion needed
  return {
    id: teamMeta?.id || teamCode.toLowerCase(),
    teamCode,
    teamName: normalizedBaseDoc.teamName,
    season: normalizedBaseDoc.season,
    abbreviation: normalizedBaseDoc.abbreviation || teamCode,
    players,
    roster: players,
    activeContracts,
    capHolds: normalizedBaseDoc.capHolds || [],
    draftPicks: normalizedBaseDoc.draftPicks || [],
    // Draft pick ledger views (from pipeline - see PIPELINE_DRAFT_PICKS_LEDGER__EXECUTION__2026-01-08.md)
    // draftPicksInventory: Picks the team currently owns
    draftPicksInventory:
      normalizedBaseDoc.draftPicksInventory ||
      normalizedBaseDoc.draftPicks ||
      [],
    // draftPicksObligations: Picks the team owes / has traded away (used for Stepien validation)
    draftPicksObligations: normalizedBaseDoc.draftPicksObligations || [],
    // draftPicksContested: Swaps and conditional picks involving the team
    draftPicksContested: normalizedBaseDoc.draftPicksContested || [],
    // draftAssets: Canonical Trade Machine source (see RETURN_PACKAGE_DRAFT_PICKS_TRADE_ASSETS.md)
    // Contains tradeable assets with assetType (outright_pick, conditional_right, swap_right)
    draftAssets: normalizedBaseDoc.draftAssets || null,
    entitlementIds: normalizedBaseDoc.entitlementIds || [],
    offerSheets: normalizedBaseDoc.offerSheets || [],
    incomingOfferSheets: normalizedBaseDoc.incomingOfferSheets || [],
    exceptions: exceptionData,
    hardCapLevel,
    hardCapReason,
    hardCapTriggeredBy,
    hardCapped,
    deadCap: normalizedBaseDoc.deadCap || [],
    baseline: normalizedBaseDoc,
    totals,
  };
};

/**
 * Base-only dashboard loader.
 *
 * Use teamLoader.getTeam(...) when world-aware fallback resolution is required.
 * Use worldTeamData.loadWorldTeamData(...) for dashboard reads that should stay
 * inside the full three-layer read contract.
 */
export const loadTeamCapSheet = async (teamId: TeamIdLike) => {
  try {
    const teamCode = resolveTeamCode(teamId);
    if (!teamCode) {
      console.warn('Unable to resolve team code for:', teamId);
      return null;
    }
    const docSnap = await getDoc(baseTeamRef(teamCode));
    if (!docSnap.exists()) {
      console.warn('No base team data found for:', teamCode);
      return null;
    }
    const baseDoc = docSnap.data() as LooseBaseTeamDoc;
    return hydrateBaseTeam(teamCode, baseDoc);
  } catch (error) {
    console.error('Error loading base team:', error);
    return null;
  }
};

export const getAllTeams = async () => {
  try {
    const snapshot = await getDocs(baseTeamsCol());
    if (!snapshot.empty) {
      return snapshot.docs.map((docSnap) => {
        const code = docSnap.id;
        const meta = TeamCodeMap[code];
        const teamData = docSnap.data() as UnknownRecord | undefined;
        return {
          id: meta?.id || code.toLowerCase(),
          code,
          name: meta?.teamName || teamData?.teamName || code,
          conference: meta?.conference || null,
        };
      });
    }
  } catch (error) {
    console.error('Error getting base teams:', error);
  }
  // Fallback to static list if architect data unavailable
  return TeamListFull.map((team) => ({
    id: team.id,
    code: team.code,
    name: team.teamName,
    conference: team.conference,
  }));
};

// ===== Free Agent Pool Management =====

export const saveFreeAgents = async (agents: LooseFreeAgent[]) => {
  try {
    const batch = writeBatch(db);
    agents.forEach((agent) => {
      const agentRef = doc(
        db,
        FREE_AGENTS_COLLECTION,
        (agent.id || agent.name) as string
      );
      batch.set(agentRef, agent);
    });
    await batch.commit();
    console.log('Saved free agents');
    return true;
  } catch (error) {
    console.error('Error saving free agents:', error);
    return false;
  }
};

export const loadFreeAgents = async () => {
  try {
    const snap = await getDocs(collection(db, FREE_AGENTS_COLLECTION));
    const agents = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));
    return agents;
  } catch (error) {
    console.error('Error loading free agents:', error);
    return [];
  }
};
