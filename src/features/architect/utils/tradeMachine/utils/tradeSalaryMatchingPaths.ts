import {
  TradeSalaryMatchingElectionZ,
  type TradeSalaryMatchingElection,
  type TradeSalaryMatchingPath,
} from '@/schemas/tradeSalaryMatchingPath';
import { isSupportedSalaryCapYear } from '@/features/architect/utils/governedSeason';

export const TRADE_SALARY_ALLOWANCE = 250_000;

export const GOVERNED_TRADE_SALARY_PATH_LEAVES = Object.freeze({
  STANDARD_TPE: Object.freeze(['CBA2-A02.1', 'CBA2-A02.2', 'CBA2-A02.12']),
  AGGREGATED_STANDARD_TPE: Object.freeze([
    'CBA2-A02.4',
    'CBA2-A02.5',
    'CBA2-A02.12',
  ]),
  ROOM: Object.freeze(['CBA2-A02.9', 'CBA2-A02.10', 'CBA2-A02.12']),
} satisfies Record<TradeSalaryMatchingPath, readonly string[]>);

export type TradeSalaryPathEvaluationStatus = 'PASS' | 'FAIL' | 'NEEDS_INPUT';

export type TradeSalaryPathPlayer = {
  playerId: string;
  playerName: string;
  salary: number;
};

export type TradeSalaryPathInputPlayer = Omit<
  TradeSalaryPathPlayer,
  'playerId'
> & {
  playerId: string | null;
};

export type TradeSalaryPathComponent = {
  componentId: string;
  kind: 'ELECTED_PATH' | 'HELD_STANDARD_TPE';
  path: TradeSalaryMatchingPath | 'STANDARD_TPE';
  timing: 'SIMULTANEOUS' | 'NON_SIMULTANEOUS';
  outgoingPlayers: TradeSalaryPathPlayer[];
  incomingPlayers: TradeSalaryPathPlayer[];
  maximumIncoming: number;
  usedIncoming: number;
  remaining: number;
};

export type HeldStandardTpeComponentInput = {
  tpeId: string;
  capacity: number;
  incomingPlayers: TradeSalaryPathInputPlayer[];
};

export type EvaluateTradeSalaryPathInput = {
  election: unknown;
  outgoingPlayers: Array<{ playerId: string | null; playerName: string }>;
  incomingMatchingPlayers: TradeSalaryPathInputPlayer[];
  heldStandardTpeComponents?: HeldStandardTpeComponentInput[];
  teamSalary: number;
  salaryCap: number;
  firstApron: number;
  transactionDate?: string | null;
  salaryCapYear?: number | string | null;
};

export type TradeSalaryPathEvaluation = {
  status: TradeSalaryPathEvaluationStatus;
  passed: boolean;
  electedPath: TradeSalaryMatchingPath | null;
  ruleLabel: string;
  formula: string;
  allowance: number | null;
  postAssignmentApronTeamSalary: number | null;
  firstApron: number | null;
  maximumIncoming: number | null;
  actualIncoming: number;
  margin: number | null;
  components: TradeSalaryPathComponent[];
  missingInputs: string[];
  violations: string[];
  canonLeafIds: readonly string[];
  election: TradeSalaryMatchingElection | null;
};

function finiteNonnegative(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function hasGovernedDate(value: string | null | undefined): boolean {
  if (!value) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const timestamp = Date.parse(`${value}T00:00:00Z`);
    return (
      Number.isFinite(timestamp) &&
      new Date(timestamp).toISOString().startsWith(value)
    );
  }
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(value)) return false;
  return Number.isFinite(new Date(value).getTime());
}

function hasGovernedYear(value: number | string | null | undefined): boolean {
  if (typeof value === 'number') return isSupportedSalaryCapYear(value);
  return typeof value === 'string' && /^\d{4}(?:-\d{2})?$/.test(value);
}

function labelForPath(path: TradeSalaryMatchingPath): string {
  if (path === 'STANDARD_TPE') return 'Standard Traded Player Exception';
  if (path === 'AGGREGATED_STANDARD_TPE') {
    return 'Aggregated Standard Traded Player Exception';
  }
  return 'Room path';
}

