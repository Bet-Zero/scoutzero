// probe.ts — Test data extraction for team salary cap parsing
//
// RUN:
//   npm run probe
//
// PURPOSE:
//   Detailed test of extraction logic before running the full parser.
//   Validates that all expected data points can be captured from the HTML.
//
// READS:
//   ../examples/page.html — saved HTML snapshot from fetch_page.ts

import fs from 'node:fs/promises';
import * as cheerio from 'cheerio';
import type { Element, AnyNode } from 'domhandler';

const norm = (s: string) => (s || '').replace(/\s+/g, ' ').trim();

function findHeading(
  $: cheerio.CheerioAPI,
  tag: 'h3' | 'h5',
  includes: string
) {
  const needle = includes.toLowerCase();
  const nodes = $(tag);
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes.eq(i);
    const t = norm(el.text()).toLowerCase();
    if (t.includes(needle)) return el;
  }
  return null;
}

function forwardUntilNextH3($: cheerio.CheerioAPI, start: cheerio.Cheerio<AnyNode>) {
  const out: Element[] = [];
  let cur = start.next();
  while (cur.length) {
    const node = cur.get(0);
    const name = node && 'name' in node ? (node as Element).name?.toLowerCase?.() : undefined;
    if (name === 'h3') break;
    if (node) out.push(node as Element);
    cur = cur.next();
  }
  return $(out);
}

function pickRealTableAfterHeading(
  $: cheerio.CheerioAPI,
  heading: cheerio.Cheerio<AnyNode>,
  headerNeedles: string[]
) {
  const sib = forwardUntilNextH3($, heading);
  const tables = sib.filter(
    (_, el) => (el as any).name?.toLowerCase() === 'table'
  );
  for (let i = 0; i < tables.length; i++) {
    const t = tables.eq(i);
    const caption = norm(t.find('caption').text());
    if (/legend/i.test(caption)) continue; // skip legend

    const theadText = norm(t.find('thead').text()).toLowerCase();
    const bodyRows = t.find('tbody tr');
    const firstRowCols = bodyRows.first().find('td').length;

    // Heuristics: must look like a data table, not legend
    const okHeader = headerNeedles.some((n) =>
      theadText.includes(n.toLowerCase())
    );
    const okSize = bodyRows.length >= 2 && firstRowCols >= 6;
    if (okHeader || okSize) return t;
  }
  return null;
}

