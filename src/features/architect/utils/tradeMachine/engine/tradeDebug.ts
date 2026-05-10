import { formatCurrency, getApronStatus } from '@/features/architect/utils/tradeHelpers';
import { getCapHitForSeason, normalizeYearInput } from '../utils/seasonUtils';

interface DebugMeta {
  team?: string;
  rule?: string;
  salary?: boolean | number;
  type?: string;
  timestamp?: string;
  teamName?: string;
  result?: unknown;
  validation?: boolean;
}

interface DebugRecord {
  msg: string;
  time: Date;
  team?: string;
  rule?: string;
  salary: boolean | number;
}

interface DebugSalaryRow {
  season?: string | null;
  salary?: number | null;
  capHit?: number | null;
}

interface DebugPlayer {
  name?: string;
  contract?: { salariesByYear?: DebugSalaryRow[] | null } | null;
  primaryContract?: { salariesByYear?: DebugSalaryRow[] | null } | null;
}

interface DebugTeam {
  team: { teamName?: string; totalSalary?: number };
  context?: { capSettings?: Record<string, unknown>; normalizedYear?: { seasonString?: string }; yearKey?: string | number | null };
  sends?: DebugPlayer[];
  incomingPlayers?: DebugPlayer[];
  salaryOut?: number;
  salaryIn?: number;
  overSecondApron?: boolean;
  willBeOverSecond?: boolean;
}

export const debug = {
  enabled: false,
  logs: [] as string[],
  records: [] as DebugRecord[],

  /**
   * Append a message to the debug log. The message is printed to the
   * console for immediate visibility and stored so it can be flushed to
   * a text file later on.
   */
  write(msg = '', meta: DebugMeta = {}) {
    if (!this.enabled) return;
    if (msg !== '' || this.logs.length > 0) {
      this.logs.push(msg);
      this.records.push({
        msg,
        time: new Date(),
        team: meta.team,
        rule: meta.rule,
        salary: meta.salary || false,
      });
    }
    console.log(msg);
  },

  log(msg = '', meta: DebugMeta = {}) {
    this.write(msg, meta);
  },

  logTrade(team: DebugTeam) {
    const capSettings = team.context?.capSettings || {};
    this.log('', { team: team.team.teamName });
    this.log(`=== ${team.team.teamName} ===`, { team: team.team.teamName });
    this.log(`Current Salary: ${formatCurrency(team.team.totalSalary)}`, {
      team: team.team.teamName,
    });
    this.log(
      `Status: ${getApronStatus(team.team.totalSalary, capSettings)}`,
      { team: team.team.teamName }
    );
  },

  logSalaries(team: DebugTeam) {
    this.log('Outgoing:', { team: team.team.teamName, salary: true });
    const normalizedYear =
      team.context?.normalizedYear || normalizeYearInput(team.context?.yearKey);
    const seasonKey = normalizedYear?.seasonString;

    (team.sends || []).forEach((p) => {
      const salary = seasonKey ? getCapHitForSeason(p, seasonKey) : 0;
      this.log(`  - ${p.name}: ${formatCurrency(salary)}`, {
        team: team.team.teamName,
        salary: true,
      });
    });

    this.log('Incoming:', { team: team.team.teamName, salary: true });
    (team.incomingPlayers || []).forEach((p) => {
      const salary = seasonKey ? getCapHitForSeason(p, seasonKey) : 0;
      this.log(`  - ${p.name}: ${formatCurrency(salary)}`, {
        team: team.team.teamName,
        salary: true,
      });
    });

    this.log(
      `Totals: OUT ${formatCurrency(team.salaryOut)} | IN ${formatCurrency(team.salaryIn)}`,
      { team: team.team.teamName, salary: true }
    );
  },

  logSecondApron(team: DebugTeam, violations: string[] = []) {
    if (!team.overSecondApron && !team.willBeOverSecond) return;

    const normalizedYear =
      team.context?.normalizedYear || normalizeYearInput(team.context?.yearKey);
    const seasonKey = normalizedYear?.seasonString;

    this.log('Second Apron Rules:', {
      team: team.team.teamName,
      rule: 'secondApron',
    });
    this.log(
      `Trade Type: ${(team.sends || []).length}-for-${(team.incomingPlayers || []).length}`,
      {
        team: team.team.teamName,
        rule: 'secondApron',
      }
    );

    if ((team.sends || []).length === 1) {
      const outgoing = seasonKey
        ? getCapHitForSeason((team.sends || [])[0], seasonKey)
        : 0;
      this.log(`1-to-Many max incoming: ${formatCurrency(outgoing)}`, {
        team: team.team.teamName,
        rule: 'secondApron',
      });
    } else {
      this.log('Many-to-Many: pair incoming with outgoing', {
        team: team.team.teamName,
        rule: 'secondApron',
      });
    }

    if (violations.length) {
      this.log('Violations:', {
        team: team.team.teamName,
        rule: 'secondApron',
      });
      violations.forEach((v) =>
        this.log(`  - ${v}`, { team: team.team.teamName, rule: 'secondApron' })
      );
    } else {
      this.log('All rules satisfied', {
        team: team.team.teamName,
        rule: 'secondApron',
      });
    }

    // Spacer between team logs for readability
    this.log('', { team: team.team.teamName, rule: 'secondApron' });
  },

  async flush(file = 'trade-debug.txt') {
    if (typeof process !== 'undefined' && process.versions?.node) {
      const fs = await import('fs');
      await fs.promises.writeFile(file, this.logs.join('\n'), 'utf8');
      console.log(`\nDebug log written to ${file}`);
    }
  },

  flushToUI({
    showSalary = true,
    team = null,
    rule = null,
  }: {
    showSalary?: boolean;
    team?: string | null;
    rule?: string | null;
  } = {}) {
    return this.records
      .filter((r: DebugRecord) => {
        if (!showSalary && r.salary) return false;
        if (team && r.team !== team) return false;
        if (rule && r.rule !== rule) return false;
        return true;
      })
      .map((r: DebugRecord) => `${r.time.toLocaleTimeString()} - ${r.msg}`);
  },
};

