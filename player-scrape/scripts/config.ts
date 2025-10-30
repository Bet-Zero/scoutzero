export const REGRESSION_FIXTURES = [
  "luka_doncic",
  "jalen_wilson",
  "jordan_poole",
  "austin_reaves",
] as const;

export type FixtureId = (typeof REGRESSION_FIXTURES)[number];

export const paths = {
  snapshotsDir: "player-scrape/snapshots",
  fixturesDir: "player-scrape/fixtures",
  outputDir: "player-scrape/output",
};

export const isRegressionFixture = (playerId: string): playerId is FixtureId =>
  (REGRESSION_FIXTURES as readonly string[]).includes(playerId);
