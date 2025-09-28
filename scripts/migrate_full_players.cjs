// Full player pass: bio + nbaId/xref + contracts + seasons/{SEASON}: {teamId, contractView, stats(full), evaluation, meta}
// DRY mode prints only players you list in SAMPLE_PLAYERS (comma-separated slugs). Real write is additive/sparse.
const fs = require('fs');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const SA_PATH = './serviceAccountKey.json';
const SEASON = process.env.SEASON || '2025-26';
const DRY = process.env.DRY_RUN === '1';
const SAMPLE = (process.env.SAMPLE_PLAYERS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const SAMPLE_SET = new Set(SAMPLE);

function initDB() {
  const sa = JSON.parse(fs.readFileSync(SA_PATH, 'utf8'));
  initializeApp({ credential: cert(sa) });
  return getFirestore();
}

/* ---- helpers ---- */
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
function toTeamId(raw) {
  if (!raw) return null;
  const t = String(raw)
    .trim()
    .toUpperCase()
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ');
  return TEAM_CODE[t] || TEAM_ALIASES[t] || null;
}
function normRights(s) {
  const t = String(s || '').toLowerCase();
  if (!t) return 'None';
  if (t.startsWith('full')) return 'Full';
  if (t.startsWith('early')) return 'Early';
  if (t.includes('non')) return 'Non';
  return 'Full';
}
function toSeasonKeyFromYear(y) {
  return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
}
const pct = (v) => {
  if (v == null) return null;
  if (typeof v === 'number') return v > 1.0001 ? v / 100 : v;
  const s = String(v).trim();
  const m = s.match(/^(\d+(\.\d+)?)%$/);
  if (m) return Number(m[1]) / 100;
  const num = Number(s);
  return num > 1.0001 ? num / 100 : num;
};

/* ---- mappers ---- */
function buildBio(p) {
  const get = (k, alt) => p?.bio?.[k] ?? p?.[k] ?? alt;
  const ht = get('HT') ?? get('height');
  const wt = get('WT') ?? get('weight_lbs');
  const bio = {
    displayName: get('display_name') ?? get('Name') ?? get('name'), // Changed to displayName first
    position: get('Position') ?? get('Pos'), // Changed to position
    height: typeof ht === 'number' ? String(ht) : ht, // Changed to height
    weight: typeof wt === 'string' ? Number(wt) || null : wt, // Changed to weight
    age: get('AGE') ?? get('age'), // Added age field
    dob:
      p?.bio?.birthdate && String(p.bio.birthdate).length >= 4
        ? String(p.bio.birthdate)
        : undefined,
    nationality: p?.bio?.nationality,
    shoots: p?.bio?.shoots,
    agent:
      p?.agent?.name || p?.agent?.agency
        ? { name: p.agent.name || null, agency: p.agent.agency || null }
        : undefined,
    draft: p?.draft
      ? {
          year: p.draft.year ?? null,
          round: p.draft.round ?? null,
          pick: p.draft.pick ?? null,
          teamId: toTeamId(p.draft.team) || null,
        }
      : undefined,
  };
  for (const k of Object.keys(bio))
    if (
      bio[k] == null ||
      (typeof bio[k] === 'object' && !Object.keys(bio[k] || {}).length)
    )
      delete bio[k];
  return bio;
}
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
  for (const k of Object.keys(out))
    if (out[k] == null || Number.isNaN(out[k])) delete out[k];
  return out;
}
function buildEvaluation(p) {
  const b = p?.blurbs || {};
  const traits =
    b.traits && Object.keys(b.traits).length ? b.traits : undefined;
  const roles = b.roles && Object.keys(b.roles).length ? b.roles : undefined;
  const comments = b.overall || b.shootingProfile || b.twoWayMeter || '';
  const evalDoc = {
    ...(traits ? { traits } : {}),
    ...(roles ? { roles } : {}),
    ...(comments ? { comments } : {}),
    updatedAt: '<client-set>',
  };
  for (const k of Object.keys(evalDoc))
    if (
      evalDoc[k] == null ||
      (typeof evalDoc[k] === 'object' && !Object.keys(evalDoc[k]).length)
    )
      delete evalDoc[k];
  return evalDoc;
}
function buildMeta(p) {
  const ts = p?.last_stats_update || p?.last_updated || null;
  const carry = !!p?.stats_carry_over;
  const tag = p?.stats_season || null;
  const meta = {
    ...(ts ? { lastStatsUpdate: ts } : {}),
    ...(carry ? { statsCarryOver: true } : {}),
    ...(tag ? { statsSeasonTag: tag } : {}),
  };
  return meta;
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
                : opt.season || '' || ''
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
    notes: p?.contract_summary
      ? `aav:${p.contract_summary.aav || ''}; cap%:${p.contract_summary.cap_percentage || ''}`
      : undefined,
  };
  for (const k of Object.keys(contract))
    if (contract[k] == null) delete contract[k];
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
function pickSalaryForSeason(contract, seasonKey) {
  const row = (contract?.salariesByYear || []).find(
    (r) => r.season === seasonKey
  );
  return row ? Number(row.salary) : null;
}
function computeFA(p) {
  const year = Number(p?.contract?.free_agency_year);
  if (!year) return null;
  const s = (p?.bio?.['Free Agent'] || p?.['Free Agent'] || '').toString();
  const m = s.match(/\(([^)]+)\)/);
  return { year, type: m ? m[1] : null };
}

