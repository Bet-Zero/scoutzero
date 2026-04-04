import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  collection,
  getDocs,
  limit as limitTo,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentData,
  type Query,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import {
  ARCHITECT_WORLD_EVENTS_SUBCOLLECTION,
  ARCHITECT_WORLDS_COLLECTION,
} from '@/constants/collections';

const DEFAULT_LIMIT = 50;

type TeamField = 'teamCodes' | 'teamsAffected';
type OrderField = 'occurredAt' | 'timestamp';
type QueryContractId =
  | 'team-history-canonical-v1'
  | 'team-history-legacy-compat-v1';
export type WorldTeamEventsResolution =
  | 'authoritative'
  | 'legacy-compatible'
  | 'mixed-compatible'
  | 'empty';

type QueryContract = {
  id: QueryContractId;
  label: string;
  teamField: TeamField;
  orderField: OrderField;
};

export type WorldEventRecord = Record<string, unknown> & {
  id: string;
};

type FetchRequest = {
  worldId: string;
  teamCode: string;
  limit: number;
  paginationState?: WorldTeamEventsPaginationState | null;
};

type FetchResponse = {
  events: WorldEventRecord[];
  hasMore: boolean;
  paginationState: WorldTeamEventsPaginationState;
  resolution: WorldTeamEventsResolution;
};

type BufferedWorldEvent = {
  contractId: QueryContractId;
  doc: QueryDocumentSnapshot<DocumentData>;
  event: WorldEventRecord;
  id: string;
};

type QueryContractState = {
  buffer: BufferedWorldEvent[];
  contract: QueryContract;
  cursor: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
  initialized: boolean;
};

export type WorldTeamEventsPaginationState = {
  contracts: Record<QueryContractId, QueryContractState>;
  seenContracts: QueryContractId[];
};

export type UseWorldTeamEventsArgs = {
  worldId: string | null | undefined;
  teamCode: string | null | undefined;
  limit?: number;
  enabled?: boolean;
};

