import type { TeamHistoryWorldEventRow } from '@/features/architect/history/utils/normalizeWorldEventsForTeamHistory';

type UnknownRecord = Record<string, unknown>;

export type TeamHistoryDetailSectionLike = {
  title?: string | null;
  lines?: Array<string | number | null | undefined> | null;
};

export type TeamHistoryLooseTimelineEntry = {
  id?: string | number | null;
  category?: string | null;
  type?: string | null;
  timestamp?: string | null;
  occurredAt?: string | null;
  teamsInvolved?: string[] | null;
  teamCodes?: string[] | null;
  playerIds?: string[] | null;
  primaryDeltas?: string | null;
  capDelta?: number | null;
  summary?: string | null;
  detailSections?: TeamHistoryDetailSectionLike[] | null;
  mutationId?: string | null;
  mutationType?: string | null;
  operationId?: string | null;
  eventId?: string | null;
  beforeTotalsByTeam?: UnknownRecord | null;
  afterTotalsByTeam?: UnknownRecord | null;
  raw?: UnknownRecord | null;
};

export type TeamHistoryDisplayEntry =
  | TeamHistoryWorldEventRow
  | TeamHistoryLooseTimelineEntry;

export type TeamHistoryTimelineSourceKey =
  | 'world-events'
  | 'dev-fixtures'
  | 'local-timeline'
  | 'synthesized';

export type TeamHistorySelectedEntryTruthKind =
  | 'authoritative-world-event'
  | 'synthetic-dev-fixture'
  | 'explicit-local-timeline'
  | 'section-derived-fallback';

export type TeamHistorySelectedEntry = {
  activeTeamCode: string | null;
  entry: TeamHistoryDisplayEntry;
  timelineSourceKey: TeamHistoryTimelineSourceKey;
  truthKind: TeamHistorySelectedEntryTruthKind;
};

export type RequestedHistoryEventDetailSource =
  | 'post-action-handoff'
  | 'activity-rail';

export type RequestedHistoryEventDetail = {
  requestKey: number;
  requestedSelectedEntryId: string;
  worldId: string;
  teamCode: string;
  source: RequestedHistoryEventDetailSource;
};

export type TeamHistoryWaivedContractEntry = {
  id?: string | null;
  name?: string | null;
  waivedOn?: string | null;
  stretched?: boolean | null;
  deadCap?: Record<string, number> | null;
};

export type TeamHistoryExceptionHistoryEntry = {
  id?: string | null;
  type?: string | null;
  action?: string | null;
  amount?: number | null;
  amountCreated?: number | null;
  amountConsumed?: number | null;
  timestamp?: string | null;
  date?: string | null;
  expires?: string | null;
  expiresAt?: string | null;
  source?: string | null;
  sourceTeamCode?: string | null;
  targetTeamCode?: string | null;
  amountRemaining?: number | null;
  primaryDeltas?: string | null;
  summary?: string | null;
  sourcePlayerName?: string | null;
};

export type TeamHistoryMLEHistoryEntry = {
  id?: string | number | null;
  year?: string | number | null;
  total?: number | null;
  used?: number | null;
  notes?: string | null;
};

export type TeamHistoryPickLogEntry = {
  id?: string | null;
  date?: string | null;
  timestamp?: string | null;
  action?: string | null;
  pick?: string | null;
  partner?: string | null;
  notes?: string | null;
};

export type TeamHistoryCurrentPickRow = {
  first?: string | null;
  second?: string | null;
};

export type TeamHistoryCurrentPickInventory = Record<
  string,
  TeamHistoryCurrentPickRow | undefined
>;

export type TeamHistoryCapSheetLike = {
  teamCode?: string | null;
  waivedContracts?: TeamHistoryWaivedContractEntry[] | null;
  exceptionHistory?: TeamHistoryExceptionHistoryEntry[] | null;
  mleHistory?: TeamHistoryMLEHistoryEntry[] | null;
  pickLog?: TeamHistoryPickLogEntry[] | null;
  currentPicks?: TeamHistoryCurrentPickInventory | null;
  historyTimeline?: TeamHistoryLooseTimelineEntry[] | null;
  [key: string]: unknown;
};

export type TeamHistoryTabProps = {
  teamCapSheet: TeamHistoryCapSheetLike;
  worldId?: string | null;
  requestedHistoryEventDetail?: RequestedHistoryEventDetail | null;
  onRequestedHistoryEventDetailHandled?: ((requestKey: number) => void) | null;
  onInjectTeamHistoryFixtures?: (() => void) | null;
  onClearTeamHistoryFixtures?: (() => void) | null;
  hasInjectedTeamHistoryFixtures?: boolean;
};

export type HistoryDetailModalProps = {
  selectedEntry: TeamHistorySelectedEntry | null;
  onClose: () => void;
};
