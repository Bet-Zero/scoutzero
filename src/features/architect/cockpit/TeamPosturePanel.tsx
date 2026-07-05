/**
 * FILE: src/features/architect/cockpit/TeamPosturePanel.tsx
 * PURPOSE: The single canonical cap-posture surface — status + total/cap/tax/
 *   apron tiles + roster spots. Docked permanently in the cockpit shell so cap
 *   posture is always-on and reads identically on every feature tab.
 * OWNERSHIP: Feature: architect/cockpit
 *
 * Cap posture is staple, must-see information — it lives here, in ONE place,
 * and is never duplicated or restyled per feature (the activity rail is for
 * on-demand records/moves, not staple info).
 *
 * Two orientations, same canonical component:
 *  - 'vertical'   — a left/right dock column (verdict on top, numbers stacked).
 *  - 'horizontal' — a thin full-width band under the TopBar (verdict on the
 *    left, numbers in a row). Kept single-row so it costs as little workbench
 *    height as possible (the Full Cap Table must still fit with no scroll).
 */
import type { ReactNode } from 'react';
import type { ArchitectWorkspaceContext } from '@/features/architect/GMDashboard/hooks/useArchitectWorkspaceContext';
import {
  TeamStatusStrip,
  formatMoney,
  type HardCapCockpitStatus,
} from './TeamStatusStrip';
import {
  deriveCapPosturePanel,
  type CapPosturePanel,
  type TrustPanelTone,
} from './teamPlanTrustPanelModel';

const TONE_CLASSES: Record<TrustPanelTone, string> = {
  safe: 'border-cockpit-safe/30 bg-cockpit-safe/5 text-cockpit-safe',
  info: 'border-cockpit-info/30 bg-cockpit-info/5 text-cockpit-info',
  watch: 'border-cockpit-watch/30 bg-cockpit-watch/5 text-cockpit-watch',
  danger: 'border-cockpit-danger/30 bg-cockpit-danger/5 text-cockpit-danger',
  muted: 'border-cockpit-edge bg-cockpit-inlay text-cockpit-text-muted',
};

const BADGE_CLASSES: Record<TrustPanelTone, string> = {
  safe: 'border-cockpit-safe/30 bg-cockpit-safe/10 text-cockpit-safe',
  info: 'border-cockpit-info/30 bg-cockpit-info/10 text-cockpit-info',
  watch: 'border-cockpit-watch/30 bg-cockpit-watch/10 text-cockpit-watch',
  danger: 'border-cockpit-danger/30 bg-cockpit-danger/10 text-cockpit-danger',
  muted: 'border-cockpit-edge bg-cockpit-slab text-cockpit-text-muted',
};

const PostureBadge = ({
  tone,
  children,
}: {
  tone: TrustPanelTone;
  children: ReactNode;
}) => (
  <span
    className={`inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide leading-4 ${BADGE_CLASSES[tone]}`}
  >
    {children}
  </span>
);

const headlineColorClass = (amount: number) =>
  amount < 0 ? 'text-red-400' : 'text-green-400';

export interface TeamPosturePanelProps {
  workspace: ArchitectWorkspaceContext;
  hardCapStatus?: HardCapCockpitStatus;
  /**
   * 'vertical' = left/right dock column (default). 'horizontal' = thin
   * full-width band under the TopBar.
   */
  orientation?: 'vertical' | 'horizontal';
  onNavigateToCapSheet?: () => void;
}

const UnavailableMessage = ({
  onNavigateToCapSheet,
}: {
  onNavigateToCapSheet?: () => void;
}) => (
  <p
    className="text-xs text-cockpit-text-muted"
    data-testid="cockpit-team-posture-unavailable"
  >
    Cap posture unavailable.{' '}
    {onNavigateToCapSheet ? (
      <button
        type="button"
        onClick={onNavigateToCapSheet}
        className="underline decoration-dotted underline-offset-2 hover:text-cockpit-text-secondary focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
      >
        View Cap Sheet.
      </button>
    ) : null}
  </p>
);

/** The hard-cap detail line, shared by both orientations. */
const HardCapLine = ({ capPosture }: { capPosture: CapPosturePanel }) =>
  capPosture.hardCapLabel ? (
    <div className="rounded border border-cockpit-danger/30 bg-cockpit-danger/5 px-2 py-1 text-[10px] leading-4 text-cockpit-danger">
      <span className="font-semibold">{capPosture.hardCapLabel}</span>
      {capPosture.hardCapDetail ? (
        <span> · {capPosture.hardCapDetail}</span>
      ) : null}
    </div>
  ) : null;

