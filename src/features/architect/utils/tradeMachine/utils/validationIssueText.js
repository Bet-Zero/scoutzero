const CANONICAL_ISSUE_KEYS = new Set([
  'message',
  'severity',
  'rule',
  'code',
  'details',
  'meta',
]);

const LEGACY_META_KEYS = new Set(['reason', 'type']);

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function normalizeSeverity(value, fallback = 'error') {
  return value === 'warning' ? 'warning' : fallback;
}

function toIssueCodeToken(value) {
  return String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

function buildFallbackIssueCode({ rule, message, severity }) {
  const ruleToken = toIssueCodeToken(rule || 'validation');
  const messageToken = toIssueCodeToken(message || severity || 'issue').slice(
    0,
    96
  );

  return [ruleToken, messageToken || 'ISSUE'].filter(Boolean).join('__');
}

function pickIssueMessage(issue, fallback = '') {
  if (issue == null) return fallback;
  if (typeof issue === 'string') return issue.trim();
  if (typeof issue === 'number' || typeof issue === 'boolean') {
    return String(issue);
  }

  if (typeof issue === 'object') {
    if (typeof issue.message === 'string' && issue.message.trim()) {
      return issue.message.trim();
    }
    if (typeof issue.reason === 'string' && issue.reason.trim()) {
      return issue.reason.trim();
    }
    if (typeof issue.details === 'string' && issue.details.trim()) {
      return issue.details.trim();
    }
    if (typeof issue.code === 'string' && issue.code.trim()) {
      return issue.code.trim();
    }
    if (typeof issue.type === 'string' && issue.type.trim()) {
      return issue.type.trim();
    }
  }

  return fallback || String(issue);
}

function extractIssueMeta(issue, defaultMeta) {
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

export function isValidationIssue(issue) {
  return (
    isPlainObject(issue) &&
    normalizeText(issue.message) !== '' &&
    normalizeText(issue.rule) !== '' &&
    normalizeText(issue.code) !== ''
  );
}

export function createValidationIssue(issue, defaults = {}) {
  const fallbackSeverity = normalizeSeverity(defaults.severity, 'error');
  const fallbackRule = normalizeText(defaults.rule) || 'validation';
  const message = pickIssueMessage(issue, normalizeText(defaults.message));

  if (!message) {
    return null;
  }

  const explicitCode =
    normalizeText(issue?.code) ||
    normalizeText(issue?.type) ||
    normalizeText(defaults.code);
  const details =
    issue?.details !== undefined ? issue.details : (defaults.details ?? null);
  const severity = normalizeSeverity(issue?.severity, fallbackSeverity);
  const rule = normalizeText(issue?.rule) || fallbackRule;
  const meta = extractIssueMeta(issue, defaults.meta);

  const normalizedIssue = {
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
    value() {
      return this.message;
    },
    enumerable: false,
  });

  Object.defineProperty(normalizedIssue, 'valueOf', {
    value() {
      return this.message;
    },
    enumerable: false,
  });

  Object.defineProperty(normalizedIssue, Symbol.toPrimitive, {
    value() {
      return this.message;
    },
    enumerable: false,
  });

  return normalizedIssue;
}

export function normalizeValidationIssues(issues, defaults = {}) {
  if (issues == null) return [];

  if (Array.isArray(issues)) {
    return issues
      .map((issue) => createValidationIssue(issue, defaults))
      .filter(Boolean);
  }

  const normalizedIssue = createValidationIssue(issues, defaults);
  return normalizedIssue ? [normalizedIssue] : [];
}

export function getValidationIssueText(issue) {
  return pickIssueMessage(issue, '');
}

export function getFirstValidationIssueText(issues, fallback = '') {
  const [firstIssue] = normalizeValidationIssues(issues);
  return firstIssue ? getValidationIssueText(firstIssue) : fallback;
}

export function summarizeValidationIssues(issues, fallback = '') {
  const text = normalizeValidationIssues(issues)
    .map((issue) => getValidationIssueText(issue))
    .filter(Boolean);

  return text.length > 0 ? text.join('; ') : fallback;
}
