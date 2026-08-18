/**
 * FILE: src/features/architect/utils/mutationPipeline.types.ingress.ts
 * PURPOSE: Public ingress current-state types, normalized compute-path types, and compute arg type maps.
 * OWNERSHIP: Feature: architect/core
 *
 * Wave 13 Step 4: Extracted from mutationPipeline.types.ts (L1420–L2143 of original).
 */

import type { PlayerDraft } from '@/schemas/players_v2';
import type {
  ArchitectMutationCashLedger,
  ArchitectMutationPayload,
  ArchitectMutationPlayerRecord,
  ArchitectMutationTeamRecord,
  ExtensionMutationPayloadInput,
  OfferSheetMirrorMutationPayloadInput,
  OfferSheetResolutionMutationPayloadInput,
  OptionMutationPayloadInput,
  PublicExtensionMutationPayloadInput,
  PublicOfferSheetMirrorMutationPayloadInput,
  PublicOfferSheetResolutionMutationPayloadInput,
  PublicOptionMutationPayloadInput,
  PublicRenounceMutationPayloadInput,
  PublicSetDeadCapMutationPayloadInput,
  PublicSetExceptionsMutationPayloadInput,
  PublicSignAndTradeMutationPayloadInput,
  PublicSigningMutationPayloadInput,
  PublicStoreOfferSheetMutationPayloadInput,
  PublicTradeMutationPayloadInput,
  PublicWaiveMutationPayloadInput,
  RenounceMutationPayloadInput,
  SetDeadCapMutationPayloadInput,
  SetExceptionsMutationPayloadInput,
  SignAndTradeMutationPayloadInput,
  SigningMutationPayloadInput,
  StoreOfferSheetMutationPayloadInput,
  TradeMutationPayload,
  WaiveMutationPayloadInput,
} from './mutationPipeline.types.record';
import type { GovernedOptionLedgerAuthority } from '@/features/architect/utils/optionDecisions/governedOptionDecision';
import type { GovernedExtensionLedgerAuthority } from '@/features/architect/utils/extensions';
import type {
  CurrentStateManualCapTeam,
  CurrentStateOfferSheetMirrorTeam,
  CurrentStateOfferSheetResolutionTeam,
  CurrentStatePlayerOpsTeam,
  CurrentStatePlayerRfaBoundary,
  CurrentStatePrimaryTeam,
  CurrentStateSigningTeam,
  MutationCurrentStatePlayerContractIngress,
  MutationCurrentStatePlayerFutureContractIngress,
  OfferSheetTeamLike,
  PlayerLike,
  TradeTeamLike,
} from './mutationPipeline.types.currentState';
import type {
  MutationCurrentStateTeamEntry,
  SupportedComputeMutationType,
} from './mutationPipeline.types.result';

export type MutationCurrentStatePlayerIngress = Omit<
  Pick<
    ArchitectMutationPlayerRecord,
    | 'player_id'
    | 'id'
    | 'playerId'
    | 'teamCode'
    | 'teamName'
    | 'name'
    | 'displayName'
    | 'playerName'
    | 'bio'
    | 'draft'
    | 'representation'
    | 'source'
    | 'birdRights'
    | 'renounced'
    | 'lastUpdated'
    | 'version'
    | 'isTwoWay'
    | 'signedDate'
  >,
  'draft' | 'contract' | 'futureContract'
> &
  CurrentStatePlayerRfaBoundary & {
    draft?: Partial<PlayerDraft> | null;
    contract?: MutationCurrentStatePlayerContractIngress | null;
    futureContract?: MutationCurrentStatePlayerFutureContractIngress | null;
  };
export type MutationCurrentStateTeamCoreIngress = Omit<
  Pick<
    ArchitectMutationTeamRecord,
    | 'teamCode'
    | 'teamName'
    | 'players'
    | 'roster'
    | 'capHolds'
    | 'rightsLedger'
    | 'contractEventLedgers'
    | 'deadCap'
    | 'exceptions'
    | 'totals'
    | 'source'
    | 'hardCapped'
    | 'hardCapLevel'
    | 'hardCapReason'
    | 'hardCapTriggeredBy'
  >,
  | 'players'
  | 'roster'
  | 'capHolds'
  | 'rightsLedger'
  | 'contractEventLedgers'
  | 'deadCap'
  | 'exceptions'
  | 'totals'
