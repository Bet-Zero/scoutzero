/**
 * SIMULATION team money baseline (V1 item A2).
 *
 * Builds one world team document per club from the accepted contract release:
 * the roster and every contract come from the release's retained source
 * documents, so Team Salary, Apron Team Salary and the governed trade salary
 * basis all read the same contracts. Apron adjustments are dated, labelled rows;
 * only CBA2-C07.4 and CBA2-C07.8 use the existing unidentified-exposure premise.
 *
 * Pure: no Firestore, no clock. Callers supply documents, dates and evidence.
 */
import type {
  SalaryLedgerLineItem,
  SalaryLedgerKind,
} from './capTotals/datedSalaryLedgers';
import type { TeamSalaryBookInputs } from '@/schemas/salaryBooks';
import { TeamSalaryBookInputsZ } from '@/schemas/salaryBooks';
import { createCanonicalTeamTotalsSnapshot } from './capTotals/computeTeamCapTotals';
import { DERIVED_FREE_AGENT_AMOUNTS_REFERENCE } from './capTotals/teamSalaryBooks';
import {
  canonicalStringify,
  sha256Digest,
} from './contractSource/deterministicDigest';
import {
  buildPlayerEntry,
  readLooseBasePlayerDoc,
  type LooseBaseTeamDoc,
} from './firebaseTeamPlanHelpers.readers';
import {
  SIMULATION_MINIMUM_UPLIFT_ASSUMPTION,
  money,
  minimumUpliftFor,
  simulationMinimumUplift,
  type MinimumUplift,
  type SourceDoc,
} from './simulationMinimumUplift';
import {
  assembleHydratedBaseTeam,
  type HydratedBaseTeamCapSheet,
} from './hydratedBaseTeam';

export interface SimulationTeamInput {
  teamCode: string;
  /** World starting instant (the release effective instant). */
  asOf: string;
  salaryCapYear: number;
  baseDoc: LooseBaseTeamDoc;
  /** Retained release source documents whose current contract is with this team. */
  releaseDocs: Record<string, SourceDoc>;
  /** Base-scrape players kept because the release has no record of them at all. */
  baseOnlyDocs: Record<string, SourceDoc>;
  /**
   * Retained release documents for players behind this team's dead money,
   * keyed by the dead-money entry's playerId, when the release holds one.
   */
  deadMoneyDocs?: Record<string, SourceDoc>;
  assumption: {
    checkedAt: string;
    evidenceReferences: string[];
  };
}

export interface SimulationTeamResult {
  team: HydratedBaseTeamCapSheet & { salaryBookInputs: TeamSalaryBookInputs };
  report: {
    teamCode: string;
    players: number;
    baseOnlyPlayers: string[];
    teamSalary: number;
    apronTeamSalary: number;
    performanceBonuses: number;
    minimumUplifts: Array<{
      playerId: string;
      uplift: number;
      yearsOfService: number;
      days: number;
      bounded: boolean;
      deadMoney: boolean;
    }>;
    freeAgentAmounts: number;
  };
}

/**
 * Build one SIMULATION world team. Throws rather than writing a team whose
 * Team Salary or Apron Team Salary cannot be completed.
 */
