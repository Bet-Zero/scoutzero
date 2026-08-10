/** Build the first immutable retained SalarySwish contract-source release. */

import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  buildContractSourceRelease,
  contractSourceReleaseDigestMaterial,
} from '../../src/features/architect/utils/contractSource/contractSourceReleaseBuilder';
import { canonicalStringify } from '../../src/features/architect/utils/contractSource/deterministicDigest';
import {
  ContractSourceReleaseZ,
  type ContractSourceObservation,
} from '../../src/schemas/contractSourceRelease';
import { decodeContractFieldEvidence } from '../../src/schemas/governedContractState';

const RELEASE_ID = 'salaryswish-retained-2026-06-05';
const RELEASE_VERSION = 1;
const SALARY_CAP_YEAR = 2026;
const SOURCE_ROOT = path.resolve(
  process.cwd(),
  'player-scrape/contracts/_artifacts/output'
);
const OUTPUT_PATH = path.resolve(
  process.cwd(),
  'public/architect/contract-source-releases/salaryswish-retained-2026-06-05-v1.json'
);
const REPORT_PATH = path.resolve(
  process.cwd(),
  'docs/reference/architect/CONTRACT_SOURCE_RELEASE_V1.md'
);

const sha256 = (value: string): string =>
  `sha256:${createHash('sha256').update(value).digest('hex')}`;

async function sourceFiles(): Promise<string[]> {
  const directories = (await readdir(SOURCE_ROOT)).sort();
  const files: string[] = [];
  for (const directory of directories) {
    const absoluteDirectory = path.join(SOURCE_ROOT, directory);
    if (!(await stat(absoluteDirectory)).isDirectory()) continue;
    const names = (await readdir(absoluteDirectory)).sort();
    names.forEach((name) => {
      if (name.endsWith('.json')) files.push(path.join(absoluteDirectory, name));
    });
  }
  return files;
}

async function observations(): Promise<ContractSourceObservation[]> {
  const values: ContractSourceObservation[] = [];
  for (const absolutePath of await sourceFiles()) {
    const artifactContent = await readFile(absolutePath, 'utf8');
    const parsed = JSON.parse(artifactContent) as Record<string, unknown>;
    const playerId = parsed.playerId;
    const teamId = parsed.teamCode;
    const source = parsed.source as Record<string, unknown> | undefined;
    const observedAt = source?.scrapedAt;
    const sourceProvider = source?.provider;
    const sourceRecordVersion = parsed.version;
    if (
      typeof playerId !== 'string' ||
      typeof teamId !== 'string' ||
      typeof observedAt !== 'string' ||
      !Number.isFinite(Date.parse(observedAt)) ||
      sourceProvider !== 'SalarySwish' ||
      typeof sourceRecordVersion !== 'string'
    ) {
      throw new Error(
        `Structurally corrupt retained source artifact: ${path.relative(process.cwd(), absolutePath)}`
      );
    }
    const artifactSha256 = sha256(artifactContent);
    values.push({
      observationId: `salaryswish:${playerId}:${artifactSha256.slice(-20)}`,
      artifactPath: path.relative(process.cwd(), absolutePath).split(path.sep).join('/'),
      artifactSha256,
      sourceProvider,
      sourceRecordVersion,
      observedAt,
      playerId,
      teamId,
      artifactContent,
    });
  }
  return values.sort((a, b) => a.observationId.localeCompare(b.observationId));
}

