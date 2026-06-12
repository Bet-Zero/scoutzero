import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Info,
  Loader2,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface ModeTagDefinition {
  label: string;
  color: string;
  description: string;
}

interface ModeTagProps {
  mode?: string | null;
}

interface ValidationStatePillProps {
  hasValidatorResult?: boolean;
  isValidating?: boolean;
  validatedAt?: string | number | Date | null;
}

interface ValidationStateHeaderProps {
  hasValidatorResult?: boolean;
  isValidating?: boolean;
  validatedAt?: string | number | Date | null;
  readiness?: TradeReadinessSummary | null;
}

export type TradeReadinessTone =
  | 'setup'
  | 'ready'
  | 'validating'
  | 'blocked'
  | 'warning'
  | 'info'
  | 'success';

export interface TradeReadinessSummary {
  tone: TradeReadinessTone;
  label: string;
  message: string;
}

export const MODE_TAGS: Record<string, ModeTagDefinition> = {
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

export const ModeTag = ({ mode }: ModeTagProps) => {
  const tag = mode ? MODE_TAGS[mode] : null;
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

const ValidationStatePill = ({
  hasValidatorResult,
  isValidating,
  validatedAt,
}: ValidationStatePillProps) => {
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
      ? new Date(validatedAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
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

const READINESS_STYLES: Record<
  TradeReadinessTone,
  { icon: LucideIcon; className: string }
> = {
  setup: {
    icon: CircleDashed,
    className: 'border-neutral-500/30 bg-neutral-500/10 text-neutral-200',
  },
  ready: {
    icon: Info,
    className: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
  },
  validating: {
    icon: Loader2,
    className: 'border-blue-500/30 bg-blue-500/10 text-blue-200',
  },
  blocked: {
    icon: XCircle,
    className: 'border-red-500/40 bg-red-500/10 text-red-200',
  },
  warning: {
    icon: AlertTriangle,
    className: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  },
  info: {
    icon: Info,
    className: 'border-blue-500/30 bg-blue-500/10 text-blue-200',
  },
  success: {
    icon: CheckCircle2,
    className: 'border-green-500/30 bg-green-500/10 text-green-200',
  },
};

const TradeReadinessLine = ({
  readiness,
}: {
  readiness: TradeReadinessSummary;
}) => {
  const style = READINESS_STYLES[readiness.tone];
  const Icon = style.icon;

  return (
    <div
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border px-3 py-2 text-xs ${style.className}`}
      data-testid="trade-readiness-summary"
      aria-live="polite"
    >
      <Icon
        size={14}
        className={
          readiness.tone === 'validating' ? 'shrink-0 animate-spin' : 'shrink-0'
        }
      />
      <span className="font-semibold">{readiness.label}</span>
      <span className="text-current/80">{readiness.message}</span>
    </div>
  );
};

export const ValidationStateHeader = ({
  hasValidatorResult = false,
  isValidating = false,
  validatedAt = null,
  readiness = null,
}: ValidationStateHeaderProps) => {
  return (
    <div
      className="flex flex-col gap-2 px-4 py-3 mb-4 bg-[#0a0a0a] border border-white/10 rounded-lg"
      data-testid="validation-state-header"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-white/50 font-medium">Validation:</span>
        <ValidationStatePill
          hasValidatorResult={hasValidatorResult}
          isValidating={isValidating}
          validatedAt={validatedAt}
        />
      </div>
      {readiness && <TradeReadinessLine readiness={readiness} />}
    </div>
  );
};
