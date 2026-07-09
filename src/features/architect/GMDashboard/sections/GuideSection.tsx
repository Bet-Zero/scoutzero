/**
 * FILE: src/features/architect/GMDashboard/sections/GuideSection.tsx
 * PURPOSE: Stage 4B read-only Front Office Guide tab.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * Pure render component. Receives a Stage4GuidedAnswersViewModel and a single
 * onNavigate callback. No mutation callbacks, no Firestore reads, no
 * freeform input. No "ask a question" text box. Answers are grouped by family.
 */

import React from 'react';
import type {
  Stage4AnswerStatus,
  Stage4BlockingConstraint,
  Stage4DeferredReason,
  Stage4EvidenceChip,
  Stage4GuidedAnswer,
  Stage4GuidedAnswersViewModel,
  Stage4AuthorityLabel,
  Stage4NavigationTarget,
  Stage4NavigationTargetId,
  Stage4QuestionFamily,
  Stage4Severity,
} from '@/features/architect/guidedQuestions';
import {
  describeGuideObjective,
  buildTradeOpenRequest,
  type FollowThroughContext,
  type TradeObjective,
  type TradeOpenRequest,
} from '@/features/architect/cockpit';

const TRADE_OBJECTIVES: ReadonlySet<TradeObjective> = new Set([
  'solve-cap',
  'reduce-tax',
  'clear-first-apron',
  'clear-second-apron',
  'avoid-hard-cap',
  'use-exception',
]);

interface GuideSectionProps {
  viewModel: Stage4GuidedAnswersViewModel;
  onNavigate: (target: Stage4NavigationTargetId) => void;
  /** Follow-through launch context (Slice 5): drives the objective banner. */
  followThroughContext?: FollowThroughContext | null;
  /** Route to the Trade overlay with a context (Guide routes, never mutates). */
  onOpenTradeWithRequest?: (request: TradeOpenRequest) => void;
}

const FAMILY_LABELS: Record<Stage4QuestionFamily, string> = {
  'team-status': 'Team Status',
  constraints: 'Constraints',
  scenario: 'Scenario',
  'post-action': 'Post-Action',
  navigation: 'Navigation',
};

const FAMILY_ORDER: Stage4QuestionFamily[] = [
  'team-status',
  'constraints',
  'scenario',
  'post-action',
  'navigation',
];

const SEVERITY_CLASS: Record<Stage4Severity, string> = {
  info: 'border-cockpit-edge bg-cockpit-slab',
  success: 'border-cockpit-safe/30 bg-cockpit-safe/[0.06]',
  warning: 'border-cockpit-watch/30 bg-cockpit-watch/[0.06]',
  danger: 'border-cockpit-danger/30 bg-cockpit-danger/[0.06]',
};

// Title tint only — the body copy stays neutral for readability. State is
// carried by the card border and the status chip, not by washing the whole
// card in a status color.
const SEVERITY_TEXT: Record<Stage4Severity, string> = {
  info: 'text-cockpit-text-primary',
  success: 'text-cockpit-safe',
  warning: 'text-cockpit-watch',
  danger: 'text-cockpit-danger',
};

const STATUS_LABEL: Record<Stage4AnswerStatus, string> = {
  available: 'Available',
  partial: 'Partial',
  deferred: 'Deferred',
  unavailable: 'Unavailable',
};

const STATUS_CHIP_CLASS: Record<Stage4AnswerStatus, string> = {
  available: 'bg-cockpit-safe/10 text-cockpit-safe border-cockpit-safe/30',
  partial: 'bg-cockpit-watch/10 text-cockpit-watch border-cockpit-watch/30',
  deferred: 'bg-white/5 text-cockpit-text-muted border-cockpit-edge',
  unavailable: 'bg-white/5 text-cockpit-text-ghost border-cockpit-edge',
};

const CHIP_SEVERITY_CLASS: Record<Stage4Severity, string> = {
  info: 'bg-cockpit-inlay text-cockpit-text-secondary border-cockpit-edge',
  success: 'bg-cockpit-safe/10 text-cockpit-safe border-cockpit-safe/30',
  warning: 'bg-cockpit-watch/10 text-cockpit-watch border-cockpit-watch/30',
  danger: 'bg-cockpit-danger/10 text-cockpit-danger border-cockpit-danger/30',
};

