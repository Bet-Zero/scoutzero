/**
 * FILE: src/features/architect/utils/governedSeason/canonGovernedSeasonRegistry.ts
 * PURPOSE: The governed season registry anchored to the accepted Canon candidate.
 * OWNERSHIP: Feature: architect/governed season inputs
 *
 * BZE-270/BZE-280. CBA rule meaning and `SRC2-*` records remain transcribed
 * only from accepted Canon candidate
 * `6cf8aaf358c158a88e630e8a7336f7e9c3febc17` (Canon SHA-256
 * `23fe883f6f1aec7799fc3396bef404c250fd26beefa705582a5307766ad7ff76`),
 * §15.12.1 and §15.12.3. `POSTCANON-SRC-*` records are separately certified,
 * retained first-party factual inputs published after the Canon freeze. They
 * cannot introduce or reinterpret a CBA rule, and their Canon leaf mappings
 * are rule traceability only.
 *
 * WHAT THE ACCEPTED EVIDENCE ACTUALLY COVERS — read this before assuming a
 * season resolves:
 *
 *   `SRC2-003`  2023-24 Salary Cap only. No floor, tax, or apron level.
 *   `SRC2-004`  2026-27 Salary Cap, Minimum Team Salary, Tax Level, First
 *               Apron, and Second Apron — all five core levels.
 *   `SRC2-005`  2025-26 Regular Season opening and closing dates only. The
 *               Canon states this release certifies no transaction deadline
 *               and its dates may not be reused for another Season
 *               (`CBA2-S01.6`).
 *
 *   `POSTCANON-SRC-0001`  retained 2026-27 NBA Communications schedule release;
 *                         2026-10-20 opening and 2027-04-11 closing only.
 *
 * The post-Canon calendar combines with unchanged `SRC2-004` levels so Salary
 * Cap Year 2027 resolves complete. No other season gains coverage.
 */

import {
  createGovernedSeasonRegistry,
  type GovernedSeasonCalendarRecord,
  type GovernedSeasonRegistry,
  type GovernedSourceRecord,
  type GovernedSystemLevelRecord,
} from './governedSeasonRecords';
import { GOVERNING_TIME_ZONE } from './governedTime';

/** Accepted Canon candidate this registry is transcribed from. */
export const ACCEPTED_CANON_CANDIDATE_COMMIT =
  '6cf8aaf358c158a88e630e8a7336f7e9c3febc17';

/** SHA-256 of `docs/reference/cba/ARCHITECT_CBA_CANON.md` at that commit. */
export const ACCEPTED_CANON_SHA256 =
  '23fe883f6f1aec7799fc3396bef404c250fd26beefa705582a5307766ad7ff76';

