/**
 * FILE: src/features/ranker/RankerPanel.tsx
 * PURPOSE: Shared card and heading styles for the Player Ranker pool builder panels
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-23: Created for the pool builder layout pass
 *
 * LINKS:
 *  - Used in: PoolSourceControls.tsx, FilterPoolPanel.tsx, PoolPanel.tsx, SavedSessionsPanel.tsx
 */
import React from 'react';

type RankerPanelProps = React.HTMLAttributes<HTMLElement> & {
  title: string;
  // Short line under the title saying what the panel is for
  description?: string;
  // Controls or counts shown on the right of the heading
  aside?: React.ReactNode;
  children: React.ReactNode;
};

export const RankerPanel = ({
  title,
  description,
  aside = null,
  children,
  className = '',
  ...rest
}: RankerPanelProps) => (
  <section
    className={`rounded-xl bg-white/[0.03] border border-white/[0.07] ${className}`}
    {...rest}
  >
    <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {description && (
          <p className="text-xs text-white/40 mt-0.5">{description}</p>
        )}
      </div>
      {aside && <div className="flex-shrink-0">{aside}</div>}
    </div>
    <div className="px-5 pb-5">{children}</div>
  </section>
);

// Small uppercase label above a control
export const FieldLabel = ({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor?: string;
}) => (
  <label
    htmlFor={htmlFor}
    className="block text-[10px] font-semibold tracking-[0.1em] uppercase text-white/35 mb-1.5"
  >
    {children}
  </label>
);

// Shared look for the builder's text inputs and selects
export const fieldClass =
  'bg-white/[0.05] text-white text-sm rounded-lg border border-white/[0.1] focus:outline-none focus:border-white/30 transition-colors';

// Toggle chip (Top-N presets and similar single-choice options)
export const chipClass = (selected: boolean) =>
  `h-9 px-3 rounded-lg text-xs font-medium border transition-colors ${
    selected
      ? 'border-white/60 bg-white/10 text-white'
      : 'border-white/[0.1] text-white/55 hover:text-white hover:border-white/25'
  }`;
