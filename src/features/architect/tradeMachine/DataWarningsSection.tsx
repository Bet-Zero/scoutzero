import React, { useState } from 'react';
import { AlertTriangle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { DATA_WARNING_SEVERITY } from '@/features/architect/utils/tradeMachine/utils/dataValidation';
import type {
  DataValidationSummaryLike,
  DataWarningLike,
} from './validationPresentationTypes';

interface DataWarningsSectionProps {
  warnings?: DataWarningLike[];
  summary?: DataValidationSummaryLike | null;
  hasDataIssues?: boolean;
}

export const DataWarningsSection = ({
  warnings = [],
  summary = null,
  hasDataIssues = false,
}: DataWarningsSectionProps) => {
  const [showInfo, setShowInfo] = useState(false);

  if (!hasDataIssues || !Array.isArray(warnings) || warnings.length === 0) {
    return null;
  }

  const errorWarnings = warnings.filter(
    (warning) => warning.severity === DATA_WARNING_SEVERITY.ERROR
  );
  const warningItems = warnings.filter(
    (warning) => warning.severity === DATA_WARNING_SEVERITY.WARNING
  );
  const infoItems = warnings.filter(
    (warning) => warning.severity === DATA_WARNING_SEVERITY.INFO
  );

  const hasErrors = errorWarnings.length > 0;
  const hasWarnings = warningItems.length > 0;
  const hasInfo = infoItems.length > 0;

  return (
    <div className="mt-4 space-y-3">
      {hasErrors && (
        <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4">
          <div className="flex items-start gap-2 mb-2">
            <AlertTriangle
              className="text-red-400 flex-shrink-0 mt-0.5"
              size={18}
            />
            <div className="flex-1">
              <h4 className="font-semibold text-red-300 text-sm mb-1">
                Critical Data Issues ({errorWarnings.length})
              </h4>
              <p className="text-xs text-red-200/70 mb-2">
                These issues prevent accurate trade validation. Please review
                and correct.
              </p>
            </div>
          </div>
          <ul className="space-y-2">
            {errorWarnings.map((warning, index) => (
              <li key={index} className="text-sm text-red-200 pl-6">
                • {warning.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasWarnings && (
        <div className="bg-yellow-900/20 border border-yellow-500/40 rounded-lg p-4">
          <div className="flex items-start gap-2 mb-2">
            <AlertTriangle
              className="text-yellow-400 flex-shrink-0 mt-0.5"
              size={18}
            />
            <div className="flex-1">
              <h4 className="font-semibold text-yellow-300 text-sm mb-1">
                Data Warnings ({warningItems.length})
              </h4>
              <p className="text-xs text-yellow-200/70 mb-2">
                Trade validation can proceed, but these data issues may affect
                accuracy.
              </p>
            </div>
          </div>
          <ul className="space-y-2">
            {warningItems.map((warning, index) => (
              <li key={index} className="text-sm text-yellow-200 pl-6">
                • {warning.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasInfo && (
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setShowInfo(!showInfo)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-900/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Info className="text-blue-400 flex-shrink-0" size={16} />
              <span className="text-sm text-blue-300 font-medium">
                Data Info ({infoItems.length})
              </span>
            </div>
            {showInfo ? (
              <ChevronUp className="text-blue-400" size={16} />
            ) : (
              <ChevronDown className="text-blue-400" size={16} />
            )}
          </button>

          {showInfo && (
            <div className="px-4 pb-4">
              <p className="text-xs text-blue-200/70 mb-2">
                Informational notes about data sources and fallback values.
              </p>
              <ul className="space-y-1">
                {infoItems.map((info, index) => (
                  <li key={index} className="text-sm text-blue-200 pl-6">
                    • {info.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {summary &&
        ((summary.bycMissingPrevSalary ?? 0) > 0 ||
          (summary.salaryMissing ?? 0) > 0) && (
          <div className="mt-2 text-xs text-white/50 border-t border-white/10 pt-2">
            <strong>Summary:</strong> {summary.totalPlayers ?? 0} players checked
            {(summary.bycPlayers ?? 0) > 0 &&
              ` • ${summary.bycPlayers} BYC players`}
            {(summary.bycMissingPrevSalary ?? 0) > 0 &&
              ` (${summary.bycMissingPrevSalary} missing previous salary)`}
            {(summary.salaryFallbacks ?? 0) > 0 &&
              ` • ${summary.salaryFallbacks} using fallback salary fields`}
            {(summary.salaryMissing ?? 0) > 0 &&
              ` • ${summary.salaryMissing} missing salary data`}
          </div>
        )}
    </div>
  );
};

