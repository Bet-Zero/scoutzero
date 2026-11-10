import { describe, expect, it } from 'vitest';
import { TeamListFull } from '@/constants/teamList';
import { prepareSimulationFinancialBaseline } from '@/features/architect/utils/prepareSimulationFinancialBaseline';
import {
  canonicalStringify,
  sha256Digest,
} from '@/features/architect/utils/contractSource/deterministicDigest';
import type { TeamSalaryBookInputs } from '@/schemas/salaryBooks';

async function candidate() {
  const inputs: TeamSalaryBookInputs = {
    version: 1,
    salaryCapYear: 2026,
    apronAdjustments: {
      status: 'ready',
      lineItems: [2, 3, 5, 6, 7, 9, 10, 11].map((n) => ({
        id: String(n),
        ledger: 'apron-team-salary',
        label: 'software probe',
        amount: 0,
        effectiveFrom: '2026-06-05T00:00:00Z',
        canonLeafIds: [`CBA2-C07.${n}`],
        source: {
          authority: 'team-state',
          reference: 'software probe, no factual assertion',
        },
      })),
    },
    taxSalary: {
      status: 'needs-input',
      missingInputs: ['tax'],
      reason: 'Unknown',
    },
  };
  inputs.simulationAssumptions = {
    version: 1,
    classification: 'SIMULATION',
    policy: 'unidentified-rare-exposure-v1',
    teamCode: 'CHI',
    asOfDate: '2026-06-05',
    checkedAt: '2026-11-10T12:00:00Z',
    evidenceReferences: ['software probe'],
    reconciledInputSha256: (
      await sha256Digest(canonicalStringify(inputs))
    ).slice(7),
    categories: ['CBA2-C07.4', 'CBA2-C07.8'],
    signals: [],
  };
  return {
    asOf: '2026-06-05T12:19:56.526Z',
    seasonId: '2025-26',
    teams: Object.fromEntries(
      TeamListFull.map((t) => [
        t.code,
        {
          teamCode: t.code,
          players: [],
          hardCapped: true,
          hardCapLevel: 'firstApron',
          entitlementIds: [`unchanged:${t.code}`],
        },
      ])
    ),
    financialInputs: { CHI: inputs },
  };
}
describe('simulation world preparation', () => {
  it('preserves every other team field and the input and marks the separate output', async () => {
    const c = await candidate();
    const before = structuredClone(c);
    const result = await prepareSimulationFinancialBaseline(c);
    expect(c).toEqual(before);
    expect(result.classification).toBe('SIMULATION');
    for (const [code, team] of Object.entries(c.teams))
      expect(result.teams[code]).toMatchObject(team);
    expect(result.teams.TOR).toEqual(c.teams.TOR);
    expect(result.teams.CHI.salaryBookInputs).toEqual(c.financialInputs.CHI);
  });
  it('rejects stale reconciliation, wrong dates and credible evidence', async () => {
    const c = await candidate();
    c.financialInputs.CHI.salaryCapYear = 2025;
    await expect(prepareSimulationFinancialBaseline(c)).rejects.toThrow(
      'season mismatch'
    );
    c.financialInputs.CHI.salaryCapYear = 2026;
    c.financialInputs.CHI.simulationAssumptions!.reconciledInputSha256 =
      'f'.repeat(64);
    await expect(prepareSimulationFinancialBaseline(c)).rejects.toThrow(
      'digest mismatch'
    );
    const d = await candidate();
    d.financialInputs.CHI.simulationAssumptions!.signals.push({
      id: 'incident',
      category: 'CBA2-C07.8',
      effectiveFrom: null,
      effectiveUntil: null,
      status: 'credible-unresolved',
      evidenceReference: 'report',
    });
    await expect(prepareSimulationFinancialBaseline(d)).rejects.toThrow(
      'blocked'
    );
  });
});
