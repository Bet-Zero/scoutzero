/**
 * FILE: scripts/exportReviewPackage.mjs
 * PURPOSE: Assemble the ChatGPT-ready owner-review hand-off folder from a staging
 *          directory. Deterministic final step of the review-mode screenshot
 *          workflow so the folder is identical every time (see memory
 *          "review-chatgpt-export").
 * OWNERSHIP: Tooling: architect review workflow
 *
 * WHAT IT DOES:
 *   - Copies every *.png (sorted by filename) and review.md from --from into
 *     ~/Downloads/<TICKET>-review/ (override with --dest).
 *   - Refuses to ship .pdf/.html — the folder is PNGs + review.md only, because
 *     that is what ChatGPT can review natively.
 *   - Wipes and rewrites the destination so re-runs are clean.
 *
 * USAGE:
 *   node scripts/exportReviewPackage.mjs --ticket BZE-222 --from <stagingDir>
 *   node scripts/exportReviewPackage.mjs --ticket BZE-222 --from <dir> --dest <dir>
 *
 * STAGING DIR CONTRACT:
 *   - Screenshots pre-named in review order, e.g. 01-baseline.png, 02-deck.png.
 *   - review.md present (the compact brief: what changed, validation, open questions).
 */

import { existsSync, mkdirSync, readdirSync, rmSync, copyFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const parseArgs = (argv) => {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i += 1;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
};

const fail = (message) => {
  process.stderr.write(`\n  ❌ ${message}\n\n`);
  process.exit(1);
};

const args = parseArgs(process.argv.slice(2));
const ticket = typeof args.ticket === 'string' ? args.ticket.trim() : '';
const from = typeof args.from === 'string' ? args.from : '';

if (!ticket) fail('Missing --ticket <ID> (e.g. --ticket BZE-222).');
if (!from) fail('Missing --from <stagingDir>.');
if (!existsSync(from)) fail(`Staging dir not found: ${from}`);

const dest =
  typeof args.dest === 'string'
    ? args.dest
    : path.join(homedir(), 'Downloads', `${ticket}-review`);

const entries = readdirSync(from);
const pngs = entries.filter((f) => f.toLowerCase().endsWith('.png')).sort();
const hasBrief = entries.includes('review.md');
const banned = entries.filter((f) => /\.(pdf|html?)$/i.test(f));

if (pngs.length === 0) fail(`No .png screenshots found in ${from}`);
if (!hasBrief) fail(`review.md not found in ${from} — the brief is required.`);
if (banned.length > 0) {
  process.stdout.write(
    `  ↷ Skipping (folder is PNGs + review.md only): ${banned.join(', ')}\n`
  );
}

// Clean + recreate so re-runs never leave stale files behind.
rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });

for (const png of pngs) {
  copyFileSync(path.join(from, png), path.join(dest, png));
}
copyFileSync(path.join(from, 'review.md'), path.join(dest, 'review.md'));

process.stdout.write(`\n  ✅ Review package for ${ticket}\n`);
process.stdout.write(`     ${dest}\n`);
for (const f of [...pngs, 'review.md']) {
  process.stdout.write(`       • ${f}\n`);
}
process.stdout.write(
  `\n  Drag this folder into ChatGPT to co-review.\n\n`
);
