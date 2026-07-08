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

// The pill is deliberately neutral: it reports WHEN the deal was last checked,
// while the surrounding banner carries the verdict color. A green pill next to
// a red "Trade blocked" banner half-read as success (BZE-224).
const ValidationStatePill = ({
  hasValidatorResult,
  isValidating,
  validatedAt,
}: ValidationStatePillProps) => {
  if (isValidating) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-600/20 text-blue-300 border border-blue-500/30">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
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
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-white/5 text-white/60 border border-white/15">
        <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
        Validated{timeStr && ` at ${timeStr}`}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-neutral-600/20 text-neutral-400 border border-neutral-500/30">
      <span className="w-1.5 h-1.5 rounded-full bg-neutral-500" />
      Not validated
    </span>
  );
};

// One banner row carries the verdict: the container color IS the state. The
// blocked tone is deliberately the loudest treatment on the page so a failed
// deal can never scan as success.
const READINESS_STYLES: Record<
  TradeReadinessTone,
  { icon: LucideIcon; container: string; label: string; message: string }
> = {
  setup: {
    icon: CircleDashed,
    container: 'border-white/10 border-l-neutral-400/60 bg-[#0a0a0a]',
    label: 'text-neutral-200',
    message: 'text-neutral-400',
  },
  ready: {
    icon: Info,
    container: 'border-sky-500/25 border-l-sky-400/80 bg-sky-950/30',
    label: 'text-sky-100',
    message: 'text-sky-200/70',
  },
  validating: {
    icon: Loader2,
    container: 'border-blue-500/25 border-l-blue-400/80 bg-blue-950/30',
    label: 'text-blue-100',
    message: 'text-blue-200/70',
  },
  blocked: {
    icon: XCircle,
    container: 'border-red-500/50 border-l-red-500 bg-red-950/50',
    label: 'text-red-100',
    message: 'text-red-200/90',
  },
  warning: {
    icon: AlertTriangle,
    container: 'border-amber-500/40 border-l-amber-400 bg-amber-950/40',
    label: 'text-amber-100',
    message: 'text-amber-200/80',
  },
  info: {
    icon: Info,
    container: 'border-blue-500/25 border-l-blue-400/80 bg-blue-950/30',
    label: 'text-blue-100',
    message: 'text-blue-200/70',
  },
  success: {
    icon: CheckCircle2,
    container: 'border-green-500/40 border-l-green-400 bg-green-950/40',
    label: 'text-green-100',
    message: 'text-green-200/80',
  },
};

const NEUTRAL_CONTAINER = 'border-white/10 bg-[#0a0a0a]';

export const ValidationStateHeader = ({
  hasValidatorResult = false,
  isValidating = false,
  validatedAt = null,
  readiness = null,
}: ValidationStateHeaderProps) => {
  const style = readiness ? READINESS_STYLES[readiness.tone] : null;
  const Icon = style?.icon;

  return (
    <div
      className={`rounded-lg border border-l-4 px-4 py-2.5 ${
        style ? style.container : NEUTRAL_CONTAINER
      }`}
      data-testid="validation-state-header"
    >
      <div
        className="flex flex-wrap items-center gap-x-2.5 gap-y-1"
        data-testid="trade-readiness-summary"
        aria-live="polite"
      >
        {readiness && style && Icon ? (
          <>
            <Icon
              size={16}
              className={`shrink-0 ${style.label} ${
                readiness.tone === 'validating' ? 'animate-spin' : ''
              }`}
            />
            <span
              className={`text-sm font-bold uppercase tracking-wide ${style.label}`}
            >
              {readiness.label}
            </span>
            <span className={`text-xs ${style.message}`}>
              {readiness.message}
            </span>
          </>
        ) : null}
        <span className="ml-auto flex shrink-0 items-center gap-2">
          <span className="text-[11px] text-white/40 font-medium">
            Validation:
          </span>
          <ValidationStatePill
            hasValidatorResult={hasValidatorResult}
            isValidating={isValidating}
            validatedAt={validatedAt}
          />
        </span>
      </div>
    </div>
  );
};
