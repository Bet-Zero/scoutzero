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
  startAfterDoc?: QueryDocumentSnapshot<DocumentData> | null;
  preferredContract?: QueryContract | null;
};

type FetchResponse = {
  events: WorldEventRecord[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
  queryContract: QueryContract;
  resolution: WorldTeamEventsResolution;
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

function normalizePageSize(limit: number): number {
  return Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : DEFAULT_LIMIT;
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

async function runQueryAttempt(
  worldId: string,
  teamCode: string,
  pageSize: number,
  contract: QueryContract,
  startAfterDoc: QueryDocumentSnapshot<DocumentData> | null
): Promise<FetchResponse> {
  const builtQuery = toQuery(
    worldId,
    teamCode,
    pageSize,
    contract,
    startAfterDoc
  );
  const snapshot = await getDocs(builtQuery);
  const pageDocs = snapshot.docs.slice(0, pageSize);
  const events = pageDocs.map((docSnapshot) => ({
    id: docSnapshot.id,
    ...(docSnapshot.data() || {}),
  }));

  return {
    events,
    lastDoc: pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null,
    hasMore: snapshot.docs.length > pageSize,
    queryContract: contract,
    resolution:
      contract.id === LEGACY_COMPAT_QUERY_CONTRACT.id
        ? 'legacy-compatible'
        : 'authoritative',
  };
}

export async function fetchWorldTeamEvents({
  worldId,
  teamCode,
  limit,
  startAfterDoc = null,
  preferredContract = null,
}: FetchRequest): Promise<FetchResponse> {
  const normalizedTeamCode = String(teamCode || '').trim();
  if (!worldId || !normalizedTeamCode) {
    throw new Error('worldId and teamCode are required to query world events');
  }

  const pageSize = normalizePageSize(limit);

  if (preferredContract) {
    try {
      return await runQueryAttempt(
        worldId,
        normalizedTeamCode,
        pageSize,
        preferredContract,
        startAfterDoc
      );
    } catch (error) {
      throw formatContractError(preferredContract, error);
    }
  }

  let authoritativeResult: FetchResponse;
  try {
    authoritativeResult = await runQueryAttempt(
      worldId,
      normalizedTeamCode,
      pageSize,
      AUTHORITATIVE_QUERY_CONTRACT,
      startAfterDoc
    );
  } catch (error) {
    throw formatContractError(AUTHORITATIVE_QUERY_CONTRACT, error);
  }

  if (authoritativeResult.events.length > 0) {
    return authoritativeResult;
  }

  let legacyCompatResult: FetchResponse;
  try {
    legacyCompatResult = await runQueryAttempt(
      worldId,
      normalizedTeamCode,
      pageSize,
      LEGACY_COMPAT_QUERY_CONTRACT,
      startAfterDoc
    );
  } catch (error) {
    throw formatContractError(LEGACY_COMPAT_QUERY_CONTRACT, error);
  }

  if (legacyCompatResult.events.length > 0) {
    return legacyCompatResult;
  }

  return {
    events: [],
    lastDoc: null,
    hasMore: false,
    queryContract: INITIAL_QUERY_CONTRACT_CHAIN[0],
    resolution: 'empty',
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
  const [lastDoc, setLastDoc] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [queryContract, setQueryContract] = useState<QueryContract | null>(null);
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
      setLastDoc(null);
      setQueryContract(null);
      setResolution(null);
      return () => {
        isActive = false;
      };
    }

    setEvents([]);
    setHasMore(false);
    setLastDoc(null);
    setQueryContract(null);
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
        setLastDoc(result.lastDoc);
        setQueryContract(result.queryContract);
        setResolution(result.resolution);
      })
      .catch((caught) => {
        if (!isActive) {
          return;
        }
        setEvents([]);
        setHasMore(false);
        setLastDoc(null);
        setQueryContract(null);
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
      !lastDoc ||
      !queryContract ||
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
        startAfterDoc: lastDoc,
        preferredContract: queryContract,
      });

      setEvents((previous) =>
        mergeWorldEventPages([...previous, ...result.events])
      );
      setHasMore(result.hasMore);
      setLastDoc(result.lastDoc);
      setQueryContract(result.queryContract);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoadingMore(false);
    }
  }, [
    canQuery,
    worldId,
    teamCode,
    lastDoc,
    queryContract,
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
