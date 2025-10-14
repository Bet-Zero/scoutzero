// parse_team.ts — SalarySwish team page → team-only JSON (+ optional Fanspo enrich)
// Run:
//   npm pkg set scripts.parse="tsx parse_team.ts"
//   TEAM_URL="https://www.salaryswish.com/teams/lakers" TEAM_CODE="LAL" SEASON="2025-26" npm run parse
//
// Optional: enrich draft picks with data from SalarySwish pick detail pages
//   ENRICH_DRAFT=1 TEAM_URL=... TEAM_CODE=... SEASON=... npm run parse
//
// Optional: enrich draft picks from Fanspo (one request)
//   FANSPO_ENRICH=1 TEAM_SLUG="Lakers" TEAM_ID=14 npm run parse
//
// Requires: cheerio, got

import fs from 'node:fs/promises';
import * as cheerio from 'cheerio';
import got from 'got';

type Money = number;

const norm = (s: string) => (s || '').replace(/\s+/g, ' ').trim();
const moneyNum = (s?: string) => {
  if (!s) return undefined;
  const v = Number(s.replace(/[$,]/g, ''));
  return Number.isFinite(v) ? v : undefined;
};
const absoluteUrl = (
  href: string | undefined,
  base = 'https://www.salaryswish.com'
) => (href ? new URL(href, base).toString() : undefined);

function findHeading(
  $: cheerio.CheerioAPI,
  tag: 'h3' | 'h5',
  includes: string
) {
  const needle = includes.toLowerCase();
  const nodes = $(tag);
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes.eq(i);
    if (norm(el.text()).toLowerCase().includes(needle)) return el;
  }
  return null;
}
function forwardUntilNextH3($: cheerio.CheerioAPI, start: cheerio.Cheerio) {
  const out: cheerio.Element[] = [];
  let cur = start.next();
  while (cur.length) {
    const tag = (cur.get(0) as any)?.name?.toLowerCase?.();
    if (tag === 'h3') break;
    out.push(cur.get(0));
    cur = cur.next();
  }
  return $(out);
}

/** optional enrichment of draft pick from its SalarySwish detail page */
async function enrichDraftPickFromDetail(url: string) {
  const html = await got(url, { timeout: { request: 15000 } }).text();
  const $d = cheerio.load(html);
  const text = norm($d('body').text());

  const currentOwner = text.match(/Current Owner:\s*([A-Z]{2,3})/i)?.[1];
  const originalTeam = text.match(/Original Team:\s*([A-Z]{2,3})/i)?.[1];
  const via = text.match(/\bvia\s+([A-Z]{2,3})\b/i)?.[1];

  const protections =
    text
      .match(
        /(top-\d+\s*protected|lottery protected|unprotected|swap rights)/gi
      )
      ?.join(', ') || undefined;
  const conveysIf = text.match(/conveys if[^.]*\./i)?.[0];

  return { currentOwner, originalTeam, via, protections, conveysIf };
}

/* ----------------------- Fanspo enrichment helpers ----------------------- */

type EnrichedMap = Map<
  string,
  {
    dir: 'incoming' | 'outgoing';
    fromTeams?: string[]; // incoming
    toTeams?: string[]; // outgoing
    protections?: string; // protections / conveys / swaps text
  }
>;

const pickKey = (year: number, round: 1 | 2) => `${year}-${round}`;

