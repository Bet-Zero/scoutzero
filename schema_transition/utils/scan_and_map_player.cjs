// SCAN + TREES + OLD→NEW MAP + FULL DOC DUMPS (CommonJS, no deps)
//
// Run:
// SA_PATH=./serviceAccountKey.json PLAYER="wendell_carter_jr" SEASON="2025-26" node scripts/scan_and_map_player.cjs

const fs = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// --------- CONFIG ---------
const SA_PATH = process.env.SA_PATH || './serviceAccountKey.json';
const PLAYER = process.env.PLAYER;
const SEASON = process.env.SEASON || '2025-26';
if (!PLAYER) {
  console.error('PLAYER env var is required (slug id in players/*).');
  process.exit(1);
}

// --------- INIT ---------
const sa = JSON.parse(fs.readFileSync(SA_PATH, 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

// --------- HELPERS ---------
const TEAM_CODE = {
  'ATLANTA HAWKS': 'ATL',
  'BOSTON CELTICS': 'BOS',
  'BROOKLYN NETS': 'BKN',
  'CHARLOTTE HORNETS': 'CHA',
  'CHICAGO BULLS': 'CHI',
  'CLEVELAND CAVALIERS': 'CLE',
  'DALLAS MAVERICKS': 'DAL',
  'DENVER NUGGETS': 'DEN',
  'DETROIT PISTONS': 'DET',
  'GOLDEN STATE WARRIORS': 'GSW',
  'HOUSTON ROCKETS': 'HOU',
  'INDIANA PACERS': 'IND',
  'LA CLIPPERS': 'LAC',
  'LOS ANGELES LAKERS': 'LAL',
  'MEMPHIS GRIZZLIES': 'MEM',
  'MIAMI HEAT': 'MIA',
  'MILWAUKEE BUCKS': 'MIL',
  'MINNESOTA TIMBERWOLVES': 'MIN',
  'NEW ORLEANS PELICANS': 'NOP',
  'NEW YORK KNICKS': 'NYK',
  'OKLAHOMA CITY THUNDER': 'OKC',
  'ORLANDO MAGIC': 'ORL',
  'PHILADELPHIA 76ERS': 'PHI',
  'PHOENIX SUNS': 'PHX',
  'PORTLAND TRAIL BLAZERS': 'POR',
  'SACRAMENTO KINGS': 'SAC',
  'SAN ANTONIO SPURS': 'SAS',
  'TORONTO RAPTORS': 'TOR',
  'UTAH JAZZ': 'UTA',
  'WASHINGTON WIZARDS': 'WAS',
};
const TEAM_ALIASES = {
  HAWKS: 'ATL',
  CELTICS: 'BOS',
  NETS: 'BKN',
  HORNETS: 'CHA',
  BULLS: 'CHI',
  CAVALIERS: 'CLE',
  MAVERICKS: 'DAL',
  NUGGETS: 'DEN',
  PISTONS: 'DET',
  WARRIORS: 'GSW',
  ROCKETS: 'HOU',
  PACERS: 'IND',
  CLIPPERS: 'LAC',
  LAKERS: 'LAL',
  GRIZZLIES: 'MEM',
  HEAT: 'MIA',
  BUCKS: 'MIL',
  TIMBERWOLVES: 'MIN',
  PELICANS: 'NOP',
  KNICKS: 'NYK',
  THUNDER: 'OKC',
  MAGIC: 'ORL',
  '76ERS': 'PHI',
  SIXERS: 'PHI',
  SUNS: 'PHX',
  'TRAIL BLAZERS': 'POR',
  BLAZERS: 'POR',
  KINGS: 'SAC',
  SPURS: 'SAS',
  RAPTORS: 'TOR',
  JAZZ: 'UTA',
  WIZARDS: 'WAS',
};
const pct = (v) => {
  if (v == null) return null;
  if (typeof v === 'number') return v > 1.0001 ? v / 100 : v;
  const s = String(v).trim();
  const m = s.match(/^(\d+(\.\d+)?)%$/);
  if (m) return Number(m[1]) / 100;
  const num = Number(s);
  return num > 1.0001 ? num / 100 : num;
};
const toTeamId = (raw) => {
  if (!raw) return null;
  const t = String(raw)
    .trim()
    .toUpperCase()
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ');
  return TEAM_CODE[t] || TEAM_ALIASES[t] || null;
};
const normRights = (s) => {
  const t = String(s || '').toLowerCase();
  if (!t) return 'None';
  if (t.startsWith('full')) return 'Full';
  if (t.startsWith('early')) return 'Early';
  if (t.includes('non')) return 'Non';
  return 'Full';
};
const toSeasonKeyFromYear = (y) =>
  `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
const seasonKeyToStartYear = (seasonKey) => {
  const m = String(seasonKey).match(/^(\d{4})-/);
  return m ? Number(m[1]) : null;
};
const yearsLeftFor = (seasonKey, endSeasonKey) => {
  const start = seasonKeyToStartYear(seasonKey),
    end = seasonKeyToStartYear(endSeasonKey);
  if (!start || !end) return null;
  return Math.max(0, end - start + 1);
};
const dollarsToDisplay = (money) =>
  money == null ? '$0' : `$${(Number(money) / 1_000_000).toFixed(1)}M`;

// --------- TREE UTILS ---------
function walkFields(node, prefix = '', out = []) {
  if (node === null || node === undefined) return out;
  if (Array.isArray(node)) {
    node.forEach((v, i) =>
      walkFields(v, `${prefix}${prefix ? '.' : ''}${i}`, out)
    );
    return out;
  }
  if (typeof node === 'object') {
    Object.entries(node).forEach(([k, v]) => {
      const p = prefix ? `${prefix}.${k}` : k;
      if (v !== null && typeof v === 'object') walkFields(v, p, out);
      else out.push(p);
    });
    return out;
  }
  out.push(prefix);
  return out;
}
function insertPath(tree, pathStr) {
  const parts = pathStr.split('.');
  let cur = tree;
  for (const part of parts) {
    if (!(part in cur)) cur[part] = {};
    cur = cur[part];
  }
}
function buildTreeFromPaths(paths) {
  const root = {};
  for (const p of paths) insertPath(root, p);
  return root;
}
function captureTree(obj, prefix = '', lines = []) {
  const keys = Object.keys(obj).sort();
  keys.forEach((k, i) => {
    const last = i === keys.length - 1;
    const branch = last ? '└─ ' : '├─ ';
    const next = prefix + (last ? '   ' : '│  ');
    lines.push(prefix + branch + k);
    captureTree(obj[k], next, lines);
  });
  return lines;
}
function printTree(obj) {
  captureTree(obj).forEach((l) => process.stdout.write(l + '\n'));
}

// --------- BUILDERS ---------
function buildFullStats(p) {
  const grab = (...keys) => {
    for (const k of keys) {
      if (p?.[k] != null) return p[k];
      if (p?.system?.stats?.[k] != null) return p.system.stats[k];
    }
    return null;
  };
  const out = {
    G: grab('G', 'Games Played'),
    GS: grab('GS'),
    MP: Number(grab('MP', 'MIN')) || null,
    PTS: Number(grab('PTS', 'PPG')) || null,
    AST: Number(grab('AST', 'APG')) || null,
    TRB: Number(grab('TRB', 'RPG')) || null,
    DRB: Number(grab('DRB')),
    ORB: Number(grab('ORB')),
    STL: Number(grab('STL')),
    BLK: Number(grab('BLK')),
    TOV: Number(grab('TOV')),
    PF: Number(grab('PF')),
    FG: Number(grab('FG')),
    FGA: Number(grab('FGA')),
    'FG%': pct(grab('FG%')),
    '3P': Number(grab('3P')),
    '3PA': Number(grab('3PA')),
    '3P%': pct(grab('3P%', '3PT%')),
    '2P': Number(grab('2P')),
    '2PA': Number(grab('2PA')),
    '2P%': pct(grab('2P%')),
    FT: Number(grab('FT')),
    FTA: Number(grab('FTA')),
    'FT%': pct(grab('FT%')),
    'eFG%': pct(grab('eFG%', 'EFG%')),
  };
  Object.keys(out).forEach((k) => {
    if (out[k] == null || Number.isNaN(out[k])) delete out[k];
  });
  return out;
}
function buildContractFromAnnualSalaries(p) {
  const ann = p?.contract?.annual_salaries;
  if (!Array.isArray(ann) || !ann.length) return null;
  const srt = ann
    .filter((r) => r && r.year != null && r.salary != null)
    .sort((a, b) => Number(a.year) - Number(b.year));
  const startYear = Number(srt[0].year),
    endYear = Number(srt[srt.length - 1].year);
  const startSeason = toSeasonKeyFromYear(startYear),
    endSeason = toSeasonKeyFromYear(endYear);
  const salariesByYear = srt.map((r) => ({
    season: toSeasonKeyFromYear(Number(r.year)),
    salary: Number(r.salary),
  }));
  const totalValue = salariesByYear.reduce(
    (s, r) => s + (Number(r.salary) || 0),
    0
  );
  const contract = {
    signedOn: p?.contract?.signed_year
      ? `${p.contract.signed_year}-07-01`
      : null,
    type: p?.contract_summary?.is_extension === true ? 'extension' : 'standard',
    startSeason,
    endSeason,
    signingTeamId:
      toTeamId(p?.contract?.signing_team) || toTeamId(p?.bio?.Team || p?.Team),
    totalValue,
    years: salariesByYear.length,
    rightsAtSigning: p?.bird_rights ? normRights(p.bird_rights) : undefined,
    bonuses: p?.contract?.incentives
      ? {
          likely: Number(p.contract.incentives.likely || 0),
          unlikely: Number(p.contract.incentives.unlikely || 0),
        }
      : undefined,
    options: Array.isArray(p?.contract?.options)
      ? p.contract.options.map((opt) => ({
          season:
            String(
              opt.year
                ? toSeasonKeyFromYear(Number(opt.year))
                : opt.season || ''
            ).trim() || undefined,
          type: opt.type || null,
        }))
      : undefined,
    guarantees: Array.isArray(ann)
      ? ann
          .filter(
            (y) => y.guaranteed !== undefined || y.guarantee_amt !== undefined
          )
          .map((y) => ({
            season: toSeasonKeyFromYear(Number(y.year)),
            amt:
              y.guarantee_amt != null
                ? Number(y.guarantee_amt)
                : y.guaranteed === true
                  ? Number(y.salary || 0)
                  : 0,
          }))
      : undefined,
    salariesByYear,
  };
  Object.keys(contract).forEach((k) => {
    if (contract[k] == null) delete contract[k];
  });
  if (
    Array.isArray(contract.options) &&
    contract.options.every((o) => !o.type && !o.season)
  )
    delete contract.options;
  if (
    Array.isArray(contract.guarantees) &&
    contract.guarantees.every((g) => !g.amt)
  )
    delete contract.guarantees;
  return contract;
}
const pickSalaryForSeason = (contract, seasonKey) => {
  const row = (contract?.salariesByYear || []).find(
    (r) => r.season === seasonKey
  );
  return row ? Number(row.salary) : null;
};
const computeFA = (p) => {
  const year = Number(p?.contract?.free_agency_year);
  if (!year) return null;
  const s = (p?.bio?.['Free Agent'] || p?.['Free Agent'] || '').toString();
  const m = s.match(/\(([^)]+)\)/);
  return { year, type: m ? m[1] : null };
};

// --------- MAPPING ---------
function makeMappings(p) {
  const rows = [];
  const push = (oldPath, newPath, notes = '') =>
    rows.push({ oldPath, newPath, notes });
  const addIf = (srcs, dest, note = '') => {
    for (const s of srcs) {
      const val = s.split('.').reduce((o, k) => (o ? o[k] : undefined), p);
      if (val !== undefined) {
        push(s, dest, note);
      }
    }
  };

  // BIO
  addIf(['Name', 'name', 'bio.Name', 'display_name'], 'players/{id}.bio.name');
  addIf(['display_name'], 'players/{id}.bio.displayName');
  addIf(['Position', 'Pos', 'bio.Position'], 'players/{id}.bio.pos');
  addIf(['HT', 'bio.height', 'bio.HT'], 'players/{id}.bio.ht');
  addIf(['WT', 'bio.weight_lbs', 'bio.WT'], 'players/{id}.bio.wt');
  addIf(['bio.birthdate'], 'players/{id}.bio.dob');
  addIf(['bio.nationality'], 'players/{id}.bio.nationality');
  addIf(['bio.shoots'], 'players/{id}.bio.shoots');
  addIf(['Years Pro', 'bio.years_pro'], 'players/{id}.bio.yearsPro');
  addIf(['agent.name'], 'players/{id}.bio.agent.name');
  addIf(['agent.agency'], 'players/{id}.bio.agent.agency');
  addIf(['draft.year'], 'players/{id}.bio.draft.year');
  addIf(['draft.round'], 'players/{id}.bio.draft.round');
  addIf(['draft.pick'], 'players/{id}.bio.draft.pick');
  addIf(['draft.team'], 'players/{id}.bio.draft.teamId', 'normalized 3-letter');
  addIf(
    ['nba_player_id', 'nbaId'],
    'playersByNbaId/{nbaId} -> {playerId}',
    'xref index'
  );

  // CONTRACT (full doc)
  const contract = buildContractFromAnnualSalaries(p);
  if (contract) {
    const contractId =
      (contract.type === 'extension' ? 'ext_' : 'std_') +
      contract.startSeason.replace('-', '');
    push(
      'contract.annual_salaries.*',
      `players/{id}/contracts/${contractId}.salariesByYear[]`,
      'year->season'
    );
    addIf(
      ['contract.signed_year'],
      `players/{id}/contracts/${contractId}.signedOn`,
      'YYYY->YYYY-07-01'
    );
    addIf(
      ['contract.signing_team', 'bio.Team', 'Team'],
      `players/{id}/contracts/${contractId}.signingTeamId`,
      'normalized'
    );
    addIf(
      ['bird_rights'],
      `players/{id}/contracts/${contractId}.rightsAtSigning`,
      'Full/Early/Non/None'
    );
    addIf(
      ['contract.incentives.likely'],
      `players/{id}/contracts/${contractId}.bonuses.likely`
    );
    addIf(
      ['contract.incentives.unlikely'],
      `players/{id}/contracts/${contractId}.bonuses.unlikely`
    );
    push(
      '(derived) startSeason',
      `players/{id}/contracts/${contractId}.startSeason`
    );
    push(
      '(derived) endSeason',
      `players/{id}/contracts/${contractId}.endSeason`
    );
    addIf(
      ['no_trade_clause'],
      `players/{id}/contracts/${contractId}.noTradeClause`
    );
    addIf(['trade_kicker'], `players/{id}/contracts/${contractId}.tradeKicker`);
    addIf(['signed_using'], `players/{id}/contracts/${contractId}.signedUsing`);
    addIf(
      ['qualifying_offer'],
      `players/{id}/contracts/${contractId}.qualifyingOffer`
    );
    addIf(['cap_hold'], `players/{id}/contracts/${contractId}.capHold`);
    addIf(
      ['contract_summary.aav'],
      `players/{id}/contracts/${contractId}.notes`,
      'append aav:'
    );
    addIf(
      ['contract_summary.cap_percentage'],
      `players/{id}/contracts/${contractId}.notes`,
      'append cap%:'
    );
  }

  // SEASON DOC (K1)
  const teamId = toTeamId(p?.bio?.Team || p?.Team);
  if (teamId)
    push(
      'Team|bio.Team',
      `players/{id}/seasons/${SEASON}.teamId`,
      'normalized 3-letter'
    );
  const salary = contract ? pickSalaryForSeason(contract, SEASON) : null;
  const rights = p?.bird_rights ? normRights(p.bird_rights) : 'None';
  const faParsed = computeFA(p);
  push(
    'bird_rights',
    `players/{id}/seasons/${SEASON}.contractView.rights`,
    'normalized'
  );
  if (contract)
    push(
      'contract.annual_salaries.*',
      `players/{id}/seasons/${SEASON}.contractView.salary`,
      'salary for SEASON'
    );
  if (faParsed)
    push(
      'contract.free_agency_year + Free Agent',
      `players/{id}/seasons/${SEASON}.contractView.fa`,
      '{year,type}'
    );
  addIf(
    ['free_agent_type'],
    `players/{id}/seasons/${SEASON}.contractView.fa.type`,
    'override type if present'
  );
  if (contract) {
    const yearsLeft = yearsLeftFor(SEASON, contract.endSeason);
    const contractId =
      (contract.type === 'extension' ? 'ext_' : 'std_') +
      contract.startSeason.replace('-', '');
    push(
      '(derived id)',
      `players/{id}/seasons/${SEASON}.contractView.contractId`,
      contractId
    );
    push(
      '(derived years left)',
      `players/{id}/seasons/${SEASON}.contractView.yearsLeft`,
      String(yearsLeft)
    );
    push(
      '(display)',
      `players/{id}/seasons/${SEASON}.contractView.display.contract`,
      `${dollarsToDisplay(salary)} / ${yearsLeft ?? 0}`
    );
    push(
      '(display)',
      `players/{id}/seasons/${SEASON}.contractView.display.freeAgent`,
      `${faParsed?.year ?? ''}${faParsed?.type ? ` (${faParsed.type})` : ''}`
    );
  }

  // STATS
  const statSyns = [
    ['G', 'Games Played'],
    ['GS'],
    ['MP', 'MIN'],
    ['PTS', 'PPG'],
    ['AST', 'APG'],
    ['TRB', 'RPG'],
    ['DRB'],
    ['ORB'],
    ['STL'],
    ['BLK'],
    ['TOV'],
    ['PF'],
    ['FG'],
    ['FGA'],
    ['FG%'],
    ['3P'],
    ['3PA'],
    ['3P%', '3PT%'],
    ['2P'],
    ['2PA'],
    ['2P%'],
    ['FT'],
    ['FTA'],
    ['FT%'],
    ['eFG%', 'EFG%'],
  ];
  for (const syn of statSyns) {
    const dest = syn[0];
    for (const k of syn) {
      const v = p?.[k] ?? p?.system?.stats?.[k];
      if (v !== undefined) {
        push(k, `players/{id}/seasons/${SEASON}.stats.${dest}`);
        break;
      }
    }
  }

  // EVALUATION — values + blurbs
  if (p?.blurbs?.traits && typeof p.blurbs.traits === 'object')
    push('blurbs.traits', `players/{id}/seasons/${SEASON}.evaluation.traits`);
  if (p?.traits && typeof p.traits === 'object') {
    for (const k of Object.keys(p.traits)) {
      push(
        `traits.${k}`,
        `players/{id}/seasons/${SEASON}.evaluation.traits.${k}`
      );
    }
  }
  addIf(
    ['roles.offense1'],
    `players/{id}/seasons/${SEASON}.evaluation.roles.offense1`
  );
  addIf(
    ['roles.offense2'],
    `players/{id}/seasons/${SEASON}.evaluation.roles.offense2`
  );
  addIf(
    ['roles.defense1'],
    `players/{id}/seasons/${SEASON}.evaluation.roles.defense1`
  );
  addIf(
    ['roles.defense2'],
    `players/{id}/seasons/${SEASON}.evaluation.roles.defense2`
  );
  addIf(
    ['roles.twoWay'],
    `players/{id}/seasons/${SEASON}.evaluation.roles.twoWay`
  );
  addIf(
    ['shootingProfile'],
    `players/{id}/seasons/${SEASON}.evaluation.shootingProfile`
  );
  if (Array.isArray(p?.badges))
    push('badges.*', `players/{id}/seasons/${SEASON}.evaluation.badges[]`);
  // blurbs (per aspect)
  addIf(
    ['blurbs.overall'],
    `players/{id}/seasons/${SEASON}.evaluation.blurbs.overall`
  );
  addIf(
    ['blurbs.shootingProfile'],
    `players/{id}/seasons/${SEASON}.evaluation.blurbs.shootingProfile`
  );
  addIf(
    ['blurbs.twoWayMeter'],
    `players/{id}/seasons/${SEASON}.evaluation.blurbs.twoWayMeter`
  );
  // optional: mirror shootingProfile text to roles blurb (UI convenience)
  addIf(
    ['blurbs.shootingProfile'],
    `players/{id}/seasons/${SEASON}.evaluation.blurbs.roles`,
    'mirrored from shootingProfile'
  );
  if (p?.blurbs?.traits && typeof p.blurbs.traits === 'object') {
    for (const t of Object.keys(p.blurbs.traits)) {
      const v = p.blurbs.traits[t];
      if (typeof v === 'string' && v.trim()) {
        push(
          `blurbs.traits.${t}`,
          `players/{id}/seasons/${SEASON}.evaluation.blurbs.traits.${t}`
        );
      }
    }
  }
  // grades + status
  addIf(
    ['overall_grade'],
    `players/{id}/seasons/${SEASON}.evaluation.grades.overall`
  );
  addIf(['status'], `players/{id}/seasons/${SEASON}.evaluation.status`);

  return rows;
}

// --------- PRETTY TABLE ---------
function padRight(s, n) {
  s = String(s || '');
  return s + ' '.repeat(Math.max(0, n - s.length));
}
function printTable(rows, widths) {
  const [w1, w2] = widths;
  console.log(
    padRight('OLD PATH', w1) + ' | ' + padRight('NEW PATH', w2) + ' | NOTES'
  );
  console.log('-'.repeat(w1) + '-+-' + '-'.repeat(w2) + '-+-' + '-'.repeat(20));
  rows.forEach((r) =>
    console.log(
      padRight(r.oldPath, w1) +
        ' | ' +
        padRight(r.newPath || '', w2) +
        ' | ' +
        (r.notes || '')
    )
  );
}

// --------- MAIN ---------
(async () => {
  const outDir = path.resolve(__dirname, '..', 'out');
  fs.mkdirSync(outDir, { recursive: true });
  const snap = await db.doc(`players/${PLAYER}`).get();
  if (!snap.exists) {
    console.error(`players/${PLAYER} does not exist.`);
    process.exit(1);
  }
  const data = snap.data() || {};

  // PRE-CHANGE TREE
  const allPaths = Array.from(new Set(walkFields(data))).sort();
  const oldTree = buildTreeFromPaths(allPaths);
  const oldTreePath = path.join(outDir, `OldTree_${PLAYER}.txt`);
  fs.writeFileSync(oldTreePath, captureTree(oldTree).join('\n') + '\n', 'utf8');
  console.log('\n======================================');
  console.log(`[SCAN] players/${PLAYER} — Fields: ${allPaths.length}`);
  console.log('• PRE-CHANGE FIELD TREE •');
  printTree(oldTree);
  console.log('Saved:', oldTreePath, '\n');

  // MAPPINGS
  const mappings = makeMappings(data);
  const aliasGroups = [
    ['3P%', '3PT%'],
    ['PTS', 'PPG'],
    ['AST', 'APG'],
    ['TRB', 'RPG'],
    ['MP', 'MIN'],
    ['G', 'Games Played'],
  ];
  const usedOlds = new Set(
    mappings.flatMap((r) =>
      r.oldPath.includes('|') ? r.oldPath.split('|') : [r.oldPath]
    )
  );
  const inSameAlias = (old) => {
    for (const g of aliasGroups)
      if (g.includes(old) && g.some((u) => usedOlds.has(u))) return true;
    if (old.startsWith('system.stats.')) {
      const k = old.replace('system.stats.', '');
      if (usedOlds.has(k)) return true;
    }
    return false;
  };
  const unmapped = allPaths.filter(
    (p) =>
      ![...usedOlds].some((u) => p === u || p.startsWith(u + '.')) &&
      !inSameAlias(p)
  );
  const unmappedRows = unmapped.map((oldPath) => ({
    oldPath,
    newPath: '',
    notes: 'UNMAPPED',
  }));
  const allRows = [...mappings, ...unmappedRows];

  // WRITE MAP CSV/JSON
  const csv = ['oldPath,newPath,notes']
    .concat(
      allRows.map(
        (r) =>
          `"${String(r.oldPath).replace(/"/g, '""')}","${String(r.newPath || '').replace(/"/g, '""')}","${String(r.notes || '').replace(/"/g, '""')}"`
      )
    )
    .join('\n');
  const mapCsvPath = path.join(outDir, `SchemaMap_${PLAYER}_${SEASON}.csv`);
  const mapJsonPath = path.join(outDir, `SchemaMap_${PLAYER}_${SEASON}.json`);
  fs.writeFileSync(mapCsvPath, csv, 'utf8');
  fs.writeFileSync(
    mapJsonPath,
    JSON.stringify({ player: PLAYER, season: SEASON, rows: allRows }, null, 2)
  );

  // MAP PREVIEW
  const termWidth = process.stdout.columns || 120;
  const w1 = Math.min(54, Math.floor(termWidth * 0.42));
  const w2 = Math.min(62, Math.floor(termWidth * 0.48));
  const preview = allRows.slice(0, 60);
  console.log('• OLD → NEW MAP (preview) •');
  printTable(preview, [w1, w2]);
  if (allRows.length > preview.length)
    console.log(
      `... ${allRows.length - preview.length} more rows (open ${path.relative(process.cwd(), mapCsvPath)})\n`
    );

  // NEW DEST TREE
  const destPaths = mappings
    .filter((r) => r.newPath && r.newPath.trim())
    .map((r) =>
      r.newPath
        .replace('players/{id}/', 'players/<id>/')
        .replace('players/{id}.', 'players/<id>.')
    );
  const newTree = buildTreeFromPaths(destPaths);
  const newTreePath = path.join(outDir, `NewTree_${PLAYER}_${SEASON}.txt`);
  fs.writeFileSync(newTreePath, captureTree(newTree).join('\n') + '\n', 'utf8');
  console.log('• NEW SCHEMA TREE (destination) •');
  printTree(newTree);
  console.log('Saved:', newTreePath, '\n');

  // UNMAPPED SUMMARY
  console.log(`• UNMAPPED: ${unmappedRows.length} field(s) •`);
  console.log(
    unmappedRows
      .slice(0, 30)
      .map((r) => ` - ${r.oldPath}`)
      .join('\n') +
      (unmappedRows.length > 30
        ? `\n - ... (${unmappedRows.length - 30} more)`
        : '')
  );
  console.log('');

  // K1 PREVIEW
  const contract = buildContractFromAnnualSalaries(data);
  const salary = contract
    ? (contract.salariesByYear || []).find((r) => r.season === SEASON)?.salary
    : null;
  const rights = data?.bird_rights ? normRights(data.bird_rights) : 'None';
  const fa = computeFA(data);
  const yearsLeft = contract?.endSeason
    ? yearsLeftFor(SEASON, contract.endSeason)
    : null;
  const teamId = toTeamId(data?.bio?.Team || data?.Team);
  const contractId = contract
    ? (contract.type === 'extension' ? 'ext_' : 'std_') +
      contract.startSeason.replace('-', '')
    : undefined;
  console.log('• K1 (seasons/%s) •', SEASON);
  console.log(
    JSON.stringify(
      {
        teamId,
        contractView: {
          contractId,
          salary: salary ?? undefined,
          yearsLeft: yearsLeft ?? undefined,
          rights,
          fa: fa ?? undefined,
          display: {
            contract:
              salary != null
                ? `${dollarsToDisplay(salary)} / ${yearsLeft ?? 0}`
                : undefined,
            freeAgent: fa
              ? `${fa.year}${fa.type ? ` (${fa.type})` : ''}`
              : undefined,
          },
        },
      },
      null,
      2
    )
  );

  // ===== DUMP FULL NEW DOCS (clean + annotated) =====
  (() => {
    const stats = buildFullStats(data);
    const evaluation = {};
    if (data?.blurbs?.traits) evaluation.traits = { ...data.blurbs.traits };
    if (data?.traits && typeof data.traits === 'object')
      evaluation.traits = { ...(evaluation.traits || {}), ...data.traits };
    if (data?.roles) {
      evaluation.roles = {};
      for (const k of [
        'offense1',
        'offense2',
        'defense1',
        'defense2',
        'twoWay',
      ])
        if (data.roles[k] !== undefined) evaluation.roles[k] = data.roles[k];
    }
    if (data?.shootingProfile !== undefined) {
      evaluation.shootingProfile = data.shootingProfile;
    }
    if (data?.subRoles) {
      evaluation.subRoles = {};
      if (Array.isArray(data.subRoles.offense))
        evaluation.subRoles.offense = [...data.subRoles.offense];
      if (Array.isArray(data.subRoles.defense))
        evaluation.subRoles.defense = [...data.subRoles.defense];
    }
    if (Array.isArray(data?.badges)) evaluation.badges = [...data.badges];
    if (data?.blurbs) {
      evaluation.blurbs = {};
      if (data.blurbs.overall) evaluation.blurbs.overall = data.blurbs.overall;
      if (data.blurbs.shootingProfile)
        evaluation.blurbs.shootingProfile = data.blurbs.shootingProfile;
      if (data.blurbs.twoWayMeter)
        evaluation.blurbs.twoWayMeter = data.blurbs.twoWayMeter;
      if (data.blurbs.shootingProfile)
        evaluation.blurbs.roles = data.blurbs.shootingProfile;
      if (data.blurbs.traits && typeof data.blurbs.traits === 'object') {
        for (const t of Object.keys(data.blurbs.traits)) {
          const v = data.blurbs.traits[t];
          if (typeof v === 'string' && v.trim()) {
            if (!evaluation.blurbs.traits) evaluation.blurbs.traits = {};
            evaluation.blurbs.traits[t] = v;
          }
        }
      }
    }
    if (data?.overall_grade !== undefined)
      evaluation.grades = { overall: data.overall_grade };
    if (data?.status !== undefined) evaluation.status = data.status;

    const _contract = buildContractFromAnnualSalaries(data);
    const _salary = _contract
      ? (_contract.salariesByYear || []).find((r) => r.season === SEASON)
          ?.salary
      : null;
    const _rights = data?.bird_rights ? normRights(data.bird_rights) : 'None';
    const _fa = computeFA(data);
    const _teamId = toTeamId(data?.bio?.Team || data?.Team);
    const _yearsLeft = _contract?.endSeason
      ? yearsLeftFor(SEASON, _contract.endSeason)
      : null;
    const _contractId = _contract
      ? (_contract.type === 'extension' ? 'ext_' : 'std_') +
        _contract.startSeason.replace('-', '')
      : null;

    const cv = { rights: _rights };
    if (_contract) {
      cv.contractId = _contractId;
      if (_salary != null) cv.salary = _salary;
      if (_yearsLeft != null) cv.yearsLeft = _yearsLeft;
      cv.display = {};
      if (_salary != null)
        cv.display.contract = `${dollarsToDisplay(_salary)} / ${_yearsLeft ?? 0}`;
      if (_fa)
        cv.display.freeAgent = `${_fa.year}${_fa.type ? ` (${_fa.type})` : ''}`;
    }
    if (_fa || data?.free_agent_type) {
      cv.fa = { ...(_fa || {}) };
      if (data?.free_agent_type) cv.fa.type = data.free_agent_type;
    }

    const cleanSeasonDoc = {
      ...(_teamId ? { teamId: _teamId } : {}),
      ...(Object.keys(cv).length ? { contractView: cv } : {}),
      ...(Object.keys(stats).length ? { stats } : {}),
      ...(Object.keys(evaluation).length ? { evaluation } : {}),
    };
    const meta = {};
    if (data?.last_stats_update || data?.last_updated)
      meta.lastStatsUpdate = data.last_stats_update || data.last_updated;
    if (data?.stats_carry_over) meta.statsCarryOver = true;
    if (data?.stats_season) meta.statsSeasonTag = data.stats_season;
    if (Object.keys(meta).length) cleanSeasonDoc.meta = meta;

    let cleanContractDoc = null;
    if (_contract) {
      cleanContractDoc = { ..._contract };
      if (data?.no_trade_clause !== undefined)
        cleanContractDoc.noTradeClause = data.no_trade_clause;
      if (data?.trade_kicker !== undefined)
        cleanContractDoc.tradeKicker = data.trade_kicker;
      if (data?.signed_using !== undefined)
        cleanContractDoc.signedUsing = data.signed_using;
      if (data?.qualifying_offer !== undefined)
        cleanContractDoc.qualifyingOffer = data.qualifying_offer;
      if (data?.cap_hold !== undefined)
        cleanContractDoc.capHold = data.cap_hold;
      const notes = [];
      if (data?.contract_summary?.aav != null)
        notes.push(`aav:${data.contract_summary.aav}`);
      if (data?.contract_summary?.cap_percentage != null)
        notes.push(`cap%:${data.contract_summary.cap_percentage}`);
      if (notes.length) cleanContractDoc.notes = notes.join('; ');
    }

    const newToOld = new Map(
      mappings
        .filter((r) => r.newPath && r.newPath.trim())
        .map((r) => [
          r.newPath,
          r.oldPath.startsWith('(derived') ? '[derived]' : r.oldPath,
        ])
    );
    function annotateDoc(rootObj, prefixNewPath) {
      function walk(node, curPath) {
        for (const k of Object.keys(node)) {
          const v = node[k];
          const np = curPath ? `${curPath}.${k}` : k;
          if (v && typeof v === 'object' && !Array.isArray(v)) {
            walk(v, np);
          } else if (Array.isArray(v)) {
            node[k] = v.map((item, idx) => {
              const exact = `${prefixNewPath}.${np}.${idx}`;
              const generic = `${prefixNewPath}.${np}.[]`;
              const __src = newToOld.get(exact) || newToOld.get(generic) || '';
              return item && typeof item === 'object'
                ? { ...item, __src }
                : { value: item, __src };
            });
          } else {
            const exact = `${prefixNewPath}.${np}`;
            const generic = exact.replace(/\.\d+(\.|$)/g, '.[]$1');
            const __src = newToOld.get(exact) || newToOld.get(generic) || '';
            node[k] = { value: v, __src };
          }
        }
      }
      const clone = JSON.parse(JSON.stringify(rootObj));
      walk(clone, '');
      return clone;
    }

    const seasonCleanPath = path.join(
      outDir,
      `NewDoc_season_${PLAYER}_${SEASON}.json`
    );
    fs.writeFileSync(seasonCleanPath, JSON.stringify(cleanSeasonDoc, null, 2));
    console.log('Saved:', seasonCleanPath);
    const seasonAnnPath = path.join(
      outDir,
      `NewDoc_season_${PLAYER}_${SEASON}_annotated.json`
    );
    fs.writeFileSync(
      seasonAnnPath,
      JSON.stringify(
        annotateDoc(cleanSeasonDoc, `players/{id}/seasons/${SEASON}`),
        null,
        2
      )
    );
    console.log('Saved:', seasonAnnPath);

    if (cleanContractDoc && _contractId) {
      const contractCleanPath = path.join(
        outDir,
        `NewDoc_contract_${_contractId}.json`
      );
      fs.writeFileSync(
        contractCleanPath,
        JSON.stringify(cleanContractDoc, null, 2)
      );
      console.log('Saved:', contractCleanPath);
      const contractAnnPath = path.join(
        outDir,
        `NewDoc_contract_${_contractId}_annotated.json`
      );
      fs.writeFileSync(
        contractAnnPath,
        JSON.stringify(
          annotateDoc(
            cleanContractDoc,
            `players/{id}/contracts/${_contractId}`
          ),
          null,
          2
        )
      );
      console.log('Saved:', contractAnnPath);
    } else {
      console.log('No contract doc to dump (missing annual_salaries).');
    }

    // --- BIO (root doc) ---
    function buildBioFromData(p) {
      const get = (k, alt) => p?.bio?.[k] ?? p?.[k] ?? alt;
      const ht = get('HT') ?? get('height');
      const wt = get('WT') ?? get('weight_lbs');
      const bio = {
        name: get('Name') ?? get('name'),
        displayName: get('display_name'),
        pos: get('Position') ?? get('Pos'),
        ht: typeof ht === 'number' ? String(ht) : ht,
        wt: typeof wt === 'string' ? Number(wt) || null : wt,
        dob: p?.bio?.birthdate ? String(p.bio.birthdate) : undefined,
        nationality: p?.bio?.nationality,
        shoots: p?.bio?.shoots,
        yearsPro: p?.['Years Pro'] ?? p?.bio?.years_pro,
        agent:
          p?.agent?.name || p?.agent?.agency
            ? { name: p.agent.name || null, agency: p.agent.agency || null }
            : undefined,
        draft: p?.draft
          ? {
              year: p.draft.year ?? null,
              round: p.draft.round ?? null,
              pick: p.draft.pick ?? null,
              teamId: p.draft.team ? toTeamId(p.draft.team) : null,
            }
          : undefined,
      };
      for (const k of Object.keys(bio)) {
        if (
          bio[k] == null ||
          (typeof bio[k] === 'object' && !Object.keys(bio[k] || {}).length)
        )
          delete bio[k];
      }
      return bio;
    }

    const bioDoc = { bio: buildBioFromData(data) };
    const rootDocPath = path.join(outDir, `NewDoc_player_root_${PLAYER}.json`);
    fs.writeFileSync(rootDocPath, JSON.stringify(bioDoc, null, 2));
    console.log('Saved:', rootDocPath);

    // --- COMBINED BUNDLE (exact Firestore paths -> docs) ---
    const bundle = {};
    bundle[`players/${PLAYER}`] = bioDoc;
    bundle[`players/${PLAYER}/seasons/${SEASON}`] = cleanSeasonDoc;
    if (cleanContractDoc && _contractId) {
      bundle[`players/${PLAYER}/contracts/${_contractId}`] = cleanContractDoc;
    }
    const bundlePath = path.join(
      outDir,
      `FirestoreBundle_${PLAYER}_${SEASON}.json`
    );
    fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2));
    console.log('Saved:', bundlePath);
  })();

  // FINAL SAVES
  console.log('Saved:', mapCsvPath);
  console.log('Saved:', mapJsonPath);
  console.log('Saved:', oldTreePath);
  console.log('Saved:', newTreePath);
  console.log('Done.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
