/**
 * FILE: src/features/architect/guidedQuestions/types.ts
 * PURPOSE: Stage 4 Front Office Guide types — authority-labeled, deterministic guided answers.
 * OWNERSHIP: Feature: architect/guidedQuestions
 *
 * No React, no Firestore, no mutation callbacks, no validators with synthetic input.
 * Every guided answer carries explicit authority labels. The view model is read-only.
 */

export type Stage4AnswerStatus =
  | 'available'
  | 'partial'
  | 'deferred'
  | 'unavailable';

export type Stage4Severity = 'info' | 'success' | 'warning' | 'danger';

export type Stage4AuthorityLabel =
  | 'committed-world'
  | 'committed-world / current-season'
  | 'committed-world / event-derived'
  | 'committed-world / session-scoped'
  | 'derived'
  | 'sandbox'
  | 'unavailable'
  | 'deferred'
  | 'navigation-only';

export type Stage4NavigationTargetId =
  | 'roster'
  | 'cap'
  | 'capfull'
  | 'trade'
  | 'fa'
  | 'offseason'
  | 'history'
  | 'compare'
  | 'guide';

export type Stage4QuestionFamily =
  | 'team-status'
  | 'constraints'
  | 'scenario'
  | 'post-action'
  | 'navigation';

export interface Stage4EvidenceChip {
  /** Short label, e.g. "Cap Space: $4.2M" or "Above 2nd Apron". */
  label: string;
  /** Authority source for this chip's value. */
  authority: Stage4AuthorityLabel;
  /** Optional severity hint for chip styling. */
  severity?: Stage4Severity;
}

export interface Stage4NavigationTarget {
  id: Stage4NavigationTargetId;
  label: string;
  /** Navigation-only intent. Stage 4 never includes a mutation callback. */
  intent: 'navigate';
}

export interface Stage4BlockingConstraint {
  /** Short label, e.g. "Above second apron — hard-cap rules apply". */
  label: string;
  authority: Stage4AuthorityLabel;
  severity: Stage4Severity;
}

export interface Stage4DeferredReason {
  /** Why this question (or part of it) is deferred. */
  reason: string;
  /** Authority source explaining the deferral, if any. */
  authority: Stage4AuthorityLabel;
}

export interface Stage4GuidedAnswer {
  /** Stable id for this question. Matches the v1 supported-question table. */
  id: string;
  /** Question text shown to the user. */
  title: string;
  /** Family grouping (A–F). */
  family: Stage4QuestionFamily;
  status: Stage4AnswerStatus;
  /** One- or two-sentence textual answer. Never freeform; always derived from inputs. */
  shortAnswer: string;
  /** Evidence chips backing the short answer. */
  evidence: Stage4EvidenceChip[];
  /** Authority labels relevant to this answer (deduplicated). */
  authorityLabels: Stage4AuthorityLabel[];
  /** Recommended navigation targets. Navigation-only; no mutation callbacks. */
  navigationTargets: Stage4NavigationTarget[];
  /** Constraints that currently block or warn against further moves. */
  blockingConstraints: Stage4BlockingConstraint[];
  /** Reasons this question (or parts of it) cannot be answered. */
  deferredReasons: Stage4DeferredReason[];
  /** Related question ids that the user may want to consult next. */
  relatedQuestionIds: string[];
  /** Severity hint for the overall answer (drives the answer card chrome). */
  severity: Stage4Severity;
}

export interface Stage4GuidedAnswersScope {
  teamCode: string | null;
  worldId: string | null;
  sandbox: boolean;
  season: number | null;
  authority: 'committed-world' | 'sandbox';
}

export interface Stage4GuidedAnswersStatus {
  workspaceLoading: boolean;
  workspaceError: string | null;
  comparisonStatus: 'sandbox' | 'loading' | 'error' | 'available';
}

export interface Stage4GuidedAnswersViewModel {
  /** Scope this answer set is bound to. */
  scope: Stage4GuidedAnswersScope;
  /** Status of the underlying inputs. */
  status: Stage4GuidedAnswersStatus;
  /** The 15 v1 guided answers, in canonical question-id order. */
  answers: Stage4GuidedAnswer[];
}
