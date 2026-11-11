/**
 * Pure assembly of the base-only hydrated team shape (Layer 1 of the Architect
 * read stack). Firestore reads stay in firebaseTeamPlanHelpers.ts; this module
 * is shared with offline preparation that already holds the player documents.
 */
import { normalizeTeamExceptionOwnership } from '@/features/architect/utils/exceptions/exceptionOwnership';
import { normalizeTeamTpeSchema } from '@/features/architect/utils/persistenceContracts/normalizeTeamTpe';
import type { TeamTotals } from '@/features/architect/types';
import type { TeamSalaryBookInputs } from '@/schemas/salaryBooks';
import type { ContractEventLedgerPayload } from '@/schemas/contractEventLedger';
import type { TradeHardCapLedgerEntry } from '@/schemas/tradeApronRestriction';
import { readArchitectNumber } from '@/features/architect/utils/architectFirestoreBoundary';
import {
  TEAM_CODE_LOOKUP,
  readLooseBaseTeamDoc,
  hasActiveContract,
  type LooseBaseTeamDoc,
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

export function assembleHydratedBaseTeam(
  teamCode: string,
  baseDoc: LooseBaseTeamDoc,
  players: HydratedBaseTeamPlayer[],
  authorityContext: { worldLineage?: readonly string[] } = {}
): HydratedBaseTeamCapSheet {
  const boundaryBaseDoc = readLooseBaseTeamDoc(
    baseDoc,
    teamCode,
    `hydrateBaseTeam(${teamCode})`,
    authorityContext.worldLineage ?? []
  );
  const normalizedBaseDoc = normalizeTeamExceptionOwnership(
    normalizeTeamTpeSchema(boundaryBaseDoc)
  ) as LooseBaseTeamDoc & {
    exceptions?: HydratedBaseTeamExceptions | null;
  };
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
}
