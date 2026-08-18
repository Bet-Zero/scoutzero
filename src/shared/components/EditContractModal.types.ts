import type { useCapValidation } from '@/features/architect/hooks/useCapValidation';
import type {
  getContractYearsForDisplay,
} from '@/features/architect/utils/contractUtils';
import type { CapProjectionOverrides } from '@/features/architect/utils/capRulesProfile';
import type { CapHoldItem, DeadCapItem } from '@/features/architect/types';
import type {
  ArchitectMutationResult,
  SignAndTradePreflightResult,
  OfferSheetPreflightResult,
} from '@/features/architect/utils/mutationPipeline';
import type { PlayerRulesProfileLeagueContext } from '@/features/architect/types';
import type {
  GovernedExtensionAvailability,
  GovernedExtensionProposal,
  GovernedExtensionRoute,
} from '@/features/architect/utils/extensions';

export type UseCapValidationParams = Parameters<typeof useCapValidation>[0];
export type HookPlayerLike = NonNullable<UseCapValidationParams['player']>;
export type HookContractLike = NonNullable<HookPlayerLike['contract']>;
export type HookContractSalaryRowLike = NonNullable<
  HookContractLike['salariesByYear']
>[number];
export type HookTeamCapSheetLike = NonNullable<
  UseCapValidationParams['teamCapSheet']
>;
export type HookContractDataLike = NonNullable<
  UseCapValidationParams['contractData']
>;
export type UseCapValidationResult = ReturnType<typeof useCapValidation>;
export type ValidationEntryLike = UseCapValidationResult['warnings'][number];
export type ValidationSeverity = ValidationEntryLike['severity'];
export type SignAndTradePreflightLike = SignAndTradePreflightResult | null;
export type OfferSheetPreflightLike = OfferSheetPreflightResult | null;
export type ContractYearLike = NonNullable<
  ReturnType<typeof getContractYearsForDisplay>[number]
>;
export type ContractYearWithNumberYear = ContractYearLike & { year: number };
export type ContractActionKey =
  | 'accept'
  | 'decline'
  | 'signNew'
  | 'resign'
  | 'signAndTrade'
  | 'renounce'
  | 'extend'
  | 'waive'
  | 'waiveStretch'
  | 'buyout';
export type SelectedContractAction = ContractActionKey | '';

export type PlayerBioLike = {
  playerId?: string | null;
  displayName?: string | null;
  age?: number | string | null;
  position?: string | null;
  height?: number | string | null;
  weight?: number | string | null;
  display?: {
    freeAgentType?: string | null;
    freeAgentYear?: number | string | null;
    teamId?: string | null;
    team?: string | null;
  } | null;
  experience?: unknown;
  draftYear?: unknown;
  draftRound?: unknown;
  draftPick?: unknown;
};

export type ContractSalaryRowLike = HookContractSalaryRowLike & {
  season?: string | null;
  year?: string | number | null;
  option?: string | null;
  isExtension?: boolean | null;
};

export type ContractLike = HookContractLike & {
  salariesByYear?: ContractSalaryRowLike[] | null;
  isRookieScale?: boolean | null;
  contractType?: string | null;
};

export type PlayerLike = HookPlayerLike & {
  id?: string | number | null;
  player_id?: string | number | null;
  playerId?: string | number | null;
  name?: string | null;
  displayName?: string | null;
  yearsOfService?: number | null;
  yearsPro?: unknown;
  bio?: PlayerBioLike | null;
  contract?: ContractLike | null;
  futureContract?: ContractLike | null;
  freeAgentYear?: number | string | null;
};

export type SigningGuardrailsLike = HookContractDataLike['guardrails'] | null;
export type CapHoldLike = Partial<CapHoldItem> & {
  active?: boolean | null;
  reason?: string | null;
};
export type DeadCapLike = Partial<DeadCapItem> & {
  label?: string | null;
  amountByYear?: DeadCapItem['amountByYear'] | null;
  stretched?: boolean | null;
};