export const TeamPosturePanel = ({
  workspace,
  hardCapStatus,
  orientation = 'vertical',
  onNavigateToCapSheet,
}: TeamPosturePanelProps) => {
  const capUnavailable = workspace.cap.status === 'unavailable';
  const capPosture = deriveCapPosturePanel(workspace, hardCapStatus);
  const isHorizontal = orientation === 'horizontal';

  // ---- Horizontal: thin full-width band under the TopBar ------------------
  if (isHorizontal) {
    return (
      <aside
        data-testid="cockpit-team-posture-panel"
        aria-label="Current cap posture"
        data-orientation="horizontal"
        className="flex w-full shrink-0 items-stretch gap-3 border-b border-cockpit-edge bg-cockpit-slab/40 px-3 py-1"
      >
        {capUnavailable ? (
          <UnavailableMessage onNavigateToCapSheet={onNavigateToCapSheet} />
        ) : (
          <>
            {/* HERO verdict — the ruling you glance at first, on the left. */}
            <div
              className={`flex shrink-0 items-center gap-3 rounded border px-2.5 py-1 ${TONE_CLASSES[capPosture.tone]}`}
              data-testid="cockpit-team-posture-summary"
            >
              <PostureBadge tone={capPosture.tone}>Cap Status</PostureBadge>
              <div className="flex min-w-0 flex-col justify-center">
                <span className="truncate text-[11px] font-semibold uppercase leading-tight tracking-wide text-cockpit-text-primary">
                  {capPosture.statusLabel}
                </span>
                <span className="truncate text-[9px] text-cockpit-text-secondary">
                  {capPosture.rosterLabel}
                </span>
              </div>
              {capPosture.headlineAmount !== null ? (
                <div className="flex items-baseline gap-1.5">
                  <span
                    className={`text-[20px] font-bold leading-none tabular-nums ${headlineColorClass(
                      capPosture.headlineAmount
                    )}`}
                    data-testid="cockpit-team-posture-headline"
                  >
                    {formatMoney(capPosture.headlineAmount)}
                  </span>
                  {capPosture.headlineCaption ? (
                    <span className="text-[9px] uppercase tracking-wide text-cockpit-text-muted">
                      {capPosture.headlineCaption}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            {capPosture.hardCapLabel ? (
              <div className="flex shrink-0 items-center">
                <HardCapLine capPosture={capPosture} />
              </div>
            ) : null}

            {/* Supporting numbers fill the rest of the band. */}
            <div className="min-w-0 flex-1 self-center">
              <TeamStatusStrip
                workspace={workspace}
                hardCapStatus={hardCapStatus}
                orientation="horizontal"
              />
            </div>
          </>
        )}
      </aside>
    );
  }

  // ---- Vertical: left/right dock column -----------------------------------
  return (
    <aside
      data-testid="cockpit-team-posture-panel"
      aria-label="Current cap posture"
      data-orientation="vertical"
      className="flex h-full w-[248px] shrink-0 flex-col gap-2 overflow-y-auto border-r border-cockpit-edge bg-cockpit-slab/40 px-3 py-3"
    >
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cockpit-text-muted">
        Current Posture
      </h2>

      {capUnavailable ? (
        <UnavailableMessage onNavigateToCapSheet={onNavigateToCapSheet} />
      ) : (
        <>
          {/* HERO: the verdict you glance at first — headline status + the one
              binding number, large and bold. Everything below steps down from
              here so the panel reads like a ruling, not a flat stat grid. */}
          <div
            className={`rounded border px-2.5 py-2.5 ${TONE_CLASSES[capPosture.tone]}`}
            data-testid="cockpit-team-posture-summary"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-[12px] font-semibold uppercase leading-tight tracking-wide text-cockpit-text-primary">
                {capPosture.statusLabel}
              </div>
              <PostureBadge tone={capPosture.tone}>Cap Status</PostureBadge>
            </div>

            {capPosture.headlineAmount !== null ? (
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span
                  className={`text-[28px] font-bold leading-none tabular-nums ${headlineColorClass(
                    capPosture.headlineAmount
                  )}`}
                  data-testid="cockpit-team-posture-headline"
                >
                  {formatMoney(capPosture.headlineAmount)}
                </span>
                {capPosture.headlineCaption ? (
                  <span className="text-[10px] uppercase tracking-wide text-cockpit-text-muted">
                    {capPosture.headlineCaption}
                  </span>
                ) : null}
              </div>
            ) : (
              <div className="mt-1 text-[11px] text-cockpit-text-secondary">
                {capPosture.detail}
              </div>
            )}

            <div className="mt-1.5 text-[10px] text-cockpit-text-secondary">
              {capPosture.rosterLabel}
            </div>

            {capPosture.hardCapLabel ? (
              <div className="mt-1.5">
                <HardCapLine capPosture={capPosture} />
              </div>
            ) : null}
          </div>

          <TeamStatusStrip
            workspace={workspace}
            hardCapStatus={hardCapStatus}
            orientation="vertical"
          />
        </>
      )}
    </aside>
  );
};
