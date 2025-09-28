// Creates /players/{id}/contracts/* and /players/{id}/seasons/{seasonKey}.contractView
// Adds bio.nbaId (if present) and a lookup doc: /playersByNbaId/{nbaId} -> { playerId }
// Dry-run prints only 3 player samples.
const fs = require('fs');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const SA_PATH = '../serviceAccountKey.json'; // your file
const SEASON = process.env.SEASON || '2025-26';
const DRY = process.env.DRY_RUN === '1';

function initDB() {
  const sa = JSON.parse(fs.readFileSync(SA_PATH, 'utf8'));
  initializeApp({ credential: cert(sa) });
  return getFirestore();
}

/* ---------- TEAM CODE MAPPING ---------- */
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

/* ---------- RIGHTS ENUM NORMALIZER ---------- */
function normRights(s) {
  const t = String(s || '').toLowerCase();
  if (!t) return 'None';
  if (t.startsWith('full')) return 'Full';
  if (t.startsWith('early')) return 'Early';
  if (t.includes('non')) return 'Non';
  return 'Full';
}

/* ---------- HELPERS ---------- */
function toSeasonKeyFromYear(y) {
  return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
}

function buildContractFromAnnualSalaries(p) {
  const ann = p?.contract?.annual_salaries;
  if (!Array.isArray(ann) || ann.length === 0) return null;

  const sorted = ann
    .filter((r) => r && r.year != null && r.salary != null)
    .sort((a, b) => Number(a.year) - Number(b.year));

  const startYear = Number(sorted[0].year);
  const endYear = Number(sorted[sorted.length - 1].year);
  const startSeason = toSeasonKeyFromYear(startYear);
  const endSeason = toSeasonKeyFromYear(endYear);

  const salariesByYear = sorted.map((r) => ({
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
    guarantees: Array.isArray(p?.contract?.annual_salaries)
      ? p.contract.annual_salaries
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

/* ---------- MAIN ---------- */
async function main() {
  const db = initDB();
  const pSnap = await db.collection('players').get();
  let writes = 0,
    processed = 0;
  let sampleLimit = 3;

  for (const doc of pSnap.docs) {
    const p = doc.data();

    // 0) NBA ID add + lookup doc
    const nbaId = p?.nba_player_id ?? p?.nbaId ?? null;
    const playerPath = `players/${doc.id}`;
    const xrefPath = nbaId != null ? `playersByNbaId/${String(nbaId)}` : null;

    // 1) Build contract from annual_salaries
    const contract = buildContractFromAnnualSalaries(p);
    const contractId = contract
      ? (contract.type === 'extension' ? 'ext_' : 'std_') +
        contract.startSeason.replace('-', '')
      : null;

    // 2) Create season view for SEASON
    const teamId = toTeamId(p?.bio?.Team || p?.Team);
    const salary = contract ? pickSalaryForSeason(contract, SEASON) : null;
    const fa = computeFA(p);
    const rights = p?.bird_rights ? normRights(p.bird_rights) : 'None';

    const seasonDoc = {
      ...(teamId ? { teamId } : {}),
      contractView: {
        ...(contractId ? { contractId } : {}),
        ...(salary != null ? { salary } : {}),
        ...(fa ? { fa } : {}),
        rights,
      },
    };

    // ---- DRY RUN: print only first 3 samples
    if (DRY && sampleLimit > 0) {
      console.log('[DRY SAMPLE] Player:', doc.id);
      if (nbaId != null) {
        console.log('  bio patch ->', { 'bio.nbaId': nbaId });
        console.log('  xref ->', xrefPath, { playerId: doc.id });
      }
      if (contract) console.log('  contract ->', { contractId, ...contract });
      console.log('  seasonView ->', seasonDoc);
      sampleLimit--;
    }

    // ---- REAL WRITES
    if (!DRY) {
      if (nbaId != null) {
        await db.doc(playerPath).set({ 'bio.nbaId': nbaId }, { merge: true });
        writes++;
        await db.doc(xrefPath).set({ playerId: doc.id }, { merge: true });
        writes++;
      }
      if (contract && contractId) {
        await db
          .doc(`players/${doc.id}/contracts/${contractId}`)
          .set(contract, { merge: true });
        writes++;
      }
      await db
        .doc(`players/${doc.id}/seasons/${SEASON}`)
        .set(seasonDoc, { merge: true });
      writes++;
    }

    processed++;
    if (!DRY && processed % 200 === 0)
      console.log('Processed players:', processed);
  }

  console.log(
    `Done players. Docs processed: ${processed}, writes: ${writes}${DRY ? ' (DRY)' : ''}.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