async function main() {
  const html = await fs.readFile('../examples/page.html', 'utf8');
  const $ = cheerio.load(html);

  // TEAM
  console.log('TEAM:');
  console.log('  name  :', $('h1').first().text().trim());
  console.log('  code  :'); // derive later
  console.log('  season:'); // set externally

  // TOTALS
  console.log('\nTOTALS:');
  $('h5').each((_, el) => {
    const t = norm($(el).text());
    if (
      /(CAP HIT|CAP ROOM|TEAM SALARY|LUXURY TAX ROOM|APRON|HARD CAPPED)/i.test(
        t
      )
    ) {
      console.log('  ·', t);
    }
  });

  // SIGNING EXCEPTIONS
  const h3Signing = findHeading($, 'h3', 'SIGNING EXCEPTIONS');
  if (h3Signing) {
    const lis = h3Signing.nextAll('ul').first().find('li');
    console.log('\nSIGNING EXCEPTIONS:', lis.length);
    lis.each((_, li) => console.log('  ·', norm($(li).text())));
  } else {
    console.log('\nSIGNING EXCEPTIONS: 0');
  }

  // --- TRADE EXCEPTIONS (sw wrapper) ---
  {
    const h3 = findHeading($, 'h3', 'TRADE EXCEPTIONS');
    if (h3) {
      const sib = forwardUntilNextH3($, h3);
      const wrapper = sib
        .filter((_, el) => $(el).is('div.sw_table__tradeExptn_wrapper'))
        .first();
      if (wrapper.length) {
        // each row typically has a player anchor, amounts, and dates
        const rows: cheerio.Cheerio<AnyNode>[] = [];
        // heuristic: a row is the closest block container around each player link
        wrapper.find('a[href^="/players/"]').each((_, a) => {
          const row = $(a).closest('div, tr, li'); // pick nearest container
          if (row.length && !rows.find((r) => r.get(0) === row.get(0)))
            rows.push(row);
        });
        console.log('\nTRADE EXCEPTIONS (wrapper) rows:', rows.length);
        rows.forEach((row, i) => {
          const player = norm(row.find('a[href^="/players/"]').first().text());
          const text = norm(row.text());
          const monies = text.match(/\$[\d,]+/g) || []; // [exception, used, remaining]
          const dates = text.match(/[A-Z][a-z]+ \d{1,2}, \d{4}/g) || []; // [start, end]
          console.log(
            `  · ${player} | ${monies.join(' | ')} | ${dates.join(' → ')}`
          );
        });
      } else {
        console.log('\nTRADE EXCEPTIONS (wrapper): 0 (wrapper div not found)');
      }
    } else {
      console.log('\nTRADE EXCEPTIONS: 0 (heading not found)');
    }
  }

  // --- HOLDS (optional; if present) ---
  {
    const h3 = findHeading($, 'h3', 'HOLDS');
    if (h3) {
      const sib = forwardUntilNextH3($, h3);
      // try first table after the heading
      const tbl = sib.filter((_, el) => $(el).is('table')).first();
      if (tbl.length) {
        const rows = tbl.find('tbody tr');
        console.log('\nHOLDS rows:', rows.length);
        rows.slice(0, 5).each((_, tr) => {
          const tds = $(tr).find('td');
          console.log(
            '  ·',
            norm(tds.eq(0).text()),
            '|',
            norm(tds.eq(1).text()),
            '|',
            norm(tds.eq(2).text())
          );
        });
      } else {
        console.log('\nHOLDS rows: 0 (no table under HOLDS)');
      }
    }
  }

  // --- DRAFT PICKS (explicit SalarySwish table by ID, print rich info) ---
  {
    const tbl = $('#sw_teamProfile__draftTable');
    if (tbl.length) {
      const years = tbl
        .find('thead th')
        .map((i, th) => (i ? $(th).text().trim() : ''))
        .get()
        .slice(1)
        .filter(Boolean);

      console.log('\nDRAFT years:', years.join(', '));

      tbl.find('tbody tr').each((_, tr) => {
        const tds = $(tr).find('td');
        if (tds.length < 2) return;

        const roundLabel = $(tds[0]).text().trim();
        const round = /2/.test(roundLabel) ? 2 : 1;

        for (let j = 1; j < tds.length; j++) {
          const year = years[j - 1];
          const td = $(tds[j]);

          // cell signals
          const q = td.find('.q').first();
          const title = (q.attr('title') || '').trim(); // tooltip often has reason/protections summary
          const href = td.find('a').first().attr('href') || '';
          const url = href
            ? new URL(href, 'https://www.salaryswish.com').toString()
            : '';

          const traded =
            td.find('.d_pick_traded').length > 0 || /traded/i.test(title);
          const contested =
            td.find('.sw_teamProfile__draftPick_inContention').length > 0 ||
            /in contention/i.test(title);
          const hasPickUI = td.find('.d_pick, img, a').length > 0;

          const status = traded
            ? 'outgoing'
            : contested
              ? 'contested'
              : hasPickUI
                ? 'own'
                : 'unknown';

          // pick number from ?pick=NN
          const mPick = href.match(/[?&]pick=(\d+)/);
          const pickNum = mPick ? Number(mPick[1]) : undefined;

          // contending teams from tooltip
          let contendingTeams: string[] | undefined;
          const mTeams = title.match(/Contending teams:\s*([A-Z, ]+)/i);
          if (mTeams)
            contendingTeams = mTeams[1]
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);

          // traded date from tooltip (if present)
          const tradedOn = title.match(
            /traded away on\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i
          )?.[1];

          console.log(
            `  Round ${round} ${year}: ${status}` +
              (pickNum ? ` #${pickNum}` : '') +
              (tradedOn ? ` · tradedOn=${tradedOn}` : '') +
              (contendingTeams?.length
                ? ` · contested=[${contendingTeams.join(', ')}]`
                : '') +
              (title ? ` · title="${title}"` : '') +
              (url ? ` · url=${url}` : '')
          );
        }
      });
    } else {
      console.log('\nDRAFT: #sw_teamProfile__draftTable not found');
    }
  }

  // ROSTER — only /players/... links (exclude /transactions/...)
  const h5Season = findHeading($, 'h5', 'Season Display');
  if (h5Season) {
    // gather siblings until next <h3>
    const block = (() => {
      const out: Element[] = [];
      let cur = h5Season.next();
      while (cur.length) {
        const node = cur.get(0);
        const tag = node && 'name' in node ? (node as Element).name?.toLowerCase?.() : undefined;
        if (tag === 'h3') break;
        if (node) out.push(node as Element);
        cur = cur.next();
      }
      return $(out);
    })();

    // Strict filter: href must START with /players/
    const anchors = block.find('a').filter((_, a) => {
      const href = ($(a).attr('href') || '').trim();
      return /^\/players\//.test(href);
    });

    const seen = new Set<string>();
    const items: { name: string; href: string }[] = [];
    anchors.each((_, a) => {
      const href = ($(a).attr('href') || '').trim();
      if (!href || seen.has(href)) return;
      seen.add(href);
      items.push({ name: norm($(a).text()), href });
    });

    console.log('\nROSTER rows:', items.length);
    items
      .slice(0, 30)
      .forEach((r) => console.log('  ·', r.name || '(no name)', '→', r.href));
  } else {
    console.log('\nROSTER rows: 0 (Season Display block not found)');
  }
}

main();
