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

type QueryConfig = {
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
  preferredConfig?: QueryConfig | null;
};

type FetchResponse = {
  events: WorldEventRecord[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
  queryConfig: QueryConfig;
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
  error: string | null;
  hasMore: boolean;
  loadMore: (() => Promise<void>) | null;
};

const QUERY_CONFIGS: QueryConfig[] = [
  { teamField: 'teamCodes', orderField: 'occurredAt' },
  { teamField: 'teamCodes', orderField: 'timestamp' },
  { teamField: 'teamsAffected', orderField: 'occurredAt' },
  { teamField: 'teamsAffected', orderField: 'timestamp' },
];

function toQuery(
  worldId: string,
  teamCode: string,
  queryLimit: number,
  config: QueryConfig,
  startAfterDoc: QueryDocumentSnapshot<DocumentData> | null
): Query<DocumentData> {
  const baseCollection = collection(
    db,
    ARCHITECT_WORLDS_COLLECTION,
    worldId,
    ARCHITECT_WORLD_EVENTS_SUBCOLLECTION
  );
  const constraints = [
    where(config.teamField, 'array-contains', teamCode),
    orderBy(config.orderField, 'desc'),
    limitTo(queryLimit),
  ] as const;

  if (!startAfterDoc) {
    return query(baseCollection, ...constraints);
  }

  return query(baseCollection, ...constraints, startAfter(startAfterDoc));
}

function dedupeById(events: WorldEventRecord[]): WorldEventRecord[] {
  const seen = new Set<string>();
  const deduped: WorldEventRecord[] = [];
  for (const event of events) {
    const id = String(event?.id || '').trim();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    deduped.push(event);
  }
  return deduped;
}

async function runQueryAttempt(
  worldId: string,
  teamCode: string,
  queryLimit: number,
  config: QueryConfig,
  startAfterDoc: QueryDocumentSnapshot<DocumentData> | null
): Promise<FetchResponse> {
  const builtQuery = toQuery(
    worldId,
    teamCode,
    queryLimit,
    config,
    startAfterDoc
  );
  const snapshot = await getDocs(builtQuery);
  const docs = snapshot.docs;
  const events = docs.map((docSnapshot) => ({
    id: docSnapshot.id,
    ...(docSnapshot.data() || {}),
  }));

  return {
    events,
    lastDoc: docs.length > 0 ? docs[docs.length - 1] : null,
    hasMore: docs.length >= queryLimit,
    queryConfig: config,
  };
}

export async function fetchWorldTeamEvents({
  worldId,
  teamCode,
  limit,
  startAfterDoc = null,
  preferredConfig = null,
}: FetchRequest): Promise<FetchResponse> {
  const normalizedTeamCode = String(teamCode || '').trim();
  if (!worldId || !normalizedTeamCode) {
    throw new Error('worldId and teamCode are required to query world events');
  }

  const queryLimit =
    Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : DEFAULT_LIMIT;
  const configs = preferredConfig ? [preferredConfig] : QUERY_CONFIGS;
  const errors: Error[] = [];

  for (const config of configs) {
    try {
      const result = await runQueryAttempt(
        worldId,
        normalizedTeamCode,
        queryLimit,
        config,
        startAfterDoc
      );
      if (result.events.length > 0 || preferredConfig) {
        return result;
      }

      if (result.events.length === 0 && !preferredConfig) {
        continue;
      }
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }
  }

  if (errors.length > 0) {
    const details = errors.map((item) => item.message).join(' | ');
    throw new Error(`Failed to load world events: ${details}`);
  }

  return {
    events: [],
    lastDoc: null,
    hasMore: false,
    queryConfig: preferredConfig || QUERY_CONFIGS[0],
  };
}

export function useWorldTeamEvents({
  worldId,
  teamCode,
  limit = DEFAULT_LIMIT,
  enabled = true,
}: UseWorldTeamEventsArgs): UseWorldTeamEventsResult {
  const [events, setEvents] = useState<WorldEventRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [lastDoc, setLastDoc] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [queryConfig, setQueryConfig] = useState<QueryConfig | null>(null);

  const canQuery = Boolean(enabled && worldId && teamCode);

  useEffect(() => {
    let isActive = true;

    if (!canQuery || !worldId || !teamCode) {
      setEvents([]);
      setLoading(false);
      setError(null);
      setHasMore(false);
      setLastDoc(null);
      setQueryConfig(null);
      return () => {
        isActive = false;
      };
    }

    setLoading(true);
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
        setEvents(dedupeById(result.events));
        setHasMore(result.hasMore);
        setLastDoc(result.lastDoc);
        setQueryConfig(result.queryConfig);
      })
      .catch((caught) => {
        if (!isActive) {
          return;
        }
        setEvents([]);
        setHasMore(false);
        setLastDoc(null);
        setQueryConfig(null);
        setError(caught instanceof Error ? caught.message : String(caught));
      })
      .finally(() => {
        if (!isActive) {
          return;
        }
        setLoading(false);
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
      !queryConfig ||
      loading
    ) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchWorldTeamEvents({
        worldId,
        teamCode,
        limit,
        startAfterDoc: lastDoc,
        preferredConfig: queryConfig,
      });

      setEvents((previous) => dedupeById([...previous, ...result.events]));
      setHasMore(result.hasMore);
      setLastDoc(result.lastDoc);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }, [canQuery, worldId, teamCode, lastDoc, queryConfig, loading, limit]);

  const loadMoreFn = useMemo(() => {
    if (!hasMore) {
      return null;
    }
    return loadMore;
  }, [hasMore, loadMore]);

  return {
    events,
    loading,
    error,
    hasMore,
    loadMore: loadMoreFn,
  };
}
