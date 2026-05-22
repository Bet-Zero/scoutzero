/**
 * FILE: src/features/architect/GMDashboard/hooks/useArchitectGuidedAnswers.ts
 * PURPOSE: Stage 4B thin hook — derives the Front Office Guide view model.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * Composes existing seams only:
 *   - useArchitectWorkspaceContext (Stage 1A)
 *   - useArchitectComparisonViewModel (Stage 3C)
 *   - useArchitectPostActionReceipt (Stage 2B)
 *
 * No new Firestore reads, no new event source, no mutation authority,
 * no validators called with synthetic input.
 */

import { useMemo } from 'react';
import type { ArchitectWorkspaceContext } from './useArchitectWorkspaceContext';
import type { UseArchitectComparisonViewModelResult } from './useArchitectComparisonViewModel';
import type { ArchitectPostActionReceipt } from '../postActionHandoff/types';
import {
  deriveGuidedAnswers,
  type Stage4GuidedAnswersViewModel,
} from '@/features/architect/guidedQuestions';

export interface UseArchitectGuidedAnswersArgs {
  workspaceContext: ArchitectWorkspaceContext;
  comparison: UseArchitectComparisonViewModelResult;
  postActionReceipt: ArchitectPostActionReceipt | null;
}

export function useArchitectGuidedAnswers({
  workspaceContext,
  comparison,
  postActionReceipt,
}: UseArchitectGuidedAnswersArgs): Stage4GuidedAnswersViewModel {
  return useMemo(
    () =>
      deriveGuidedAnswers({
        workspaceContext,
        comparisonStatus: comparison.status,
        comparisonViewModel: comparison.viewModel,
        comparisonError: comparison.error,
        postActionReceipt,
      }),
    [
      workspaceContext,
      comparison.status,
      comparison.viewModel,
      comparison.error,
      postActionReceipt,
    ]
  );
}
