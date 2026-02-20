/**
 * FILE: src/features/architect/admin/entitlementEditorFormState.ts
 * PURPOSE: Form state helpers for EntitlementEditorModal.
 * OWNERSHIP: Feature: architect/admin (TM-4 Entitlement Authoring)
 *
 * HISTORY:
 *  - 2026-02-05: Created for TM-4 entitlement authoring form state.
 */

import { getEntitlementIdentityKey } from '../utils/entitlements/entitlementIdentity';

export type EntitlementKind =
  | 'pick_ownership'
  | 'swap_right'
  | 'conveyance_right';
export type EntitlementUnderlyingStatus = 'pooled' | 'encumbered' | 'clean';
export type ReceivesComparator = 'more_favorable' | 'less_favorable' | 'middle';
export type SwapType = 'best_of' | 'worst_of';

export type ProtectionLadderTierForm = {
  year: string;
  condition: string;
  ifTriggered: 'roll' | 'convert' | 'cancel';
  rollToYear: string;
  convertToRound: string;
  // BUG #5 fix: preserve pipeline-generated source metadata through editor round-trips
  source?: string;
};

export type EntitlementFormState = {
  id: string;
  holderTeam: string;
  seasonYear: string;
  round: string;
  kind: EntitlementKind | '';
  description: string;
  underlyingPickId: string;
  underlyingStatus: EntitlementUnderlyingStatus | '';
  swapControllerPickId: string;
  swapTargetDefinition: string;
  swapType: SwapType | '';
  poolUnderlyingPickIdsText: string;
  receivesRankText: string;
  receivesComparator: ReceivesComparator | '';
  protectionLadder: ProtectionLadderTierForm[];
  // TM-ENTITLEMENTS-ADV-E1: Chained/linked entitlement support
  linkedEntitlementIdsText: string;
  residualOfEntitlementId: string;
  coveredByEntitlementIdsText: string;
};

const defaultFormState: EntitlementFormState = {
  id: '',
  holderTeam: 'LAL',
  seasonYear: '2026',
  round: '1',
  kind: 'pick_ownership',
  description: '',
  underlyingPickId: '',
  underlyingStatus: 'clean',
  swapControllerPickId: '',
  swapTargetDefinition: '',
  swapType: '',
  poolUnderlyingPickIdsText: '',
  receivesRankText: '',
  receivesComparator: '',
  protectionLadder: [],
  // TM-ENTITLEMENTS-ADV-E1: Chained/linked entitlement support
  linkedEntitlementIdsText: '',
  residualOfEntitlementId: '',
  coveredByEntitlementIdsText: '',
};

const parseListInput = (value: string): string[] =>
  value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);

const parseNumberListInput = (value: string): number[] =>
  parseListInput(value)
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry));

const stringifyList = (value?: unknown[]): string =>
  Array.isArray(value) && value.length ? value.join('\n') : '';

const stringifyNumberList = (value?: unknown[]): string =>
  Array.isArray(value) && value.length ? value.join(', ') : '';

const toNumberString = (value: unknown): string =>
  typeof value === 'number' && Number.isFinite(value) ? String(value) : '';

const normalizeTeamCode = (value: unknown): string =>
  typeof value === 'string' ? value.toUpperCase() : '';

const parseOptionalNumber = (value: string): number | undefined => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const createEntitlementFormState = (
  initialDocument?: Record<string, unknown>,
  entitlementId?: string
): EntitlementFormState => {
  if (!initialDocument) {
    return {
      ...defaultFormState,
      id: entitlementId || defaultFormState.id,
    };
  }

  return {
    ...defaultFormState,
    id: (entitlementId || (initialDocument.id as string) || '').toString(),
    holderTeam: normalizeTeamCode(initialDocument.holderTeam),
    seasonYear: toNumberString(initialDocument.seasonYear),
    round: toNumberString(initialDocument.round),
    kind: (initialDocument.kind as EntitlementKind) || '',
    description: (initialDocument.description as string) || '',
    underlyingPickId: (initialDocument.underlyingPickId as string) || '',
    underlyingStatus:
      (initialDocument.underlyingStatus as EntitlementUnderlyingStatus) || '',
    swapControllerPickId:
      (initialDocument.swapControllerPickId as string) || '',
    swapTargetDefinition:
      (initialDocument.swapTargetDefinition as string) || '',
    swapType: (initialDocument.swapType as SwapType) || '',
    poolUnderlyingPickIdsText: stringifyList(
      initialDocument.poolUnderlyingPickIds as string[]
    ),
    receivesRankText: stringifyNumberList(
      initialDocument.receivesRank as number[]
    ),
    receivesComparator:
      (initialDocument.receivesComparator as ReceivesComparator) || '',
    protectionLadder: Array.isArray(initialDocument.protectionLadder)
      ? initialDocument.protectionLadder.map((tier) => ({
          year: toNumberString(tier.year),
          condition: (tier.condition as string) || '',
          ifTriggered:
            (tier.ifTriggered as 'roll' | 'convert' | 'cancel') || 'roll',
          rollToYear: toNumberString(tier.rollToYear),
          convertToRound: toNumberString(tier.convertToRound),
          // BUG #5 fix: preserve source metadata
          ...(tier.source ? { source: tier.source as string } : {}),
        }))
      : [],
    // TM-ENTITLEMENTS-ADV-E1: Chained/linked entitlement support
    linkedEntitlementIdsText: stringifyList(
      initialDocument.linkedEntitlementIds as string[]
    ),
    residualOfEntitlementId:
      (initialDocument.residualOfEntitlementId as string) || '',
    coveredByEntitlementIdsText: stringifyList(
      initialDocument.coveredByEntitlementIds as string[]
    ),
  };
};

