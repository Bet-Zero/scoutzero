import fs from "node:fs/promises";
import path from "node:path";
import { getPlayerHtml } from "./fetch_player_page";
import { paths } from "./config";
import { parsePlayer } from "./parse_player";

const playerId = process.env.PLAYER_ID;
const sourceUrl = process.env.SOURCE_URL;

if (!playerId || !sourceUrl) {
  console.error("Usage: PLAYER_ID=... SOURCE_URL=... npm run scrape:one");
  process.exit(1);
}

(async () => {
  const html = await getPlayerHtml(playerId, sourceUrl);
  const normalized = await parsePlayer(html, { playerId, sourceUrl });

  // Create team-specific output directory
  const teamOutDir = path.join(paths.outputDir, normalized.teamCode);
  await fs.mkdir(teamOutDir, { recursive: true });

  const outPath = path.join(teamOutDir, `${playerId}.json`);
  await fs.writeFile(outPath, JSON.stringify(normalized, null, 2), "utf8");
  console.log(`✅ Wrote ${outPath}`);
})();