const AUTHORITY_LABEL_TEXT: Record<Stage4AuthorityLabel, string> = {
  'committed-world': 'Saved world',
  'committed-world / current-season': 'Saved world / current season',
  'committed-world / event-derived': 'Saved world / event history',
  'committed-world / session-scoped': 'Current session',
  derived: 'Derived',
  sandbox: 'Sandbox',
  unavailable: 'Unavailable',
  deferred: 'Deferred',
  'navigation-only': 'Navigation only',
};

const formatAuthorityLabel = (label: string) =>
  AUTHORITY_LABEL_TEXT[label as Stage4AuthorityLabel] ?? label;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const AuthorityChip = ({ label }: { label: string }) => (
  <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-cockpit-inlay text-cockpit-text-muted border-cockpit-edge uppercase tracking-wide">
    {formatAuthorityLabel(label)}
  </span>
);

const StatusChip = ({ status }: { status: Stage4AnswerStatus }) => (
  <span
    data-testid="guide-status-chip"
    className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-wide ${STATUS_CHIP_CLASS[status]}`}
  >
    {STATUS_LABEL[status]}
  </span>
);

const EvidenceChipRow = ({ chip }: { chip: Stage4EvidenceChip }) => {
  const severityClass = chip.severity
    ? CHIP_SEVERITY_CLASS[chip.severity]
    : CHIP_SEVERITY_CLASS.info;
  return (
    <span
      data-testid="guide-evidence-chip"
      className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded border ${severityClass}`}
    >
      <span>{chip.label}</span>
      <AuthorityChip label={chip.authority} />
    </span>
  );
};

