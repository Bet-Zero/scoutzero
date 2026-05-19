/**
 * FILE: src/features/architect/GMDashboard/hooks/useArchitectModePresentation.ts
 * PURPOSE: Read-only presentation seam for Architect world/sandbox/preview authority labels.
 * OWNERSHIP: Feature: architect/GMDashboard
 */

import { useMemo } from 'react';
import type { ArchitectWorldModeBoundary } from './useArchitectState';

export type ArchitectModePresentationKind =
  | 'committed-world'
  | 'sandbox'
  | 'local-only-preview'
  | 'pending-world-preview'
  | 'failed-world-preview'
  | 'dev-only-preview'
  | 'loading'
  | 'unavailable'
  | 'error';

export type ArchitectModePresentationTone =
  | 'success'
  | 'neutral'
  | 'info'
  | 'warning'
  | 'danger'
  | 'muted';

export interface ArchitectModePresentation {
  kind: ArchitectModePresentationKind;
  label: string;
  shortLabel: string;
  detail: string;
  tone: ArchitectModePresentationTone;
  worldId: string | null;
  isCommittedWorldTruth: boolean;
}

export interface ArchitectModePresentationInput {
  worldId?: string | null;
  worldModeBoundary?: ArchitectWorldModeBoundary | null;
  isLoading?: boolean;
  worldMetadataLoading?: boolean;
  error?: string | null;
  authorityOverride?: ArchitectModePresentationKind | null;
}

export type ArchitectEntryAuthorityKind =
  | 'committed-world'
  | 'sandbox'
  | 'local-only-preview'
  | 'pending-world-preview'
  | 'failed-world-preview'
  | 'dev-only-preview'
  | 'unavailable';

const PRESENTATION_BY_KIND: Record<
  ArchitectModePresentationKind,
  Omit<ArchitectModePresentation, 'worldId'>
> = {
  'committed-world': {
    kind: 'committed-world',
    label: 'Committed World',
    shortLabel: 'World',
    detail: 'This view reflects saved world state.',
    tone: 'success',
    isCommittedWorldTruth: true,
  },
  sandbox: {
    kind: 'sandbox',
    label: 'Sandbox',
    shortLabel: 'Sandbox',
    detail: 'No active world is selected. This is a local operating view.',
    tone: 'neutral',
    isCommittedWorldTruth: false,
  },
  'local-only-preview': {
    kind: 'local-only-preview',
    label: 'Local Preview',
    shortLabel: 'Local',
    detail: 'This entry is local-only and is not saved as committed world truth.',
    tone: 'warning',
    isCommittedWorldTruth: false,
  },
  'pending-world-preview': {
    kind: 'pending-world-preview',
    label: 'Pending World Save',
    shortLabel: 'Pending',
    detail: 'This preview is waiting for committed world persistence evidence.',
    tone: 'info',
    isCommittedWorldTruth: false,
  },
  'failed-world-preview': {
    kind: 'failed-world-preview',
    label: 'Failed Preview',
    shortLabel: 'Failed',
    detail: 'This preview did not become committed world truth.',
    tone: 'danger',
    isCommittedWorldTruth: false,
  },
  'dev-only-preview': {
    kind: 'dev-only-preview',
    label: 'Developer Preview',
    shortLabel: 'DEV',
    detail: 'This entry is a development-only preview and is not committed.',
    tone: 'muted',
    isCommittedWorldTruth: false,
  },
  loading: {
    kind: 'loading',
    label: 'Loading Context',
    shortLabel: 'Loading',
    detail: 'Architect is resolving the active operating context.',
    tone: 'muted',
    isCommittedWorldTruth: false,
  },
  unavailable: {
    kind: 'unavailable',
    label: 'Context Unavailable',
    shortLabel: 'Unavailable',
    detail: 'Architect cannot reliably identify the operating context yet.',
    tone: 'muted',
    isCommittedWorldTruth: false,
  },
  error: {
    kind: 'error',
    label: 'Context Error',
    shortLabel: 'Error',
    detail: 'Architect encountered an error while resolving operating context.',
    tone: 'danger',
    isCommittedWorldTruth: false,
  },
};

const withWorldId = (
  kind: ArchitectModePresentationKind,
  worldId: string | null,
  detailOverride?: string
): ArchitectModePresentation => {
  const base = PRESENTATION_BY_KIND[kind];
  return {
    ...base,
    detail: detailOverride || base.detail,
    worldId,
  };
};

export function deriveArchitectEntryAuthorityPresentation(
  authorityKind: ArchitectEntryAuthorityKind,
  worldId: string | null = null
): ArchitectModePresentation {
  return withWorldId(authorityKind, worldId);
}

export function deriveArchitectModePresentation({
  worldId = null,
  worldModeBoundary = null,
  isLoading = false,
  worldMetadataLoading = false,
  error = null,
  authorityOverride = null,
}: ArchitectModePresentationInput): ArchitectModePresentation {
  if (authorityOverride) {
    return withWorldId(authorityOverride, worldId);
  }

  if (error) {
    return withWorldId('error', worldId, error);
  }

  if (isLoading || worldMetadataLoading) {
    return withWorldId('loading', worldId);
  }

  if (!worldId) {
    return withWorldId('sandbox', null);
  }

  if (
    !worldModeBoundary ||
    worldModeBoundary.kind !== 'world' ||
    worldModeBoundary.worldId !== worldId
  ) {
    return withWorldId('unavailable', worldId);
  }

  return withWorldId('committed-world', worldId);
}

export function useArchitectModePresentation(
  input: ArchitectModePresentationInput
): ArchitectModePresentation {
  return useMemo(
    () => deriveArchitectModePresentation(input),
    [
      input.authorityOverride,
      input.error,
      input.isLoading,
      input.worldId,
      input.worldMetadataLoading,
      input.worldModeBoundary,
    ]
  );
}
