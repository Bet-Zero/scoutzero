import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ACCEPTED_CANON_PIN = Object.freeze({
  candidate: '6cf8aaf358c158a88e630e8a7336f7e9c3febc17',
  authorityRef: 'refs/remotes/origin/architect/cba-canon-v2',
  fingerprint:
    '23fe883f6f1aec7799fc3396bef404c250fd26beefa705582a5307766ad7ff76',
  artifactPath: 'docs/reference/cba/ARCHITECT_CBA_CANON.md',
});

const LEAF_ID = /^CBA2-[ACRLS]\d{2}\.\d+$/;
const AUTHORITY_CLASSES = new Set([
  'CBA',
  'BYL',
  'NBA',
  'DERIVED',
  'INFERRED',
  'OPS',
  'EXT',
]);

export type AcceptedCanonPin = typeof ACCEPTED_CANON_PIN;

type MarkdownRow = string[];

export interface CanonLookupResult {
  acceptedAuthority: {
    candidate: string;
    authorityRef: string;
    fingerprint: string;
    artifactPath: string;
    source: 'pinned git object';
  };
  leaf: {
    id: string;
    rule: string;
    authority: string;
    primaryMethod: string;
    secondaryMethods: string;
    evidenceIds: string[];
    lineage: string;
    notes: string;
    lifecycleInputs: string;
  };
  scenarios: Array<{
    id: string;
    inputs: string;
    boundary: string;
    expectedResult: string;
    evidenceChain: string;
    exercises: string;
  }>;
  provenance: {
    evidenceComponents: Array<{
      id: string;
      owner: string;
      authority: string;
      sourceRoots: string;
      dependencies: string;
      citation: string;
      sourceText: string;
      result: string;
      reasoning: string;
      limitations: string;
    }>;
    sourceRecords: Array<{
      id: string;
      type: string;
      title: string;
      sourceDate: string;
      url: string;
      artifactFingerprint: string;
      artifactBytes: string;
      retrievedAt: string;
      verifier: string;
      verificationSession: string;
      verificationDate: string;
      limitations: string;
      status: string;
      version: string;
    }>;
  };
}

function runGit(repoRoot: string, args: string[]): Buffer {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'buffer',
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const detail =
      error && typeof error === 'object' && 'stderr' in error
        ? String((error as { stderr?: Buffer }).stderr ?? '').trim()
        : String(error);
    throw new Error(
      `Accepted Canon artifact is unavailable: ${detail || 'git lookup failed'}`
    );
  }
}

function assertAcceptedPin(pin: AcceptedCanonPin): void {
  for (const key of [
    'candidate',
    'authorityRef',
    'fingerprint',
    'artifactPath',
  ] as const) {
    if (pin[key] !== ACCEPTED_CANON_PIN[key]) {
      throw new Error(
        `Wrong Canon authority: ${key} must remain pinned to ${ACCEPTED_CANON_PIN[key]}`
      );
    }
  }
}

export function verifyCanonFingerprint(
  content: Buffer,
  expectedFingerprint = ACCEPTED_CANON_PIN.fingerprint
): string {
  const actual = createHash('sha256').update(content).digest('hex');
  if (actual !== expectedFingerprint) {
    throw new Error(
      `Accepted Canon fingerprint mismatch: expected ${expectedFingerprint}, received ${actual}`
    );
  }
  return actual;
}

export function readAcceptedCanon(
  repoRoot: string,
  pin: AcceptedCanonPin = ACCEPTED_CANON_PIN
): Buffer {
  assertAcceptedPin(pin);

  let authorityTip: string;
  try {
    authorityTip = runGit(repoRoot, [
      'rev-parse',
      '--verify',
      `${pin.authorityRef}^{commit}`,
    ])
      .toString('utf8')
      .trim();
  } catch {
    throw new Error(
      `Accepted Canon authority ref is unavailable: ${pin.authorityRef}. ` +
        'Fetch it with: git fetch origin architect/cba-canon-v2:refs/remotes/origin/architect/cba-canon-v2'
    );
  }

  const resolvedCandidate = runGit(repoRoot, [
    'rev-parse',
    '--verify',
    `${pin.candidate}^{commit}`,
  ])
    .toString('utf8')
    .trim();

  if (resolvedCandidate !== pin.candidate) {
    throw new Error(
      `Wrong Canon authority: expected candidate ${pin.candidate}, resolved ${resolvedCandidate}`
    );
  }

  const authorityMergeBase = runGit(repoRoot, [
    'merge-base',
    resolvedCandidate,
    authorityTip,
  ])
    .toString('utf8')
    .trim();
  if (authorityMergeBase !== resolvedCandidate) {
    throw new Error(
      `Wrong Canon authority: candidate ${resolvedCandidate} is not reachable from ${pin.authorityRef}`
    );
  }

  const content = runGit(repoRoot, [
    'show',
    `${pin.candidate}:${pin.artifactPath}`,
  ]);
  verifyCanonFingerprint(content, pin.fingerprint);
  return content;
}

