/** Offline BZE-344 compiler. Reads existing private evidence; never publishes/adopts. */
import {
  readFileSync,
  mkdirSync,
  realpathSync,
  writeFileSync,
  existsSync,
} from 'node:fs';
import { resolve, relative, join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { TeamListFull } from '../../src/constants/teamList';
import {
  prepareDraftWorldBaseline,
  previewStartingStateOriginals,
} from '../../src/features/architect/utils/draftStartingState';
import {
  DraftStartingStateCandidateZ,
  JUNE5_START,
} from '../../src/schemas/draftStartingState';
import { canonicalStringify } from '../../src/features/architect/utils/contractSource/deterministicDigest';
import recovery from './june5DraftPreparationRecovery.json';

type Json = any; // Retained source documents have historical, independently owned schemas.
const sha = (bytes: string | Buffer) =>
  createHash('sha256').update(bytes).digest('hex');
const read = (path: string): Json => JSON.parse(readFileSync(path, 'utf8'));
const assert = (ok: boolean, message: string) => {
  if (!ok) throw new Error(message);
};
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url)));

export async function compileJune5DraftState(paths: {
  assessmentRoot: string;
  recoveredRoot: string;
  cataloguePath: string;
}) {
  const root = realpathSync(paths.assessmentRoot);
  const recovered = realpathSync(paths.recoveredRoot);
  const files: { locator: string; sha256: string }[] = [];
  const source = (base: string, path: string, locator: string) => {
    const bytes = readFileSync(join(base, path));
    const expected = recovery.files.find((f) => f.locator === locator);
    assert(
      Boolean(expected) && sha(bytes) === expected!.sha256,
      `Extracted source recovery mismatch: ${locator}`
    );
    files.push({ locator, sha256: sha(bytes) });
    return JSON.parse(bytes.toString('utf8')) as Json;
  };
  // Recovery integrity is not a new installed trust pin or a source promotion.
  const assessmentText = readFileSync(join(root, 'admission-map.json'), 'utf8');
  assert(
    sha(assessmentText) ===
      '7b71c6f9c69addc66ead13d05102e3b4a5001adef3dfd168ef6fedf8d1c5ce88',
    'C6 assessment recovery mismatch'
  );
  assert(
    sha(readFileSync(join(root, 'c6-admission-assessment.tar.gz'))) ===
      '43a129a009af323d0bd369f4bd173cb9cd00fd5995326651159aaa7b09d12ee9',
    'C6 archive recovery mismatch'
  );
  const assessment = JSON.parse(assessmentText);
  for (const [name, pin] of Object.entries(assessment.summary.sourceFiles) as [
    string,
    Json,
  ][]) {
    assert(
      sha(readFileSync(join(root, name))) === pin.sha256,
      `Recovered archive mismatch: ${name}`
    );
  }
  const catalogueText = readFileSync(paths.cataloguePath, 'utf8');
  assert(
    sha(catalogueText) === assessment.summary.catalogue.payloadSha256,
    'Catalogue recovery mismatch'
  );
  const catalogue = JSON.parse(catalogueText);
  const baseline = source(
    root,
    'v12/output/june5-readiness.json',
    '1ca449af:output/june5-readiness.json'
  );
  assert(
    files.at(-1)!.sha256 === catalogue.inventorySha256,
    'Inventory recovery mismatch'
  );
  const cells = source(
    root,
    'v12/output/may26-holder-transcription.json',
    '1ca449af:output/may26-holder-transcription.json'
  );
  const ledger = source(
    root,
    'v12/output/june2-ledger-transcription.json',
    '1ca449af:output/june2-ledger-transcription.json'
  );
  const assets = source(
    root,
    'v12/output/starting-asset-mapping.json',
    '1ca449af:output/starting-asset-mapping.json'
  );
  const native = source(
    root,
    'v12/output/starting-right-mapping.json',
    '1ca449af:output/starting-right-mapping.json'
  );
  const f = source(
    root,
    'familyF/family-f/candidate.json',
    '71a9a97e:family-f/candidate.json'
  );
  const fClaims = source(
    root,
    'familyF/family-f/claims-and-membership.json',
    '71a9a97e:family-f/claims-and-membership.json'
  );
  const repair = source(
    root,
    'audit/bze309-consolidated-audit-20261009/repair/replacement-records.json',
    '50901231:repair/replacement-records.json'
  );
  const d = source(
    recovered,
    'familyD/family-d-candidate/candidate.json',
    'ca3fbacf:family-d-candidate/candidate.json'
  );
  assert(
    sha(readFileSync(join(recovered, 'familyD.archive'))) ===
      '99828051873a1a88a55713c7347faa208706dcaf9943d3f27761286002df9aa1',
    'Family D recovery mismatch'
  );
  const corrected = source(
    recovered,
    'holders/author-checkpoint/holder-delta-staging.json',
    '9f56d9ac:author-checkpoint/holder-delta-staging.json'
  );
  assert(
    sha(readFileSync(join(recovered, 'holders.archive'))) ===
      'c4a2c7952294482a1f359eaed5c518ec864f4ec8ba399118f0203606bb88d708',
    'Holder recovery mismatch'
  );
  const deltas = ['od-n2-1', 'followup', 'next', 'final'].map((name) =>
    source(
      root,
      `checkpoint/current/${name}-delta.json`,
      `d5ce47ad:current/${name}-delta.json`
    )
  );
  const changes = deltas.flatMap((x) => x.statusChanges);
  const comments = source(
    recovered,
    'accepted-comments.json',
    'BZE-309:accepted-comments'
  );
  for (const id of [
    'a3925d77-4e1e-4f5b-b4ed-776dcd711233',
    'b91d5c8d-d2a7-43bf-9674-a8bce8a4a9df',
    '32754373-0d79-4a84-a10e-a8e1a5c51b95',
    'e8c66157-5c85-4086-95dd-56d1eb87401d',
  ]) {
    assert(
      comments.some((c: Json) => c.id === id && c.body.includes('ACCEPT')),
      `Missing accepted scope: ${id}`
    );
  }
  const acceptedNotAbove = new Map<string, string>();
  // Newly compiled NBA values remain private. These bindings preserve accepted
  // scopes, and still require independent source admission of the candidate.
  const bindings = source(
    recovered,
    'accepted-value-bindings.json',
    'BZE344:accepted-value-bindings.json'
  );
  for (const row of bindings.historicalNotAbove) {
    assert(
      comments.some((c: Json) => c.id === row.reviewCommentId),
      'Missing binding review'
    );
    acceptedNotAbove.set(row.dependencyId, row.reviewCommentId);
  }
  const aliases: Record<string, string> = {
    BRK: 'BKN',
    SAN: 'SAS',
    UTH: 'UTA',
    PHL: 'PHI',
    GOS: 'GSW',
  };
  const holders = new Map<
    string,
    { team: string; refs: string[]; limitations: string[] }
  >();
  // Extract explicit holder words, never ownership from an ID or an empty cell.
  // Only the C6 accepted-state partition can select these values below.
  for (const cell of cells.rows) {
    const own = /^(?:Own(?:\s|;|$)|[A-Z]{3} \(Own\))/.test(
      cell.fullFirstRoundText
    );
    const to = /^To ([A-Z]{3})(?:\s|;|$)/.exec(cell.fullFirstRoundText);
    if (own || to)
      holders.set(cell.originalPick, {
        team: own ? cell.team : (aliases[to![1]] ?? to![1]),
        refs: [`1ca449af:output/may26-holder-transcription.json#${cell.id}`],
        limitations: [
          'Reported holder component only; attached claims and complete Stepien coverage are separate.',
          'Earlier publication is used only with the accepted June 5 holder disposition; no general continuity inference.',
        ],
      });
  }
  for (const row of corrected.changes)
    holders.set(row.asset, {
      team: row.reportedHolder,
      refs: [
        `9f56d9ac:author-checkpoint/holder-delta-staging.json#${row.dependencyId}`,
      ],
      limitations: [row.scope],
    });
  for (const row of d.candidateOperations)
    holders.set(row.dependencyId.split(':')[1], {
      team: row.proposedHolder,
      refs: [`ca3fbacf:family-d-candidate/candidate.json#${row.dependencyId}`],
      limitations: Object.values(d.carriedLimitations),
    });
  // Reuse the exact three-holder review; the Frozen label alone proves no holder.
  for (const row of bindings.frozenHolderBindings) {
    assert(
      comments.some((c: Json) => c.id === row.reviewCommentId) &&
        fClaims.frozenTrackerCells.some(
          (c: Json) => `${c.team}_${c.draftYear}_1st` === row.pick
        ),
      'Missing frozen-holder scope'
    );
    holders.set(row.pick, {
      team: row.team,
      refs: row.refs,
      limitations: row.limitations,
    });
  }
  for (const { pick, team, dependencyId } of bindings.transferBindings) {
    const delta = changes.find(
      (x) =>
        x.id === dependencyId &&
        x.id === `ownership-state:${pick}` &&
        x.to === 'supported'
    );
    assert(Boolean(delta), `Missing accepted transfer: ${pick}`);
    holders.set(pick, {
      team,
      refs: [
        `d5ce47ad:current/followup-delta.json#${delta.id}`,
        ...delta.evidenceLocators,
      ],
      limitations: [delta.reason],
    });
  }
  const records = assessment.records.map((row: Json) => {
    const cat = catalogue.records.find(
      (r: Json) => r.entitlementId === row.entitlementId
    );
    const asset = assets.find(
      (r: Json) => r.entitlementId === row.entitlementId
    );
    const holder =
      row.ownershipComponent?.acceptedState === 'supported'
        ? holders.get(row.originalPick.id)
        : undefined;
    assert(
      row.ownershipComponent?.acceptedState !== 'supported' || Boolean(holder),
      `Accepted holder value not bound: ${row.entitlementId}`
    );
    return {
      entitlementId: row.entitlementId,
      originalPick: row.originalPick,
      group: row.group,
      acceptedHolderState: row.ownershipComponent?.acceptedState ?? null,
      reportedHolder: holder?.team ?? null,
      holderEvidenceRefs: holder
        ? [
            ...holder.refs,
            `C6:admission-map.json#${row.entitlementId}/ownershipComponent`,
          ]
        : [],
      holderLimitations: holder?.limitations ?? [],
      ownershipFact: cat.ownership,
      nativeAssets: row.nativeAssets,
      duplicateRepresentationNote: row.duplicateRepresentationNote,
      retainedAssessment: row,
      excludedLaterAssertionIds: row.laterDatedAssertionIdsExcludedFromStart,
      retainedTerms: row.baselineDependencyIdsUnchanged
        .map((id: string) => ({
          dependencyId: id,
          sourceRefs: [`1ca449af:output/june5-readiness.json#${id}`],
          content: {
            historicalDependency: baseline.dependencies.find(
              (d: Json) => d.id === id
            ),
            acceptedScope: row.acceptedLaterScopeReferences[id] ?? null,
            // The immutable source and its old status remain history, not new operative terms.
            currentStatusNotInferredFromHistoricalRecord: true,
          },
        }))
        .concat([
          {
            dependencyId: `source-context:${row.entitlementId}`,
            sourceRefs: [
              `1ca449af:output/starting-asset-mapping.json#${row.entitlementId}`,
            ],
            content: {
              startingAssetMapping: asset,
              nativeMapping:
                native.find((r: Json) => r.legacyId === row.entitlementId) ??
                null,
              publishedStartingClauses: ledger.paragraphs.filter(
                (p: Json) =>
                  p.round === 1 &&
                  asset.underlyingPickStateReferences.some((s: Json) =>
                    s.june2OriginalTeamOutgoingParagraphIds.includes(p.id)
                  )
              ),
              scope:
                'Retained source clauses and original lineage. Only separately accepted scopes are operative; no later event is backdated.',
            },
          },
        ]),
    };
  });
  const unresolved = new Set(
    assessment.exactUnresolvedMappings.map((x: Json) => x.dependencyId)
  );
  const apronHistory = baseline.dependencies
    .filter((x: Json) => x.id.startsWith('season:'))
    .map((dep: Json) => {
      const [, team, season] = dep.id.split(':');
      const year = Number(season.slice(0, 4));
      const op = f.candidateOperations.find(
        (x: Json) => x.dependencyId === dep.id
      );
      const final = repair.records.find(
        (x: Json) => x.id === dep.id && x.status === 'supported'
      );
      const comment = acceptedNotAbove.get(dep.id);
      const value =
        op?.proposedAboveSecondApron ?? (final || comment ? false : null);
      // Preserve the accepted DSE-2 set only. Do not extend it automatically using
      // the three later audit closures (review W4 requires a separate disposition).
      const gates = (year === 2029 ? [2025] : [2024, 2025]).map(
        (y) =>
          `season:${team}:${y}-${String(y + 1).slice(-2)}:last-regular-game-start`
      );
      const inactive =
        year >= 2026 &&
        year <= 2029 &&
        gates.every(
          (id) =>
            acceptedNotAbove.has(id) ||
            f.candidateOperations.some(
              (x: Json) =>
                x.dependencyId === id && x.proposedAboveSecondApron === false
            )
        );
      return {
        dependencyId: dep.id,
        team,
        seasonStartYear: year,
        state:
          year > 2025
            ? 'future-pending'
            : unresolved.has(dep.id)
              ? 'unresolved'
              : 'supported',
        aboveSecondApron: value,
        valueBinding:
          value !== null
            ? 'bound'
            : year <= 2025 && !unresolved.has(dep.id)
              ? 'accepted-value-not-yet-bound'
              : 'not-established',
        lifecycleRelevance: inactive
          ? 'conditional-non-applicable'
          : 'retained',
        restoreIfGateReopened: inactive ? gates : [],
        sourceRefs: [
          op
            ? `71a9a97e:family-f/candidate.json#${dep.id}`
            : final
              ? `50901231:repair/replacement-records.json#${dep.id}`
              : comment
                ? `BZE-309#comment-${comment}`
                : `C6:summary/acceptedDependencyAccounting;1ca449af:output/june5-readiness.json#${dep.id}`,
          ...(inactive
            ? ['BZE-309#comment-e8c66157-5c85-4086-95dd-56d1eb87401d']
            : []),
        ],
        limitations: [
          'Historical scoped determination; numeric Apron Team Salary is not established.',
          ...(comment
            ? [
                'Accepted historical determination may use a later report/trade to establish the earlier measurement fact; that later event is not installed as starting custody.',
              ]
            : []),
          ...(inactive
            ? [
                'Conditional bookkeeping within the retained 2032–2033 universe; restore references when a named gate reopens or the universe expands. Not a claim that the future season is not measured.',
              ]
            : []),
          ...(value === null && year <= 2025 && !unresolved.has(dep.id)
            ? [
                'Accepted disposition retained; recover the exact accepted value-bearing support before lifecycle consumption.',
              ]
            : []),
        ],
        numericSalaryEstablished: false,
      };
    });
  assert(
    apronHistory.filter(
      (x: Json) => x.lifecycleRelevance === 'conditional-non-applicable'
    ).length === 89,
    'Accepted DSE-2 membership mismatch'
  );
  assert(
    apronHistory.filter((x: Json) => x.valueBinding === 'bound').length === 57,
    'Historical Apron value membership mismatch'
  );
  const contractPath = join(
    repo,
    'public/architect/contract-source-releases/salaryswish-retained-2026-06-05-v1.json'
  );
  const contract = read(contractPath);
  const financialMissing = [
    'dated-roster-and-dead-cap-and-cap-holds',
    'apron-adjustments-and-tax-salary',
    'hard-cap-trigger-history-and-remaining-capacity',
    'unsigned-firsts-and-incomplete-roster-state',
    'mechanism-specific-contract-salary-basis-and-incentives',
    'cash-or-exception-ledger-when-elected',
  ];
  const candidate = DraftStartingStateCandidateZ.parse({
    version: 1,
    purpose: 'private-starting-state-preparation',
    asOf: JUNE5_START,
    salaryCapYear: 2026,
    authority: 'pending-independent-source-admission',
    apply: 'blocked',
    inventorySha256: catalogue.inventorySha256,
    assessmentSha256: sha(assessmentText),
    catalogueSha256: sha(catalogueText),
    sourceFiles: files,
    contractRelease: {
      releaseId: contract.releaseId,
      releaseVersion: contract.releaseVersion,
      releaseDigest: contract.releaseDigest,
    },
    records,
    unresolved: assessment.exactUnresolvedMappings,
    apronHistory,
    teamInputs: TeamListFull.map((t) => ({
      team: t.code,
      missingInputs: financialMissing,
      salaryBookInputs: {
        version: 1,
        salaryCapYear: 2026,
        apronAdjustments: {
          status: 'needs-input',
          missingInputs: ['qualified-june5-apron-adjustments'],
          reason:
            'Retained payroll sums are not authenticated Apron Team Salary.',
        },
        taxSalary: {
          status: 'needs-input',
          missingInputs: ['qualified-june5-tax-salary'],
          reason: 'No dated complete tax-salary input is established.',
        },
      },
    })),
  });
  const world = await prepareDraftWorldBaseline({
    candidate,
    assessmentText,
    catalogueText,
    contractRelease: contract,
    worldId: 'june5-candidate-review',
    asOfDate: '2026-06-05',
    season: '2025-26',
  });
  // Concrete known custody anchor; deliberately no invented counterparty or exchange.
  const anchor = records.find((r: Json) => r.ownershipFact)!;
  const preview = previewStartingStateOriginals(world.draftCandidate, {
    request: {
      context: {
        proposalSha256: sha(
          'BZE-344:incomplete-preparation-anchor-not-a-trade'
        ),
        stateVersion: 'unadopted-candidate',
        releaseId: 'unadopted-june5-candidate',
        asOf: JUNE5_START,
        team: anchor.reportedHolder,
      },
      outgoing: [anchor.originalPick],
    },
  });
  return { candidate, world, preview };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [assessmentRoot, recoveredRoot, cataloguePath, output] =
    process.argv.slice(2);
  assert(
    Boolean(assessmentRoot && recoveredRoot && cataloguePath && output),
    'Usage: node --import tsx scripts/architect/prepareJune5DraftState.ts <C6 root> <recovered root> <catalogue JSON> <NEW private output directory>'
  );
  const destination = resolve(output);
  assert(
    !existsSync(destination),
    'Output directory must be new; retained files are never overwritten.'
  );
  const parent = realpathSync(resolve(destination, '..'));
  const fromRepo = relative(repo, parent);
  assert(
    (fromRepo === '..' || fromRepo.startsWith('../')) &&
      !parent.split('/').includes('public') &&
      !destination.split('/').includes('public'),
    'Private output must be outside repository/public directories.'
  );
  const result = await compileJune5DraftState({
    assessmentRoot,
    recoveredRoot,
    cataloguePath,
  });
  mkdirSync(destination, { mode: 0o700 });
  const outputs: Record<string, unknown> = {
    'candidate.json': result.candidate,
    'world-preparation.json': result.world,
    'ownership-anchor-preview.json': result.preview,
  };
  const members = Object.entries(outputs).map(([name, value]) => {
    const bytes = canonicalStringify(value) + '\n';
    writeFileSync(join(destination, name), bytes, { flag: 'wx', mode: 0o600 });
    return { name, bytes: Buffer.byteLength(bytes), sha256: sha(bytes) };
  });
  writeFileSync(
    join(destination, 'manifest.json'),
    JSON.stringify(
      {
        version: 1,
        members,
        sourceFiles: result.candidate.sourceFiles,
        runtimeAuthority: false,
        durability:
          'local-only; no authorized export or verified durable backup',
      },
      null,
      2
    ) + '\n',
    { flag: 'wx', mode: 0o600 }
  );
  console.log(
    JSON.stringify(
      {
        members,
        identities: result.candidate.records.length,
        unresolved: result.candidate.unresolved.length,
        writes: result.world.writes.length,
        apply: result.world.apply,
      },
      null,
      2
    )
  );
}