const SOURCE_RECORDS: readonly GovernedSourceRecord[] = [
  {
    sourceRecordId: 'SRC2-003',
    sourceRecordVersion: 1,
    provenanceType: 'official-mutable',
    identity:
      'NBA Communications official release: NBA Salary Cap for 2023-24 season set at $136.021 million',
    sourceDateBasis: 'publication:2023-06-30',
    officialUrl:
      'https://pr.nba.com/nba-salary-cap-for-2023-24-season-set-at-136-021-million/',
    artifactSha256:
      'a6ddaa845d23429bbeb9699c39c00891a36c78e73636888e2cfb1f13ea85b804',
    artifactByteSize: 101545,
    retrievalTimestamp: '2026-07-23T11:23:46Z',
    authenticationTimestamp: null,
    verifierIdentity: 'agent:codex',
    verificationSessionId: 'session:r31-20260723-maker',
    verificationDate: '2026-07-23',
    recordLimitations:
      'Mutable webpage; hash is of the content retrieved at the recorded timestamp',
    recordStatus: 'current',
    canonLocator: 'ARCHITECT_CBA_CANON.md §15.12.1 / §15.12.3',
  },
  {
    sourceRecordId: 'SRC2-004',
    sourceRecordVersion: 1,
    provenanceType: 'official-mutable',
    identity:
      'NBA Communications official release: NBA sets Salary Cap for 2026-27 season at $164.961 million',
    sourceDateBasis: 'publication:2026-06-30',
    officialUrl: 'https://pr.nba.com/2026-27-salary-cap/',
    artifactSha256:
      '799f5c402e2aa44aef1b80732a0f007c546797f77c7747702030524baf744c72',
    artifactByteSize: 100746,
    retrievalTimestamp: '2026-07-23T11:23:46Z',
    authenticationTimestamp: null,
    verifierIdentity: 'agent:codex',
    verificationSessionId: 'session:r31-20260723-maker',
    verificationDate: '2026-07-23',
    recordLimitations:
      'Mutable webpage; hash is of the content retrieved at the recorded timestamp',
    recordStatus: 'current',
    canonLocator: 'ARCHITECT_CBA_CANON.md §15.12.1 / §15.12.3',
  },
  {
    sourceRecordId: 'SRC2-005',
    sourceRecordVersion: 1,
    provenanceType: 'official-mutable',
    identity:
      'NBA Communications official release: 2025-26 NBA regular-season schedule',
    sourceDateBasis: 'publication:2025-08-14',
    officialUrl: 'https://pr.nba.com/2025-26-nba-regular-season-schedule/',
    artifactSha256:
      'fb38ea144da8f2a8b26d8b605b3d1cde165a997c722e675913f9ce696ba2f01a',
    artifactByteSize: 117337,
    retrievalTimestamp: '2026-07-28T18:10:00Z',
    authenticationTimestamp: null,
    verifierIdentity: 'agent:codex',
    verificationSessionId: 'session:r6-20260728-maker',
    verificationDate: '2026-07-28',
    recordLimitations:
      'Mutable webpage; hash is of content retrieved for R6 and certifies only the stated 2025-26 schedule dates',
    recordStatus: 'current',
    canonLocator: 'ARCHITECT_CBA_CANON.md §15.12.1 / §15.12.3',
  },
  {
    sourceRecordId: 'POSTCANON-SRC-0001',
    sourceRecordVersion: 1,
    provenanceType: 'official-mutable',
    identity:
      'NBA Communications official release: 2026-27 NBA regular-season schedule',
    sourceDateBasis: 'publication:2026-08-13',
    officialUrl: 'https://pr.nba.com/2026-27-nba-regular-season-schedule/',
    artifactSha256:
      '2470130997194e83e2419cb272cb384473fe3444a8b2e4fd85b30608daf86c3f',
    artifactByteSize: 122319,
    retrievalTimestamp: '2026-08-17T23:37:21Z',
    authenticationTimestamp: null,
    verifierIdentity: 'agent:codex',
    verificationSessionId: 'session:bze-280-authority-gate',
    verificationDate: '2026-08-17',
    recordLimitations:
      'Mutable first-party webpage; this retained capture certifies only the stated 2026-27 regular-season endpoints. Two NBA Cup games per team remain unassigned within Dec. 4-10 and do not affect either endpoint.',
    recordStatus: 'current',
    canonLocator: null,
    postCanonCertification: {
      certificationRecordId: 'POSTCANON-CERT-0001',
      certificationRecordVersion: 1,
      authorityScope: 'time-varying-factual-input-only',
      publicationDate: '2026-08-13',
      firstPartyHost: 'pr.nba.com',
      retainedArtifactPath:
        'docs/reference/cba/source-artifacts/post-canon/2026-27-nba-regular-season-schedule.2470130997194e83e2419cb272cb384473fe3444a8b2e4fd85b30608daf86c3f.html',
      retainedArtifactSha256:
        '2470130997194e83e2419cb272cb384473fe3444a8b2e4fd85b30608daf86c3f',
      retainedArtifactByteSize: 122319,
      matchingFirstPartyRetrievalCount: 2,
      matchingRetrievalDate: '2026-08-17',
      exactFields: [
        {
          fieldId: 'regularSeasonOpening',
          sourceText:
            'American Express NBA Tip-Off 2026 will begin on Tuesday, Oct. 20',
          normalizedValue: '2026-10-20',
        },
        {
          fieldId: 'regularSeasonClosing',
          sourceText:
            'The NBA’s 81<sup>st</sup> regular season will conclude on Sunday, April 11, 2027',
          normalizedValue: '2027-04-11',
        },
        {
          fieldId: 'nbaCupUnassignedGameWindow',
          sourceText:
            'The two unassigned games for each team, to be played from Friday, Dec. 4 through Thursday, Dec. 10, will be determined based on the results of Group Play games in the Emirates NBA Cup 2026.',
          normalizedValue: '2026-12-04/2026-12-10',
        },
      ],
      supersedesCertificationRecordVersion: null,
      gateHistory: [
        {
          artifactSha256:
            '0169bb5c78a5ddd0727254dcc991222fbe4e82407b3ba36f60dcc038f002fb18',
          artifactByteSize: 122306,
          capturedOn: '2026-08-14',
          bytesRetained: false,
          runtimeAuthority: 'none',
          disposition: 'superseded-by-mutable-page-drift',
        },
      ],
    },
  },
];

