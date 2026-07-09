/**
 * FILE: src/features/architect/guidedQuestions/questionCatalog.ts
 * PURPOSE: Fixed catalog of the 15 Stage 4 v1 Front Office Guide questions.
 * OWNERSHIP: Feature: architect/guidedQuestions
 *
 * No dynamic, freeform, or runtime-generated questions. The catalog is a
 * constant; any change requires a spec update.
 */

import type { Stage4QuestionFamily } from './types';

export interface Stage4QuestionCatalogEntry {
  id: string;
  title: string;
  family: Stage4QuestionFamily;
  /** Sibling question ids commonly consulted together. */
  relatedQuestionIds: string[];
}

export const STAGE4_QUESTION_CATALOG: readonly Stage4QuestionCatalogEntry[] = [
  // Family A — Team Status
  {
    id: 'cap-posture',
    title: 'What is our current cap situation?',
    family: 'team-status',
    relatedQuestionIds: ['current-constraints', 'exceptions-available'],
  },
  {
    id: 'roster-count',
    title: 'How many roster spots are used?',
    family: 'team-status',
    relatedQuestionIds: ['current-constraints'],
  },
  {
    id: 'exceptions-available',
    title: 'Which exceptions are available?',
    family: 'team-status',
    relatedQuestionIds: ['cap-posture', 'current-constraints'],
  },

  // Family B — Constraints
  {
    id: 'current-constraints',
    title: 'What are our current constraints?',
    family: 'constraints',
    relatedQuestionIds: ['cap-posture', 'roster-count', 'inspect-first'],
  },
  {
    id: 'inspect-first',
    title: 'What should I inspect first?',
    family: 'constraints',
    relatedQuestionIds: ['current-constraints'],
  },

  // Family C — Scenario
  {
    id: 'world-changes-summary',
    title: 'What changed in this world?',
    family: 'scenario',
    relatedQuestionIds: ['comparison-available', 'comparison-deferred'],
  },
  {
    id: 'comparison-available',
    title: 'What comparison data is available?',
    family: 'scenario',
    relatedQuestionIds: ['world-changes-summary', 'comparison-deferred'],
  },
  {
    id: 'comparison-deferred',
    title: 'What comparison data is unavailable or deferred?',
    family: 'scenario',
    relatedQuestionIds: ['world-changes-summary', 'comparison-available'],
  },

  // Family D — Post-Action
  {
    id: 'last-action-summary',
    title: 'What just happened?',
    family: 'post-action',
    relatedQuestionIds: ['last-action-inspect', 'recent-committed-event'],
  },
  {
    id: 'last-action-inspect',
    title: 'Where should I inspect the consequences of the last action?',
    family: 'post-action',
    relatedQuestionIds: ['last-action-summary', 'navigation-history'],
  },
  {
    id: 'recent-committed-event',
    title: 'Which recent committed event should I review?',
    family: 'post-action',
    relatedQuestionIds: ['navigation-history', 'last-action-summary'],
  },

  // Family E — Navigation
  {
    id: 'navigation-cap',
    title: 'Where do I inspect cap impact?',
    family: 'navigation',
    relatedQuestionIds: ['cap-posture'],
  },
  {
    id: 'navigation-roster',
    title: 'Where do I inspect roster impact?',
    family: 'navigation',
    relatedQuestionIds: ['roster-count'],
  },
  {
    id: 'navigation-history',
    title: 'Where do I inspect history detail?',
    family: 'navigation',
    relatedQuestionIds: ['recent-committed-event', 'last-action-inspect'],
  },
  {
    id: 'navigation-comparison',
    title: 'Where do I inspect scenario comparison?',
    family: 'navigation',
    relatedQuestionIds: ['world-changes-summary'],
  },
];

export const STAGE4_QUESTION_IDS: readonly string[] = STAGE4_QUESTION_CATALOG.map(
  (entry) => entry.id
);

export function getCatalogEntry(id: string): Stage4QuestionCatalogEntry | null {
  return STAGE4_QUESTION_CATALOG.find((entry) => entry.id === id) ?? null;
}
