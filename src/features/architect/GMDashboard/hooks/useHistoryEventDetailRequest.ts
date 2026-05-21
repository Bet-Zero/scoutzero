/**
 * FILE: src/features/architect/GMDashboard/hooks/useHistoryEventDetailRequest.ts
 * PURPOSE: Dashboard-owned one-shot History event detail request state.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * Stores read-only navigation/detail-selection requests only. It never creates
 * history truth, never writes to Firestore, and clears when world/team scope
 * changes or when History acknowledges the request.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  RequestedHistoryEventDetail,
  RequestedHistoryEventDetailSource,
} from '@/features/architect/history/TeamHistoryTab/types';

type UseHistoryEventDetailRequestArgs = {
  worldId: string | null | undefined;
  teamCode: string | null | undefined;
  onOpenHistory: () => void;
};

type UseHistoryEventDetailRequestResult = {
  requestedHistoryEventDetail: RequestedHistoryEventDetail | null;
  openHistoryRoot: () => void;
  requestHistoryEventDetail: (
    eventId: string | null | undefined,
    source: RequestedHistoryEventDetailSource
  ) => void;
  handleHistoryEventDetailHandled: (requestKey: number) => void;
};

const normalizeToken = (value: string | null | undefined): string | null => {
  const normalized = String(value ?? '').trim();
  return normalized || null;
};

export function useHistoryEventDetailRequest({
  worldId,
  teamCode,
  onOpenHistory,
}: UseHistoryEventDetailRequestArgs): UseHistoryEventDetailRequestResult {
  const [requestedHistoryEventDetail, setRequestedHistoryEventDetail] =
    useState<RequestedHistoryEventDetail | null>(null);
  const requestKeyRef = useRef(0);
  const normalizedWorldId = normalizeToken(worldId);
  const normalizedTeamCode = normalizeToken(teamCode);

  useEffect(() => {
    setRequestedHistoryEventDetail(null);
  }, [normalizedWorldId, normalizedTeamCode]);

  const openHistoryRoot = useCallback(() => {
    setRequestedHistoryEventDetail(null);
    onOpenHistory();
  }, [onOpenHistory]);

  const requestHistoryEventDetail = useCallback(
    (
      eventId: string | null | undefined,
      source: RequestedHistoryEventDetailSource
    ) => {
      const requestedSelectedEntryId = normalizeToken(eventId);
      if (!requestedSelectedEntryId || !normalizedWorldId || !normalizedTeamCode) {
        openHistoryRoot();
        return;
      }

      requestKeyRef.current += 1;
      setRequestedHistoryEventDetail({
        requestKey: requestKeyRef.current,
        requestedSelectedEntryId,
        worldId: normalizedWorldId,
        teamCode: normalizedTeamCode,
        source,
      });
      onOpenHistory();
    },
    [normalizedWorldId, normalizedTeamCode, onOpenHistory, openHistoryRoot]
  );

  const handleHistoryEventDetailHandled = useCallback((requestKey: number) => {
    setRequestedHistoryEventDetail((current) =>
      current?.requestKey === requestKey ? null : current
    );
  }, []);

  return {
    requestedHistoryEventDetail,
    openHistoryRoot,
    requestHistoryEventDetail,
    handleHistoryEventDetailHandled,
  };
}
