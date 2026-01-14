/**
 * generate_ledger_tsv.ts
 * 
 * Generates ledger_team_pick_counts.tsv from the by_team ledger JSONs.
 * Columns: TEAM  INV_1  INV_2  INV_T  OBL_T  CON_T
 * 
 * Usage: npx ts-node scripts/generate_ledger_tsv.ts
 */

import fs from "fs";
import path from "path";

const LEDGER_DIR = "team-scrape/shared/firestore_staging/_artifacts/output/ledger/by_team";
const OUTPUT_FILE = "team-scrape/draft-picks/_artifacts/audits/ledger_team_pick_counts.tsv";

const TEAM_CODES = [
  "ATL","BOS","BKN","CHA","CHI","CLE","DAL","DEN","DET","GSW",
  "HOU","IND","LAC","LAL","MEM","MIA","MIL","MIN","NOP","NYK",
  "OKC","ORL","PHI","PHX","POR","SAC","SAS","TOR","UTA","WAS"
];

interface Pick {
  round?: number;
  [key: string]: any;
}

interface Ledger {
  teamCode: string;
  inventory: Pick[];
  obligations: Pick[];
  contested: Pick[];
}

function loadLedger(team: string): Ledger | null {
  const fp = path.join(LEDGER_DIR, `${team}.json`);
  if (!fs.existsSync(fp)) {
    console.warn(`Missing ledger file: ${fp}`);
    return null;
  }
  return JSON.parse(fs.readFileSync(fp, "utf8"));
}

function main() {
  const rows: string[] = [];
  rows.push(["TEAM", "INV_1", "INV_2", "INV_T", "OBL_T", "CON_T"].join("\t"));

  for (const team of TEAM_CODES) {
    const ledger = loadLedger(team);
    if (!ledger) {
      rows.push([team, "0", "0", "0", "0", "0"].join("\t"));
      continue;
    }

    const inv = ledger.inventory || [];
    const obl = ledger.obligations || [];
    const con = ledger.contested || [];

    const inv1 = inv.filter(p => p.round === 1).length;
    const inv2 = inv.filter(p => p.round === 2).length;
    const invT = inv.length;
    const oblT = obl.length;
    const conT = con.length;

    rows.push([team, inv1.toString(), inv2.toString(), invT.toString(), oblT.toString(), conT.toString()].join("\t"));
  }

  // Ensure output directory exists
  const outDir = path.dirname(OUTPUT_FILE);
  fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(OUTPUT_FILE, rows.join("\n"), "utf8");
  console.log(`Wrote: ${OUTPUT_FILE}`);
  console.log(`Total teams: ${TEAM_CODES.length}`);
}

main();