export type ExtensionStateLike = {
  years: number;
  contractType: string;
  salaries: number[];
  raisePct?: number;
  route?: GovernedExtensionRoute;
  signedAt?: string;
  agreedDesignatedVeteranPercentage?: number | null;
};

export type PlayerRulesProfileLike = UseCapValidationParams['rulesProfile'];

export type ExtMaxState = {
  maxYears: number | null | undefined;
  maxFirstYearSalary: number | null | undefined;
  minFirstYearSalary: number | null | undefined;
  baseRaisePct: number | null | undefined;
  type?: string | null;
  basedOn?: string | null;
  notes?: string | null;
};

export type RulesLeagueContextLike = Pick<
  PlayerRulesProfileLeagueContext,
  'simulationDate' | 'currentYear'
> | null;

export type TeamCapSheetLike = HookTeamCapSheetLike & {
  teamCode?: string | null;
  players?: PlayerLike[] | null;
  deadCap?: DeadCapLike[] | null;
  capHolds?: CapHoldLike[] | null;
};

export type OverrideMetadataLike = {
  overrideUsed: boolean;
  overrideReasons: string[];
  overrideTimestamp: string;
};

export type AuditLogEntryLike = {
  actionType: string;
  timestamp: string;
  reasons: string[];
  overrideUsed: boolean;
  playerId?: string | number | null;
  playerName?: string | null;
};

export type MutationWritesSummaryLike = Partial<
  NonNullable<ArchitectMutationResult['writesSummary']>
>;

export type ContractActionResultLike = Pick<
  ArchitectMutationResult,
  'success' | 'error' | 'appliedToLocalState' | 'persistedToWorld'
> & {
  message?: string | null;
  writesSummary?: MutationWritesSummaryLike | null;
};

export type ActionResultLike =
  | ContractActionResultLike
  | boolean
  | null
  | undefined;

export type StagedSigningPayloadLike = {
  years: number;
  contractType: string;
  salaries: number[];
  raisePct?: number;
  startYear?: number;
  contractYears?: number;
  salariesByYear?: Array<{
    season: string;
    salary: number;
    capHit: number;
    guaranteed: boolean;
    option: string | null;
    optionType: string | null;
    optionUsed: boolean | null;
  }>;
  base?: number;
  totalValue?: number;
  averageAnnualValue?: number;
  firstYearGuaranteed?: boolean;
  exceptionType: string;
  signedUsing: string | null;
  guardrails: SigningGuardrailsLike;
  signAndTrade?: boolean;
  rfaOfferSheet?: boolean;
  rfaOfferSheetOnly?: boolean;
  rfaOfferSheetStatus?: string;
} & Partial<OverrideMetadataLike>;

export type ExtensionPayloadLike = GovernedExtensionProposal;

export type WaivePayloadLike = {
  stretch: boolean;
  buyout: boolean;
  buyoutAmount?: number;
} & Partial<OverrideMetadataLike>;

export type SigningActionCallback = (
  player: PlayerLike,
  payload: StagedSigningPayloadLike,
) => Promise<ActionResultLike | undefined> | ActionResultLike | undefined;

export type OptionDecisionCallback = (
  player: PlayerLike,
  accept: boolean,
  overrideMetadata?: OverrideMetadataLike | null,
  targetYear?: number | null,
  notice?: GovernedOptionNoticeInput | null,
) => Promise<ActionResultLike | undefined> | ActionResultLike | undefined;

export type SignAndTradeCallback = (
  player: PlayerLike,
  payload: StagedSigningPayloadLike,
  destTeamCode: string,
) => Promise<ActionResultLike | undefined> | ActionResultLike | undefined;

export type SignAndTradePreflightCallback = (
  player: PlayerLike,
  payload: StagedSigningPayloadLike,
  destTeamCode: string,
) =>
  | Promise<SignAndTradePreflightResult | null | undefined>
  | SignAndTradePreflightResult
  | null
  | undefined;