> & {
  players?: unknown[] | null;
  roster?: unknown[] | null;
  capHolds?: unknown[] | null;
  rightsLedger?: ArchitectMutationTeamRecord['rightsLedger'];
  contractEventLedgers?: ArchitectMutationTeamRecord['contractEventLedgers'];
  deadCap?: unknown[] | null;
  exceptions?: ArchitectMutationTeamRecord['exceptions'] | null;
  totals?: ArchitectMutationTeamRecord['totals'] | null;
};
export type MutationCurrentStateTeamRoundTripIngress = {
  tradeExceptions?: unknown[] | null;
  cashLedger?: ArchitectMutationCashLedger | null;
  exceptionHistory?: ArchitectMutationTeamRecord['exceptionHistory'] | null;
  draftPicks?: ArchitectMutationTeamRecord['draftPicks'] | null;
  entitlementIds?: ArchitectMutationTeamRecord['entitlementIds'] | null;
};
export type MutationCurrentStateBaseTeamIngress = MutationCurrentStateTeamCoreIngress &
  MutationCurrentStateTeamRoundTripIngress;
export type MutationCurrentStateOfferSheetTeamIngress =
  MutationCurrentStateBaseTeamIngress &
    Pick<ArchitectMutationTeamRecord, 'offerSheets' | 'incomingOfferSheets'>;
export type MutationCurrentStateTradeTeamIngress =
  MutationCurrentStateTeamCoreIngress &
    Pick<
      ArchitectMutationTeamRecord,
      | 'tradeExceptions'
      | 'cashLedger'
      | 'exceptionHistory'
      | 'teamTotalSalary'
      | 'draftPicks'
      | 'entitlementIds'
    > & {
      twoWayPlayers?: unknown[] | null;
    };
export type MutationCurrentStateClosedShape = {
  teams?: undefined;
  team?: undefined;
  player?: undefined;
  homeTeam?: undefined;
  offeringTeam?: undefined;
  destinationTeam?: undefined;
  teamCode?: undefined;
  destinationTeamCode?: undefined;
  offerSheetId?: undefined;
  optionAuthority?: undefined;
  extensionAuthority?: undefined;
  extensionTeamSnapshot?: undefined;
  extensionPlayerSnapshot?: undefined;
};
export type MutationDocumentSnapshotReceipt = Readonly<{
  exists: boolean;
  digest: string | null;
  sourceWorldId: string | null;
  sourceDigest: string | null;
}>;
export type MutationCurrentStateTradeTeamEntryInput = {
  teamCode?: string | null;
  team?: MutationCurrentStateTradeTeamIngress | null;
};
export type MutationTradeCurrentStateIngress = Omit<
  MutationCurrentStateClosedShape,
  'teams'
> & {
  teams?: MutationCurrentStateTradeTeamEntryInput[];
};
export type MutationTeamOnlyCurrentStateIngress = Omit<
  MutationCurrentStateClosedShape,
  'team' | 'teamCode'
> & {
  team?: MutationCurrentStateBaseTeamIngress | null;
  teamCode?: string | null;
};
export type MutationTeamAndPlayerCurrentStateIngress = Omit<
  MutationCurrentStateClosedShape,
  | 'team'
  | 'player'
  | 'teamCode'
  | 'optionAuthority'
  | 'extensionAuthority'
  | 'extensionTeamSnapshot'
  | 'extensionPlayerSnapshot'
> & {
  team?: MutationCurrentStateBaseTeamIngress | null;
  player?: MutationCurrentStatePlayerIngress | null;
  teamCode?: string | null;
  optionAuthority?: GovernedOptionLedgerAuthority | null;
  extensionAuthority?: GovernedExtensionLedgerAuthority | null;
  extensionTeamSnapshot?: MutationDocumentSnapshotReceipt | null;
  extensionPlayerSnapshot?: MutationDocumentSnapshotReceipt | null;
};
export type MutationSigningCurrentStateIngress = Omit<
  MutationCurrentStateClosedShape,
  'team' | 'player' | 'homeTeam' | 'teamCode'
> & {
  team?: MutationCurrentStateOfferSheetTeamIngress | null;
  player?: MutationCurrentStatePlayerIngress | null;
  homeTeam?: MutationCurrentStateOfferSheetTeamIngress | null;
  teamCode?: string | null;
};
export type MutationOfferSheetMirrorCurrentStateIngress = Omit<
  MutationCurrentStateClosedShape,
  'homeTeam' | 'offeringTeam' | 'offerSheetId'
> & {
  homeTeam?: MutationCurrentStateOfferSheetTeamIngress | null;
  offeringTeam?: MutationCurrentStateOfferSheetTeamIngress | null;
  offerSheetId?: string | null;
};
export type MutationOfferSheetResolutionCurrentStateIngress = Omit<
  MutationCurrentStateClosedShape,
  'homeTeam' | 'offeringTeam' | 'offerSheetId'
