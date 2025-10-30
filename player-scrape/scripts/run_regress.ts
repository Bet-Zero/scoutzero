import fs from "node:fs/promises";
import path from "node:path";
import { REGRESSION_FIXTURES, paths } from "./config";
import { parsePlayer } from "./parse_player";
import { deepStableStringify } from "./test_utils";

async function runOne(playerId: string) {
  const snapshotPath = path.join(paths.snapshotsDir, `${playerId}.html`);
  const fixturePath  = path.join(paths.fixturesDir, `${playerId}.snapshot.json`);

  const html = await fs.readFile(snapshotPath, "utf8");
  const actual = await parsePlayer(html, { playerId, sourceUrl: "snapshot" });

  const expected = JSON.parse(await fs.readFile(fixturePath, "utf8"));

  const a = deepStableStringify(actual);
  const e = deepStableStringify(expected);

  if (a !== e) {
    const outExpected = path.join(paths.outputDir, `${playerId}.expected.json`);
    const outActual   = path.join(paths.outputDir, `${playerId}.actual.json`);
    await fs.writeFile(outExpected, e, "utf8");
    await fs.writeFile(outActual, a, "utf8");
    throw new Error(`Regression failed for ${playerId}. See ${outActual}`);
  } else {
    console.log(`✅ ${playerId} passed`);
  }
}

(async () => {
  for (const id of REGRESSION_FIXTURES) {
    await runOne(id);
  }
  console.log("✅ All regression fixtures passed");
})();