export type SignAndTradeInitiation = {
  onSignAndTrade: SignAndTradeCallback;
  getSignAndTradePreflight: SignAndTradePreflightCallback;
};

export type GetOfferSheetPreflightCallback = (
  player: PlayerLike,
  payload: StagedSigningPayloadLike,
) =>
  | Promise<OfferSheetPreflightResult | null | undefined>
  | OfferSheetPreflightResult
  | null
  | undefined;

export type OfferSheetInitiation = {
  getOfferSheetPreflight: GetOfferSheetPreflightCallback;
  onStoreOfferSheet: SigningActionCallback;
};

export type ExtendCallback = (
  player: PlayerLike,
  payload: ExtensionPayloadLike,
) => Promise<ActionResultLike | undefined> | ActionResultLike | undefined;

export type WaiveCallback = (
  player: PlayerLike,
  payload: WaivePayloadLike,
) => Promise<ActionResultLike | undefined> | ActionResultLike | undefined;

export type SimpleActionCallback = (
  player: PlayerLike,
  overrideMetadata?: OverrideMetadataLike | null,
) => Promise<ActionResultLike | undefined> | ActionResultLike | undefined;

export type AuditLogCallback = (entry: AuditLogEntryLike) => void;
export type ActionSetKey = 'option' | 'freeAgent' | 'underContract';

export type EditContractModalProps = {
  player?: PlayerLike | null;
  isOpen?: boolean;
  onClose: () => void;
  onSignFreeAgent?: SigningActionCallback | null;
  onResign?: SigningActionCallback | null;
  onWaive?: WaiveCallback | null;
  onOptionDecision?: OptionDecisionCallback | null;
  optionDecisionAvailability?: GovernedOptionDecisionAvailability | null;
  extensionAvailability?: GovernedExtensionAvailability | null;
  onExtend?: ExtendCallback | null;
  signAndTradeInitiation?: SignAndTradeInitiation | null;
  onSignAndTrade?: SignAndTradeCallback | null;
  getSignAndTradePreflight?: SignAndTradePreflightCallback | null;
  getOfferSheetPreflight?: GetOfferSheetPreflightCallback | null;
  onRenounce?: SimpleActionCallback | null;
  onStoreOfferSheet?: SigningActionCallback | null;
  initialAction?: string | null;
  targetYear?: number | null;
  actionYear?: number | null;
  actionContext?: ActionSetKey | null;
  teamCapSheet?: TeamCapSheetLike | null;
  currentYear?: number | null;
  playerRulesProfile?: PlayerRulesProfileLike;
  rulesLeagueContext?: RulesLeagueContextLike;
  actionsOverride?: string[] | null;
  actionLabelsOverride?: Partial<Record<ContractActionKey, string>>;
  actionDescriptionsOverride?: Partial<Record<ContractActionKey, string>>;
  // When provided, replaces the inferred contract-state intro paragraph with a
  // caller-supplied predicate (rendered after the bold player name). Used by the
  // Free Agency sign flow so pool free agents don't get expiring/extend/waive copy.
  actionContextCopy?: string | null;
  showOfferSheetToggle?: boolean | null;
  onAuditLog?: AuditLogCallback | null;
  capProjections?: CapProjectionOverrides | null;
  playersMap?: Record<string, unknown> | null;
};

export type ValidationAuthority = 'advisory-modal' | 'authoritative-preflight';
export type AuthoritativePreflightKind = 'sign-and-trade' | 'offer-sheet';

export type ValidationStateLike = {
  authority: ValidationAuthority;
  isLegal: boolean;
  incomplete: boolean;
  reasons: string[];
  severity: ValidationSeverity;
  warnings: ValidationEntryLike[];
  errors: ValidationEntryLike[];
};

export type NormalizedContractActionResult = {
  success: boolean;
  message: string;
};

export type SigningExceptionOption = {
  value: string;
  label: string;
};
import type { GovernedOptionDecisionAvailability } from '@/features/architect/utils/optionDecisions';
import type { GovernedOptionNoticeInput } from '@/schemas/governedOptionDecision';
