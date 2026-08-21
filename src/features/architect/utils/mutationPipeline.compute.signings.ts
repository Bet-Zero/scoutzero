/**
 * FILE: src/features/architect/utils/mutationPipeline.compute.signings.ts
 * PURPOSE: Signing, waive, extend, option, renounce, and exception compute functions.
 * OWNERSHIP: Feature: architect/core
 *
 * Wave 8 Step 2: Extracted from mutationPipeline.compute.ts (L397-L1491).
 */

import { toEndYear } from '@/features/architect/utils/seasonFormat';
import {
  getTeamSourceRecord,
  normalizeMutationExceptionsFromIngress,
  requireBasicTeamState,
  synchronizeTeamTotalsSnapshotOrTeam,
  toMutationExceptionPreserveOnlyBuckets,
} from './mutationPipeline.helpers';
import type { MutationExceptionPreserveOnlyBuckets } from './mutationPipeline.read';
import type {
  ArchitectMutationExceptions,
  ComputeMutationParamsWithCurrentState,
  ComputeResultLike,
  MutationPayloadInputByType,
  MutationTeamOnlyCurrentState,
} from './mutationPipeline';

// Wave 23 Step 1: signing utilities + computeSigningResult
export * from './mutationPipeline.compute.signings.signing';

// Wave 23 Step 2: waive, extend, option, renounce compute functions
export * from './mutationPipeline.compute.signings.playerOps';


export const MANUAL_EXCEPTION_MUTATION_KEYS = [
  'mle',
  'tpmle',
  'taxpayerMle',
  'tpMle',
  'miniMle',
  'nonTaxpayerMle',
  'fullMLE',
  'bae',
  'biAnnual',
  'room',
  'roomMLE',
  'roommle',
  'rmle',
] as const;
export const MANUAL_EXCEPTION_MUTATION_KEY_SET = new Set<string>(
  MANUAL_EXCEPTION_MUTATION_KEYS
);

export function mergeManualExceptionSnapshot(
  existingExceptions: unknown,
  editedExceptions: unknown
): ArchitectMutationExceptions {
  const existingBuckets =
    toMutationExceptionPreserveOnlyBuckets(existingExceptions);
  const editedBuckets =
    toMutationExceptionPreserveOnlyBuckets(editedExceptions);
  const mergedPreserveOnlyBuckets: MutationExceptionPreserveOnlyBuckets = {};

  for (const [key, value] of Object.entries(existingBuckets || {})) {
    if (!MANUAL_EXCEPTION_MUTATION_KEY_SET.has(key)) {
      mergedPreserveOnlyBuckets[key] = value;
    }
  }

  if (editedBuckets) {
    Object.assign(mergedPreserveOnlyBuckets, editedBuckets);
  }

  return normalizeMutationExceptionsFromIngress(mergedPreserveOnlyBuckets);
}

/**
 * Compute set exceptions result (Phase 27)
 *
 * Replaces only the editable exception subset while preserving untouched
 * non-editable buckets such as canonical TPE storage.
 */
export function computeSetExceptionsResult({
  payload,
  currentState,
  seasonId,
  timestamp,
  asOfDate = null,
}: ComputeMutationParamsWithCurrentState<
  MutationTeamOnlyCurrentState,
  MutationPayloadInputByType['setExceptions']
> & { asOfDate?: string | number | null }): ComputeResultLike {
  const { team } = requireBasicTeamState(currentState, 'setExceptions');
  const { teamCode } = payload;

  if (payload.exceptions !== null && payload.exceptions !== undefined) {
    if (
      typeof payload.exceptions !== 'object' ||
      Array.isArray(payload.exceptions)
    ) {
      return {
        success: false,
        error: 'Invalid exceptions payload: must be an object or null',
      };
    }
  }

  const updatedTeam = {
    ...team,
    exceptions: mergeManualExceptionSnapshot(
      team?.exceptions,
      payload.exceptions
    ),
  };

  updatedTeam.source = {
    ...getTeamSourceRecord(updatedTeam.source),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };
  updatedTeam.totals = synchronizeTeamTotalsSnapshotOrTeam(
    updatedTeam,
    toEndYear(seasonId),
    asOfDate
  ).totals;

  return {
    success: true,
    teamUpdates: [{ teamCode, team: updatedTeam }],
    playerUpdates: [],
    metadata: {
      actionType: 'setExceptions',
      teamCode,
      exceptionChanges:
        Array.isArray(payload.exceptionChanges) &&
        payload.exceptionChanges.length
          ? payload.exceptionChanges
          : ['Exceptions updated'],
      timestamp,
    },
  };
}
