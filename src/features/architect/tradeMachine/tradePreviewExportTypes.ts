export type YearKeyLike = string | number | null | undefined;
export type ExportDateLike = string | number | Date | null | undefined;

export interface TradePreviewTeamCoreLike {
  id?: string | number;
  teamId?: string | number;
  teamName?: string;
}

export interface TradePreviewPlayerLike {
  id?: string | number;
  player_id?: string | number;
  name?: string;
  baseSalary?: number | null;
  salary?: number | null;
  headshotUrl?: string;
  headshot?: string;
  originTeamId?: string | number;
  teamId?: string | number;
  team?: string | number;
  teamAbbr?: string;
  tradeTo?: string | number | null;
  fa_year?: string | number | null;
  freeAgentYear?: string | number | null;
  contract?: {
    freeAgency?: {
      year?: string | number | null;
    } | null;
  } | null;
  bio?: {
    displayName?: string;
    display?: {
      team?: string;
    } | null;
  } | null;
}

export interface TradePreviewEntitlementLike {
  id?: string | number;
  entitlementId?: string | number;
  seasonYear?: string | number | null;
  round?: string | number | null;
  kind?: string;
  termsShort?: string | null;
  originalTeam?: string | number;
  originTeamId?: string | number;
  fromTeamId?: string | number;
  toTeamId?: string | number | null;
}

export interface TradePreviewTeamLike {
  team?: TradePreviewTeamCoreLike | null;
  sends?: TradePreviewPlayerLike[] | null;
  entitlementsOut?: TradePreviewEntitlementLike[] | null;
}

export interface TradePreviewSummaryLike {
  teamName?: string;
  capDelta?: number;
}

export interface TradePreviewResultLike {
  legal?: boolean;
  summaryByTeamIndex?: Array<TradePreviewSummaryLike | null | undefined>;
}

export interface TradePreviewModalProps {
  open?: boolean;
  onClose?: () => void;
  teams?: TradePreviewTeamLike[];
  result?: TradePreviewResultLike | null;
  yearKey?: YearKeyLike;
}

export interface TradeExportCaptureProps {
  teams?: TradePreviewTeamLike[];
  result?: TradePreviewResultLike | null;
  yearKey?: YearKeyLike;
  label?: string;
  date?: ExportDateLike;
}

export interface IncomingTradeAssets {
  players: TradePreviewPlayerLike[];
  entitlements: TradePreviewEntitlementLike[];
}
