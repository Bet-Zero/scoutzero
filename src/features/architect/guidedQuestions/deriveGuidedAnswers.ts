/**
 * FILE: src/features/architect/guidedQuestions/deriveGuidedAnswers.ts
 * PURPOSE: Stage 4B pure aggregator — composes the 15 v1 guided answers.
 * OWNERSHIP: Feature: architect/guidedQuestions
 *
 * Pure function. No React, no Firestore, no mutation callbacks, no validators
 * called with synthetic input. Inputs come exclusively from existing
 * authoritative seams (workspace context, comparison view model, post-action
 * receipt).
 */

import type { ArchitectWorkspaceContext } from '@/features/architect/GMDashboard/hooks/useArchitectWorkspaceContext';
import type { Stage3ComparisonViewModel } from '@/features/architect/comparison/types';
import type { ArchitectPostActionReceipt } from '@/features/architect/GMDashboard/postActionHandoff/types';
import { STAGE4_QUESTION_CATALOG } from './questionCatalog';
import type {
  Stage4GuidedAnswer,
  Stage4GuidedAnswersScope,
  Stage4GuidedAnswersStatus,
  Stage4GuidedAnswersViewModel,
} from './types';
import {
  buildCapPostureAnswer,
  buildExceptionsAvailableAnswer,
  buildRosterCountAnswer,
} from './answerTeamStatus';
import {
  buildCurrentConstraintsAnswer,
  buildInspectFirstAnswer,
} from './answerConstraints';
import {
  buildComparisonAvailableAnswer,
  buildComparisonDeferredAnswer,
  buildWorldChangesSummaryAnswer,
  type ComparisonSourceStatus,
} from './answerScenario';
import {
  buildLastActionInspectAnswer,
  buildLastActionSummaryAnswer,
  buildRecentCommittedEventAnswer,
} from './answerPostAction';
import {
  buildNavigationCapAnswer,
  buildNavigationComparisonAnswer,
  buildNavigationHistoryAnswer,
  buildNavigationRosterAnswer,
} from './answerNavigation';

export interface DeriveGuidedAnswersInput {
  workspaceContext: ArchitectWorkspaceContext;
  comparisonStatus: ComparisonSourceStatus;
  comparisonViewModel: Stage3ComparisonViewModel | null;
  comparisonError: string | null;
  postActionReceipt: ArchitectPostActionReceipt | null;
}

function buildScope(
  input: DeriveGuidedAnswersInput
): Stage4GuidedAnswersScope {
  const teamCode =
    input.workspaceContext.team.status === 'available'
      ? input.workspaceContext.team.id
      : null;
  const worldId =
    input.workspaceContext.world.status === 'sandbox'
      ? null
      : input.workspaceContext.world.id;
  const sandbox = worldId === null;
  const season = input.workspaceContext.seasons.selectedViewingSeason;
  return {
    teamCode,
    worldId,
    sandbox,
    season,
    authority: sandbox ? 'sandbox' : 'committed-world',
  };
}

function buildStatus(
  input: DeriveGuidedAnswersInput
): Stage4GuidedAnswersStatus {
  return {
    workspaceLoading: input.workspaceContext.status.isLoading,
    workspaceError: input.workspaceContext.status.errorMessage,
    comparisonStatus: input.comparisonStatus,
  };
}

export function deriveGuidedAnswers(
  input: DeriveGuidedAnswersInput
): Stage4GuidedAnswersViewModel {
  const scope = buildScope(input);
  const status = buildStatus(input);

  const scenarioInputs = {
    comparisonStatus: input.comparisonStatus,
    comparisonViewModel: input.comparisonViewModel,
    comparisonError: input.comparisonError,
  };

  const postActionInputs = {
    receipt: input.postActionReceipt,
    comparisonViewModel: input.comparisonViewModel,
    sandbox: scope.sandbox,
  };

  const byId: Record<string, Stage4GuidedAnswer> = {
    'cap-posture': buildCapPostureAnswer(input.workspaceContext),
    'roster-count': buildRosterCountAnswer(input.workspaceContext),
    'exceptions-available': buildExceptionsAvailableAnswer(input.workspaceContext),
    'current-constraints': buildCurrentConstraintsAnswer(input.workspaceContext),
    'inspect-first': buildInspectFirstAnswer(input.workspaceContext),
    'world-changes-summary': buildWorldChangesSummaryAnswer(scenarioInputs),
    'comparison-available': buildComparisonAvailableAnswer(scenarioInputs),
    'comparison-deferred': buildComparisonDeferredAnswer(scenarioInputs),
    'last-action-summary': buildLastActionSummaryAnswer(postActionInputs),
    'last-action-inspect': buildLastActionInspectAnswer(postActionInputs),
    'recent-committed-event': buildRecentCommittedEventAnswer(postActionInputs),
    'navigation-cap': buildNavigationCapAnswer(),
    'navigation-roster': buildNavigationRosterAnswer(),
    'navigation-history': buildNavigationHistoryAnswer(),
    'navigation-comparison': buildNavigationComparisonAnswer(),
  };

  const answers: Stage4GuidedAnswer[] = STAGE4_QUESTION_CATALOG.map(
    (entry) => byId[entry.id]
  );

  return {
    scope,
    status,
    answers,
  };
}
