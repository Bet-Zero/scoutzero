import type { ValidationIssue } from '../constants/types';

const CANONICAL_ISSUE_KEYS = new Set([
  'message',
  'severity',
  'rule',
  'code',
  'details',
  'meta',
]);

const LEGACY_META_KEYS = new Set(['reason', 'type']);

type ValidationIssueSeverity = ValidationIssue['severity'];

interface ValidationIssueDefaults {
  message?: string;
  severity?: ValidationIssueSeverity;
  rule?: string;
  code?: string;
  details?: unknown;
  meta?: Record<string, unknown> | null;
}

interface LegacyValidationIssueObject {
  message?: unknown;
  severity?: unknown;
  rule?: unknown;
  code?: unknown;
  details?: unknown;
  meta?: unknown;
  reason?: unknown;
  type?: unknown;
}

type ValidationIssueInput =
  | ValidationIssue
  | LegacyValidationIssueObject
  | string
  | number
  | boolean
  | null
  | undefined;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function normalizeSeverity(
  value: unknown,
  fallback: ValidationIssueSeverity = 'error'
): ValidationIssueSeverity {
  return value === 'warning' ? 'warning' : fallback;
}

function toIssueCodeToken(value: unknown): string {
  return String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

function buildFallbackIssueCode({
  rule,
  message,
  severity,
}: {
  rule: string;
  message: string;
  severity: ValidationIssueSeverity;
}): string {
  const ruleToken = toIssueCodeToken(rule || 'validation');
  const messageToken = toIssueCodeToken(message || severity || 'issue').slice(
    0,
    96
  );

  return [ruleToken, messageToken || 'ISSUE'].filter(Boolean).join('__');
}

function pickIssueMessage(issue: ValidationIssueInput, fallback = ''): string {
  if (issue == null) return fallback;
  if (typeof issue === 'string') return issue.trim();
  if (typeof issue === 'number' || typeof issue === 'boolean') {
    return String(issue);
  }

  if (typeof issue === 'object') {
    const issueObject = issue as LegacyValidationIssueObject;

    if (typeof issueObject.message === 'string' && issueObject.message.trim()) {
      return issueObject.message.trim();
    }
    if (typeof issueObject.reason === 'string' && issueObject.reason.trim()) {
      return issueObject.reason.trim();
    }
    if (typeof issueObject.details === 'string' && issueObject.details.trim()) {
      return issueObject.details.trim();
    }
    if (typeof issueObject.code === 'string' && issueObject.code.trim()) {
      return issueObject.code.trim();
    }
    if (typeof issueObject.type === 'string' && issueObject.type.trim()) {
      return issueObject.type.trim();
    }
  }

  return fallback || String(issue);
}

function extractIssueMeta(
  issue: ValidationIssueInput,
  defaultMeta: ValidationIssueDefaults['meta']
): Record<string, unknown> | null {
  const meta = isPlainObject(defaultMeta) ? { ...defaultMeta } : {};

  if (!isPlainObject(issue)) {
    return Object.keys(meta).length > 0 ? meta : null;
  }

  if (isPlainObject(issue.meta)) {
    Object.assign(meta, issue.meta);
  }

  Object.entries(issue).forEach(([key, value]) => {
    if (
      CANONICAL_ISSUE_KEYS.has(key) ||
      LEGACY_META_KEYS.has(key) ||
      value === undefined
    ) {
      return;
    }

    meta[key] = value;
  });

  return Object.keys(meta).length > 0 ? meta : null;
}

function issueToText(this: ValidationIssue): string {
  return this.message;
}

function issueToPrimitive(this: ValidationIssue): string {
  return this.message;
}

export function isValidationIssue(issue: unknown): issue is ValidationIssue {
  return (
    isPlainObject(issue) &&
    normalizeText(issue.message) !== '' &&
    normalizeText(issue.rule) !== '' &&
    normalizeText(issue.code) !== ''
  );
}

export function createValidationIssue(
  issue: ValidationIssueInput,
  defaults: ValidationIssueDefaults = {}
): ValidationIssue | null {
  const issueObject = isPlainObject(issue)
    ? (issue as LegacyValidationIssueObject)
    : null;
  const fallbackSeverity = normalizeSeverity(defaults.severity, 'error');
  const fallbackRule = normalizeText(defaults.rule) || 'validation';
  const message = pickIssueMessage(issue, normalizeText(defaults.message));

  if (!message) {
    return null;
  }

  const explicitCode =
    normalizeText(issueObject?.code) ||
    normalizeText(issueObject?.type) ||
    normalizeText(defaults.code);
  const details =
    issueObject?.details !== undefined ? issueObject.details : (defaults.details ?? null);
  const severity = normalizeSeverity(issueObject?.severity, fallbackSeverity);
  const rule = normalizeText(issueObject?.rule) || fallbackRule;
  const meta = extractIssueMeta(issue, defaults.meta);

  const normalizedIssue: ValidationIssue = {
    message,
    severity,
    rule,
    code:
      explicitCode ||
      buildFallbackIssueCode({
        rule,
        message,
        severity,
      }),
    details,
    meta,
  };

  Object.defineProperty(normalizedIssue, 'toString', {
    value: issueToText,
    enumerable: false,
  });

  Object.defineProperty(normalizedIssue, 'valueOf', {
    value: issueToText,
    enumerable: false,
  });

  Object.defineProperty(normalizedIssue, Symbol.toPrimitive, {
    value: issueToPrimitive,
    enumerable: false,
  });

  return normalizedIssue;
}

export function normalizeValidationIssues(
  issues: ValidationIssueInput | ValidationIssueInput[],
  defaults: ValidationIssueDefaults = {}
): ValidationIssue[] {
  if (issues == null) return [];

  if (Array.isArray(issues)) {
    return issues
      .map((issue) => createValidationIssue(issue, defaults))
      .filter((issue): issue is ValidationIssue => Boolean(issue));
  }

  const normalizedIssue = createValidationIssue(issues, defaults);
  return normalizedIssue ? [normalizedIssue] : [];
}

export function getValidationIssueText(issue: ValidationIssueInput): string {
  return pickIssueMessage(issue, '');
}

export function getFirstValidationIssueText(
  issues: ValidationIssueInput | ValidationIssueInput[],
  fallback = ''
): string {
  const [firstIssue] = normalizeValidationIssues(issues);
  return firstIssue ? getValidationIssueText(firstIssue) : fallback;
}

export function summarizeValidationIssues(
  issues: ValidationIssueInput | ValidationIssueInput[],
  fallback = ''
): string {
  const text = normalizeValidationIssues(issues)
    .map((issue) => getValidationIssueText(issue))
    .filter(Boolean);

  return text.length > 0 ? text.join('; ') : fallback;
}
