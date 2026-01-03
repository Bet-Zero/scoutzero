// src/features/architect/tradeMachine/ValidationStateHeader.jsx
// Purpose: Displays validation state pill and mode legend at top of Trade Machine
// Ownership: Trade Machine Team
// History:
//   - Jan 2026: Created for UX clarity (Task A from UX/Mode Legend requirement)

import React from 'react';

/**
 * MODE_TAGS defines the 4 display modes used in Trade Machine.
 * Each section in Validation Details uses one of these tags to indicate its purpose.
 */
export const MODE_TAGS = {
  OFFICIAL: {
    label: 'Official (Validator)',
    color: 'bg-blue-600/30 text-blue-300 border-blue-500/50',
    description: 'Authoritative validator results',
  },
  SETUP: {
    label: 'Setup',
    color: 'bg-neutral-600/30 text-neutral-300 border-neutral-500/50',
    description: 'Configuration and team selection',
  },
  EXPLORATORY: {
    label: 'Exploratory',
    color: 'bg-amber-600/30 text-amber-300 border-amber-500/50',
    description: 'What-if calculations (sandbox)',
  },
  DEBUG: {
    label: 'Debug',
    color: 'bg-purple-600/30 text-purple-300 border-purple-500/50',
    description: 'Developer-only diagnostic data',
  },
};

/**
 * ModeTag renders a small pill for section headers indicating Official/Exploratory/Debug mode.
 */
export const ModeTag = ({ mode }) => {
  const tag = MODE_TAGS[mode];
  if (!tag) return null;
  return (
    <span
      className={`px-2 py-0.5 text-[10px] font-medium rounded border ${tag.color}`}
      title={tag.description}
    >
      {tag.label}
    </span>
  );
};

/**
 * ValidationStatePill shows current validation state: Not validated / Validating... / Validated + timestamp
 */
const ValidationStatePill = ({ hasValidatorResult, isValidating, validatedAt }) => {
  if (isValidating) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-600/20 text-blue-300 border border-blue-500/30">
        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
        Validating…
      </span>
    );
  }

  if (hasValidatorResult) {
    const timeStr = validatedAt
      ? new Date(validatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-600/20 text-green-300 border border-green-500/30">
        <span className="w-2 h-2 rounded-full bg-green-400" />
        Validated{timeStr && ` at ${timeStr}`}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-neutral-600/20 text-neutral-400 border border-neutral-500/30">
      <span className="w-2 h-2 rounded-full bg-neutral-500" />
      Not validated
    </span>
  );
};

/**
 * ModeLegend renders a compact legend explaining the 4 mode tags.
 */
const ModeLegend = ({ compact = true }) => {
  const modes = compact
    ? [MODE_TAGS.OFFICIAL, MODE_TAGS.SETUP, MODE_TAGS.EXPLORATORY, MODE_TAGS.DEBUG]
    : Object.values(MODE_TAGS);

  return (
    <div className="flex flex-wrap items-center gap-2 text-[10px]">
      {modes.map((tag) => (
        <span
          key={tag.label}
          className={`px-1.5 py-0.5 rounded border ${tag.color}`}
          title={tag.description}
        >
          {tag.label}
        </span>
      ))}
    </div>
  );
};

/**
 * ValidationStateHeader - Top banner showing validation state and mode legend.
 * Displays:
 *   - Validation State pill (Not validated / Validating... / Validated + timestamp)
 *   - Mode legend with 4 tags and their meanings
 */
const ValidationStateHeader = ({
  hasValidatorResult = false,
  isValidating = false,
  validatedAt = null,
  showLegend = true,
}) => {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 mb-4 bg-[#0a0a0a] border border-white/10 rounded-lg"
      data-testid="validation-state-header"
    >
      <div className="flex items-center gap-3">
        <span className="text-xs text-white/50 font-medium">Validation:</span>
        <ValidationStatePill
          hasValidatorResult={hasValidatorResult}
          isValidating={isValidating}
          validatedAt={validatedAt}
        />
      </div>
      {showLegend && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40">Mode legend:</span>
          <ModeLegend />
        </div>
      )}
    </div>
  );
};

export default ValidationStateHeader;
