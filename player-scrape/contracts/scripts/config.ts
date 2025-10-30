export const REGRESSION_FIXTURES = [
  "luka_doncic",
  "jalen_wilson",
  "jordan_poole",
  "austin_reaves",
] as const;

export type FixtureId = (typeof REGRESSION_FIXTURES)[number];

export const paths = {
  snapshotsDir: "player-scrape/contracts/snapshots",
  fixturesDir: "player-scrape/contracts/fixtures",
  outputDir: "player-scrape/contracts/output",
};

export const isRegressionFixture = (playerId: string): playerId is FixtureId =>
  (REGRESSION_FIXTURES as readonly string[]).includes(playerId);