/** Fetch and parse Fanspo “Future Draft Picks” page for a team */
async function fetchFanspoTeamPicks(
  teamSlug: string,
  teamId: number
): Promise<EnrichedMap> {
  const url = `https://fanspo.com/nba/teams/${teamSlug}/${teamId}/draft-picks`;
  const html = await got(url, { timeout: { request: 20000 } }).text();
  const $ = cheerio.load(html);

  const lines = $('body')
    .text()
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  let section: 'incoming' | 'outgoing' | null = null;
  let lastKey: string | null = null;
  const map: EnrichedMap = new Map();

  for (const line of lines) {
    if (/^Incoming Draft Picks$/i.test(line)) {
      section = 'incoming';
      continue;
    }
    if (/^Outgoing Draft Picks$/i.test(line)) {
      section = 'outgoing';
      continue;
    }

    // e.g., "2027 1-UTA", "2028 2-ORL or WAS", "2026 1-Own"
    const m = line.match(
      /^(20\d{2})\s+(1|2)-([A-Za-z]+(?:\s+or\s+[A-Za-z]+)?|Own)$/i
    );
    if (m && section) {
      const year = Number(m[1]);
      const round = Number(m[2]) as 1 | 2;
      const dest = m[3];

      const key = pickKey(year, round);
      const entry: any = { dir: section };

      if (section === 'incoming') {
        if (!/own/i.test(dest))
          entry.fromTeams = dest.split(/\s+or\s+/i).map((x) => x.toUpperCase());
      } else {
        entry.toTeams = dest.split(/\s+or\s+/i).map((x) => x.toUpperCase());
      }

      map.set(key, entry);
      lastKey = key;
      continue;
    }

    // Protections / swaps / conveys lines typically follow immediately after a pick line
    if (/protected|protection|no protections|convey|swap/i.test(line)) {
      if (lastKey) {
        const e = map.get(lastKey)!;
        const combined = (e.protections ? e.protections + ' ' : '') + line;
        e.protections = combined.replace(/\s+/g, ' ').trim();
      }
    }
  }

  return map;
}

/** Merge Fanspo info into existing picks */
function mergeFanspoIntoPicks(picks: Array<any>, fanspo: EnrichedMap) {
  const seenNote = new Set<string>();
  for (const p of picks) {
    const e = fanspo.get(pickKey(p.year, p.round));
    if (!e) continue;

    if (e.fromTeams) (p as any).fromTeams = e.fromTeams;
    if (e.toTeams) (p as any).toTeams = e.toTeams;

    if (e.protections) {
      const note = e.protections.replace(/\s+/g, ' ').trim();
      const key = `${p.year}-${p.round}:${note}`;
      if (!seenNote.has(key)) {
        p.protections = (p.protections ? p.protections + ' ' : '') + note;
        seenNote.add(key);
      }
    }

    // Direction correction: trust Fanspo if it contradicts the grid
    if (e.toTeams && p.status === 'own') p.status = 'outgoing';
  }
}

/* ------------------------------------------------------------------------ */