const BlockingConstraintPill = ({
  constraint,
}: {
  constraint: Stage4BlockingConstraint;
}) => (
  <span
    data-testid="guide-blocking-constraint"
    className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded border ${CHIP_SEVERITY_CLASS[constraint.severity]}`}
  >
    <span>{constraint.label}</span>
    <AuthorityChip label={constraint.authority} />
  </span>
);

const DeferredReasonRow = ({ reason }: { reason: Stage4DeferredReason }) => (
  <li
    className="text-xs text-cockpit-text-muted"
    data-testid="guide-deferred-reason"
  >
    <span>{reason.reason}</span>{' '}
    <AuthorityChip label={reason.authority} />
  </li>
);

interface NavigationButtonProps {
  target: Stage4NavigationTarget;
  onNavigate: (id: Stage4NavigationTargetId) => void;
}

const NavigationButton = ({ target, onNavigate }: NavigationButtonProps) => (
  <button
    type="button"
    onClick={() => onNavigate(target.id)}
    className="text-xs px-2.5 py-1 rounded border border-cockpit-edge bg-cockpit-slab hover:bg-cockpit-raised text-cockpit-text-secondary hover:text-cockpit-text-primary transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-cockpit-info/50"
    data-testid={`guide-nav-${target.id}`}
    title="Navigation only — opens the existing surface"
    aria-label={`${target.label} (navigation only)`}
  >
    {target.label}
  </button>
);

const AnswerCard = ({
  answer,
  onNavigate,
}: {
  answer: Stage4GuidedAnswer;
  onNavigate: (id: Stage4NavigationTargetId) => void;
}) => (
  <div
    className={`rounded-md border px-4 py-3 space-y-2 ${SEVERITY_CLASS[answer.severity]}`}
    data-testid={`guide-answer-${answer.id}`}
  >
    <div className="flex flex-wrap items-center gap-2">
      <h4 className={`text-sm font-semibold ${SEVERITY_TEXT[answer.severity]}`}>
        {answer.title}
      </h4>
      <StatusChip status={answer.status} />
    </div>

    <p
      className="text-xs text-cockpit-text-secondary"
      data-testid="guide-short-answer"
    >
      {answer.shortAnswer}
    </p>

    {answer.evidence.length > 0 && (
      <div className="flex flex-wrap gap-1.5">
        {answer.evidence.map((chip, i) => (
          <EvidenceChipRow key={`${answer.id}-chip-${i}`} chip={chip} />
        ))}
      </div>
    )}

    {answer.blockingConstraints.length > 0 && (
      <div className="flex flex-wrap gap-1.5">
        {answer.blockingConstraints.map((c, i) => (
          <BlockingConstraintPill
            key={`${answer.id}-blocker-${i}`}
            constraint={c}
          />
        ))}
      </div>
    )}

    {answer.deferredReasons.length > 0 && (
      <ul
        className="space-y-0.5 pt-1"
        data-testid="guide-deferred-reasons"
      >
        {answer.deferredReasons.map((r, i) => (
          <DeferredReasonRow key={`${answer.id}-reason-${i}`} reason={r} />
        ))}
      </ul>
    )}

    {answer.navigationTargets.length > 0 && (
      <div className="flex flex-wrap gap-1.5 pt-1">
        {answer.navigationTargets.map((t) => (
          <NavigationButton
            key={`${answer.id}-nav-${t.id}`}
            target={t}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    )}
  </div>
);

const FamilyGroup = ({
  family,
  answers,
  onNavigate,
}: {
  family: Stage4QuestionFamily;
  answers: Stage4GuidedAnswer[];
  onNavigate: (id: Stage4NavigationTargetId) => void;
}) => {
  if (answers.length === 0) return null;
  return (
    <section
      className="space-y-2"
      data-testid={`guide-family-${family}`}
    >
      <h3 className="text-xs font-extrabold text-cockpit-text-muted uppercase tracking-wide">
        {FAMILY_LABELS[family]}
      </h3>
      <div className="space-y-2">
        {answers.map((answer) => (
          <AnswerCard
            key={answer.id}
            answer={answer}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </section>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const GuideSection: React.FC<GuideSectionProps> = ({
  viewModel,
  onNavigate,
  followThroughContext = null,
  onOpenTradeWithRequest,
}) => {
  const objective = describeGuideObjective(followThroughContext);
  const tradeObjective =
    followThroughContext?.warningType &&
    TRADE_OBJECTIVES.has(followThroughContext.warningType as TradeObjective)
      ? (followThroughContext.warningType as TradeObjective)
      : null;
  if (!viewModel.scope.teamCode) {
    return (
      <div
        className="rounded-md border border-cockpit-edge bg-cockpit-slab px-4 py-6 text-center space-y-2"
        data-testid="guide-unavailable-state"
      >
        <p className="text-sm font-semibold text-cockpit-text-secondary">
          Guide is unavailable
        </p>
        <p className="text-xs text-cockpit-text-muted">
          {viewModel.status.workspaceError ||
            'Active team identity is not available.'}
        </p>
      </div>
    );
  }

  const grouped: Record<Stage4QuestionFamily, Stage4GuidedAnswer[]> = {
    'team-status': [],
    constraints: [],
    scenario: [],
    'post-action': [],
    navigation: [],
  };
  for (const answer of viewModel.answers) {
    grouped[answer.family].push(answer);
  }

  return (
    <div className="space-y-4" data-testid="guide-section">
      <header
        className="rounded-md border border-cockpit-edge bg-cockpit-slab px-4 py-3 space-y-1"
        data-testid="guide-scope"
      >
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="text-sm font-semibold text-cockpit-text-primary">
            Front Office Guide
          </h2>
          <span className="text-[11px] text-cockpit-text-muted">
            Read-only · Navigation only
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AuthorityChip
            label={viewModel.scope.sandbox ? 'Sandbox' : 'Committed world'}
          />
          <span className="text-sm font-semibold text-cockpit-text-primary">
            {viewModel.scope.teamCode}
          </span>
          {viewModel.scope.season && (
            <span className="text-xs text-cockpit-text-muted">
              Season {viewModel.scope.season}
            </span>
          )}
          {viewModel.scope.sandbox && (
            <span className="text-xs text-cockpit-text-muted italic">
              Scenario answers require an active world.
            </span>
          )}
        </div>
      </header>

      {objective ? (
        <div
          className="rounded-md border border-cockpit-info/25 bg-cockpit-info/[0.06] px-4 py-2"
          data-testid="guide-objective-banner"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-cockpit-info">
                Objective
              </span>
              <span
                className="text-sm font-semibold text-cockpit-text-primary"
                data-testid="guide-objective-text"
              >
                {objective}
              </span>
            </div>
            {tradeObjective && onOpenTradeWithRequest ? (
              <button
                type="button"
                onClick={() =>
                  onOpenTradeWithRequest(
                    buildTradeOpenRequest({
                      source: 'guide',
                      objective: tradeObjective,
                    })
                  )
                }
                className="text-xs px-2.5 py-1 rounded border border-cockpit-edge bg-cockpit-slab hover:bg-cockpit-raised text-cockpit-text-secondary hover:text-cockpit-text-primary transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-cockpit-info/50"
                data-testid="guide-objective-open-trade"
              >
                Open Trade
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {FAMILY_ORDER.map((family) => (
        <FamilyGroup
          key={family}
          family={family}
          answers={grouped[family]}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
};
