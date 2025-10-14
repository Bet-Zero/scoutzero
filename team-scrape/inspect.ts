// inspect.ts — Section x-ray for SalarySwish team pages (uses ./page.html)
// Run: npm run inspect

import fs from 'node:fs/promises';
import * as cheerio from 'cheerio';

const norm = (s: string) => (s || '').replace(/\s+/g, ' ').trim();

function listHeadings($: cheerio.CheerioAPI, tag: 'h3' | 'h5') {
  const items: string[] = [];
  $(tag).each((_, el) => items.push(norm($(el).text())));
  return items;
}

function findHeading(
  $: cheerio.CheerioAPI,
  tag: 'h3' | 'h5',
  includes: string
) {
  const needle = includes.toLowerCase();
  let found: cheerio.Cheerio | null = null;
  $(tag).each((_, el) => {
    const t = norm($(el).text()).toLowerCase();
    if (!found && t.includes(needle)) found = $(el);
  });
  return found;
}

function forwardUntilNextH3($: cheerio.CheerioAPI, start: cheerio.Cheerio) {
  const out: cheerio.Element[] = [];
  let cur = start.next();
  while (cur.length) {
    const name = (cur.get(0) as any)?.name?.toLowerCase?.();
    if (name === 'h3') break;
    out.push(cur.get(0));
    cur = cur.next();
  }
  return $(out);
}

(async () => {
  const html = await fs.readFile('./page.html', 'utf8');
  const $ = cheerio.load(html);

  console.log('H5 headings:');
  listHeadings($, 'h5').forEach((h) => console.log('  ·', h));

  console.log('\nH3 headings:');
  listHeadings($, 'h3').forEach((h) => console.log('  ·', h));

  // ---- Inspect specific sections ----
  const targets: Array<{ tag: 'h3' | 'h5'; label: string }> = [
    { tag: 'h5', label: 'Season Display' },
    { tag: 'h3', label: 'TRADE EXCEPTIONS' },
    { tag: 'h3', label: 'Draft' },
  ];

  for (const t of targets) {
    const h = findHeading($, t.tag, t.label);
    console.log(`\n>>> SECTION: ${t.label} (${t.tag})`);
    if (!h) {
      console.log('  (heading not found)');
      continue;
    }

    const sib =
      t.tag === 'h3'
        ? forwardUntilNextH3($, h)
        : (() => {
            const out: cheerio.Element[] = [];
            let cur = h.next();
            while (cur.length) {
              const name = (cur.get(0) as any)?.name?.toLowerCase?.();
              if (name === 'h3') break;
              out.push(cur.get(0));
              cur = cur.next();
            }
            return $(out);
          })();

    // List the next 10 sibling blocks with quick summaries
    let idx = 0;
    sib.each((_, el) => {
      if (idx >= 10) return;
      idx++;
      const tag = (el as any).name || '(node)';
      const $el = $(el);
      const cls = ($el.attr('class') || '').trim();
      const caption = norm($el.find('caption').first().text());
      const thead = norm($el.find('thead').first().text());
      const textSnippet = norm($el.text()).slice(0, 120);

      if (tag.toLowerCase() === 'table') {
        const r = $el.find('tbody tr');
        const c = r.first().find('td').length;
        console.log(
          `  [${idx}] <table class="${cls}"> rows=${r.length} cols=${c} caption="${caption}" thead="${thead.slice(0, 80)}"`
        );
        // print first data row snippet
        if (r.length)
          console.log('       sample:', norm(r.first().text()).slice(0, 120));
      } else if (tag.toLowerCase() === 'ul') {
        const liCount = $el.find('li').length;
        console.log(
          `  [${idx}] <ul class="${cls}"> li=${liCount} sample="${textSnippet}"`
        );
      } else {
        console.log(`  [${idx}] <${tag} class="${cls}"> text="${textSnippet}"`);
      }
    });

    // For roster: show number of player anchors in this block
    if (t.label === 'Season Display') {
      const anchors = sib.find('a[href^="/players/"]');
      console.log(`  players anchors in block: ${anchors.length}`);
      // peek first 10
      anchors.slice(0, 10).each((i, a) => {
        console.log(`    · ${norm($(a).text())} -> ${$(a).attr('href')}`);
      });
      // also look for a subheading containing "Active ("
      const subHead = sib
        .find('h6, h5, h4')
        .filter((_, e) => /Active\s*\(/i.test(norm($(e).text())))
        .first();
      if (subHead.length)
        console.log('  found subheading:', norm(subHead.text()));
    }
  }
})();