const SYSTEM_LEVEL_CANON_LEAF_IDS = [
  'CBA2-S01.3',
  'CBA2-S01.4',
  'CBA2-S01.9',
  'CBA2-S02.5',
] as const;

/**
 * 2026-27 (Salary Cap Year 2027). `SRC2-004` states all five core levels in one
 * official release, so this is the only Salary Cap Year with a complete core
 * level set.
 */
const SALARY_CAP_YEAR_2027_LEVELS: readonly GovernedSystemLevelRecord[] = (
  [
    [
      'GOV-LVL-0001',
      'salary-cap',
      164_961_000,
      '2026-27 Salary Cap $164.961 million',
    ],
    [
      'GOV-LVL-0002',
      'minimum-team-salary',
      148_465_000,
      'Minimum Team Salary $148.465 million',
    ],
    ['GOV-LVL-0003', 'tax-level', 200_428_000, 'Tax Level $200.428 million'],
    [
      'GOV-LVL-0004',
      'first-apron',
      209_015_000,
      'First Apron Level $209.015 million',
    ],
    [
      'GOV-LVL-0005',
      'second-apron',
      221_686_000,
      'Second Apron Level $221.686 million',
    ],
  ] as const
).map(([recordId, levelId, amount, sourceField]) => ({
  recordId,
  recordVersion: 1,
  levelId,
  salaryCapYear: 2027,
  authority: 'official' as const,
  amount,
  sourceRecordId: 'SRC2-004',
  sourceRecordVersion: 1,
  sourceField: `SRC2-004 §15.12.3 "Exact values or text relied upon" — ${sourceField}`,
  effectiveFrom: '2026-07-01T00:00:00-04:00',
  effectiveUntil: '2027-07-01T00:00:00-04:00',
  canonLeafIds: SYSTEM_LEVEL_CANON_LEAF_IDS,
  recordStatus: 'current' as const,
  supersedesRecordVersion: null,
}));

/**
 * 2023-24 (Salary Cap Year 2024). `SRC2-004`'s indexing base. The release
 * states the Salary Cap and nothing else, so the floor, tax, and apron levels
 * for this year stay unavailable rather than being derived here.
 */
