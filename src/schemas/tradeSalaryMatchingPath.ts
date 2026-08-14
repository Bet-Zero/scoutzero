import { z } from 'zod';

export const TradeSalaryMatchingPathZ = z.enum([
  'STANDARD_TPE',
  'AGGREGATED_STANDARD_TPE',
  'ROOM',
]);

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
