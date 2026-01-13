import fs from "fs";
import path from "path";

type Pick = any;

const MENTIONS_DIR_DEFAULT = "team-scrape/draft-picks/_artifacts/output/mentions";

// Keep this aligned with your canonical codes (post-PHX/BKN work)
const TEAM_CODES = [
  "ATL","BOS","BKN","CHA","CHI","CLE","DAL","DEN","DET","GSW",
  "HOU","IND","LAC","LAL","MEM","MIA","MIL","MIN","NOP","NYK",
  "OKC","ORL","PHI","PHX","POR","SAC","SAS","TOR","UTA","WAS"
];

function normalizeCode(code: string): string {
  const c = (code || "").toUpperCase().trim().replace(/['"]/g, "");
  if (c === "PHO") return "PHX";
  if (c === "BRK" || c === "BRO") return "BKN";
  if (c === "UTH") return "UTA";
  if (c === "CHO") return "CHA";
  return c;
}

function loadMentionsFile(team: string, mentionsDir: string): Pick[] {
  const fp = path.join(mentionsDir, `draft_picks_mentions_${team}.json`);
  if (!fs.existsSync(fp)) throw new Error(`Missing mentions file: ${fp}`);
  const json = JSON.parse(fs.readFileSync(fp, "utf8"));
  if (!Array.isArray(json)) throw new Error(`Expected array in ${fp}`);
  return json;
}

function getRawText(p: Pick): string {
  return (p?.metadata?.realgmRawText || "").toString();
}

// --- Assertions ---

function hasProtectionAnchor(raw: string): boolean {
  // e.g. "1-4", "5-30", "31-55"
  return /\b\d{1,2}\s*-\s*\d{1,2}\b/.test(raw);
}

function hasProtectionParsed(p: Pick): boolean {
  return !!p?.protection;
}

function hasSwapAnchor(raw: string): boolean {
  return /\b(swap|most favorable|least favorable|more favorable|less favorable)\b/i.test(raw);
}

function hasSwapParsed(p: Pick): boolean {
  return p?.isSwap === true || !!p?.swapDetails;
}

function controllerAnchor(raw: string): string | null {
  // "Own or OKC (via OKC swap for DAL)" => controller OKC
  const m = raw.match(/\bvia\s+([A-Z]{2,3})\s+swap\s+for\b/i);
  if (!m) return null;
  return normalizeCode(m[1]);
}

function controllerParsed(p: Pick): string | null {
  const c = p?.swapDetails?.controller;
  return c ? normalizeCode(c) : null;
}

function extractToTeams(raw: string): string[] {
  // "to UTH" etc, but ignore "via XXX to YYY" chains (we only care about direct "to")
  // We'll treat "to XYZ" as an anchor; this can be noisy, but it’s useful to catch misses.
  const out: string[] = [];
  const re = /\bto\s+([A-Z]{2,3})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const code = normalizeCode(m[1]);
    if (TEAM_CODES.includes(code)) out.push(code);
  }
  return Array.from(new Set(out));
}

function hasRecipientOrRoute(p: Pick, team: string): boolean {
  const rec = p?.recipient ? normalizeCode(p.recipient) : null;
  const route = Array.isArray(p?.route) ? p.route.map((x: any) => normalizeCode(String(x))) : [];
  return !!(rec && TEAM_CODES.includes(rec)) || route.includes(team);
}

function parseReportRow(team: string, p: Pick) {
  const raw = getRawText(p);
  const id = p?.id || "NO_ID";
  const year = p?.year ?? "??";
  const round = p?.round ?? "??";
  return { team, id, year, round, raw };
}

function main() {
  const mentionsDir = process.argv.find(a => a.startsWith("--mentionsDir="))?.split("=")[1] || MENTIONS_DIR_DEFAULT;
  const teamsArg = process.argv.find(a => a.startsWith("--teams="))?.split("=")[1] || "ALL";
  const teams = teamsArg === "ALL" ? TEAM_CODES : teamsArg.split(",").map(s => s.trim().toUpperCase());

  const failures: Record<string, any[]> = {
    PROTECTION_ANCHOR_BUT_NO_PROTECTION: [],
    SWAP_ANCHOR_BUT_NO_SWAPDETAILS: [],
    CONTROLLER_ANCHOR_BUT_CONTROLLER_MISSING: [],
    TO_ANCHOR_BUT_NO_RECIPIENT_OR_ROUTE: [],
  };

  let totalPicks = 0;

  for (const t of teams) {
    const team = normalizeCode(t);
    const picks = loadMentionsFile(team, mentionsDir);
    totalPicks += picks.length;

    for (const p of picks) {
      const raw = getRawText(p);
      if (!raw) continue;

      if (hasProtectionAnchor(raw) && !hasProtectionParsed(p)) {
        failures.PROTECTION_ANCHOR_BUT_NO_PROTECTION.push(parseReportRow(team, p));
      }

      if (hasSwapAnchor(raw) && !hasSwapParsed(p)) {
        failures.SWAP_ANCHOR_BUT_NO_SWAPDETAILS.push(parseReportRow(team, p));
      }

      const ctrl = controllerAnchor(raw);
      if (ctrl && controllerParsed(p) !== ctrl) {
        failures.CONTROLLER_ANCHOR_BUT_CONTROLLER_MISSING.push({
          ...parseReportRow(team, p),
          expectedController: ctrl,
          parsedController: controllerParsed(p)
        });
      }

      const toTeams = extractToTeams(raw);
      // Only assert if it looks like a direct assignment row (avoid pure "via ..." noise)
      if (toTeams.length > 0) {
        const ok = toTeams.some(tt => {
          const rec = p?.recipient ? normalizeCode(p.recipient) : null;
          const route = Array.isArray(p?.route) ? p.route.map((x: any) => normalizeCode(String(x))) : [];
          return rec === tt || route.includes(tt);
        });
        if (!ok) {
          failures.TO_ANCHOR_BUT_NO_RECIPIENT_OR_ROUTE.push({
            ...parseReportRow(team, p),
            toTeams
          });
        }
      }
    }
  }

  const summary = {
    mentionsDir,
    teamsAudited: teams.length,
    totalPicksScanned: totalPicks,
    counts: Object.fromEntries(Object.entries(failures).map(([k,v]) => [k, v.length])),
  };

  const outDir = "team-scrape/draft-picks/_artifacts/audits";
  fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, "semantic_assertions_report.json");
  fs.writeFileSync(outPath, JSON.stringify({ summary, failures }, null, 2), "utf8");

  console.log("\n=== SEMANTIC ASSERTIONS AUDIT ===");
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nWrote: ${outPath}`);
  console.log("\nTip: open the JSON and search by failure bucket, then inspect those pick IDs in mentions/ledger.");
}

main();