> & {
  homeTeam?: MutationCurrentStateOfferSheetTeamIngress | null;
  offeringTeam?: MutationCurrentStateOfferSheetTeamIngress | null;
  offerSheetId?: string | null;
};
export type MutationSignAndTradeCurrentStateIngress = Omit<
  MutationCurrentStateClosedShape,
  'team' | 'player' | 'destinationTeam' | 'teamCode' | 'destinationTeamCode'
> & {
  team?: MutationCurrentStateTradeTeamIngress | null;
  player?: MutationCurrentStatePlayerIngress | null;
  destinationTeam?: MutationCurrentStateTradeTeamIngress | null;
  teamCode?: string | null;
  // Compatibility-only outer-edge field. This remains explicit on the
  // sign-and-trade lane only, instead of leaking through the shared ingress bag.
  destinationTeamCode?: string | null;
};

// Public current-state ingress is now a family-owned union instead of one
// cross-lane object bag. Mixed compute-ready tolerance is reintroduced only by
// the per-family input types below.
// Internal mutation state after ingress normalization. Only fields actually read
// by compute/apply paths are carried forward from the public ingress.
export type MutationCurrentState = {
  teams?: MutationCurrentStateTeamEntry[];
  team?: CurrentStatePrimaryTeam | null;
  player?: PlayerLike | null;
  homeTeam?: OfferSheetTeamLike | null;
  offeringTeam?: OfferSheetTeamLike | null;
  destinationTeam?: TradeTeamLike | null;
  teamCode?: string | null;
  offerSheetId?: string | null;
  optionAuthority?: GovernedOptionLedgerAuthority | null;
  extensionAuthority?: GovernedExtensionLedgerAuthority | null;
  extensionTeamSnapshot?: MutationDocumentSnapshotReceipt | null;
  extensionPlayerSnapshot?: MutationDocumentSnapshotReceipt | null;
};
export type MutationTradeCurrentState = Omit<
  MutationCurrentStateClosedShape,
  'teams'
> &
  Pick<MutationCurrentState, 'teams'>;
export type MutationTeamOnlyCurrentState = Omit<
  MutationCurrentStateClosedShape,
  'team' | 'teamCode'
> &
  Pick<MutationCurrentState, 'team' | 'teamCode'> & {
    team?: CurrentStateManualCapTeam | null;
  };
export type MutationTeamAndPlayerCurrentState = Omit<
  MutationCurrentStateClosedShape,
  | 'team'
  | 'player'
  | 'teamCode'
  | 'optionAuthority'
  | 'extensionAuthority'
  | 'extensionTeamSnapshot'
  | 'extensionPlayerSnapshot'
> &
  Pick<
    MutationCurrentState,
    | 'team'
    | 'player'
    | 'teamCode'
    | 'optionAuthority'
    | 'extensionAuthority'
    | 'extensionTeamSnapshot'
    | 'extensionPlayerSnapshot'
  > & {
    team?: CurrentStatePlayerOpsTeam | null;
    player?: PlayerLike | null;
  };
export type MutationOfferSheetTeamAndPlayerCurrentState = Omit<
  MutationCurrentStateClosedShape,
  'team' | 'player' | 'homeTeam' | 'teamCode'
> &
  Pick<MutationCurrentState, 'team' | 'player' | 'homeTeam' | 'teamCode'> & {
    team?: CurrentStateSigningTeam | null;
    player?: PlayerLike | null;
    homeTeam?: CurrentStateOfferSheetMirrorTeam | null;
  };
export type MutationSigningTeamLike = CurrentStateSigningTeam | TradeTeamLike;
export type MutationSigningCurrentState = Omit<
  MutationCurrentStateClosedShape,
  'team' | 'player' | 'homeTeam' | 'teamCode'
> &
  Pick<MutationCurrentState, 'team' | 'player' | 'homeTeam' | 'teamCode'> & {
    team?: MutationSigningTeamLike | null;
    player?: PlayerLike | null;
    homeTeam?: CurrentStateOfferSheetMirrorTeam | null;
  };
export type MutationOfferSheetMirrorCurrentState = Omit<
  MutationCurrentStateClosedShape,
  'homeTeam' | 'offeringTeam' | 'offerSheetId'