const SALARY_CAP_YEAR_2024_LEVELS: readonly GovernedSystemLevelRecord[] = [
  {
    recordId: 'GOV-LVL-0006',
    recordVersion: 1,
    levelId: 'salary-cap',
    salaryCapYear: 2024,
    authority: 'official',
    amount: 136_021_000,
    sourceRecordId: 'SRC2-003',
    sourceRecordVersion: 1,
    sourceField:
      'SRC2-003 §15.12.3 "Exact values or text relied upon" — 2023-24 Salary Cap $136.021 million',
    effectiveFrom: '2023-07-01T00:00:00-04:00',
    effectiveUntil: '2024-07-01T00:00:00-04:00',
    canonLeafIds: SYSTEM_LEVEL_CANON_LEAF_IDS,
    recordStatus: 'current',
    supersedesRecordVersion: null,
  },
];

/**
 * 2025-26 (Salary Cap Year 2026). `SRC2-005` certifies the two Regular Season
 * endpoints and explicitly no transaction deadline.
 */
const SEASON_CALENDARS: readonly GovernedSeasonCalendarRecord[] = [
  {
    recordId: 'GOV-CAL-0001',
    recordVersion: 1,
    salaryCapYear: 2026,
    seasonKey: '2025-26',
    authority: 'official',
    regularSeasonOpening: {
      value: '2025-10-21',
      precision: 'date-only',
      governingTimeZone: GOVERNING_TIME_ZONE,
    },
    regularSeasonClosing: {
      value: '2026-04-12',
      precision: 'date-only',
      governingTimeZone: GOVERNING_TIME_ZONE,
    },
    sourceRecordId: 'SRC2-005',
    sourceRecordVersion: 1,
    sourceField:
      'SRC2-005 §15.12.3 "Exact values or text relied upon" — Regular Season begins 2025-10-21 and ends 2026-04-12',
    publicationDate: '2025-08-14',
    effectiveFrom: '2025-07-01T00:00:00-04:00',
    effectiveUntil: '2026-07-01T00:00:00-04:00',
    canonLeafIds: ['CBA2-L01.2', 'CBA2-L01.8', 'CBA2-L01.9', 'CBA2-S01.6'],
    recordStatus: 'current',
    supersedesRecordVersion: null,
    uncertifiedFields: ['tradeDeadline'],
  },
  {
    recordId: 'GOV-CAL-0002',
    recordVersion: 1,
    salaryCapYear: 2027,
    seasonKey: '2026-27',
    authority: 'official',
    regularSeasonOpening: {
      value: '2026-10-20',
      precision: 'date-only',
      governingTimeZone: GOVERNING_TIME_ZONE,
    },
    regularSeasonClosing: {
      value: '2027-04-11',
      precision: 'date-only',
      governingTimeZone: GOVERNING_TIME_ZONE,
    },
    sourceRecordId: 'POSTCANON-SRC-0001',
    sourceRecordVersion: 1,
    sourceField:
      'American Express NBA Tip-Off 2026 will begin on Tuesday, Oct. 20 | The NBA’s 81<sup>st</sup> regular season will conclude on Sunday, April 11, 2027',
    publicationDate: '2026-08-13',
    effectiveFrom: '2026-07-01T00:00:00-04:00',
    effectiveUntil: '2027-07-01T00:00:00-04:00',
    canonLeafIds: ['CBA2-L01.2', 'CBA2-L01.8', 'CBA2-L01.9', 'CBA2-S01.6'],
    recordStatus: 'current',
    supersedesRecordVersion: null,
    uncertifiedFields: ['tradeDeadline', 'nbaCupGameAssignments'],
  },
];

/** The governed registry the Architect ships with. */
export const CANON_GOVERNED_SEASON_REGISTRY: GovernedSeasonRegistry =
  createGovernedSeasonRegistry({
    registryId: 'architect-governed-season-registry',
    registryVersion: 2,
    canonCandidateCommit: ACCEPTED_CANON_CANDIDATE_COMMIT,
    canonSha256: ACCEPTED_CANON_SHA256,
    sourceRecords: SOURCE_RECORDS,
    systemLevels: [
      ...SALARY_CAP_YEAR_2024_LEVELS,
      ...SALARY_CAP_YEAR_2027_LEVELS,
    ],
    calendars: SEASON_CALENDARS,
  });
