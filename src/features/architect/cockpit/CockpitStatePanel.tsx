/**
 * FILE: src/features/architect/cockpit/CockpitStatePanel.tsx
 * PURPOSE: Full-viewport loading, empty, and error states for Architect routes.
 * OWNERSHIP: Feature: architect/cockpit
 */
import type { ReactNode } from 'react';

export type CockpitStateVariant = 'loading' | 'empty' | 'error';

interface CockpitStatePanelProps {
  variant: CockpitStateVariant;
  title: string;
  message?: string;
  action?: ReactNode;
  testId?: string;
}

export const CockpitStatePanel = ({
  variant,
  title,
  message,
  action,
  testId = 'cockpit-state-panel',
}: CockpitStatePanelProps) => (
  <div
    className="flex h-[100dvh] min-h-0 flex-col items-center justify-center bg-cockpit-void px-6 text-center"
    data-testid={testId}
    data-variant={variant}
    role={variant === 'loading' ? 'status' : 'alert'}
    aria-live="polite"
    aria-busy={variant === 'loading' ? true : undefined}
  >
    {variant === 'loading' ? (
      <div
        className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-cockpit-edge border-t-cockpit-text-secondary"
        aria-hidden
      />
    ) : null}
    <h1 className="text-sm font-semibold uppercase tracking-wide text-cockpit-text-primary">
      {title}
    </h1>
    {message ? (
      <p className="mt-2 max-w-md text-xs leading-relaxed text-cockpit-text-secondary">
        {message}
      </p>
    ) : null}
    {action ? <div className="mt-4">{action}</div> : null}
  </div>
);
