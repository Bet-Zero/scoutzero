/**
 * generate_pretty_mentions.ts
 * 
 * Copies mentions files to a pretty_mentions/ folder with nice formatting.
 * 
 * Usage: npx ts-node scripts/generate_pretty_mentions.ts
 */

import fs from "fs";
import path from "path";

const MENTIONS_DIR = "team-scrape/draft-picks/_artifacts/output/mentions";
const PRETTY_DIR = "team-scrape/draft-picks/_artifacts/audits/pretty_mentions";

const TEAM_CODES = [
  "ATL","BOS","BKN","CHA","CHI","CLE","DAL","DEN","DET","GSW",
  "HOU","IND","LAC","LAL","MEM","MIA","MIL","MIN","NOP","NYK",
  "OKC","ORL","PHI","PHX","POR","SAC","SAS","TOR","UTA","WAS"
];

function main() {
  fs.mkdirSync(PRETTY_DIR, { recursive: true });
  
  let processed = 0;
  let missing = 0;

  for (const team of TEAM_CODES) {
    const srcPath = path.join(MENTIONS_DIR, `draft_picks_mentions_${team}.json`);
    const dstPath = path.join(PRETTY_DIR, `draft_picks_mentions_${team}.json`);

    if (!fs.existsSync(srcPath)) {
      console.warn(`Missing: ${srcPath}`);
      missing++;
      continue;
    }

    try {
      const data = JSON.parse(fs.readFileSync(srcPath, "utf8"));
      fs.writeFileSync(dstPath, JSON.stringify(data, null, 2), "utf8");
      processed++;
    } catch (err) {
      console.error(`Error processing ${team}:`, err);
    }
  }

  console.log(`Pretty mentions generated: ${processed}/${TEAM_CODES.length}`);
  console.log(`Missing: ${missing}`);
  console.log(`Output: ${PRETTY_DIR}`);
}

main();