function coverageReport(
  release: ReturnType<typeof buildContractSourceRelease>
): string {
  const coverage = release.coverage;
  const retainedContractObservations = release.observations.reduce(
    (count, observation) => {
      const raw = JSON.parse(observation.artifactContent) as Record<string, unknown>;
      return count + (raw.contract ? 1 : 0) + (raw.futureContract ? 1 : 0);
    },
    0
  );
  const evidenceCounts = new Map<string, number>();
  const missingFields = new Map<string, Set<string>>();
  release.records.forEach((record) => {
    record.resultingState.evidence.forEach((evidence) => {
      const { fieldPath, status } = decodeContractFieldEvidence(evidence);
      evidenceCounts.set(
        status,
        (evidenceCounts.get(status) ?? 0) + 1
      );
      if (status === 'unknown' || status === 'conflicting') {
        const category = fieldPath.replace(/\[\d+\]/g, '[]');
        const recordIds = missingFields.get(category) ?? new Set<string>();
        recordIds.add(record.contractId);
        missingFields.set(category, recordIds);
      }
    });
  });
  const missing = coverage.missingByCategory
    .map(
      (entry) =>
        `- ${entry.category}: ${entry.recordIds.length}${
          entry.recordIds.length > 0 ? ` (${entry.recordIds.join(', ')})` : ''
        }`
    )
    .join('\n');
  const fieldAccounting = [...missingFields.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([field, recordIds]) => `- \`${field}\`: ${recordIds.size} records`)
    .join('\n');
  return `# Governed contract-source release v1

This is the readable receipt for the immutable retained source artifact at
\`/architect/contract-source-releases/salaryswish-retained-2026-06-05-v1.json\`.
The JSON release is the source of record and names every observation, baseline
contract, evidence path, state digest, missing fact, and later-route blocker.

## Release

- Release: \`${release.releaseId}@v${release.releaseVersion}\`
- Digest: \`${release.releaseDigest}\`
- Source observation boundary: \`${release.effectiveAt}\`
- Salary Cap Year: \`${release.salaryCapYear}\` (2025-26)
- Transformation: \`${release.source.transformationId}\`
- Supersedes: none

## Coverage

- Retained observations: ${coverage.sourceObservationCount}
- Contract records across all retained observations: ${retainedContractObservations}
- Prior observation artifacts retained but not selected as the baseline: ${coverage.sourceObservationCount - coverage.uniquePlayerCount}
- Prior contract observations retained but not selected as the baseline: ${retainedContractObservations - coverage.totalSourceContracts}
- Unique source players: ${coverage.uniquePlayerCount}
- Contracts in the deterministic latest-observation baseline: ${coverage.totalSourceContracts}
- Complete for deterministic retained-source replay: ${coverage.completeRecordIds.length}
- Needs input for deterministic retained-source replay: ${coverage.needsInputRecordIds.length}
- Excluded for structural corruption: ${coverage.excludedCorruptRecordIds.length}

${missing || '- No record-level missing categories.'}

“Complete” above means the retained record can replay its supported salary and
term state. It does not convert unknown clauses or later-action evidence into
sourced facts.

### Field evidence

- Known field entries: ${evidenceCounts.get('known') ?? 0}
- Derived field entries with named transformation limits: ${evidenceCounts.get('derived') ?? 0}
- Unknown field entries: ${evidenceCounts.get('unknown') ?? 0}
- Unsupported field entries: ${evidenceCounts.get('unsupported') ?? 0}
- Conflicting field entries: ${evidenceCounts.get('conflicting') ?? 0}

Unknown or conflicting record categories (salary-row indexes collapsed for
accounting only; the release retains each exact indexed path):

${fieldAccounting || '- None.'}

## Later route readiness

- Pending option contracts ready for action: ${coverage.laterRouteReadiness.option.readyRecordIds.length}
- Pending option contracts blocked by missing governed evidence: ${coverage.laterRouteReadiness.option.blockedRecordIds.length}
- Contracts ready for extension action: ${coverage.laterRouteReadiness.extension.readyRecordIds.length}
- Contracts blocked from extension action: ${coverage.laterRouteReadiness.extension.blockedRecordIds.length}

No option, ETO, extension, or renegotiation action is implemented or authorized
by this release. The release preserves SalarySwish-derived retained evidence and
its transformation limitations; it does not promote the source to an official
league contract feed or reconstruct historical signing transactions.
`;
}

async function existing(pathname: string): Promise<string | null> {
  try {
    return await readFile(pathname, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

async function main() {
  const retainedObservations = await observations();
  const effectiveAt = retainedObservations
    .map((observation) => observation.observedAt)
    .sort()
    .at(-1);
  if (!effectiveAt) throw new Error('No retained contract observations found.');
  const digestMaterial = contractSourceReleaseDigestMaterial({
    releaseId: RELEASE_ID,
    releaseVersion: RELEASE_VERSION,
    supersedes: null,
    effectiveAt,
    salaryCapYear: SALARY_CAP_YEAR,
    observations: retainedObservations,
  });
  const releaseDigest = sha256(canonicalStringify(digestMaterial));
  const release = ContractSourceReleaseZ.parse(
    buildContractSourceRelease({
      releaseId: RELEASE_ID,
      releaseVersion: RELEASE_VERSION,
      releaseDigest,
      supersedes: null,
      effectiveAt,
      salaryCapYear: SALARY_CAP_YEAR,
      observations: retainedObservations,
    })
  );
  const serialized = `${JSON.stringify(release)}\n`;
  const report = coverageReport(release);
  const priorRelease = await existing(OUTPUT_PATH);
  const priorReport = await existing(REPORT_PATH);

  if (priorRelease !== null && priorRelease !== serialized) {
    throw new Error(
      `Immutable ${RELEASE_ID}@v${RELEASE_VERSION} differs from the rebuilt corpus. Create a new release/version; the prior release cannot be rewritten.`
    );
  }
  if (process.argv.includes('--check')) {
    if (priorRelease === null || priorReport !== report) {
      throw new Error('Checked-in contract-source release or coverage report is missing/stale.');
    }
  } else if (priorRelease === null) {
    await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await mkdir(path.dirname(REPORT_PATH), { recursive: true });
    await writeFile(OUTPUT_PATH, serialized, 'utf8');
    await writeFile(REPORT_PATH, report, 'utf8');
  }

  process.stdout.write(
    `${release.releaseId}@v${release.releaseVersion} ${release.releaseDigest}\n` +
      `${release.coverage.sourceObservationCount} observations / ${release.coverage.totalSourceContracts} contracts / ${release.coverage.completeRecordIds.length} complete / ${release.coverage.needsInputRecordIds.length} needs input\n`
  );
}

void main();
