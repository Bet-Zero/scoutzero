import type { TeamSalaryBookInputs } from '@/schemas/salaryBooks';
import { SimulationFinancialAssumptionsZ } from '@/schemas/simulationFinancialAssumptions';
import type { SalaryLedgerInput, SalaryLedgerKind } from './datedSalaryLedgers';

/** Only fill explicitly selected, unidentified rare categories on the starting day.
 * All other missing evidence and all known rows retain their original semantics.
 */
export function resolveSimulationApronInputs(
  inputs: TeamSalaryBookInputs | null,
  teamCode: string | null,
  asOfDate: string | null
): SalaryLedgerInput<SalaryLedgerKind> | undefined {
  const original = inputs?.apronAdjustments;
  if (!inputs?.simulationAssumptions) {
    // A generated assumption row is never independently admissible as a fact.
    if (
      original?.status === 'ready' &&
      original.lineItems.some(
        (l) => l.source.authority === 'simulation-assumption'
      )
    )
      return blocked('Simulation rows require their dated assumption record.');
    return original;
  }
  const parsed = SimulationFinancialAssumptionsZ.safeParse(
    inputs.simulationAssumptions
  );
  if (
    !parsed.success ||
    !asOfDate ||
    parsed.data.teamCode !== teamCode ||
    parsed.data.asOfDate !== asOfDate.slice(0, 10)
  )
    return blocked(
      'The SIMULATION assumption requires its original team and starting date.'
    );
  if (original?.status !== 'ready') return original;
  const policy = parsed.data;
  if (
    original.lineItems.some(
      (l) => l.source.authority === 'simulation-assumption'
    )
  )
    return blocked(
      'Simulation rows must be derived from the retained assumption record.'
    );
  if (
    policy.signals.some(
      (s) =>
        s.status === 'credible-unresolved' &&
        (!s.effectiveFrom || s.effectiveFrom <= policy.asOfDate) &&
        (!s.effectiveUntil || policy.asOfDate < s.effectiveUntil)
    )
  )
    return blocked(
      'A credible unresolved signal requires review before simulation admission.'
    );
  for (const category of policy.categories) {
    if (original.lineItems.some((l) => l.canonLeafIds.includes(category)))
      return blocked(
        'A known financial category cannot be replaced by an unidentified-exposure assumption.'
      );
    if (
      policy.signals.some(
        (s) =>
          s.category === category &&
          (!s.effectiveFrom || s.effectiveFrom <= policy.asOfDate) &&
          (!s.effectiveUntil || policy.asOfDate < s.effectiveUntil)
      )
    )
      return blocked(
        'A documented liability or credible unresolved signal prevents the SIMULATION assumption.'
      );
  }
  return {
    status: 'ready',
    lineItems: [
      ...original.lineItems,
      ...policy.categories.map((category) => ({
        id: `simulation:${teamCode}:${policy.asOfDate}:${category}`,
        ledger: 'apron-team-salary' as const,
        label: `SIMULATION — unidentified ${category === 'CBA2-C07.4' ? 'grievance exposure' : 'first-round Required Tenders'} assumed not applicable`,
        amount: 0,
        effectiveFrom: asOfDate,
        canonLeafIds: [category],
        source: {
          authority: 'simulation-assumption' as const,
          reference: `${policy.policy}; evidence checked ${policy.checkedAt}; reconciled input ${policy.reconciledInputSha256}; ${policy.evidenceReferences.join('; ')}`,
        },
      })),
    ],
  };
}
function blocked(reason: string): SalaryLedgerInput<SalaryLedgerKind> {
  return {
    status: 'needs-input',
    missingInputs: ['salaryBookInputs.simulationAssumptions'],
    reason,
  };
}