function parseMarkdownRow(line: string): MarkdownRow | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;

  const cells: string[] = [];
  let current = '';
  for (let index = 1; index < trimmed.length - 1; index += 1) {
    const char = trimmed[index];
    if (char === '|' && trimmed[index - 1] !== '\\') {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());

  if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) return null;
  return cells;
}

function tableRows(canon: string): MarkdownRow[] {
  return canon
    .split(/\r?\n/)
    .map(parseMarkdownRow)
    .filter((row): row is MarkdownRow => row !== null);
}

function ids(value: string, pattern: RegExp): string[] {
  return [...new Set(value.match(pattern) ?? [])];
}

function findUniqueRow(
  rows: MarkdownRow[],
  predicate: (row: MarkdownRow) => boolean,
  description: string
): MarkdownRow {
  const matches = rows.filter(predicate);
  if (matches.length !== 1) {
    throw new Error(
      `Accepted Canon is structurally ambiguous: expected one ${description}, found ${matches.length}`
    );
  }
  return matches[0];
}

export function lookupAcceptedCanonLeaf(
  leafId: string,
  repoRoot = process.cwd()
): CanonLookupResult {
  if (!LEAF_ID.test(leafId)) {
    throw new Error(`Unknown Canon leaf ID: ${leafId}`);
  }

  const canon = readAcceptedCanon(repoRoot).toString('utf8');
  const rows = tableRows(canon);
  const leafRows = rows.filter(
    (row) =>
      row[0] === leafId &&
      AUTHORITY_CLASSES.has(row[2] ?? '') &&
      /^EV2-\d{4}/.test(row[5] ?? '')
  );
  if (leafRows.length === 0)
    throw new Error(`Unknown Canon leaf ID: ${leafId}`);
  if (leafRows.length > 1) {
    throw new Error(
      `Accepted Canon is structurally ambiguous: multiple active LEAF rows for ${leafId}`
    );
  }
  const leafRow = leafRows[0];

  const mappingRows = rows.filter(
    (row) => row[0] === leafId && /CBA2-SC-\d{3}\(/.test(row[1] ?? '')
  );
  if (mappingRows.length > 1) {
    throw new Error(
      `Accepted Canon is structurally ambiguous: multiple scenario mappings for ${leafId}`
    );
  }
  const mappingRow = mappingRows[0];
  const scenarioIds = mappingRow
    ? ids(mappingRow[1], /CBA2-SC-\d{3}\([^)]+\)/g)
    : [];

  const scenarios = scenarioIds.map((scenarioId) => {
    const row = findUniqueRow(
      rows,
      (candidate) => candidate[0] === scenarioId && candidate.length === 6,
      `named scenario row for ${scenarioId}`
    );
    return {
      id: row[0],
      inputs: row[1],
      boundary: row[2],
      expectedResult: row[3],
      evidenceChain: row[4],
      exercises: row[5],
    };
  });

  const evidenceQueue = ids(leafRow[5], /EV2-\d{4}/g);
  const visitedEvidence = new Set<string>();
  const evidenceRows: MarkdownRow[] = [];
  const sourceIds = new Set<string>();

  while (evidenceQueue.length > 0) {
    const evidenceId = evidenceQueue.shift();
    if (!evidenceId || visitedEvidence.has(evidenceId)) continue;
    visitedEvidence.add(evidenceId);

    const row = findUniqueRow(
      rows,
      (candidate) =>
        candidate[0] === evidenceId &&
        AUTHORITY_CLASSES.has(candidate[2] ?? '') &&
        candidate.length >= 10,
      `evidence component row for ${evidenceId}`
    );
    evidenceRows.push(row);
    ids(row[3] ?? '', /SRC2-\d{3}/g).forEach((id) => sourceIds.add(id));
    ids(row[4] ?? '', /EV2-\d{4}/g).forEach((id) => evidenceQueue.push(id));
  }

  const sourceRows = [...sourceIds]
    .sort()
    .map((sourceId) =>
      findUniqueRow(
        rows,
        (row) =>
          row[0] === sourceId &&
          /^`[^`]+`$/.test(row[1] ?? '') &&
          row.length >= 15,
        `source record row for ${sourceId}`
      )
    );

  return {
    acceptedAuthority: {
      candidate: ACCEPTED_CANON_PIN.candidate,
      authorityRef: ACCEPTED_CANON_PIN.authorityRef,
      fingerprint: ACCEPTED_CANON_PIN.fingerprint,
      artifactPath: ACCEPTED_CANON_PIN.artifactPath,
      source: 'pinned git object',
    },
    leaf: {
      id: leafRow[0],
      rule: leafRow[1],
      authority: leafRow[2],
      primaryMethod: leafRow[3],
      secondaryMethods: leafRow[4],
      evidenceIds: ids(leafRow[5], /EV2-\d{4}/g),
      lineage: leafRow[6],
      notes: leafRow[7],
      lifecycleInputs: mappingRow?.[3] ?? '—',
    },
    scenarios,
    provenance: {
      evidenceComponents: evidenceRows.map((row) => ({
        id: row[0],
        owner: row[1],
        authority: row[2],
        sourceRoots: row[3],
        dependencies: row[4],
        citation: row[5],
        sourceText: row[6],
        result: row[7],
        reasoning: row[8],
        limitations: row[9],
      })),
      sourceRecords: sourceRows.map((row) => ({
        id: row[0],
        type: row[1],
        title: row[2],
        sourceDate: row[3],
        url: row[4],
        artifactFingerprint: row[5],
        artifactBytes: row[6],
        retrievedAt: row[7],
        verifier: row[9],
        verificationSession: row[10],
        verificationDate: row[11],
        limitations: row[12],
        status: row[13],
        version: row[14],
      })),
    },
  };
}

export function formatCanonLookup(result: CanonLookupResult): string {
  const lines = [
    'PINNED ACCEPTED CANON AUTHORITY — working-tree copies are not consulted',
    `Candidate: ${result.acceptedAuthority.candidate}`,
    `Authority ref: ${result.acceptedAuthority.authorityRef}`,
    `SHA-256:  ${result.acceptedAuthority.fingerprint}`,
    `Artifact: ${result.acceptedAuthority.artifactPath} (${result.acceptedAuthority.source})`,
    '',
    `LEAF ${result.leaf.id}`,
    `Rule: ${result.leaf.rule}`,
    `Authority: ${result.leaf.authority}`,
    `Methods: primary=${result.leaf.primaryMethod}; secondary=${result.leaf.secondaryMethods}`,
    `Lifecycle inputs: ${result.leaf.lifecycleInputs}`,
    `Lineage: ${result.leaf.lineage}`,
    `Notes: ${result.leaf.notes}`,
    '',
    'APPLICABLE SCENARIOS',
  ];

  if (result.scenarios.length === 0) {
    lines.push('None registered for this non-SCEN leaf.');
  } else {
    for (const scenario of result.scenarios) {
      lines.push(
        '',
        scenario.id,
        `Inputs: ${scenario.inputs}`,
        `Boundary: ${scenario.boundary}`,
        `Expected: ${scenario.expectedResult}`,
        `Evidence chain: ${scenario.evidenceChain}`,
        `Exercises: ${scenario.exercises}`
      );
    }
  }

  lines.push('', 'PROVENANCE CLOSURE');
  for (const evidence of result.provenance.evidenceComponents) {
    lines.push(
      '',
      `${evidence.id} (${evidence.authority}) owner=${evidence.owner}`,
      `Source roots: ${evidence.sourceRoots}; dependencies: ${evidence.dependencies}`,
      `Citation: ${evidence.citation}`,
      `Source text: ${evidence.sourceText}`,
      `Result: ${evidence.result}`,
      `Reasoning: ${evidence.reasoning}`,
      `Limitations: ${evidence.limitations}`
    );
  }
  for (const source of result.provenance.sourceRecords) {
    lines.push(
      '',
      `${source.id} ${source.type} — ${source.title}`,
      `Source date: ${source.sourceDate}; URL: ${source.url}`,
      `Artifact: ${source.artifactFingerprint}; bytes=${source.artifactBytes}; retrieved=${source.retrievedAt}`,
      `Verified by ${source.verifier} in ${source.verificationSession} on ${source.verificationDate}`,
      `Status/version: ${source.status}/${source.version}; limitations: ${source.limitations}`
    );
  }

  return `${lines.join('\n')}\n`;
}

function isMainModule(): boolean {
  const invoked = process.argv[1];
  return (
    Boolean(invoked) && path.resolve(invoked) === fileURLToPath(import.meta.url)
  );
}

if (isMainModule()) {
  const [leafId, ...extra] = process.argv.slice(2);
  if (!leafId || extra.length > 0) {
    process.stderr.write(
      'Usage: npm run architect:canon:lookup -- CBA2-A02.14\n'
    );
    process.exitCode = 2;
  } else {
    try {
      process.stdout.write(formatCanonLookup(lookupAcceptedCanonLeaf(leafId)));
    } catch (error) {
      process.stderr.write(
        `${error instanceof Error ? error.message : String(error)}\n`
      );
      process.exitCode = 1;
    }
  }
}
