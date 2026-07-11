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
    color: 'bg-cockpit-info/20 text-cockpit-info border-cockpit-info/40',
    description: 'Authoritative validator results',
  },
  SETUP: {
    label: 'Setup',
    color: 'bg-cockpit-raised text-cockpit-text-secondary border-cockpit-edge',
    description: 'Configuration and team selection',
  },
  EXPLORATORY: {
    label: 'Exploratory',
    color: 'bg-cockpit-watch/20 text-cockpit-watch border-cockpit-watch/40',
    description: 'What-if calculations (sandbox)',
  },
  DEBUG: {
    label: 'Debug',
    color: 'bg-cockpit-raised text-cockpit-text-muted border-cockpit-edge',
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
// a red "Trade blocked" banner half-read as success (BZE-224), and "Validated"
// wording on a blocked deal read the same way (BZE-247) — hence "Last checked".
const ValidationStatePill = ({
  hasValidatorResult,
  isValidating,
  validatedAt,
}: ValidationStatePillProps) => {
  if (isValidating) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-cockpit-info/20 text-cockpit-info border border-cockpit-info/30">
        <span className="w-1.5 h-1.5 rounded-full bg-cockpit-info animate-pulse" />
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
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-cockpit-raised text-cockpit-text-secondary border border-cockpit-edge">
        <span className="w-1.5 h-1.5 rounded-full bg-cockpit-text-muted" />
        Last checked{timeStr && ` at ${timeStr}`}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-cockpit-inlay text-cockpit-text-muted border border-cockpit-edge">
      <span className="w-1.5 h-1.5 rounded-full bg-cockpit-text-ghost" />
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
    container: 'border-cockpit-edge border-l-cockpit-text-muted/60 bg-cockpit-void',
    label: 'text-cockpit-text-primary',
    message: 'text-cockpit-text-muted',
  },
  ready: {
    icon: Info,
    container: 'border-cockpit-info/25 border-l-cockpit-info/80 bg-cockpit-info/10',
    label: 'text-cockpit-info',
    message: 'text-cockpit-info/70',
  },
  validating: {
    icon: Loader2,
    container: 'border-cockpit-info/25 border-l-cockpit-info/80 bg-cockpit-info/10',
    label: 'text-cockpit-info',
    message: 'text-cockpit-info/70',
  },
  blocked: {
    icon: XCircle,
    container: 'border-cockpit-danger/50 border-l-cockpit-danger bg-cockpit-danger/15',
    label: 'text-cockpit-danger',
    message: 'text-cockpit-danger/90',
  },
  warning: {
    icon: AlertTriangle,
    container: 'border-cockpit-watch/40 border-l-cockpit-watch bg-cockpit-watch/10',
    label: 'text-cockpit-watch',
    message: 'text-cockpit-watch/80',
  },
  info: {
    icon: Info,
    container: 'border-cockpit-info/25 border-l-cockpit-info/80 bg-cockpit-info/10',
    label: 'text-cockpit-info',
    message: 'text-cockpit-info/70',
  },
  success: {
    icon: CheckCircle2,
    container: 'border-cockpit-safe/40 border-l-cockpit-safe bg-cockpit-safe/10',
    label: 'text-cockpit-safe',
    message: 'text-cockpit-safe/80',
  },
};

const NEUTRAL_CONTAINER = 'border-cockpit-edge bg-cockpit-void';

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
          <span className="text-[11px] text-cockpit-text-muted font-medium">
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