export async function buildSimulationTeam(
  input: SimulationTeamInput
): Promise<SimulationTeamResult> {
  const { teamCode, asOf, salaryCapYear } = input;
  const season = `${salaryCapYear - 1}-${String(salaryCapYear).slice(-2)}`;
  const docs = { ...input.releaseDocs, ...input.baseOnlyDocs };
  if (
    Object.keys(input.releaseDocs).length +
      Object.keys(input.baseOnlyDocs).length !==
    Object.keys(docs).length
  ) {
    throw new Error(
      `${teamCode}: a player is both a release and a base-only player.`
    );
  }
  const ids = Object.keys(docs).sort();
  const players = ids.map((id) =>
    buildPlayerEntry(
      id,
      readLooseBasePlayerDoc(docs[id], id, `${teamCode}/${id}`)
    )
  );
  const team = assembleHydratedBaseTeam(
    teamCode,
    { ...input.baseDoc, roster: ids },
    players
  );

  const line = (
    id: string,
    leaf: string,
    label: string,
    amount: number,
    reference: string
  ): SalaryLedgerLineItem<SalaryLedgerKind> => ({
    id: `apron-team-salary:simulation:${teamCode}:${id}`,
    ledger: 'apron-team-salary',
    label,
    amount,
    // The assumption record is day-granular (asOfDate), so the adjustments
    // start with the as-of day: a same-day date-only reading must not drop
    // them and fall back to Team Salary (which carries holds).
    effectiveFrom: `${asOf.slice(0, 10)}T00:00:00.000Z`,
    canonLeafIds: [leaf],
    source: { authority: 'team-state', reference },
  });

  const bonusLines: SalaryLedgerLineItem<SalaryLedgerKind>[] = [];
  const upliftLines: SalaryLedgerLineItem<SalaryLedgerKind>[] = [];
  const minimumUplifts: SimulationTeamResult['report']['minimumUplifts'] = [];
  const addUplift = (id: string, deadMoney: boolean, uplift: MinimumUplift) => {
    if (uplift.status === 'unresolved') {
      throw new Error(`${teamCode}/${id}: ${uplift.reason}`);
    }
    if (uplift.status !== 'qualifying' || uplift.uplift <= 0) return;
    minimumUplifts.push({
      playerId: id,
      uplift: uplift.uplift,
      yearsOfService: uplift.yearsOfService,
      days: uplift.days,
      bounded: uplift.bounded,
      deadMoney,
    });
    upliftLines.push(
      line(
        `minimum-uplift:${id}`,
        'CBA2-C07.3',
        `Zero/one-YOS Minimum Contract uplift (${id}${deadMoney ? ', dead money' : ''}, ${uplift.yearsOfService} YOS, ${uplift.days} days${uplift.bounded ? ', upper bound' : ''})`,
        uplift.uplift,
        `${id} contract; ${SIMULATION_MINIMUM_UPLIFT_ASSUMPTION}`
      )
    );
  };
  for (const id of ids) {
    const row = docs[id].contract?.salariesByYear?.find(
      (r) => r?.season === season
    );
    const unlikely = row?.incentives?.unlikely ?? 0;
    if (money(unlikely) === null || (unlikely as number) < 0) {
      throw new Error(`${teamCode}/${id}: unlikely bonus amount is not exact.`);
    }
    if ((unlikely as number) > 0) {
      bonusLines.push(
        line(
          `performance-bonus:${id}`,
          'CBA2-C07.2',
          `Unlikely Performance Bonuses excluded from Salary (${id})`,
          unlikely as number,
          `${id} contract, ${season} incentives.unlikely`
        )
      );
    }
    addUplift(id, false, simulationMinimumUplift(docs[id], season));
  }

  // Dead money keeps the contract's C07.3 reading (a waived or expired
  // zero/one-YOS Minimum still counts at the two-YOS amount).
  (input.baseDoc.deadCap ?? []).forEach((entry, index) => {
    const record = entry as {
      playerId?: unknown;
      amountByYear?: Array<{ season?: unknown; amount?: unknown }>;
    };
    const amount = money(
      record.amountByYear?.find((row) => row?.season === season)?.amount
    );
    if (amount === null) return;
    const playerId = String(record.playerId ?? `entry-${index}`);
    const source = input.deadMoneyDocs?.[playerId];
    const rows = source?.contract?.salariesByYear ?? [];
    const draftYear = source?.bio?.draftYear;
    addUplift(
      `${playerId}:dead-${index}`,
      true,
      minimumUpliftFor({
        amount,
        signedUsing:
          typeof source?.contract?.signedUsing === 'string'
            ? source.contract.signedUsing
            : null,
        startSeason:
          typeof rows[0]?.season === 'string'
            ? String(rows[0].season).slice(0, 7)
            : null,
        draftYear:
          typeof draftYear === 'string' || typeof draftYear === 'number'
            ? String(draftYear)
            : null,
      })
    );
  });

  const adjustments = (incompleteRoster: number) => [
    ...(bonusLines.length
      ? bonusLines
      : [
          line(
            'performance-bonus:none',
            'CBA2-C07.2',
            'No unlikely Performance Bonuses reported on the roster',
            0,
            `${season} incentives.unlikely for every rostered contract`
          ),
        ]),
    ...(upliftLines.length
      ? upliftLines
      : [
          line(
            'minimum-uplift:none',
            'CBA2-C07.3',
            'No qualifying zero/one-YOS Minimum Contract',
            0,
            SIMULATION_MINIMUM_UPLIFT_ASSUMPTION
          ),
        ]),
    line(
      'free-agent-amounts',
      'CBA2-C07.5',
      'Free Agent Amounts and other holds included in Team Salary',
      0,
      DERIVED_FREE_AGENT_AMOUNTS_REFERENCE
    ),
    line(
      'restricted-free-agent-tenders',
      'CBA2-C07.6',
      'No Restricted Free Agent tender belongs to this Salary Cap Year',
      0,
      `${season} free agency closed; 2026 tenders belong to the next Salary Cap Year`
    ),
    line(
      'unsigned-first-round-picks',
      'CBA2-C07.7',
      'No unsigned first-round pick amount outside the holds above',
      0,
      'Team Salary carries unsigned-pick amounts only as holds, removed by the C07.5 row'
    ),
    line(
      'exception-amounts',
      'CBA2-C07.9',
      'No exception amount is included in Team Salary',
      0,
      'Team Salary components: contracts, dead money, holds, Offer Sheets, roster charge'
    ),
    line(
      'second-round-pick-exception',
      'CBA2-C07.10',
      'No Second Round Pick Exception amount is excluded from Team Salary',
      0,
      'Every rostered contract counts its full cap hit in Team Salary'
    ),
    line(
      'incomplete-roster',
      'CBA2-C07.11',
      'Incomplete-roster charges included in Team Salary',
      -incompleteRoster,
      'Team Salary incomplete-roster component'
    ),
  ];

  const withInputs = async (incompleteRoster: number) => {
    const original: TeamSalaryBookInputs = TeamSalaryBookInputsZ.parse({
      version: 1,
      salaryCapYear,
      apronAdjustments: {
        status: 'ready',
        lineItems: adjustments(incompleteRoster),
      },
      taxSalary: {
        status: 'needs-input',
        missingInputs: ['salaryBookInputs.taxSalary.baseline'],
        reason:
          'Tax Salary needs its start-of-last-Regular-Season-game baseline (V1 item A4).',
      },
    });
    const salaryBookInputs = TeamSalaryBookInputsZ.parse({
      ...original,
      simulationAssumptions: {
        version: 1,
        classification: 'SIMULATION',
        policy: 'unidentified-rare-exposure-v1',
        teamCode,
        asOfDate: asOf.slice(0, 10),
        checkedAt: input.assumption.checkedAt,
        evidenceReferences: input.assumption.evidenceReferences,
        reconciledInputSha256: (
          await sha256Digest(canonicalStringify(original))
        ).slice(7),
        categories: ['CBA2-C07.4', 'CBA2-C07.8'],
        signals: [],
      },
    });
    const candidate = { ...team, salaryBookInputs };
    const snapshot = createCanonicalTeamTotalsSnapshot(
      candidate,
      salaryCapYear,
      { asOfDate: asOf }
    );
    return { candidate, snapshot };
  };

  let { candidate, snapshot } = await withInputs(0);
  const teamLedger = snapshot.salaryBooks.ledgers.teamSalary;
  if (teamLedger.status !== 'complete') {
    throw new Error(
      `${teamCode}: Team Salary is ${teamLedger.status} (${'reason' in teamLedger ? teamLedger.reason : ''}).`
    );
  }
  const component = (suffix: string) =>
    teamLedger.lineItems.find(
      (l) => l.id === `team-salary:${teamCode}:${suffix}`
    )?.amount ?? 0;
  const incomplete = component('incomplete-roster');
  if (incomplete !== 0)
    ({ candidate, snapshot } = await withInputs(incomplete));
  const apron = snapshot.salaryBooks.ledgers.apronTeamSalary;
  if (apron.status !== 'complete') {
    throw new Error(
      `${teamCode}: Apron Team Salary is ${apron.status} (${'reason' in apron ? apron.reason : ''}).`
    );
  }
  const final = snapshot.salaryBooks.ledgers.teamSalary;
  return {
    team: JSON.parse(JSON.stringify(candidate)),
    report: {
      teamCode,
      players: ids.length,
      baseOnlyPlayers: Object.keys(input.baseOnlyDocs).sort(),
      teamSalary: final.status === 'complete' ? final.total : Number.NaN,
      apronTeamSalary: apron.total,
      performanceBonuses: bonusLines.reduce((n, l) => n + l.amount, 0),
      minimumUplifts,
      freeAgentAmounts: component('cap-holds'),
    },
  };
}

export {
  SIMULATION_2025_26_MINIMUMS,
  SIMULATION_2025_26_SEASON_DAYS,
  SIMULATION_MINIMUM_UPLIFT_ASSUMPTION,
  simulationMinimumUplift,
} from './simulationMinimumUplift';
