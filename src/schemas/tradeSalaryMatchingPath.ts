import { z } from 'zod';

export const TradeSalaryMatchingPathZ = z.enum([
  'STANDARD_TPE',
  'AGGREGATED_STANDARD_TPE',
  // One or more outgoing and incoming players, simultaneous, under the
  // official Expanded TPE formula (CBA2-A02.7, A02.8); also the below-cap
  // election in lieu of the room path (CBA2-A02.11).
  'EXPANDED_TPE',
  'ROOM',
  // Every incoming player is acquired with the Minimum Exception and no
  // player is sent: no salary is matched (incoming trade salary counts $0).
  'MINIMUM_EXCEPTION',
  // The team sends no players and takes the incoming Salary into one of its
  // free-agent exceptions (CBA canon 7.3). Before January 10 only.
  'NON_TAXPAYER_MLE',
  'BI_ANNUAL_EXCEPTION',
  'ROOM_MLE',
]);

/** Paths that consume a team's free-agent exception balance. */
export const EXCEPTION_TRADE_PATHS = [
  'NON_TAXPAYER_MLE',
  'BI_ANNUAL_EXCEPTION',
  'ROOM_MLE',
] as const;
export type ExceptionTradePath = (typeof EXCEPTION_TRADE_PATHS)[number];
export const isExceptionTradePath = (
  path: unknown
): path is ExceptionTradePath =>
  (EXCEPTION_TRADE_PATHS as readonly unknown[]).includes(path);

export const TradeSalaryMatchingElectionZ = z
  .object({
    version: z.literal(1),
    path: TradeSalaryMatchingPathZ,
    postAssignmentApronTeamSalary: z.number().finite().nonnegative().nullable(),
    tradedPlayerPreTradeSalaries: z.record(
      z.string().min(1),
      z.number().finite().nonnegative()
    ),
  })
  .strict();

export type TradeSalaryMatchingPath = z.infer<typeof TradeSalaryMatchingPathZ>;
export type TradeSalaryMatchingElection = z.infer<
  typeof TradeSalaryMatchingElectionZ
>;

export const createEmptyTradeSalaryMatchingElection = (
  path: TradeSalaryMatchingPath
): TradeSalaryMatchingElection => ({
  version: 1,
  path,
  postAssignmentApronTeamSalary: null,
  tradedPlayerPreTradeSalaries: {},
});
