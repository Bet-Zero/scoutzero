/**
 * SIMULATION hard-cap status and Traded Player Exception checks (V1 item A3).
 *
 * The private source snapshot labels each team's 2025-26 hard cap ("1st Apron",
 * "2nd Apron", "No"). Complete dated trigger history is not retained, so the
 * label is the SIMULATION reading, with three guards:
 *   - a retained correction may raise a label (never lower it);
 *   - a hard-cap trigger visible in the release's 2025-26 signings
 *     (Non-Taxpayer MLE above the Taxpayer MLE amount, or the Bi-annual
 *     Exception) under a "No" label is a conflict, not an assumption;
 *   - a hard-capped team's Apron Team Salary must be at or under its ceiling.
 *
 * Pure: no Firestore, no clock.
 */
import type { SourceDoc } from './simulationMinimumUplift';

export type SimulationHardCapLevel = 'none' | 'firstApron' | 'secondApron';

/** 2025-26 levels (approved2025SystemLevels.ts). */
export const SIMULATION_2025_26_APRONS = Object.freeze({
  firstApron: 195_945_000,
  secondApron: 207_824_000,
});
/** 2025-26 Taxpayer Mid-Level amount: NT-MLE use above it hard-caps. */
export const SIMULATION_2025_26_TAXPAYER_MLE = 5_685_000;

const RANK: Record<SimulationHardCapLevel, number> = {
  none: 0,
  firstApron: 1,
  secondApron: 2,
};

export interface SimulationHardCapCorrection {
  level: SimulationHardCapLevel;
  evidence: string;
}

export interface SimulationHardCap {
  level: SimulationHardCapLevel;
  /** Shown in the app as the hard-cap reason. */
  reason: string | null;
  /** SIMULATION provenance; present exactly when the team is hard-capped. */
  triggeredBy: string | null;
  sourceLabel: SimulationHardCapLevel;
  corrected: boolean;
  signingTriggers: string[];
}

export function readHardCapLabel(value: unknown): SimulationHardCapLevel {
  const text = String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  if (text === '' || text === 'none' || text === 'no') return 'none';
  if (text === 'firstapron' || text === '1stapron') return 'firstApron';
  if (text === 'secondapron' || text === '2ndapron') return 'secondApron';
  throw new Error(`Unrecognised hard-cap label ${JSON.stringify(value)}.`);
}

/** First-Apron hard-cap triggers visible in this cap year's signings. */
export function signingHardCapTriggers(
  docs: Record<string, SourceDoc>,
  season: string
): string[] {
  const triggers: string[] = [];
  for (const [id, doc] of Object.entries(docs)) {
    const contract = doc.contract;
    const first = contract?.salariesByYear?.[0];
    if (!first || String(first.season ?? '').slice(0, 7) !== season) continue;
    const using = String(contract?.signedUsing ?? '').toLowerCase();
    const amount = Number(first.salary ?? 0);
    if (/bi-?annual|^bae$/.test(using))
      triggers.push(`${id}: Bi-annual Exception`);
    else if (using === 'mle' && amount > SIMULATION_2025_26_TAXPAYER_MLE)
      triggers.push(`${id}: Non-Taxpayer MLE at ${amount}`);
  }
  return triggers.sort();
}

export function resolveSimulationHardCap(input: {
  teamCode: string;
  season: string;
  sourceLabel: unknown;
  releaseDocs: Record<string, SourceDoc>;
  apronTeamSalary: number;
  correction?: SimulationHardCapCorrection;
}): SimulationHardCap {
  const { teamCode } = input;
  const sourceLabel = readHardCapLabel(input.sourceLabel);
  const level = input.correction?.level ?? sourceLabel;
  if (RANK[level] < RANK[sourceLabel])
    throw new Error(
      `${teamCode}: a correction may not lower the source hard cap (${sourceLabel} → ${level}).`
    );
  const signingTriggers = signingHardCapTriggers(
    input.releaseDocs,
    input.season
  );
  if (level === 'none' && signingTriggers.length > 0)
    throw new Error(
      `${teamCode}: labelled not hard-capped but signed ${signingTriggers.join(', ')}.`
    );
  if (
    level !== 'none' &&
    input.apronTeamSalary > SIMULATION_2025_26_APRONS[level]
  )
    throw new Error(
      `${teamCode}: Apron Team Salary ${input.apronTeamSalary} exceeds its ${level} hard cap.`
    );
  const name = level === 'firstApron' ? 'First Apron' : 'Second Apron';
  const corrected = input.correction !== undefined && level !== sourceLabel;
  return {
    level,
    reason: level === 'none' ? null : `Hard-capped at the ${name} (SIMULATION)`,
    triggeredBy:
      level === 'none'
        ? null
        : corrected
          ? `SIMULATION: ${input.correction!.evidence}`
          : `SIMULATION: source snapshot hard-cap label (${name})`,
    sourceLabel,
    corrected,
    signingTriggers,
  };
}

type TpeEntry = {
  id?: unknown;
  totalAmount?: unknown;
  usedAmount?: unknown;
  remainingAmount?: unknown;
  expiresOn?: unknown;
};

/**
 * Traded Player Exceptions carried from the source snapshot must be coherent
 * and still open on the world's starting day. Returns the open balance total.
 */
export function checkSimulationTpes(
  teamCode: string,
  tpes: unknown,
  asOf: string
): number {
  if (tpes === undefined || tpes === null) return 0;
  if (!Array.isArray(tpes))
    throw new Error(`${teamCode}: Traded Player Exceptions are not a list.`);
  const start = Date.parse(asOf.slice(0, 10));
  let open = 0;
  for (const raw of tpes as TpeEntry[]) {
    const [total, used, remaining] = [
      raw.totalAmount,
      raw.usedAmount,
      raw.remainingAmount,
    ].map(Number);
    const expires = Date.parse(String(raw.expiresOn ?? ''));
    if (
      ![total, used, remaining].every(
        (n) => Number.isSafeInteger(n) && n >= 0
      ) ||
      total - used !== remaining ||
      remaining === 0 ||
      !Number.isFinite(expires) ||
      expires <= start
    )
      throw new Error(
        `${teamCode}: Traded Player Exception ${String(raw.id)} is incoherent or closed.`
      );
    open += remaining;
  }
  return open;
}
