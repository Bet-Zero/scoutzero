/**
 * FILE: src/features/ranker/RankerPanel.tsx
 * PURPOSE: Shared pane, field and chip styles for the Player Ranker pool workbench
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-24: Created for the pool workbench layout
 *
 * LINKS:
 *  - Used in: PoolWorkbench.tsx, PoolToolbar.tsx, PoolPanel.tsx, ToolbarMenu.tsx
 */
import React from 'react';

type PaneProps = React.HTMLAttributes<HTMLElement> & {
  children: React.ReactNode;
};

// A workbench column: fixed height on wide screens, its body scrolls inside
export const Pane = ({ children, className = '', ...rest }: PaneProps) => (
  <section
    className={`flex flex-col min-h-0 min-w-0 rounded-xl bg-white/[0.03] border border-white/[0.07] ${className}`}
    {...rest}
  >
    {children}
  </section>
);

export const PaneHeader = ({
  title,
  detail,
  aside = null,
}: {
  title: string;
  detail?: React.ReactNode;
  aside?: React.ReactNode;
}) => (
  <div className="flex flex-shrink-0 items-center justify-between gap-3 px-4 py-3 border-b border-white/[0.06]">
    <div className="min-w-0">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      {detail && <p className="text-xs text-white/40 mt-0.5">{detail}</p>}
    </div>
    {aside && (
      <div className="flex flex-shrink-0 items-center gap-3">{aside}</div>
    )}
  </div>
);

// Shared look for the workbench's text inputs and selects
export const fieldClass =
  'h-9 bg-white/[0.05] text-white text-sm rounded-lg border border-white/[0.1] focus:outline-none focus:border-white/30 transition-colors';

// Outlined toolbar button; `on` marks an open or active control
export const toolbarButtonClass = (on = false) =>
  `inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium border whitespace-nowrap transition-colors ${
    on
      ? 'border-white/50 bg-white/[0.08] text-white'
      : 'border-white/[0.12] text-white/65 hover:text-white hover:border-white/30'
  }`;

// Toggle chip (Top-N presets)
export const chipClass = (selected: boolean) =>
  `h-9 px-3 rounded-lg text-xs font-medium border transition-colors ${
    selected
      ? 'border-white/60 bg-white/10 text-white'
      : 'border-white/[0.1] text-white/55 hover:text-white hover:border-white/25'
  }`;
