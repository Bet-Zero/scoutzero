import { z } from 'zod';

const NonEmptyStringZ = z.string().trim().min(1);
export function isGovernedMoney(value: unknown): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return false;
  }
  const cents = value * 100;
  const roundedCents = Math.round(cents);
  const tolerance =
    Number.EPSILON * Math.max(1, Math.abs(cents), Math.abs(roundedCents)) * 4;
  return (
    Number.isSafeInteger(roundedCents) &&
    Math.abs(cents - roundedCents) <= tolerance
  );
}

const MoneyZ = z.number().refine(isGovernedMoney, {
  message: 'must be finite, nonnegative safe money with at most cent precision',
});
const ZonedInstantZ = z.string().datetime({ offset: true });

export const GovernedUnsignedFirstRoundPickEntryZ = z
  .object({
    pickId: NonEmptyStringZ,
    playerId: NonEmptyStringZ,
    teamCode: NonEmptyStringZ,
    salaryCapYear: z.number().int(),
    teamSalaryAmount: MoneyZ,
    includedInTeamSalary: z.literal(true),
    requiresUnresolvedDraftDetermination: z.literal(false),
    canonLeafIds: z.tuple([z.literal('CBA2-C02.1'), z.literal('CBA2-C03.1')]),
  })
  .strict();

const EvidenceSourceZ = z
  .object({
    evidenceId: NonEmptyStringZ,
    evidenceVersion: z.number().int().positive(),
    authority: z.enum(['official', 'external-determination']),
    reference: NonEmptyStringZ,
    authenticatedAt: ZonedInstantZ,
    recordStatus: z.literal('current'),
    canonLeafIds: z.tuple([z.literal('CBA2-C02.1'), z.literal('CBA2-C03.1')]),
  })
  .strict();

const ReadyStateZ = z
  .object({
    version: z.literal(1),
    status: z.literal('ready'),
    teamCode: NonEmptyStringZ,
    salaryCapYear: z.number().int(),
    entries: z.array(GovernedUnsignedFirstRoundPickEntryZ),
    source: EvidenceSourceZ,
  })
  .strict()
  .superRefine((state, context) => {
    const pickIds = new Set<string>();
    const playerIds = new Set<string>();
    state.entries.forEach((entry, index) => {
      if (entry.teamCode !== state.teamCode) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['entries', index, 'teamCode'],
          message: 'pick team identity must match its evidence envelope',
        });
      }
      if (entry.salaryCapYear !== state.salaryCapYear) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['entries', index, 'salaryCapYear'],
          message: 'pick Salary Cap Year must match its evidence envelope',
        });
      }
      if (pickIds.has(entry.pickId) || playerIds.has(entry.playerId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['entries', index],
          message: 'pick and player identities must be unique',
        });
      }
      pickIds.add(entry.pickId);
      playerIds.add(entry.playerId);
    });
  });

const NeedsInputStateZ = z
  .object({
    version: z.literal(1),
    status: z.literal('needs-input'),
    teamCode: NonEmptyStringZ,
    salaryCapYear: z.number().int(),
    missingInputs: z.array(NonEmptyStringZ).min(1),
    reason: NonEmptyStringZ,
  })
  .strict();

export const GovernedUnsignedFirstRoundPickStateZ = z.discriminatedUnion(
  'status',
  [ReadyStateZ, NeedsInputStateZ]
);

export type GovernedUnsignedFirstRoundPickState = z.infer<
  typeof GovernedUnsignedFirstRoundPickStateZ
>;

const CanonLeafIdsZ = z
  .tuple([
    z.literal('CBA2-C03.1'),
    z.literal('CBA2-C03.2'),
    z.literal('CBA2-C07.11'),
  ])
  .readonly();
const WindowZ = z
  .object({
    opens: z.string().date(),
    closes: z.string().date().nullable(),
  })
  .strict();
const CountsZ = z
  .object({
    underContract: z.number().int().nonnegative(),
    veteranFreeAgentAmounts: z.number().int().nonnegative(),
    offerSheets: z.number().int().nonnegative(),
    unsignedFirstRoundPicks: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  })
  .strict();

const CompleteResolutionZ = z
  .object({
    mode: z.literal('governed'),
    status: z.literal('complete'),
    activeWindow: z.boolean(),
    window: WindowZ,
    counts: CountsZ,
    threshold: z.literal(12),
    missingSlots: z.number().int().nonnegative(),
    chargePerSlot: MoneyZ,
    amount: MoneyZ,
    canonLeafIds: CanonLeafIdsZ,
    missingInputs: z.tuple([]),
    reason: NonEmptyStringZ,
  })
  .strict()
  .superRefine((resolution, context) => {
    if (resolution.activeWindow && resolution.window.closes === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['window', 'closes'],
        message: 'must be known while the governed charge window is active',
      });
    }
    const counted =
      resolution.counts.underContract +
      resolution.counts.veteranFreeAgentAmounts +
      resolution.counts.offerSheets +
      resolution.counts.unsignedFirstRoundPicks;
    if (resolution.counts.total !== counted) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['counts', 'total'],
        message: 'must equal the four governed count categories',
      });
    }
    const expectedSlots = resolution.activeWindow
      ? Math.max(0, resolution.threshold - counted)
      : 0;
    const expectedRate = resolution.activeWindow
      ? resolution.chargePerSlot
      : 0;
    if (
      resolution.missingSlots !== expectedSlots ||
      (!resolution.activeWindow &&
        (counted !== 0 || resolution.chargePerSlot !== 0)) ||
      Math.abs(resolution.amount - expectedSlots * expectedRate) > 1e-6
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['amount'],
        message:
          'must reconcile the governed window, count, threshold, and per-slot charge',
      });
    }
  });

const NeedsInputResolutionZ = z
  .object({
    mode: z.literal('governed'),
    status: z.literal('needs-input'),
    activeWindow: z.boolean().nullable(),
    window: WindowZ.nullable(),
    counts: z.null(),
    threshold: z.literal(12),
    missingSlots: z.null(),
    chargePerSlot: z.null(),
    amount: z.null(),
    canonLeafIds: CanonLeafIdsZ,
    missingInputs: z.array(NonEmptyStringZ).min(1),
    reason: NonEmptyStringZ,
  })
  .strict();

export const GovernedIncompleteRosterResolutionZ = z.discriminatedUnion(
  'status',
  [CompleteResolutionZ, NeedsInputResolutionZ]
);

export type GovernedIncompleteRosterResolution = z.infer<
  typeof GovernedIncompleteRosterResolutionZ
>;