export type UseWorldTeamEventsResult = {
  events: WorldEventRecord[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  resolution: WorldTeamEventsResolution | null;
  loadMore: (() => Promise<void>) | null;
};

const AUTHORITATIVE_QUERY_CONTRACT: QueryContract = {
  id: 'team-history-canonical-v1',
  label: 'canonical Team History contract',
  teamField: 'teamCodes',
  orderField: 'occurredAt',
};

const LEGACY_COMPAT_QUERY_CONTRACT: QueryContract = {
  id: 'team-history-legacy-compat-v1',
  label: 'legacy Team History compatibility contract',
  teamField: 'teamsAffected',
  orderField: 'timestamp',
};

// Team History owns one authoritative query contract and one bounded legacy
// compatibility contract for older world-event documents.
const INITIAL_QUERY_CONTRACT_CHAIN = [
  AUTHORITATIVE_QUERY_CONTRACT,
  LEGACY_COMPAT_QUERY_CONTRACT,
] as const;

const QUERY_CONTRACT_PRIORITY: Record<QueryContractId, number> = {
  'team-history-canonical-v1': 0,
  'team-history-legacy-compat-v1': 1,
};

function normalizePageSize(limit: number): number {
  return Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : DEFAULT_LIMIT;
}

function buildInitialPaginationState(): WorldTeamEventsPaginationState {
  const contracts: Record<QueryContractId, QueryContractState> = {
    'team-history-canonical-v1': {
      buffer: [],
      contract: AUTHORITATIVE_QUERY_CONTRACT,
      cursor: null,
      hasMore: true,
      initialized: false,
    },
    'team-history-legacy-compat-v1': {
      buffer: [],
      contract: LEGACY_COMPAT_QUERY_CONTRACT,
      cursor: null,
      hasMore: true,
      initialized: false,
    },
  };

  return {
    contracts,
    seenContracts: [],
  };
}

function toQuery(
  worldId: string,
  teamCode: string,
  pageSize: number,
  contract: QueryContract,
  startAfterDoc: QueryDocumentSnapshot<DocumentData> | null
): Query<DocumentData> {
  const baseCollection = collection(
    db,
    ARCHITECT_WORLDS_COLLECTION,
    worldId,
    ARCHITECT_WORLD_EVENTS_SUBCOLLECTION
  );
  const constraints = [
    where(contract.teamField, 'array-contains', teamCode),
    orderBy(contract.orderField, 'desc'),
    limitTo(pageSize + 1),
  ] as const;

  if (!startAfterDoc) {
    return query(baseCollection, ...constraints);
  }

  return query(baseCollection, ...constraints, startAfter(startAfterDoc));
}

function getEventTimestamp(event: WorldEventRecord): number {
  const parsed = Date.parse(String(event?.occurredAt || event?.timestamp || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareBufferedEvents(
  a: BufferedWorldEvent,
  b: BufferedWorldEvent
): number {
  const timeDiff = getEventTimestamp(b.event) - getEventTimestamp(a.event);
  if (timeDiff !== 0) {
    return timeDiff;
  }

  const contractDiff =
    QUERY_CONTRACT_PRIORITY[a.contractId] - QUERY_CONTRACT_PRIORITY[b.contractId];
  if (contractDiff !== 0) {
    return contractDiff;
  }

  return a.id.localeCompare(b.id);
}

function mergeWorldEventPages(events: WorldEventRecord[]): WorldEventRecord[] {
  const seen = new Set<string>();
  const merged: Array<{ event: WorldEventRecord; firstSeenIndex: number }> = [];

  events.forEach((event, index) => {
    const id = String(event?.id || '').trim();
    if (!id || seen.has(id)) {
      return;
    }

    seen.add(id);
    merged.push({ event, firstSeenIndex: index });
  });

  return merged
    .sort((a, b) => {
      const timeDiff = getEventTimestamp(b.event) - getEventTimestamp(a.event);
      if (timeDiff !== 0) {
        return timeDiff;
      }

      return a.firstSeenIndex - b.firstSeenIndex;
    })
    .map(({ event }) => event);
}

function formatContractError(contract: QueryContract, error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`${contract.label} failed: ${message}`);
}

function mergeContractBuffer(
  existingBuffer: BufferedWorldEvent[],
  nextEntries: BufferedWorldEvent[]
): BufferedWorldEvent[] {
  const seen = new Set(existingBuffer.map((entry) => entry.id));
  const merged = [...existingBuffer];

  nextEntries.forEach((entry) => {
    if (seen.has(entry.id)) {
      return;
    }

    seen.add(entry.id);
    merged.push(entry);
  });

  return merged;
}

function countUniqueBufferedEvents(
  paginationState: WorldTeamEventsPaginationState
): number {
  const mergedEntries = Object.values(paginationState.contracts)
    .flatMap((contractState) => contractState.buffer)
    .sort(compareBufferedEvents);
  const seen = new Set<string>();

  mergedEntries.forEach((entry) => {
    seen.add(entry.id);
  });

  return seen.size;
}

function hasFetchableContracts(
  paginationState: WorldTeamEventsPaginationState
): boolean {
  return Object.values(paginationState.contracts).some(
    (contractState) => !contractState.initialized || contractState.hasMore
  );
}

function mergeSeenContracts(
  previous: QueryContractId[],
  next: Iterable<QueryContractId>
): QueryContractId[] {
  const seen = new Set<QueryContractId>(previous);

  for (const contractId of next) {
    seen.add(contractId);
  }

  return INITIAL_QUERY_CONTRACT_CHAIN.map((contract) => contract.id).filter(
    (contractId) => seen.has(contractId)
  );
}

function resolveResolution(
  seenContracts: QueryContractId[]
): WorldTeamEventsResolution {
  const hasCanonical = seenContracts.includes(AUTHORITATIVE_QUERY_CONTRACT.id);
  const hasLegacy = seenContracts.includes(LEGACY_COMPAT_QUERY_CONTRACT.id);

  if (hasCanonical && hasLegacy) {
    return 'mixed-compatible';
  }

  if (hasCanonical) {
    return 'authoritative';
  }

  if (hasLegacy) {
    return 'legacy-compatible';
  }

  return 'empty';
}

type ContractFetchResult = {
  cursor: QueryDocumentSnapshot<DocumentData> | null;
  entries: BufferedWorldEvent[];
  hasMore: boolean;
};

async function runQueryAttempt(
  worldId: string,
  teamCode: string,
  pageSize: number,
  contract: QueryContract,
  startAfterDoc: QueryDocumentSnapshot<DocumentData> | null
): Promise<ContractFetchResult> {
  const builtQuery = toQuery(
    worldId,
    teamCode,
    pageSize,
    contract,
    startAfterDoc
  );
  const snapshot = await getDocs(builtQuery);
  const pageDocs = snapshot.docs;
  const entries = pageDocs.map((docSnapshot) => ({
    contractId: contract.id,
    doc: docSnapshot,
    event: {
      id: docSnapshot.id,
      ...(docSnapshot.data() || {}),
    },
    id: docSnapshot.id,
  }));

  return {
    cursor: pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : startAfterDoc,
    entries,
    hasMore: snapshot.docs.length > pageSize,
  };
}

async function ensureBufferedRows({
  worldId,
  teamCode,
  pageSize,
  paginationState,
}: {
  worldId: string;
  teamCode: string;
  pageSize: number;
  paginationState: WorldTeamEventsPaginationState;
}): Promise<WorldTeamEventsPaginationState> {
  let nextState = paginationState;
  let availableUniqueRows = countUniqueBufferedEvents(nextState);

  while (availableUniqueRows < pageSize && hasFetchableContracts(nextState)) {
    let fetchedContract = false;

    for (const contract of INITIAL_QUERY_CONTRACT_CHAIN) {
      const contractState = nextState.contracts[contract.id];
      if (contractState.initialized && !contractState.hasMore) {
        continue;
      }

      const result = await runQueryAttempt(
        worldId,
        teamCode,
        pageSize,
        contract,
        contractState.cursor
      ).catch((error) => {
        throw formatContractError(contract, error);
      });

      fetchedContract = true;
      nextState = {
        ...nextState,
        contracts: {
          ...nextState.contracts,
          [contract.id]: {
            ...contractState,
            buffer: mergeContractBuffer(contractState.buffer, result.entries),
            cursor: result.cursor,
            hasMore: result.hasMore,
            initialized: true,
          },
        },
      };
    }

    if (!fetchedContract) {
      break;
    }

    availableUniqueRows = countUniqueBufferedEvents(nextState);
  }

  return nextState;
}

function materializeNextPage(
  paginationState: WorldTeamEventsPaginationState,
  pageSize: number
): {
  events: WorldEventRecord[];
  paginationState: WorldTeamEventsPaginationState;
} {
  const mergedEntries = Object.values(paginationState.contracts)
    .flatMap((contractState) => contractState.buffer)
    .sort(compareBufferedEvents);
  const consumedIds = new Set<string>();
  const seenIds = new Set<string>();
  const pageEvents: WorldEventRecord[] = [];
  const contributingContracts = new Set<QueryContractId>();

  for (const entry of mergedEntries) {
    if (pageEvents.length >= pageSize) {
      break;
    }

    if (seenIds.has(entry.id)) {
      continue;
    }

    seenIds.add(entry.id);
    consumedIds.add(entry.id);
    contributingContracts.add(entry.contractId);
    pageEvents.push(entry.event);
  }

  return {
    events: pageEvents,
    paginationState: {
      contracts: Object.fromEntries(
        Object.entries(paginationState.contracts).map(([contractId, contractState]) => [
          contractId,
          {
            ...contractState,
            buffer: contractState.buffer.filter(
              (entry) => !consumedIds.has(entry.id)
            ),
          },
        ])
      ) as Record<QueryContractId, QueryContractState>,
      seenContracts: mergeSeenContracts(
        paginationState.seenContracts,
        contributingContracts
      ),
    },
  };
}

export async function fetchWorldTeamEvents({
  worldId,
  teamCode,
  limit,
  paginationState = null,
}: FetchRequest): Promise<FetchResponse> {
  const normalizedTeamCode = String(teamCode || '').trim();
  if (!worldId || !normalizedTeamCode) {
    throw new Error('worldId and teamCode are required to query world events');
  }

  const pageSize = normalizePageSize(limit);
  const nextState = await ensureBufferedRows({
    worldId,
    teamCode: normalizedTeamCode,
    pageSize,
    paginationState: paginationState || buildInitialPaginationState(),
  });
  const page = materializeNextPage(nextState, pageSize);

  return {
    events: page.events,
    hasMore:
      countUniqueBufferedEvents(page.paginationState) > 0 ||
      hasFetchableContracts(page.paginationState),
    paginationState: page.paginationState,
    resolution: resolveResolution(page.paginationState.seenContracts),
  };
}

export function useWorldTeamEvents({
  worldId,
  teamCode,
  limit = DEFAULT_LIMIT,
  enabled = true,
}: UseWorldTeamEventsArgs): UseWorldTeamEventsResult {
  const [events, setEvents] = useState<WorldEventRecord[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [paginationState, setPaginationState] =
    useState<WorldTeamEventsPaginationState | null>(null);
  const [resolution, setResolution] =
    useState<WorldTeamEventsResolution | null>(null);

  const canQuery = Boolean(enabled && worldId && teamCode);

  useEffect(() => {
    let isActive = true;

    if (!canQuery || !worldId || !teamCode) {
      setEvents([]);
      setLoadingInitial(false);
      setLoadingMore(false);
      setError(null);
      setHasMore(false);
      setPaginationState(null);
      setResolution(null);
      return () => {
        isActive = false;
      };
    }

    setEvents([]);
    setHasMore(false);
    setPaginationState(null);
    setResolution(null);
    setLoadingInitial(true);
    setLoadingMore(false);
    setError(null);

    fetchWorldTeamEvents({
      worldId,
      teamCode,
      limit,
    })
      .then((result) => {
        if (!isActive) {
          return;
        }
        setEvents(mergeWorldEventPages(result.events));
        setHasMore(result.hasMore);
        setPaginationState(result.paginationState);
        setResolution(result.resolution);
      })
      .catch((caught) => {
        if (!isActive) {
          return;
        }
        setEvents([]);
        setHasMore(false);
        setPaginationState(null);
        setResolution(null);
        setError(caught instanceof Error ? caught.message : String(caught));
      })
      .finally(() => {
        if (!isActive) {
          return;
        }
        setLoadingInitial(false);
      });

    return () => {
      isActive = false;
    };
  }, [canQuery, worldId, teamCode, limit]);

  const loadMore = useCallback(async () => {
    if (
      !canQuery ||
      !worldId ||
      !teamCode ||
      !paginationState ||
      loadingInitial ||
      loadingMore
    ) {
      return;
    }

    setLoadingMore(true);
    setError(null);

    try {
      const result = await fetchWorldTeamEvents({
        worldId,
        teamCode,
        limit,
        paginationState,
      });

      setEvents((previous) =>
        mergeWorldEventPages([...previous, ...result.events])
      );
      setHasMore(result.hasMore);
      setPaginationState(result.paginationState);
      setResolution(result.resolution);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoadingMore(false);
    }
  }, [
    canQuery,
    worldId,
    teamCode,
    paginationState,
    loadingInitial,
    loadingMore,
    limit,
  ]);

  const loadMoreFn = useMemo(() => {
    if (!hasMore) {
      return null;
    }
    return loadMore;
  }, [hasMore, loadMore]);

  return {
    events,
    loading: loadingInitial || loadingMore,
    loadingMore,
    error,
    hasMore,
    resolution,
    loadMore: loadMoreFn,
  };
}