> &
  Pick<MutationCurrentState, 'homeTeam' | 'offeringTeam' | 'offerSheetId'> & {
    homeTeam?: CurrentStateOfferSheetMirrorTeam | null;
    offeringTeam?: CurrentStateOfferSheetMirrorTeam | null;
  };
export type MutationOfferSheetResolutionCurrentState = Omit<
  MutationCurrentStateClosedShape,
  'homeTeam' | 'offeringTeam' | 'offerSheetId'
> &
  Pick<MutationCurrentState, 'homeTeam' | 'offeringTeam' | 'offerSheetId'> & {
    homeTeam?: CurrentStateOfferSheetResolutionTeam | null;
    offeringTeam?: CurrentStateOfferSheetResolutionTeam | null;
  };
export type MutationSignAndTradeCurrentState = Omit<
  MutationCurrentStateClosedShape,
  'team' | 'player' | 'destinationTeam' | 'teamCode'
> &
  Pick<
    MutationCurrentState,
    'team' | 'player' | 'destinationTeam' | 'teamCode'
  > & {
    team?: TradeTeamLike | null;
    player?: PlayerLike | null;
    destinationTeam?: TradeTeamLike | null;
  };
export type MutationTradeCurrentStateInput =
  | MutationTradeCurrentStateIngress
  | MutationTradeCurrentState;
export type MutationTeamOnlyCurrentStateInput =
  | MutationTeamOnlyCurrentStateIngress
  | MutationTeamOnlyCurrentState;
export type MutationTeamAndPlayerCurrentStateInput =
  | MutationTeamAndPlayerCurrentStateIngress
  | MutationTeamAndPlayerCurrentState;
export type MutationOfferSheetTeamAndPlayerCurrentStateInput =
  | MutationSigningCurrentStateIngress
  | MutationOfferSheetTeamAndPlayerCurrentState;
export type MutationOfferSheetMirrorCurrentStateInput =
  | MutationOfferSheetMirrorCurrentStateIngress
  | MutationOfferSheetMirrorCurrentState;
export type MutationOfferSheetResolutionCurrentStateInput =
  | MutationOfferSheetResolutionCurrentStateIngress
  | MutationOfferSheetResolutionCurrentState;
export type MutationSignAndTradeCurrentStateInput =
  | MutationSignAndTradeCurrentStateIngress
  | MutationSignAndTradeCurrentState;

// Public compute callers may still pass raw loader-shaped snapshots or already
// normalized lane state. That compatibility is kept here and adapted once by
// normalizeComputeWorldMutationArgs before the core compute switch runs.
export type PublicMutationCurrentStateInputByType = {
  executeTrade: MutationTradeCurrentStateInput;
  signFreeAgent: MutationOfferSheetTeamAndPlayerCurrentStateInput;
  waivePlayer: MutationTeamAndPlayerCurrentStateInput;
  extendPlayer: MutationTeamAndPlayerCurrentStateInput;
  optionDecision: MutationTeamAndPlayerCurrentStateInput;
  renounceRights: MutationTeamAndPlayerCurrentStateInput;
  storeOfferSheet: MutationOfferSheetTeamAndPlayerCurrentStateInput;
  matchOfferSheet: MutationOfferSheetResolutionCurrentStateInput;
  declineOfferSheet: MutationOfferSheetResolutionCurrentStateInput;
  finalizeMatchedOfferSheet: MutationOfferSheetResolutionCurrentStateInput;
  finalizeDeclinedOfferSheet: MutationOfferSheetResolutionCurrentStateInput;
  signAndTrade: MutationSignAndTradeCurrentStateInput;
  setDeadCap: MutationTeamOnlyCurrentStateInput;
  setExceptions: MutationTeamOnlyCurrentStateInput;
};
export type PublicMutationPayloadInputByType = {
  executeTrade: PublicTradeMutationPayloadInput;
  signFreeAgent: PublicSigningMutationPayloadInput;
  waivePlayer: PublicWaiveMutationPayloadInput;
  extendPlayer: PublicExtensionMutationPayloadInput;
  optionDecision: PublicOptionMutationPayloadInput;
  renounceRights: PublicRenounceMutationPayloadInput;
  storeOfferSheet: PublicStoreOfferSheetMutationPayloadInput;
  matchOfferSheet: PublicOfferSheetResolutionMutationPayloadInput;
  declineOfferSheet: PublicOfferSheetResolutionMutationPayloadInput;
  finalizeMatchedOfferSheet: PublicOfferSheetResolutionMutationPayloadInput;
  finalizeDeclinedOfferSheet: PublicOfferSheetResolutionMutationPayloadInput;
  signAndTrade: PublicSignAndTradeMutationPayloadInput;
  setDeadCap: PublicSetDeadCapMutationPayloadInput;
  setExceptions: PublicSetExceptionsMutationPayloadInput;
};

