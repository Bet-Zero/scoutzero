import {
  SoftwareSeasonContextZ,
  type SoftwareSeasonContext,
} from '@/schemas/softwareSeasonContext';
import { CANON_GOVERNED_SEASON_REGISTRY } from './canonGovernedSeasonRegistry';
import {
  createGovernedSeasonRegistry,
  type GovernedSystemLevelId,
} from './governedSeasonRecords';
import { seasonKeyForSalaryCapYear, salaryCapYearWindow } from './governedTime';
import { isSoftwareSeasonEnvironment } from './softwareSeasonEnvironment';
import { deterministicStateDigest } from '../contractSource/deterministicDigest';

const levels: Record<GovernedSystemLevelId, keyof SoftwareSeasonContext> = {
  'salary-cap': 'salaryCap',
  'minimum-team-salary': 'minimumTeamSalary',
  'tax-level': 'luxuryTax',
  'first-apron': 'firstApron',
  'second-apron': 'secondApron',
};

/** Reusable registry adapter. Explicit software authority never satisfies official requests. */
export function softwareSeasonRegistry(
  values: readonly SoftwareSeasonContext[]
) {
  if (!isSoftwareSeasonEnvironment())
    throw new Error('Protected software season inputs are unavailable.');
  const contexts = values.map((c) => SoftwareSeasonContextZ.parse(c));
  if (new Set(contexts.map((c) => c.salaryCapYear)).size !== contexts.length)
    throw new Error('Conflicting software seasons.');
  const identity = deterministicStateDigest(contexts);
  return createGovernedSeasonRegistry({
    registryId: `software-seasons:${identity}`,
    registryVersion: 1,
    canonCandidateCommit: CANON_GOVERNED_SEASON_REGISTRY.canonCandidateCommit,
    canonSha256: CANON_GOVERNED_SEASON_REGISTRY.canonSha256,
    sourceRecords: contexts.map((c) => ({
      sourceRecordId: c.id,
      sourceRecordVersion: 1,
      provenanceType: 'software-test' as const,
      identity: `Software assumptions only: ${c.id}`,
      sourceDateBasis: null,
      officialUrl: null,
      artifactSha256: null,
      artifactByteSize: null,
      retrievalTimestamp: null,
      authenticationTimestamp: null,
      verifierIdentity: 'software-scenario',
      verificationSessionId: identity,
      verificationDate: c.regularSeasonOpening,
      recordLimitations:
        'Not authenticated NBA facts. Protected software worlds only.',
      recordStatus: 'current' as const,
      canonLocator: 'Rule traceability only; values are software assumptions',
    })),
    systemLevels: contexts.flatMap((c) =>
      Object.entries(levels).map(([levelId, field]) => ({
        recordId: `${c.id}:${levelId}`,
        recordVersion: 1,
        levelId: levelId as GovernedSystemLevelId,
        salaryCapYear: c.salaryCapYear,
        authority: 'software-test' as const,
        amount: Number(c[field]),
        sourceRecordId: c.id,
        sourceRecordVersion: 1,
        sourceField: field,
        effectiveFrom: salaryCapYearWindow(c.salaryCapYear)!.from,
        effectiveUntil: salaryCapYearWindow(c.salaryCapYear)!.until,
        canonLeafIds: ['CBA2-S01.6'],
        recordStatus: 'current' as const,
        supersedesRecordVersion: null,
      }))
    ),
    calendars: contexts.map((c) => ({
      recordId: `${c.id}:calendar`,
      recordVersion: 1,
      salaryCapYear: c.salaryCapYear,
      seasonKey: seasonKeyForSalaryCapYear(c.salaryCapYear)!,
      authority: 'software-test' as const,
      regularSeasonOpening: {
        value: c.regularSeasonOpening,
        precision: 'date-only' as const,
        governingTimeZone: 'America/New_York',
      },
      regularSeasonClosing: {
        value: c.regularSeasonClosing,
        precision: 'date-only' as const,
        governingTimeZone: 'America/New_York',
      },
      sourceRecordId: c.id,
      sourceRecordVersion: 1,
      sourceField: 'regularSeasonOpening/regularSeasonClosing',
      publicationDate: `${c.salaryCapYear - 1}-07-01`,
      effectiveFrom: salaryCapYearWindow(c.salaryCapYear)!.from,
      effectiveUntil: salaryCapYearWindow(c.salaryCapYear)!.until,
      canonLeafIds: ['CBA2-L01.2', 'CBA2-S01.6'],
      recordStatus: 'current' as const,
      supersedesRecordVersion: null,
      uncertifiedFields: ['tradeDeadline', 'draftOrder'],
    })),
  });
}

/** Do not silently fall back when a saved software context is malformed or denied. */
export function teamSoftwareSeason(
  team: unknown,
  year: number
): SoftwareSeasonContext | null {
  const raw = (
    team as { salaryBookInputs?: { softwareSeasonContext?: unknown } } | null
  )?.salaryBookInputs?.softwareSeasonContext;
  if (raw === undefined) return null;
  if (!isSoftwareSeasonEnvironment())
    throw new Error(
      'Software season inputs cannot authorize this environment.'
    );
  const c = SoftwareSeasonContextZ.parse(raw);
  // Other-year displays may show projections, but the dated books remain unavailable.
  if (c.salaryCapYear !== year) return null;
  return c;
}

export function softwareCapSettings(c: SoftwareSeasonContext) {
  return {
    salaryCap: c.salaryCap,
    floor: c.minimumTeamSalary,
    luxuryTax: c.luxuryTax,
    firstApron: c.firstApron,
    secondApron: c.secondApron,
    confirmed: false,
  };
}