function result({
  status,
  election,
  formula,
  allowance,
  maximumIncoming,
  actualIncoming,
  components = [],
  missingInputs = [],
  violations = [],
  firstApron,
}: {
  status: TradeSalaryPathEvaluationStatus;
  election: TradeSalaryMatchingElection | null;
  formula: string;
  allowance: number | null;
  maximumIncoming: number | null;
  actualIncoming: number;
  components?: TradeSalaryPathComponent[];
  missingInputs?: string[];
  violations?: string[];
  firstApron: number | null;
}): TradeSalaryPathEvaluation {
  return {
    status,
    passed: status === 'PASS',
    electedPath: election?.path ?? null,
    ruleLabel: election
      ? labelForPath(election.path)
      : 'Salary path election required',
    formula,
    allowance,
    postAssignmentApronTeamSalary:
      election?.postAssignmentApronTeamSalary ?? null,
    firstApron,
    maximumIncoming,
    actualIncoming,
    margin: maximumIncoming === null ? null : maximumIncoming - actualIncoming,
    components,
    missingInputs,
    violations,
    canonLeafIds: election
      ? GOVERNED_TRADE_SALARY_PATH_LEAVES[election.path]
      : [],
    election,
  };
}

function playerSalaryTotal(players: ReadonlyArray<{ salary: number }>): number {
  return players.reduce((sum, player) => sum + player.salary, 0);
}