// Core mutation compute only receives lane-owned current state. Loader output
// and public direct-call compatibility must normalize into these shapes first.
export type MutationCurrentStateInputByType = {
  executeTrade: MutationTradeCurrentState;
  signFreeAgent: MutationOfferSheetTeamAndPlayerCurrentState;
  waivePlayer: MutationTeamAndPlayerCurrentState;
  extendPlayer: MutationTeamAndPlayerCurrentState;
  optionDecision: MutationTeamAndPlayerCurrentState;
  renounceRights: MutationTeamAndPlayerCurrentState;
  storeOfferSheet: MutationOfferSheetTeamAndPlayerCurrentState;
  matchOfferSheet: MutationOfferSheetResolutionCurrentState;
  declineOfferSheet: MutationOfferSheetResolutionCurrentState;
  finalizeMatchedOfferSheet: MutationOfferSheetResolutionCurrentState;
  finalizeDeclinedOfferSheet: MutationOfferSheetResolutionCurrentState;
  signAndTrade: MutationSignAndTradeCurrentState;
  setDeadCap: MutationTeamOnlyCurrentState;
  setExceptions: MutationTeamOnlyCurrentState;
};
export type MutationPayloadInputByType = {
  executeTrade: TradeMutationPayload;
  signFreeAgent: SigningMutationPayloadInput;
  waivePlayer: WaiveMutationPayloadInput;
  extendPlayer: ExtensionMutationPayloadInput;
  optionDecision: OptionMutationPayloadInput;
  renounceRights: RenounceMutationPayloadInput;
  storeOfferSheet: StoreOfferSheetMutationPayloadInput;
  matchOfferSheet: OfferSheetResolutionMutationPayloadInput;
  declineOfferSheet: OfferSheetResolutionMutationPayloadInput;
  finalizeMatchedOfferSheet: OfferSheetResolutionMutationPayloadInput;
  finalizeDeclinedOfferSheet: OfferSheetResolutionMutationPayloadInput;
  signAndTrade: SignAndTradeMutationPayloadInput;
  setDeadCap: SetDeadCapMutationPayloadInput;
  setExceptions: SetExceptionsMutationPayloadInput;
};
export type LoadedMutationCurrentStateByType = MutationCurrentStateInputByType;
export type TradeStateSlice = Pick<MutationCurrentState, 'teams'>;
export type ApplyWorldMutationArgs = {
  userId: string;
  worldId: string;
  seasonId: string;
  mutationType: string;
  payload: ArchitectMutationPayload;
  timestamp?: number;
  operationId?: string;
};
export type PublicComputeWorldMutationArgsByType = {
  [TMutationType in SupportedComputeMutationType]: {
    mutationType: TMutationType;
    payload: PublicMutationPayloadInputByType[TMutationType];
    currentState: PublicMutationCurrentStateInputByType[TMutationType];
    seasonId: string;
    timestamp: number;
    asOfDate?: string | number | null;
    worldId?: string;
    operationId?: string;
    authoringIdentity?: string;
    recordedAt?: string;
  };
};
export type LegacyPublicComputeWorldMutationArgsByType = {
  [TMutationType in SupportedComputeMutationType]: {
    mutationType: TMutationType;
    payload: ArchitectMutationPayload;
    currentState: PublicMutationCurrentStateInputByType[TMutationType];
    seasonId: string;
    timestamp: number;
    asOfDate?: string | number | null;
    worldId?: string;
    operationId?: string;
    authoringIdentity?: string;
    recordedAt?: string;
  };
};
export type PublicComputeWorldMutationArgs =
  | PublicComputeWorldMutationArgsByType[SupportedComputeMutationType]
  | LegacyPublicComputeWorldMutationArgsByType[SupportedComputeMutationType];
export type ComputeWorldMutationArgsByType = {
  [TMutationType in SupportedComputeMutationType]: {
    mutationType: TMutationType;
    payload: MutationPayloadInputByType[TMutationType];
    currentState: MutationCurrentStateInputByType[TMutationType];
    seasonId: string;
    timestamp: number;
    asOfDate?: string | number | null;
    worldId?: string;
    operationId?: string;
    authoringIdentity?: string;
    recordedAt?: string;
  };
};
export type ComputeWorldMutationArgs =
  ComputeWorldMutationArgsByType[SupportedComputeMutationType];
