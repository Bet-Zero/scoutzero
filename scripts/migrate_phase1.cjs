#!/usr/bin/env node
/* Minimal Firestore migration runner (Phase 1) */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const { transforms } = require('./transforms.cjs');
const { validateTarget } = require('./validate_target.cjs');

// Initialize Firebase Admin with service account
if (!admin.apps.length) {
  const serviceAccount = require('../serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

function parseArgs(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--dry-run' || k === '--shadow') {
      a[k.slice(2)] = true;
      continue;
    }
    if (k.startsWith('--')) {
      a[k.slice(2)] = argv[i + 1];
      i++;
    }
  }
  return a;
}
function loadMapping(p) {
  const raw = fs.readFileSync(p, 'utf8');
  const m = JSON.parse(raw);
  m.placeholders = m.placeholders || {
    seasonId: '2025-26',
    contractId: 'std_202425',
  };
  return m;
}
function applyPH(s, ph) {
  return s
    .replaceAll('{seasonId}', ph.seasonId)
    .replaceAll('{contractId}', ph.contractId);
}
function getByPath(o, p) {
  if (o == null) return undefined;
  const norm = String(p).replace(/\[['"]([^'"]+)['"]\]/g, '.$1');
  return norm
    .split('.')
    .filter(Boolean)
    .reduce((c, k) => (c ? c[k] : undefined), o);
}
function setByPath(o, p, v) {
  const parts = p.split('.');
  let c = o;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (!c[k] || typeof c[k] !== 'object') c[k] = {};
    c = c[k];
  }
  c[parts[parts.length - 1]] = v;
}
function mapDoc(legacy, mapping) {
  const out = {};
  const warnings = [];
  for (const row of mapping.mappings) {
    try {
      const to = applyPH(row.to, mapping.placeholders);
      const from = row.from;
      const raw = getByPath(legacy, from);
      const fn = transforms[row.transform || 'copy'] || transforms.copy;
      const val = fn(raw, {
        legacy,
        row,
        toPath: to,
        fromPath: from,
        placeholders: mapping.placeholders,
      });
      if (val !== undefined) setByPath(out, to, val);
    } catch (e) {
      warnings.push(`${row.to}<-${row.from}: ${e.message}`);
    }
  }
  return { targetDoc: out, warnings };
}

(async () => {
  const args = parseArgs(process.argv);
  const mappingPath =
    args.mapping || path.resolve('./mapping_phase1_FINAL.json');
  const mapping = loadMapping(mappingPath);
  const src = db.collection('players');
  const dstName = args.shadow ? 'players_v2_shadow' : 'players_v2';
  const dst = db.collection(dstName);
  let q = src.orderBy(admin.firestore.FieldPath.documentId());
  if (args.startAfter) q = q.startAfter(args.startAfter);
  if (args.limit) q = q.limit(Number(args.limit));
  const snap = await q.get();
  let ok = 0,
    fail = 0;
  for (const doc of snap.docs) {
    const legacy = doc.data(),
      id = doc.id;
    const { targetDoc, warnings } = mapDoc(legacy, mapping);
    const errors = validateTarget(targetDoc);
    if (errors.length) {
      console.error(`VALIDATION ${id}:`, errors);
      fail++;
      continue;
    }
    if (args['dry-run']) {
      console.log(
        `DRY ${id}`,
        warnings.length ? `(warn ${warnings.length})` : ''
      );
      ok++;
      continue;
    }
    try {
      await dst.doc(id).set(targetDoc, { merge: true });
      console.log(
        `WROTE ${id}`,
        warnings.length ? `(warn ${warnings.length})` : ''
      );
      ok++;
    } catch (e) {
      console.error(`WRITE FAIL ${id}:`, e.message);
      fail++;
    }
  }
  console.log(`Done OK=${ok} FAIL=${fail}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
