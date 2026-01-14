/**
 * generate_ledger_md.ts
 * 
 * Generates ledger_team_pick_lists.md - one doc with all teams' picks.
 * 
 * Format per team:
 * ## TEAM — Inventory X / Obligations Y / Contested Z
 * ### Inventory
 * - YYYY 1st|2nd | orig:XXX | owner:YYY | status:... | prot:... | swap:... | to:... | route:A→B→C | tradeable:false
 * 
 * Usage: npx ts-node scripts/generate_ledger_md.ts
 */

import fs from "fs";
import path from "path";

const LEDGER_DIR = "team-scrape/shared/firestore_staging/_artifacts/output/ledger/by_team";
const OUTPUT_FILE = "team-scrape/draft-picks/_artifacts/audits/ledger_team_pick_lists.md";

const TEAM_CODES = [
  "ATL","BOS","BKN","CHA","CHI","CLE","DAL","DEN","DET","GSW",
  "HOU","IND","LAC","LAL","MEM","MIA","MIL","MIN","NOP","NYK",
  "OKC","ORL","PHI","PHX","POR","SAC","SAS","TOR","UTA","WAS"
];

interface Pick {
  id?: string;
  year?: number;
  round?: number;
  originalTeam?: string;
  owner?: string;
  status?: string;
  protection?: string | null;
  isSwap?: boolean;
  recipient?: string;
  route?: string[];
  tradeable?: boolean;
  swapDetails?: any;
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

function roundLabel(round: number | undefined): string {
  if (round === 1) return "1st";
  if (round === 2) return "2nd";
  return `R${round ?? "?"}`;
}

function pickOneLine(p: Pick): string {
  const parts: string[] = [];
  
  // Year + Round
  parts.push(`${p.year ?? "????"} ${roundLabel(p.round)}`);
  
  // Original team
  if (p.originalTeam) parts.push(`orig:${p.originalTeam}`);
  
  // Current owner
  if (p.owner) parts.push(`owner:${p.owner}`);
  
  // Status
  if (p.status) parts.push(`status:${p.status}`);
  
  // Protection
  if (p.protection) parts.push(`prot:${p.protection}`);
  
  // Swap info
  if (p.isSwap) {
    let swapStr = "swap:true";
    if (p.swapDetails?.controller) {
      swapStr += `(ctrl:${p.swapDetails.controller})`;
    }
    if (p.swapDetails?.swapWith?.length) {
      swapStr += `(with:${p.swapDetails.swapWith.join(",")})`;
    }
    parts.push(swapStr);
  }
  
  // Recipient
  if (p.recipient) parts.push(`to:${p.recipient}`);
  
  // Route
  if (p.route && p.route.length > 0) {
    parts.push(`route:${p.route.join("→")}`);
  }
  
  // Tradeable (only if false)
  if (p.tradeable === false) {
    parts.push("tradeable:false");
  }
  
  return parts.join(" | ");
}

function sortPicks(picks: Pick[]): Pick[] {
  return [...picks].sort((a, b) => {
    const yearDiff = (a.year ?? 0) - (b.year ?? 0);
    if (yearDiff !== 0) return yearDiff;
    return (a.round ?? 0) - (b.round ?? 0);
  });
}

function main() {
  const lines: string[] = [];
  lines.push("# Draft Picks Ledger — All Teams");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");

  for (const team of TEAM_CODES) {
    const ledger = loadLedger(team);
    if (!ledger) {
      lines.push(`## ${team} — (no data)`);
      lines.push("");
      continue;
    }

    const inv = ledger.inventory || [];
    const obl = ledger.obligations || [];
    const con = ledger.contested || [];

    lines.push(`## ${team} — Inventory ${inv.length} / Obligations ${obl.length} / Contested ${con.length}`);
    lines.push("");

    if (inv.length > 0) {
      lines.push("### Inventory");
      for (const p of sortPicks(inv)) {
        lines.push(`- ${pickOneLine(p)}`);
      }
      lines.push("");
    }

    if (obl.length > 0) {
      lines.push("### Obligations");
      for (const p of sortPicks(obl)) {
        lines.push(`- ${pickOneLine(p)}`);
      }
      lines.push("");
    }

    if (con.length > 0) {
      lines.push("### Contested");
      for (const p of sortPicks(con)) {
        lines.push(`- ${pickOneLine(p)}`);
      }
      lines.push("");
    }
  }

  // Ensure output directory exists
  const outDir = path.dirname(OUTPUT_FILE);
  fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(OUTPUT_FILE, lines.join("\n"), "utf8");
  console.log(`Wrote: ${OUTPUT_FILE}`);
  console.log(`Total teams: ${TEAM_CODES.length}`);
}

main();