export function evaluateTradeSalaryMatchingPath({
  election: rawElection,
  outgoingPlayers,
  incomingMatchingPlayers,
  heldStandardTpeComponents = [],
  teamSalary,
  salaryCap,
  firstApron,
  transactionDate,
  salaryCapYear,
}: EvaluateTradeSalaryPathInput): TradeSalaryPathEvaluation {
  const actualIncoming = incomingMatchingPlayers.reduce(
    (sum, player) => sum + (finiteNonnegative(player.salary) ?? 0),
    0
  );
  const parsedElection = TradeSalaryMatchingElectionZ.safeParse(rawElection);
  if (!parsedElection.success) {
    return result({
      status: 'NEEDS_INPUT',
      election: null,
      formula: 'Select a supported salary-matching path before validation.',
      allowance: null,
      maximumIncoming: null,
      actualIncoming,
      missingInputs: ['salaryMatchingElection'],
      firstApron: finiteNonnegative(firstApron),
    });
  }

  const election = parsedElection.data;
  const missingInputs: string[] = [];
  const governedTeamSalary = finiteNonnegative(teamSalary);
  const governedSalaryCap = finiteNonnegative(salaryCap);
  const governedFirstApron = finiteNonnegative(firstApron);
  if (!hasGovernedDate(transactionDate)) missingInputs.push('transactionDate');
  if (!hasGovernedYear(salaryCapYear)) missingInputs.push('salaryCapYear');
  if (governedSalaryCap === null || governedSalaryCap === 0) {
    missingInputs.push('salaryCap');
  }
  if (governedFirstApron === null || governedFirstApron === 0) {
    missingInputs.push('firstApron');
  }
  if (governedTeamSalary === null || governedTeamSalary === 0) {
    missingInputs.push('teamSalary');
  }
  if (election.postAssignmentApronTeamSalary === null) {
    missingInputs.push('postAssignmentApronTeamSalary');
  }
  outgoingPlayers.forEach((player, index) => {
    if (!player.playerId)
      missingInputs.push(`outgoingPlayers.${index}.identity`);
  });
  incomingMatchingPlayers.forEach((player, index) => {
    if (!player.playerId) {
      missingInputs.push(`incomingMatchingPlayers.${index}.identity`);
    }
    if (finiteNonnegative(player.salary) === null) {
      missingInputs.push(`incomingMatchingPlayers.${index}.salary`);
    }
  });
  heldStandardTpeComponents.forEach((component, componentIndex) => {
    if (!component.tpeId.trim()) {
      missingInputs.push(`heldStandardTpeComponents.${componentIndex}.tpeId`);
    }
    if (finiteNonnegative(component.capacity) === null) {
      missingInputs.push(
        `heldStandardTpeComponents.${componentIndex}.capacity`
      );
    }
    component.incomingPlayers.forEach((player, playerIndex) => {
      if (!player.playerId) {
        missingInputs.push(
          `heldStandardTpeComponents.${componentIndex}.incomingPlayers.${playerIndex}.identity`
        );
      }
      if (finiteNonnegative(player.salary) === null) {
        missingInputs.push(
          `heldStandardTpeComponents.${componentIndex}.incomingPlayers.${playerIndex}.salary`
        );
      }
    });
  });

  if (missingInputs.length > 0) {
    return result({
      status: 'NEEDS_INPUT',
      election,
      formula:
        'Exact transaction date, Salary Cap Year, cap lines, and post-assignment Apron Team Salary are required.',
      allowance: null,
      maximumIncoming: null,
      actualIncoming,
      missingInputs,
      firstApron: governedFirstApron,
    });
  }

  const allowance =
    Number(election.postAssignmentApronTeamSalary) > Number(governedFirstApron)
      ? 0
      : TRADE_SALARY_ALLOWANCE;
  const governedIncomingMatchingPlayers: TradeSalaryPathPlayer[] =
    incomingMatchingPlayers.map((player) => ({
      ...player,
      playerId: String(player.playerId),
    }));
  const heldComponents: TradeSalaryPathComponent[] =
    heldStandardTpeComponents.map((component) => {
      const usedIncoming = playerSalaryTotal(component.incomingPlayers);
      return {
        componentId: component.tpeId,
        kind: 'HELD_STANDARD_TPE',
        path: 'STANDARD_TPE',
        timing: 'NON_SIMULTANEOUS',
        outgoingPlayers: [],
        incomingPlayers: component.incomingPlayers.map((player) => ({
          ...player,
          playerId: String(player.playerId),
        })),
        maximumIncoming: component.capacity,
        usedIncoming,
        remaining: Math.max(0, component.capacity - usedIncoming),
      };
    });

  if (election.path === 'ROOM') {
    if (heldComponents.length > 0) {
      return result({
        status: 'FAIL',
        election,
        formula: 'Room path cannot be combined with a Standard TPE component.',
        allowance,
        maximumIncoming: null,
        actualIncoming,
        components: heldComponents,
        violations: [
          'Room path is mutually exclusive with Standard, Aggregated, Transition, and Expanded TPE acquisitions in the same trade.',
        ],
        firstApron: governedFirstApron,
      });
    }
    if (Number(governedTeamSalary) >= Number(governedSalaryCap)) {
      return result({
        status: 'FAIL',
        election,
        formula: 'room under Salary Cap + allowance',
        allowance,
        maximumIncoming: 0,
        actualIncoming,
        violations: [
          'Room path requires pre-transaction Team Salary below the Salary Cap.',
        ],
        firstApron: governedFirstApron,
      });
    }

    const exactOutgoingPlayers: TradeSalaryPathPlayer[] = [];
    outgoingPlayers.forEach((player) => {
      if (!player.playerId) return;
      const exactSalary =
        election.tradedPlayerPreTradeSalaries[player.playerId];
      if (exactSalary === undefined) {
        missingInputs.push(`tradedPlayerPreTradeSalaries.${player.playerId}`);
        return;
      }
      exactOutgoingPlayers.push({
        ...player,
        playerId: player.playerId,
        salary: exactSalary,
      });
    });
    if (missingInputs.length > 0) {
      return result({
        status: 'NEEDS_INPUT',
        election,
        formula:
          'Room after assignment requires exact pre-trade Salary for every outgoing Traded Player.',
        allowance,
        maximumIncoming: null,
        actualIncoming,
        missingInputs,
        firstApron: governedFirstApron,
      });
    }

    const preTransactionRoom =
      Number(governedSalaryCap) - Number(governedTeamSalary);
    const outgoingSalary = playerSalaryTotal(exactOutgoingPlayers);
    const room = preTransactionRoom + outgoingSalary;
    const maximumIncoming = room + allowance;
    const component: TradeSalaryPathComponent = {
      componentId: 'room-path',
      kind: 'ELECTED_PATH',
      path: 'ROOM',
      timing: 'SIMULTANEOUS',
      outgoingPlayers: exactOutgoingPlayers,
      incomingPlayers: governedIncomingMatchingPlayers,
      maximumIncoming,
      usedIncoming: actualIncoming,
      remaining: Math.max(0, maximumIncoming - actualIncoming),
    };
    const violations =
      actualIncoming > maximumIncoming
        ? [
            `Room-path incoming salary exceeds room plus allowance by $${(
              actualIncoming - maximumIncoming
            ).toLocaleString('en-US')}.`,
          ]
        : [];
    return result({
      status: violations.length === 0 ? 'PASS' : 'FAIL',
      election,
      formula: `pre-transaction room $${preTransactionRoom.toLocaleString('en-US')} + exact outgoing Salary $${outgoingSalary.toLocaleString('en-US')} + allowance $${allowance.toLocaleString('en-US')} = $${maximumIncoming.toLocaleString('en-US')}`,
      allowance,
      maximumIncoming,
      actualIncoming,
      components: [component],
      violations,
      firstApron: governedFirstApron,
    });
  }

  if (Number(governedTeamSalary) < Number(governedSalaryCap)) {
    return result({
      status: 'FAIL',
      election,
      formula:
        'Below-cap use of a TPE path requires the separate explicit election authority.',
      allowance,
      maximumIncoming: null,
      actualIncoming,
      components: heldComponents,
      violations: [
        'Standard and Aggregated Standard TPE paths are unavailable below the Salary Cap until the governed below-cap election path is implemented.',
      ],
      firstApron: governedFirstApron,
    });
  }

  const requiredOutgoingCount = election.path === 'STANDARD_TPE' ? 1 : 2;
  const isHeldOnlyStandardUse =
    election.path === 'STANDARD_TPE' &&
    outgoingPlayers.length === 0 &&
    incomingMatchingPlayers.length === 0 &&
    heldComponents.length > 0;
  const structurePass =
    isHeldOnlyStandardUse ||
    (election.path === 'STANDARD_TPE'
      ? outgoingPlayers.length === requiredOutgoingCount
      : outgoingPlayers.length >= requiredOutgoingCount);

  if (!structurePass) {
    const structureMessage =
      election.path === 'STANDARD_TPE'
        ? 'Standard TPE requires exactly one Traded Player, unless this transaction only consumes a held Standard TPE.'
        : 'Aggregated Standard TPE requires two or more Traded Players in one simultaneous transaction.';
    return result({
      status: 'FAIL',
      election,
      formula: structureMessage,
      allowance,
      maximumIncoming: null,
      actualIncoming,
      components: heldComponents,
      violations: [structureMessage],
      firstApron: governedFirstApron,
    });
  }

  if (isHeldOnlyStandardUse) {
    return result({
      status: 'PASS',
      election,
      formula: 'Held Standard TPE component(s) consumed non-simultaneously.',
      allowance,
      maximumIncoming: heldComponents.reduce(
        (sum, component) => sum + component.maximumIncoming,
        0
      ),
      actualIncoming: heldComponents.reduce(
        (sum, component) => sum + component.usedIncoming,
        0
      ),
      components: heldComponents,
      firstApron: governedFirstApron,
    });
  }

  const exactOutgoingPlayers: TradeSalaryPathPlayer[] = [];
  outgoingPlayers.forEach((player) => {
    if (!player.playerId) return;
    const exactSalary = election.tradedPlayerPreTradeSalaries[player.playerId];
    if (exactSalary === undefined) {
      missingInputs.push(`tradedPlayerPreTradeSalaries.${player.playerId}`);
      return;
    }
    exactOutgoingPlayers.push({
      ...player,
      playerId: player.playerId,
      salary: exactSalary,
    });
  });

  if (missingInputs.length > 0) {
    return result({
      status: 'NEEDS_INPUT',
      election,
      formula:
        'Exact CBA pre-trade Salary is required for every Traded Player; generic matching salary is not substituted.',
      allowance,
      maximumIncoming: null,
      actualIncoming,
      components: heldComponents,
      missingInputs,
      firstApron: governedFirstApron,
    });
  }

  const outgoingSalary = playerSalaryTotal(exactOutgoingPlayers);
  const maximumIncoming = outgoingSalary + allowance;
  const electedComponent: TradeSalaryPathComponent = {
    componentId:
      election.path === 'STANDARD_TPE'
        ? `standard:${exactOutgoingPlayers[0]?.playerId}`
        : `aggregated:${exactOutgoingPlayers.map((player) => player.playerId).join('+')}`,
    kind: 'ELECTED_PATH',
    path: election.path,
    timing: 'SIMULTANEOUS',
    outgoingPlayers: exactOutgoingPlayers,
    incomingPlayers: governedIncomingMatchingPlayers,
    maximumIncoming,
    usedIncoming: actualIncoming,
    remaining: Math.max(0, maximumIncoming - actualIncoming),
  };
  const violations =
    actualIncoming > maximumIncoming
      ? [
          `${labelForPath(election.path)} incoming salary exceeds its component limit by $${(
            actualIncoming - maximumIncoming
          ).toLocaleString('en-US')}.`,
        ]
      : [];

  return result({
    status: violations.length === 0 ? 'PASS' : 'FAIL',
    election,
    formula: `pre-trade Salary $${outgoingSalary.toLocaleString('en-US')} + allowance $${allowance.toLocaleString('en-US')} = $${maximumIncoming.toLocaleString('en-US')}`,
    allowance,
    maximumIncoming,
    actualIncoming,
    components: [electedComponent, ...heldComponents],
    violations,
    firstApron: governedFirstApron,
  });
}
