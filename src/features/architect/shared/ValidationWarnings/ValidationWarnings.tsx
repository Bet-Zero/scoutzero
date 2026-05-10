/**
 * ValidationWarnings
 *
 * Displays CBA validation feedback in the contract modal.
 * Shows info/warnings in advisory mode, errors block on confirm.
 */
import React from 'react';

type ValidationMessageLike = {
  severity?: string;
  message?: string;
};

type ValidationWarningsProps = {
  warnings?: ValidationMessageLike[];
  errors?: ValidationMessageLike[];
  showErrors?: boolean;
};

const SEVERITY_STYLES = {
  info: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-300',
    icon: 'ℹ️',
  },
  warning: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-300',
    icon: '⚠️',
  },
  error: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-300',
    icon: '❌',
  },
  success: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    text: 'text-green-300',
    icon: '✓',
  },
};

export const ValidationWarnings = ({
  warnings = [],
  errors = [],
  showErrors = false,
}: ValidationWarningsProps) => {
  // Combine warnings and conditionally show errors
  const allMessages = [
    ...warnings,
    ...(showErrors ? errors : []),
  ];

  if (allMessages.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 mt-4">
      {allMessages.map((item, idx) => {
        const style =
          SEVERITY_STYLES[item.severity as keyof typeof SEVERITY_STYLES] ||
          SEVERITY_STYLES.info;

        return (
          <div
            key={idx}
            className={`flex items-start gap-2 px-3 py-2 rounded border ${style.bg} ${style.border}`}
          >
            <span className="shrink-0 text-sm">{style.icon}</span>
            <span className={`text-xs ${style.text}`}>{item.message}</span>
          </div>
        );
      })}

      {/* Show count of hidden errors when not in strict mode */}
      {!showErrors && errors.length > 0 && (
        <div className="text-xs text-red-400/60 italic px-1">
          {errors.length} issue{errors.length > 1 ? 's' : ''} will block confirmation
        </div>
      )}
    </div>
  );
};