async function main() {
  const TEAM_URL =
    process.env.TEAM_URL || 'https://www.salaryswish.com/teams/lakers';
  const TEAM_CODE = process.env.TEAM_CODE || 'LAL';
  const SEASON = process.env.SEASON || '2025-26';
  const ENRICH_DRAFT = process.env.ENRICH_DRAFT === '1';
  const FANSPO_ENRICH = process.env.FANSPO_ENRICH === '1';
  const TEAM_SLUG = process.env.TEAM_SLUG || 'Lakers'; // Fanspo
  const TEAM_ID = Number(process.env.TEAM_ID || 14); // Fanspo

  const html = await fs.readFile('./page.html', 'utf8');
  const $ = cheerio.load(html);

  // --- Team identity ---
  const teamName = $('h1').first().text().trim();
  const teamCode = TEAM_CODE;
  const season = SEASON;

  // --- Totals (from <h5> headings) ---
  const totalsBox: any = {};
  $('h5').each((_, el) => {
    const raw = norm($(el).text());
    const t = raw.toUpperCase();

    const valAfterColon = (text: string) => {
      const idx = text.indexOf(':');
      return idx >= 0 ? moneyNum(text.slice(idx + 1)) : undefined;
    };

    if (t.includes('TEAM SALARY ROOM'))
      totalsBox.teamSalaryRoom = valAfterColon(raw);
    else if (t.includes('TEAM SALARY'))
      totalsBox.totalSalary = valAfterColon(raw);
    else if (t.includes('CAP HIT')) totalsBox.capHit = valAfterColon(raw);
    else if (t.includes('CAP ROOM')) totalsBox.capSpace = valAfterColon(raw);
    else if (t.includes('LUXURY TAX ROOM'))
      totalsBox.luxuryTaxRoom = valAfterColon(raw);
    else if (t.includes('1ST APRON ROOM'))
      totalsBox.firstApronRoom = valAfterColon(raw);
    else if (t.includes('2ND APRON ROOM'))
      totalsBox.secondApronRoom = valAfterColon(raw);
    else if (t.includes('HARD CAPPED')) {
      const txt = raw.split(':').slice(1).join(':').trim().toLowerCase();
      totalsBox.hardCappedAt = txt.startsWith('1st')
        ? 'firstApron'
        : txt.startsWith('2nd')
          ? 'secondApron'
          : 'none';
    }
  });

  // --- Signing Exceptions (h3 SIGNING EXCEPTIONS → UL) ---
  let mle: any = null,
    bae: any = null,
    room: any = null;
  {
    const h3 = findHeading($, 'h3', 'SIGNING EXCEPTIONS');
    if (h3) {
      const lis = h3.nextAll('ul').first().find('li');
      lis.each((_, li) => {
        const text = norm($(li).text());
        const m = text.match(
          /^(Bi-Annual|Mid-Level|Room):\s*\$?([\d,]+)\s*of\s*\$?([\d,]+)/i
        );
        if (!m) return;
        const kind = m[1].toLowerCase();
        const remaining = moneyNum(m[2]);
        const total = moneyNum(m[3]);
        const used =
          total != null && remaining != null ? total - remaining : undefined;
        const base = {
          totalAmount: total,
          usedAmount: used,
          remainingAmount: remaining,
          available: (remaining || 0) > 0,
        };
        if (kind.startsWith('bi-')) bae = base;
        else if (kind.startsWith('mid-')) mle = { type: undefined, ...base };
        else if (kind.startsWith('room')) room = base;
      });
    }
  }

  // --- Trade Exceptions (wrapper under h3 TRADE EXCEPTIONS) ---
  const tpe: Array<{
    id: string;
    totalAmount?: Money;
    usedAmount?: Money;
    remainingAmount?: Money;
    createdFrom?: string;
    expiresOn?: string;
  }> = [];
  {
    const h3 = findHeading($, 'h3', 'TRADE EXCEPTIONS');
    if (h3) {
      const sib = forwardUntilNextH3($, h3);
      const wrapper = sib
        .filter((_, el) => $(el).is('div.sw_table__tradeExptn_wrapper'))
        .first();
      if (wrapper.length) {
        const seen = new Set<any>();
        wrapper.find('a[href^="/players/"]').each((i, a) => {
          const row = $(a).closest('div, tr, li');
          const key = row.get(0);
          if (!key || seen.has(key)) return;
          seen.add(key);

          const player = norm($(a).text());
          const text = norm(row.text());
          const monies = text.match(/\$[\d,]+/g) || []; // [$exception, $used, $remaining]
          const dates = text.match(/[A-Z][a-z]+ \d{1,2}, \d{4}/g) || []; // [start, end]
          const exception = monies[0]
            ? Number(monies[0].replace(/[$,]/g, ''))
            : undefined;
          const used = monies[1]
            ? Number(monies[1].replace(/[$,]/g, ''))
            : undefined;
          const remaining = monies[2]
            ? Number(monies[2].replace(/[$,]/g, ''))
            : undefined;
          const end = dates[1];

          if (exception != null || remaining != null) {
            tpe.push({
              id: `TPE-${teamCode}-${end || 'NA'}-${tpe.length + 1}`,
              totalAmount: exception,
              usedAmount: used,
              remainingAmount: remaining,
              createdFrom: player || undefined,
              expiresOn: end,
            });
          }
        });
      }
    }
  }

  // --- Cap Holds (table OR card/grid under h3 HOLDS) ---
  const capHolds: Array<{
    displayName: string;
    capHoldAmount: number;
    type?: 'UFA' | 'RFA' | 'Two-way' | 'Other';
    rights?: 'Bird' | 'Early Bird' | 'Non-Bird';
    notes?: string;
  }> = [];
  {
    const h3 = findHeading($, 'h3', 'HOLDS');
    if (h3) {
      const block = forwardUntilNextH3($, h3);
      const tbl = block.filter((_, el) => $(el).is('table')).first();
      if (tbl.length) {
        // table path
        tbl.find('tbody tr').each((_, tr) => {
          const tds = $(tr).find('td');
          if (!tds.length) return;
          const name = norm(tds.eq(0).text());
          const amount = moneyNum(
            norm(tds.eq(1).text()) || norm(tds.eq(2).text())
          );
          const meta = norm($(tr).text()).toLowerCase();
          if (name && amount != null) {
            capHolds.push({
              displayName: name,
              capHoldAmount: amount,
              type: /rfa/.test(meta)
                ? 'RFA'
                : /ufa/.test(meta)
                  ? 'UFA'
                  : /two-?way/.test(meta)
                    ? 'Two-way'
                    : 'Other',
              rights: /early bird/.test(meta)
                ? 'Early Bird'
                : /non-?bird/.test(meta)
                  ? 'Non-Bird'
                  : /bird/.test(meta)
                    ? 'Bird'
                    : undefined,
              notes: norm($(tr).text()),
            });
          }
        });
      } else {
        // card/grid path (no table)
        const rows: cheerio.Cheerio[] = [];
        block.find('a[href^="/players/"]').each((_, a) => {
          const row = $(a).closest('div, li, article');
          if (row.length && !rows.find((r) => r.get(0) === row.get(0)))
            rows.push(row);
        });
        rows.forEach((row) => {
          const name = norm(row.find('a[href^="/players/"]').first().text());
          const text = norm(row.text());
          const mAmt = text.match(/\$[\d,]+/);
          const amount = mAmt ? moneyNum(mAmt[0]) : undefined;
          if (name && amount != null) {
            capHolds.push({
              displayName: name,
              capHoldAmount: amount,
              type: /rfa/i.test(text)
                ? 'RFA'
                : /ufa/i.test(text)
                  ? 'UFA'
                  : /two-?way/i.test(text)
                    ? 'Two-way'
                    : 'Other',
              rights: /early bird/i.test(text)
                ? 'Early Bird'
                : /non-?bird/i.test(text)
                  ? 'Non-Bird'
                  : /bird/i.test(text)
                    ? 'Bird'
                    : undefined,
              notes: text,
            });
          }
        });
      }
    }
  }

  // --- Draft Picks (from #sw_teamProfile__draftTable) ---
  const draftPicks: Array<{
    year: number;
    round: 1 | 2;
    status: 'own' | 'outgoing' | 'contested' | 'unknown';
    pickNumber?: number;
    detailUrl?: string;
    title?: string;
    contendingTeams?: string[];
    tradedOn?: string;
    // Enrichment fields:
    currentOwner?: string;
    originalTeam?: string;
    via?: string;
    protections?: string;
    conveysIf?: string;
    fromTeams?: string[];
    toTeams?: string[];
  }> = [];
  {
    const tbl = $('#sw_teamProfile__draftTable');
    if (tbl.length) {
      const years = tbl
        .find('thead th')
        .map((i, th) => (i ? Number($(th).text().trim()) : NaN))
        .get()
        .slice(1)
        .filter((n: any) => Number.isFinite(n));

      tbl.find('tbody tr').each((_, tr) => {
        const tds = $(tr).find('td');
        if (tds.length < 2) return;

        const round: 1 | 2 = /2/.test($(tds[0]).text()) ? 2 : 1;

        for (let j = 1; j < tds.length; j++) {
          const year = years[j - 1];
          if (!year) continue;
          const td = $(tds[j]);

          const q = td.find('.q').first();
          const title = (q.attr('title') || '').trim();
          const detailUrl = absoluteUrl(td.find('a').first().attr('href'));

          const isTraded =
            td.find('.d_pick_traded').length > 0 || /traded/i.test(title);
          const isContested =
            td.find('.sw_teamProfile__draftPick_inContention').length > 0 ||
            /in contention/i.test(title);
          const hasPickUI = td.find('.d_pick, img, a').length > 0;

          const status: 'own' | 'outgoing' | 'contested' | 'unknown' = isTraded
            ? 'outgoing'
            : isContested
              ? 'contested'
              : hasPickUI
                ? 'own'
                : 'unknown';

          const mPick = (detailUrl || '').match(/[?&]pick=(\d+)/);
          const pickNumber = mPick ? Number(mPick[1]) : undefined;

          let contendingTeams: string[] | undefined;
          const mTeams = title.match(/Contending teams:\s*([A-Z, ]+)/i);
          if (mTeams)
            contendingTeams = mTeams[1]
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);

          const tradedOn = title.match(
            /traded away on\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i
          )?.[1];

          draftPicks.push({
            year,
            round,
            status,
            pickNumber,
            detailUrl,
            title: title || undefined,
            contendingTeams,
            tradedOn,
          });
        }
      });
    }
  }

  // --- Optional: enrich draft picks by visiting SalarySwish detail pages ---
  if (ENRICH_DRAFT) {
    const picksWithUrl = draftPicks.filter((p) => p.detailUrl);
    const work = [...picksWithUrl];
    const workers = 3; // small parallelism
    const runner = async () => {
      while (work.length) {
        const p = work.shift()!;
        try {
          const extra = await enrichDraftPickFromDetail(p.detailUrl!);
          Object.assign(p, extra);
        } catch {
          // ignore per-pick failure
        }
      }
    };
    await Promise.all(new Array(workers).fill(0).map(runner));
  }

  // --- Optional: single-shot Fanspo enrichment (owners/protections/swap) ---
  if (FANSPO_ENRICH) {
    try {
      const fanspo = await fetchFanspoTeamPicks(TEAM_SLUG, TEAM_ID);
      mergeFanspoIntoPicks(draftPicks, fanspo);
    } catch (err) {
      console.warn('Fanspo enrichment failed:', (err as Error).message);
    }
  }

  // --- Roster (Active only) — under h5 "Season Display" ---
  const roster: Array<{
    playerId?: string;
    displayName?: string;
    sourceUrl?: string;
  }> = [];
  {
    const h5 = findHeading($, 'h5', 'Season Display');
    if (h5) {
      const block = (() => {
        const out: cheerio.Element[] = [];
        let cur = h5.next();
        while (cur.length) {
          const tag = (cur.get(0) as any)?.name?.toLowerCase?.();
          if (tag === 'h3') break;
          out.push(cur.get(0));
          cur = cur.next();
        }
        return $(out);
      })();

      const teamC = block.filter((_, el) => $(el).is('div.team_c')).first();
      const activeMatch = teamC.length
        ? norm(teamC.text()).match(/Active\s*\((\d+)\b/i)
        : null;
      const activeCount = activeMatch ? Number(activeMatch[1]) : undefined;

      const seen = new Set<string>();
      block.find('a[href^="/players/"]').each((_, a) => {
        const href = ($(a).attr('href') || '').trim();
        if (!href || seen.has(href)) return;
        seen.add(href);
        roster.push({
          playerId: undefined,
          displayName: norm($(a).text()),
          sourceUrl: absoluteUrl(href),
        });
      });

      if (activeCount && roster.length > activeCount)
        roster.length = activeCount;
    }
  }

  // --- Final Team JSON (team-only) ---
  const teamDoc = {
    teamCode,
    teamName,
    season,

    roster, // player refs; IDs resolved later by your mapper
    deadCap: [], // not on this page
    capHolds, // parsed above (may be [])
    exceptions: {
      mle: mle || undefined,
      taxpayerMle: undefined, // can't disambiguate from text alone
      room: room || undefined,
      bae: bae || undefined,
      dpe: undefined,
      tpe,
    },
    draftPicks, // populated from draft table (+ optional enrich)

    totals: {
      totalSalary: totalsBox.totalSalary,
      capSpace: totalsBox.capSpace,
      taxSpace: totalsBox.luxuryTaxRoom,
      firstApronRoom: totalsBox.firstApronRoom,
      secondApronRoom: totalsBox.secondApronRoom,
      hardCappedAt: totalsBox.hardCappedAt || 'none',
    },

    source: {
      provider: 'SalarySwish',
      teamPageUrl: TEAM_URL,
      scrapedAt: new Date().toISOString(),
    },
    lastUpdated: new Date().toISOString(),
    version: '1.0',
  };

  await fs.writeFile('./team.json', JSON.stringify(teamDoc, null, 2), 'utf8');
  console.log('✅ Wrote ./team.json');
  console.log(
    `  roster=${roster.length}  tpe=${tpe.length}  holds=${capHolds.length}  picks=${draftPicks.length}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
