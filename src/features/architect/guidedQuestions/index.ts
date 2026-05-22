/**
 * FILE: src/features/architect/guidedQuestions/index.ts
 * PURPOSE: Public API for the Stage 4 Front Office Guide module.
 * OWNERSHIP: Feature: architect/guidedQuestions
 */

export type {
  Stage4AnswerStatus,
  Stage4Severity,
  Stage4AuthorityLabel,
  Stage4NavigationTargetId,
  Stage4QuestionFamily,
  Stage4EvidenceChip,
  Stage4NavigationTarget,
  Stage4BlockingConstraint,
  Stage4DeferredReason,
  Stage4GuidedAnswer,
  Stage4GuidedAnswersScope,
  Stage4GuidedAnswersStatus,
  Stage4GuidedAnswersViewModel,
} from './types';

export {
  STAGE4_QUESTION_CATALOG,
  STAGE4_QUESTION_IDS,
  getCatalogEntry,
} from './questionCatalog';
export type { Stage4QuestionCatalogEntry } from './questionCatalog';

export {
  deriveGuidedAnswers,
} from './deriveGuidedAnswers';
export type { DeriveGuidedAnswersInput } from './deriveGuidedAnswers';

export type { ComparisonSourceStatus } from './answerScenario';
