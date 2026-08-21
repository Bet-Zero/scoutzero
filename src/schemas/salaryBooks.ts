import { z } from 'zod';
import { JsonValueZ } from './common';

export const SalaryBookStatusZ = z.enum([
  'complete',
  'needs-input',
  'not-evaluated',
]);

export const SalaryLedgerKindZ = z.enum([
  'team-salary',
  'apron-team-salary',
  'tax-salary',
]);

export const SalaryLedgerSourceZ = z
  .object({
    authority: z.enum(['canon', 'team-state', 'external-determination']),
    reference: z.string().min(1),
  })
  .strict();

export const SalaryLedgerLineItemZ = z
  .object({
    id: z.string().min(1),
    ledger: SalaryLedgerKindZ,
    label: z.string().min(1),
    amount: z.number().finite(),
    effectiveFrom: z.string().min(1),
    effectiveUntil: z.string().min(1).nullable().optional(),
    canonLeafIds: z.array(z.string().min(1)).min(1),
    source: SalaryLedgerSourceZ,
  })
  .strict();

const SalaryLedgerReadyInputZ = z
  .object({
    status: z.literal('ready'),
    lineItems: z.array(SalaryLedgerLineItemZ),
  })
  .strict();

const SalaryLedgerNeedsInputZ = z
  .object({
    status: z.literal('needs-input'),
    missingInputs: z.array(z.string().min(1)),
    reason: z.string().min(1),
  })
  .strict();

const SalaryLedgerNotEvaluatedInputZ = z
  .object({
    status: z.literal('not-evaluated'),
    reason: z.string().min(1),
  })
  .strict();

export const SalaryLedgerInputZ = z.discriminatedUnion('status', [
  SalaryLedgerReadyInputZ,
  SalaryLedgerNeedsInputZ,
  SalaryLedgerNotEvaluatedInputZ,
]);

/**
 * Governed inputs not derivable from the current team snapshot.
 *
 * Apron input contains only the ten adjustments; the Team Salary baseline is
 * always derived at evaluation time. Tax input is a complete independent
 * ledger because its last-Regular-Season-game baseline is a separate dated
 * authority and cannot be reconstructed from current Team Salary.
 */
export const TeamSalaryBookInputsZ = z
  .object({
    version: z.literal(1),
    salaryCapYear: z.number().int(),
    incompleteRosterCharge: SalaryLedgerLineItemZ.optional(),
    apronAdjustments: SalaryLedgerInputZ,
    taxSalary: SalaryLedgerInputZ,
  })
  .strict()
  .superRefine((inputs, context) => {
    const charge = inputs.incompleteRosterCharge;
    if (!charge) return;
    if (charge.ledger !== 'team-salary') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['incompleteRosterCharge', 'ledger'],
        message: 'Incomplete-roster charges belong only to Team Salary.',
      });
    }
    if (charge.amount < 0 || !charge.canonLeafIds.includes('CBA2-A01.1')) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['incompleteRosterCharge', 'amount'],
        message:
          'Incomplete-roster charge input must be nonnegative and evidenced by CBA2-A01.1.',
      });
    }
  });

const EvaluatedSalaryLedgerLineItemZ = SalaryLedgerLineItemZ.extend({
  included: z.boolean(),
  exclusionReason: z
    .enum(['not-yet-effective', 'no-longer-effective'])
    .nullable(),
}).strict();

const CompleteSalaryLedgerResultZ = z
  .object({
    kind: SalaryLedgerKindZ,
    status: z.literal('complete'),
    total: z.number().finite(),
    lineItems: z.array(EvaluatedSalaryLedgerLineItemZ),
  })
  .strict();

const NeedsInputSalaryLedgerResultZ = z
  .object({
    kind: SalaryLedgerKindZ,
    status: z.literal('needs-input'),
    total: z.null(),
    lineItems: z.array(z.never()).length(0),
    missingInputs: z.array(z.string().min(1)),
    reason: z.string().min(1),
  })
  .strict();

const NotEvaluatedSalaryLedgerResultZ = z
  .object({
    kind: SalaryLedgerKindZ,
    status: z.literal('not-evaluated'),
    total: z.null(),
    lineItems: z.array(z.never()).length(0),
    reason: z.string().min(1),
  })
  .strict();

export const SalaryLedgerResultZ = z.discriminatedUnion('status', [
  CompleteSalaryLedgerResultZ,
  NeedsInputSalaryLedgerResultZ,
  NotEvaluatedSalaryLedgerResultZ,
]);

export const SalaryBooksSnapshotZ = z
  .object({
    version: z.literal(1),
    status: SalaryBookStatusZ,
    context: z
      .object({
        asOfDate: z.string(),
        salaryCapYear: z.number().int(),
        teamId: z.string(),
      })
      .nullable(),
    ledgers: z
      .object({
        teamSalary: SalaryLedgerResultZ,
        apronTeamSalary: SalaryLedgerResultZ,
        taxSalary: SalaryLedgerResultZ,
      })
      .strict(),
    governedInputs: JsonValueZ.nullable(),
  })
  .strict()
  .superRefine((snapshot, context) => {
    const expectedKinds = {
      teamSalary: 'team-salary',
      apronTeamSalary: 'apron-team-salary',
      taxSalary: 'tax-salary',
    } as const;

    for (const [key, expectedKind] of Object.entries(expectedKinds) as Array<
      [
        keyof typeof expectedKinds,
        (typeof expectedKinds)[keyof typeof expectedKinds],
      ]
    >) {
      const ledger = snapshot.ledgers[key];
      if (ledger.kind !== expectedKind) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ledgers', key, 'kind'],
          message: `${key} must retain the ${expectedKind} ledger identity.`,
        });
      }
      ledger.lineItems.forEach((lineItem, index) => {
        if (lineItem.ledger !== expectedKind) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['ledgers', key, 'lineItems', index, 'ledger'],
            message: `${key} line items must retain the ${expectedKind} ledger identity.`,
          });
        }
      });
    }
  });

export type TeamSalaryBookInputs = z.infer<typeof TeamSalaryBookInputsZ>;
export type SalaryBooksSnapshot = z.infer<typeof SalaryBooksSnapshotZ>;
