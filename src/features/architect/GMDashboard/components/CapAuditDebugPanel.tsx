/**
 * FILE: src/features/architect/GMDashboard/components/CapAuditDebugPanel.tsx
 * PURPOSE: Dev-only panel for inspecting local cap audit streams.
 * OWNERSHIP: Feature: architect/GMDashboard
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BASE_CAP_AUDIT_STORAGE_KEY,
  WORLD_PREVIEW_CAP_AUDIT_STORAGE_KEY,
  clearLocalCapAuditEvents,
  readLocalCapAuditEvents,
  type CapAuditEventV1Like,
} from '@/features/architect/utils/capLegality/localCapAuditLog';

export const ARCHITECT_DEBUG_FLAG_STORAGE_KEY = '__ARCHITECT_DEBUG__';

function hasDebugFlagEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(ARCHITECT_DEBUG_FLAG_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function isCapAuditDebugEnabled(): boolean {
  return import.meta.env.DEV || hasDebugFlagEnabled();
}

function normalizeOperationIdFilter(value: string): string {
  return String(value || '').trim().toLowerCase();
}

function doesEventMatchFilters(
  event: CapAuditEventV1Like,
  mutationTypeFilter: string,
  operationIdFilter: string
): boolean {
  if (mutationTypeFilter && event.mutationType !== mutationTypeFilter) {
    return false;
  }

  if (!operationIdFilter) {
    return true;
  }

  const operationId = String(event.operationId || '').toLowerCase();
  return operationId.includes(operationIdFilter);
}

function formatOccurredAt(value: unknown): string {
  if (!value) return '-';
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return parsed.toLocaleString();
}

type CapAuditDebugPanelProps = {
  worldId: string | null;
};

function AuditStreamTable({
  title,
  events,
  mutationTypeFilter,
  operationIdFilter,
  onClear,
  showLinkage,
}: {
  title: string;
  events: CapAuditEventV1Like[];
  mutationTypeFilter: string;
  operationIdFilter: string;
  onClear: () => void;
  showLinkage: boolean;
}) {
  const filteredEvents = useMemo(() => {
    return events.filter((event) =>
      doesEventMatchFilters(event, mutationTypeFilter, operationIdFilter)
    );
  }, [events, mutationTypeFilter, operationIdFilter]);

  return (
    <div className="rounded border border-white/10 bg-black/30 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white">{title}</h4>
        <button
          type="button"
          onClick={onClear}
          className="rounded border border-white/20 px-2 py-1 text-xs text-white hover:bg-white/10"
        >
          Clear
        </button>
      </div>
      <p className="mb-2 text-xs text-white/70">
        Showing {filteredEvents.length} of {events.length} events
      </p>
      <div className="max-h-72 overflow-auto rounded border border-white/10">
        <table className="min-w-full divide-y divide-white/10 text-xs">
          <thead className="bg-black/40 text-white/80">
            <tr>
              <th className="px-2 py-1 text-left font-medium">Occurred</th>
              <th className="px-2 py-1 text-left font-medium">Mutation</th>
              <th className="px-2 py-1 text-left font-medium">Operation ID</th>
              {showLinkage && (
                <th className="px-2 py-1 text-left font-medium">Linked</th>
              )}
              <th className="px-2 py-1 text-left font-medium">Valid</th>
              <th className="px-2 py-1 text-left font-medium">Viol.</th>
              <th className="px-2 py-1 text-left font-medium">Warn.</th>
              <th className="px-2 py-1 text-left font-medium">Team Codes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 text-white/90">
            {filteredEvents.map((event) => (
              <tr key={`${event.operationId}_${event.occurredAt}`}>
                <td className="px-2 py-1">{formatOccurredAt(event.occurredAt)}</td>
                <td className="px-2 py-1">{event.mutationType}</td>
                <td className="px-2 py-1 font-mono">{event.operationId}</td>
                {showLinkage && (
                  <td className="px-2 py-1">
                    {event.authoritativeEventLinked ? 'yes' : 'no'}
                  </td>
                )}
                <td className="px-2 py-1">{event.valid ? 'true' : 'false'}</td>
                <td className="px-2 py-1">{event.violations?.length || 0}</td>
                <td className="px-2 py-1">{event.warnings?.length || 0}</td>
                <td className="px-2 py-1">
                  {Array.isArray(event.teamCodes) ? event.teamCodes.join(', ') : ''}
                </td>
              </tr>
            ))}
            {filteredEvents.length === 0 && (
              <tr>
                <td
                  className="px-2 py-3 text-center text-white/50"
                  colSpan={showLinkage ? 8 : 7}
                >
                  No events match the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CapAuditDebugPanel({ worldId }: CapAuditDebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [baseEvents, setBaseEvents] = useState<CapAuditEventV1Like[]>([]);
  const [worldPreviewEvents, setWorldPreviewEvents] = useState<
    CapAuditEventV1Like[]
  >([]);
  const [mutationTypeFilter, setMutationTypeFilter] = useState('');
  const [operationIdFilter, setOperationIdFilter] = useState('');

  const refreshEvents = useCallback(() => {
    setBaseEvents(
      readLocalCapAuditEvents({
        storageKey: BASE_CAP_AUDIT_STORAGE_KEY,
      })
    );
    setWorldPreviewEvents(
      readLocalCapAuditEvents({
        storageKey: WORLD_PREVIEW_CAP_AUDIT_STORAGE_KEY,
      })
    );
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    refreshEvents();
  }, [isOpen, refreshEvents]);

  const clearBaseEvents = useCallback(() => {
    clearLocalCapAuditEvents({
      storageKey: BASE_CAP_AUDIT_STORAGE_KEY,
    });
    refreshEvents();
  }, [refreshEvents]);

  const clearWorldPreviewEvents = useCallback(() => {
    clearLocalCapAuditEvents({
      storageKey: WORLD_PREVIEW_CAP_AUDIT_STORAGE_KEY,
    });
    refreshEvents();
  }, [refreshEvents]);

  const normalizedOperationIdFilter = useMemo(
    () => normalizeOperationIdFilter(operationIdFilter),
    [operationIdFilter]
  );

  const mutationTypeOptions = useMemo(() => {
    const allMutationTypes = new Set<string>();
    for (const event of [...baseEvents, ...worldPreviewEvents]) {
      if (event?.mutationType) {
        allMutationTypes.add(String(event.mutationType));
      }
    }

    return Array.from(allMutationTypes).sort((a, b) => a.localeCompare(b));
  }, [baseEvents, worldPreviewEvents]);

  if (!isCapAuditDebugEnabled()) {
    return null;
  }

  return (
    <div className="rounded-md border border-amber-400/40 bg-amber-950/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
            Dev Debug
          </p>
          <h3 className="text-sm font-semibold text-white">Cap Audit Debug</h3>
          <p className="text-xs text-white/70">
            World: {worldId || 'base-mode'} | Base events: {baseEvents.length}{' '}
            | Preview events: {worldPreviewEvents.length}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="rounded border border-white/20 px-3 py-1 text-xs text-white hover:bg-white/10"
          >
            {isOpen ? 'Hide' : 'Show'}
          </button>
          <button
            type="button"
            onClick={refreshEvents}
            className="rounded border border-white/20 px-3 py-1 text-xs text-white hover:bg-white/10"
          >
            Refresh
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="mt-3 space-y-3">
          <div className="grid gap-2 md:grid-cols-2">
            <label className="flex flex-col text-xs text-white/80">
              Mutation Type Filter
              <select
                value={mutationTypeFilter}
                onChange={(event) => setMutationTypeFilter(event.target.value)}
                className="mt-1 rounded border border-white/20 bg-black/40 px-2 py-1 text-white"
              >
                <option value="">All</option>
                {mutationTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col text-xs text-white/80">
              Operation ID Contains
              <input
                type="text"
                value={operationIdFilter}
                onChange={(event) => setOperationIdFilter(event.target.value)}
                placeholder="op_..."
                className="mt-1 rounded border border-white/20 bg-black/40 px-2 py-1 text-white"
              />
            </label>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            <AuditStreamTable
              title="Base-mode Local Audit Stream"
              events={baseEvents}
              mutationTypeFilter={mutationTypeFilter}
              operationIdFilter={normalizedOperationIdFilter}
              onClear={clearBaseEvents}
              showLinkage={false}
            />
            <AuditStreamTable
              title="World Optimistic Preview Stream"
              events={worldPreviewEvents}
              mutationTypeFilter={mutationTypeFilter}
              operationIdFilter={normalizedOperationIdFilter}
              onClear={clearWorldPreviewEvents}
              showLinkage={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}