export const buildEntitlementDocument = (
  formState: EntitlementFormState
): Record<string, unknown> => {
  const document: Record<string, unknown> = {
    holderTeam: formState.holderTeam.trim().toUpperCase(),
    seasonYear: Number(formState.seasonYear),
    round: Number(formState.round),
    kind: formState.kind,
  };

  if (formState.id) document.id = formState.id;
  if (formState.description)
    document.description = formState.description.trim();
  if (formState.underlyingPickId)
    document.underlyingPickId = formState.underlyingPickId.trim();
  if (formState.underlyingStatus)
    document.underlyingStatus = formState.underlyingStatus;
  if (formState.swapControllerPickId)
    document.swapControllerPickId = formState.swapControllerPickId.trim();
  if (formState.swapTargetDefinition)
    document.swapTargetDefinition = formState.swapTargetDefinition.trim();
  if (formState.swapType) document.swapType = formState.swapType;

  const poolUnderlyingPickIds = parseListInput(
    formState.poolUnderlyingPickIdsText
  );
  if (poolUnderlyingPickIds.length > 0) {
    document.poolUnderlyingPickIds = poolUnderlyingPickIds;
  }

  const receivesRank = parseNumberListInput(formState.receivesRankText);
  if (receivesRank.length > 0) {
    document.receivesRank = receivesRank;
  }

  if (formState.receivesComparator) {
    document.receivesComparator = formState.receivesComparator;
  }

  if (formState.protectionLadder.length > 0) {
    document.protectionLadder = formState.protectionLadder.map((tier) => {
      const year = parseOptionalNumber(tier.year);
      const rollToYear = parseOptionalNumber(tier.rollToYear);
      const convertToRound = parseOptionalNumber(tier.convertToRound);
      return {
        year,
        condition: tier.condition,
        ifTriggered: tier.ifTriggered,
        rollToYear,
        convertToRound,
        // BUG #5 fix: preserve source metadata through editor saves
        ...(tier.source ? { source: tier.source } : {}),
      };
    });
  }

  // TM-ENTITLEMENTS-ADV-E1: Chained/linked entitlement support
  const linkedEntitlementIds = parseListInput(
    formState.linkedEntitlementIdsText
  );
  if (linkedEntitlementIds.length > 0) {
    document.linkedEntitlementIds = linkedEntitlementIds;
  }

  if (formState.residualOfEntitlementId.trim()) {
    document.residualOfEntitlementId = formState.residualOfEntitlementId.trim();
  }

  const coveredByEntitlementIds = parseListInput(
    formState.coveredByEntitlementIdsText
  );
  if (coveredByEntitlementIds.length > 0) {
    document.coveredByEntitlementIds = coveredByEntitlementIds;
  }

  // R2: Persist identityKey so downstream consumers (resolver, list, dedupe)
  // can match records without recomputing. Written to both world and vacuum docs.
  document.identityKey = getEntitlementIdentityKey(document);

  return document;
};

export const serializeEntitlementDocument = (
  formState: EntitlementFormState
): string => JSON.stringify(buildEntitlementDocument(formState), null, 2);

export const parseEntitlementDocument = (
  jsonInput: string
): { document?: Record<string, unknown>; error?: string } => {
  try {
    const parsed = JSON.parse(jsonInput);
    if (!parsed || typeof parsed !== 'object') {
      return { error: 'JSON must be an object' };
    }
    return { document: parsed };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Invalid JSON',
    };
  }
};

export const getEntitlementIdFromForm = (
  formState: EntitlementFormState,
  fallbackId?: string
): string => formState.id || fallbackId || '';
