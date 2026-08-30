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
import { TeamListFull } from '@/constants/teamList';
import { normalizeTeamExceptionOwnership } from '@/features/architect/utils/exceptions/exceptionOwnership';
import { normalizeTeamTpeSchema } from '@/features/architect/utils/persistenceContracts/normalizeTeamTpe';
import type { TeamTotals } from '@/features/architect/types';
import type { TeamSalaryBookInputs } from '@/schemas/salaryBooks';
import type { ContractEventLedgerPayload } from '@/schemas/contractEventLedger';
import type { TradeHardCapLedgerEntry } from '@/schemas/tradeApronRestriction';
import {
  readArchitectNumber,
  readArchitectRecord,
  readArchitectString,
} from '@/features/architect/utils/architectFirestoreBoundary';
// Wave 38 Step 1: private types, constants, and reader functions extracted to submodule
export * from './firebaseTeamPlanHelpers.readers';
import {
  TEAM_CODE_LOOKUP,
  readLooseBaseTeamDoc,
  readLooseBasePlayerDoc,
  readLooseFreeAgent,
  buildPlayerEntry,
  hasActiveContract,
  resolveTeamCode,
  type LooseBaseTeamDoc,
  type LooseFreeAgent,
  type HydratedBaseTeamPlayer,
  type HydratedBaseTeamActiveContract,
  type HydratedBaseTeamExceptions,
} from './firebaseTeamPlanHelpers.readers';

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
  salaryBookInputs?: TeamSalaryBookInputs | null;
  contractEventLedgers?: ContractEventLedgerPayload[] | null;
  hardCapLedger?: TradeHardCapLedgerEntry[] | null;
  cashLedger?: LooseBaseTeamDoc['cashLedger'];
};

/**
 * Layer 1 of the Architect read stack.
 *
 * Hydrates a base team document into the base-only team shape used by higher
 * read layers. This function deliberately does not resolve world lineage.
 */
export const hydrateBaseTeam = async (
  teamCode: string,
  baseDoc: LooseBaseTeamDoc,
  authorityContext: { worldId?: string | null } = {}
): Promise<HydratedBaseTeamCapSheet> => {
  const boundaryBaseDoc = readLooseBaseTeamDoc(
    baseDoc,
    teamCode,
    `hydrateBaseTeam(${teamCode})`,
    authorityContext.worldId ?? null
  );
  const normalizedBaseDoc = normalizeTeamExceptionOwnership(
    normalizeTeamTpeSchema(boundaryBaseDoc)
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

      const playerData = readLooseBasePlayerDoc(
        playerSnap.data(),
        playerId,
        `architect_basePlayers/${playerId}`
      );
      const playerEntry = buildPlayerEntry(playerId, playerData);
      players.push(playerEntry);
    } catch (err) {
      console.warn(`Failed to hydrate player ${playerId}`, err);
      players.push(buildPlayerEntry(playerId, null));
    }
  }

  // Build activeContracts from new schema format
  const activeContracts: HydratedBaseTeamActiveContract[] = players
    .filter(hasActiveContract)
    .map((p) => {
      const contract = p.contract;
      const yearsOfService =
        readArchitectNumber(p.bio?.experience) ??
        readArchitectNumber(contract.birdRights?.yearsOfService) ??
        null;

      return {
        name: p.name,
        player_id: p.player_id,
        contract: contract,
        years: contract.yearsRemaining || 0,
        type: contract.contractType || 'Contract',
        signAndTrade: false,
        guaranteed: true,
        isMinimum: false,
        yearsOfService,
      };
    });

  const exceptionData =
    (normalizedBaseDoc.exceptions as HydratedBaseTeamExceptions | null) || {};

  const teamMeta = TEAM_CODE_LOOKUP[teamCode] || null;
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
  // A team is hard-capped ONLY when it has actually triggered a hard cap by
  // using the NT-MLE, BAE, or a sign-and-trade (which records a
  // `hardCapTriggeredBy` / canonical `isHardCapped`). `hardCapLevel` is only a
  // band descriptor (which apron the salary sits in) and must not, by itself,
  // mark a team hard-capped — otherwise every apron-band team is falsely capped.
  const hardCapped =
    Boolean(hardCapTriggeredBy) ||
    normalizedBaseDoc.totals?.isHardCapped === true;
  const totals = (normalizedBaseDoc.totals || {}) as TeamTotals;

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
    draftPicksInventory:
      normalizedBaseDoc.draftPicksInventory ||
      normalizedBaseDoc.draftPicks ||
      [],
    draftPicksObligations: normalizedBaseDoc.draftPicksObligations || [],
    draftPicksContested: normalizedBaseDoc.draftPicksContested || [],
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
    ...(normalizedBaseDoc.salaryBookInputs !== undefined
      ? { salaryBookInputs: normalizedBaseDoc.salaryBookInputs }
      : {}),
    ...(normalizedBaseDoc.contractEventLedgers !== undefined
      ? { contractEventLedgers: normalizedBaseDoc.contractEventLedgers }
      : {}),
    ...(normalizedBaseDoc.hardCapLedger !== undefined
      ? { hardCapLedger: normalizedBaseDoc.hardCapLedger }
      : {}),
    ...(normalizedBaseDoc.cashLedger !== undefined
      ? { cashLedger: normalizedBaseDoc.cashLedger }
      : {}),
  };
};

/**
 * Base-only dashboard loader.
 *
 * Use teamLoader.getTeam(...) when world-aware fallback resolution is required.
 * Use worldTeamData.loadWorldTeamData(...) for dashboard reads that should stay
 * inside the full three-layer read contract.
 */
export const loadTeamCapSheet = async (teamId: string | null | undefined) => {
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
    const baseDoc = readLooseBaseTeamDoc(
      docSnap.data(),
      teamCode,
      `architect_baseTeams/${teamCode}`
    );
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
        const meta = TEAM_CODE_LOOKUP[code];
        const teamData = readArchitectRecord(docSnap.data()) ?? {};
        return {
          id: meta?.id || code.toLowerCase(),
          code,
          name: meta?.teamName || readArchitectString(teamData.teamName) || code,
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
      const agentId = readArchitectString(agent.id) ?? readArchitectString(agent.name);
      if (!agentId) {
        throw new Error('Free agent id or name is required');
      }
      const agentRef = doc(db, FREE_AGENTS_COLLECTION, agentId);
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
    const agents = snap.docs.map((docSnap) =>
      readLooseFreeAgent(
        docSnap.data(),
        docSnap.id,
        `${FREE_AGENTS_COLLECTION}/${docSnap.id}`
      )
    );
    return agents;
  } catch (error) {
    console.error('Error loading free agents:', error);
    return [];
  }
};