/* ---- main ---- */
async function main() {
  const db = initDB();
  const snap = await db.collection('players').get();
  let writes = 0,
    processed = 0;

  for (const doc of snap.docs) {
    const id = doc.id;
    const show = SAMPLE_SET.size === 0 || SAMPLE_SET.has(id); // print only if in sample (or no sample specified)
    const p = doc.data();

    const bio = buildBio(p);
    const nbaId = p?.nba_player_id ?? p?.nbaId ?? null;
    if (nbaId != null) bio.nbaId = nbaId;

    const contract = buildContractFromAnnualSalaries(p);
    const contractId = contract
      ? (contract.type === 'extension' ? 'ext_' : 'std_') +
        contract.startSeason.replace('-', '')
      : null;

    const teamId = toTeamId(p?.bio?.Team || p?.Team);
    const salary = contract ? pickSalaryForSeason(contract, SEASON) : null;
    const rights = p?.bird_rights ? normRights(p.bird_rights) : 'None';
    const fa = computeFA(p);

    const stats = buildFullStats(p);
    const evaluation = buildEvaluation(p);
    const meta = buildMeta(p);

    const seasonDoc = {
      ...(teamId ? { teamId } : {}),
      contractView: {
        ...(contractId ? { contractId } : {}),
        ...(salary != null ? { salary } : {}),
        rights,
        ...(fa ? { fa } : {}),
      },
      ...(Object.keys(stats).length ? { stats } : {}),
      ...(Object.keys(evaluation).length ? { evaluation } : {}),
      ...(Object.keys(meta).length ? { meta } : {}),
    };

    if (DRY) {
      if (show) {
        console.log('======================================');
        console.log('[DRY FULL] Player:', id);
        if (Object.keys(bio).length) console.log('  bio ->', bio);
        if (nbaId != null)
          console.log('  xref ->', `playersByNbaId/${String(nbaId)}`, {
            playerId: id,
          });
        if (contract)
          console.log('  contracts ->', { contractId, ...contract });
        console.log(`  seasons/${SEASON} ->`, seasonDoc);
      }
      continue;
    }

    // Writes (sparse, additive)
    const playerPath = `players/${id}`;
    if (Object.keys(bio).length) {
      await db.doc(playerPath).set({ bio }, { merge: true });
      writes++;
    }
    if (nbaId != null) {
      await db
        .doc(`playersByNbaId/${String(nbaId)}`)
        .set({ playerId: id }, { merge: true });
      writes++;
    }
    if (contract && contractId) {
      await db
        .doc(`${playerPath}/contracts/${contractId}`)
        .set(contract, { merge: true });
      writes++;
    }
    await db
      .doc(`${playerPath}/seasons/${SEASON}`)
      .set(seasonDoc, { merge: true });
    writes++;
    processed++;
  }

  console.log(
    `Done players. Docs processed: ${snap.size}, writes: ${writes}${DRY ? ' (DRY)' : ''}.`
  );
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
