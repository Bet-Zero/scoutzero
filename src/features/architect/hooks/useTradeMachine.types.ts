import type {
  TradeContextPayload,
  TradeContextCurrentState,
  TradeApplyPreparation,
} from '@/features/architect/utils/tradeContext/types';
import type { PickRuleDoc } from '@/features/architect/utils/entitlements/pickRulesResolver';
import type { validateSignAndTradeContractPayload } from '@/features/architect/utils/tradeMachine/signAndTrade/signAndTradeEligibility';
import type { FullLegalityPreviewResult } from '@/features/architect/utils/tradeContext/tradeContext';
import type { TradeSalaryMatchingElection } from '@/schemas/tradeSalaryMatchingPath';
import type { ContractEventLedgerPayload } from '@/schemas/contractEventLedger';

export type UnknownRecord = Record<string, unknown>;

export type TradeMachinePlayer = UnknownRecord &
  NonNullable<TradeContextPayload['teams'][number]['sends']>[number];

export type TradeMachineEntitlement = UnknownRecord &
  NonNullable<TradeContextPayload['teams'][number]['entitlementsOut']>[number];

export type TradeMachineActionMeta = UnknownRecord & {
  signAndTradeContract?: Parameters<
    typeof validateSignAndTradeContractPayload
  >[0];
};

export type TradeMachineTeam = UnknownRecord & {
  id?: string | null;
  teamCode?: string | null;
  teamName?: string | null;
  abbreviation?: string | null;
  players?: TradeMachinePlayer[] | null;
  capHolds?: unknown[] | null;
  deadCap?: unknown[] | null;
  entitlementIds?: Array<string | null | undefined> | null;
  entitlements?: TradeMachineEntitlement[] | null;
  pickRulesById?: Record<string, PickRuleDoc>;
  tradeExceptions?: unknown[] | null;
  totals?: UnknownRecord | null;
  hardCapped?: unknown;
  hardCapLevel?: string | null;
  teamTotalSalary?: number | null;
  projectedSalary?: number | null;
  teamSalary?: number | null;
  apronTeamSalary?: number | null;
  taxSalary?: number | null;
  salaryBooks?: unknown;
  contractEventLedgers?: ContractEventLedgerPayload[] | null;
  governedTradeSalaryBasisLoadError?: string | null;
};

export type TradeMachineTeamSlot = {
  team: TradeMachineTeam | null;
  sends: TradeMachinePlayer[];
  entitlementsOut: TradeMachineEntitlement[];
  entitlements?: TradeMachineEntitlement[];
  salaryMatchingElection?: TradeSalaryMatchingElection | null;
};

export type EntitlementOverrideDocument = UnknownRecord & {
  holderTeam?: string | null;
  holder_team?: string | null;
};

// Wave 29 Step 1: private types extracted from useTradeMachine.ts

export type TradeMachinePreviewAuthority = FullLegalityPreviewResult;

export type TradeMachineSnapshotValidationDetails = UnknownRecord & {
  teamResults?: unknown[] | null;
};

export type PreparedTradePreviewContext = {
  activeTeams: Array<TradeMachineTeamSlot & { team: TradeMachineTeam }>;
  payload: TradeContextPayload;
  currentState: TradeContextCurrentState;
  seasonId: string;
  preparation: TradeApplyPreparation;
};

export type ValidateCurrentTradeOutcome = {
  snapshotValidationDetails: TradeMachineSnapshotValidationDetails;
  previewContext: PreparedTradePreviewContext;
};
