import { z } from 'zod';

const NonEmptyStringZ = z.string().trim().min(1);
const MoneyZ = z
  .number()
  .finite()
  .nonnegative()
  .refine((value) => Number.isSafeInteger(Math.round(value * 100)), {
    message: 'must be safe money with at most cent precision',
  })
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, {
    message: 'must use at most cent precision',
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
