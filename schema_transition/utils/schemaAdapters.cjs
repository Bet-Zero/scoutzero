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

const STAT_MAP = {
  pts: ['PTS', 'PPG'],
  ast: ['AST', 'APG'],
  reb: ['TRB', 'RPG'],
  stl: ['STL'],
  blk: ['BLK'],
  tov: ['TOV'],
  pf: ['PF'],
  orb: ['ORB'],
  drb: ['DRB'],
  fgMade: ['FG'],
  fgAtt: ['FGA'],
  fgPct: ['FG%', 'FG_PCT'],
  tpMade: ['3P'],
  tpAtt: ['3PA'],
  tpPct: ['3P%', '3PT%', 'FG3_PCT'],
  twoMade: ['2P'],
  twoAtt: ['2PA'],
  twoPct: ['2P%'],
  ftMade: ['FT'],
  ftAtt: ['FTA'],
  ftPct: ['FT%', 'FT_PCT'],
  efgPct: ['eFG%', 'EFG%'],
  games: ['G', 'Games Played'],
  gamesStarted: ['GS'],
  minutes: ['MP', 'MIN'],
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

function pct(value) {
  if (value == null) return null;
  if (typeof value === 'number') return value > 1.0001 ? value / 100 : value;
  const s = String(value).trim();
  const match = s.match(/^(\d+(?:\.\d+)?)%$/);
  if (match) return Number(match[1]) / 100;
  const numeric = Number(s);
  if (!Number.isFinite(numeric)) return null;
  return numeric > 1.0001 ? numeric / 100 : numeric;
}

function normalizeStatValue(key, value) {
  if (key.toLowerCase().includes('pct')) return pct(value);
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function pickStat(source, keys) {
  for (const key of keys) {
    if (source?.[key] != null) return source[key];
  }
  return null;
}

function buildStats(legacy) {
  const buckets = [legacy?.system?.stats, legacy?.stats, legacy];
  const stats = {};
  for (const [modernKey, legacyKeys] of Object.entries(STAT_MAP)) {
    const raw = buckets.reduce(
      (acc, bucket) => (acc != null ? acc : pickStat(bucket, legacyKeys)),
      null
    );
    const normalized = normalizeStatValue(modernKey, raw);
    if (normalized != null) stats[modernKey] = normalized;
  }
  return stats;
}

function normRights(value) {
  const t = String(value || '').toLowerCase();
  if (!t) return 'None';
  if (t.startsWith('full')) return 'Full';
  if (t.startsWith('early')) return 'Early';
  if (t.includes('non')) return 'Non';
  return 'Full';
}

function toSeasonKeyFromYear(year) {
  const start = Number(year);
  if (!Number.isFinite(start)) return null;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

function seasonStartYear(seasonKey) {
  const match = String(seasonKey || '').match(/^(\d{4})-/);
  return match ? Number(match[1]) : null;
}

function yearsRemaining(seasonKey, endSeason) {
  const start = seasonStartYear(seasonKey);
  const end = seasonStartYear(endSeason);
  if (!start || !end) return null;
  return Math.max(0, end - start + 1);
}

function buildContract(legacy) {
  const rows = Array.isArray(legacy?.contract?.annual_salaries)
    ? legacy.contract.annual_salaries.filter(
        (row) => row && row.year != null && row.salary != null
      )
    : [];
  if (!rows.length) return null;

  const sorted = [...rows].sort((a, b) => Number(a.year) - Number(b.year));
  const salariesByYear = sorted.map((row) => ({
    season: toSeasonKeyFromYear(Number(row.year)),
    salary: Number(row.salary) || 0,
    guaranteed:
      row.guarantee_amt != null
        ? Number(row.guarantee_amt)
        : row.guaranteed === true
          ? Number(row.salary) || 0
          : undefined,
    option: row.option || row.type || null,
  }));

  const startSeason = salariesByYear[0]?.season || null;
  const endSeason = salariesByYear[salariesByYear.length - 1]?.season || null;

  const contract = {
    signedOn: legacy?.contract?.signed_year
      ? `${legacy.contract.signed_year}-07-01`
      : null,
    type:
      legacy?.contract_summary?.is_extension === true
        ? 'extension'
        : 'standard',
    startSeason,
    endSeason,
    signingTeamId: toTeamId(
      legacy?.contract?.signing_team || legacy?.Team || legacy?.bio?.Team
    ),
    years: salariesByYear.length,
    salariesByYear,
    totalValue: salariesByYear.reduce((sum, row) => sum + (row.salary || 0), 0),
    rightsAtSigning: legacy?.bird_rights
      ? normRights(legacy.bird_rights)
      : undefined,
    freeAgentType:
      legacy.contract?.faType || legacy.contract?.freeAgency?.type || null,
    bonuses: legacy?.contract?.incentives
      ? {
          likely: Number(legacy.contract.incentives.likely || 0) || 0,
          unlikely: Number(legacy.contract.incentives.unlikely || 0) || 0,
        }
      : undefined,
    options: Array.isArray(legacy?.contract?.options)
      ? legacy.contract.options.map((opt) => ({
          season:
            opt?.season ||
            (opt?.year != null
              ? toSeasonKeyFromYear(Number(opt.year))
              : null) ||
            null,
          type: opt?.type || null,
        }))
      : undefined,
    notes: legacy?.contract_summary
      ? {
          averageAnnualValue: Number(legacy.contract_summary.aav || 0) || null,
          capPercentage:
            Number(legacy.contract_summary.cap_percentage || 0) || null,
        }
      : undefined,
  };

  const data = { ...contract };

  for (const key of Object.keys(data)) {
    if (
      data[key] == null ||
      (typeof data[key] === 'object' &&
        !Array.isArray(data[key]) &&
        !Object.keys(data[key] || {}).length)
    ) {
      delete data[key];
    }
  }
  if (Array.isArray(data.options)) {
    data.options = data.options.filter((opt) => opt.season || opt.type);
    if (!data.options.length) delete data.options;
  }
  if (Array.isArray(data.salariesByYear)) {
    data.salariesByYear = data.salariesByYear.filter(
      (row) => row.season && row.salary != null
    );
  }

  return data;
}

function contractViewForSeason(contract, seasonKey, legacy) {
  if (!contract) {
    const view = {
      freeAgentYear: legacy?.contract?.free_agency_year || null,
      rights: legacy?.bird_rights ? normRights(legacy.bird_rights) : 'None',
    };
    for (const key of Object.keys(view))
      if (view[key] == null) delete view[key];
    return view;
  }

  const salaryRow = contract.salariesByYear.find(
    (row) => row.season === seasonKey
  );
  const salary = salaryRow ? Number(salaryRow.salary) || 0 : null;
  const yearsLeft = yearsRemaining(seasonKey, contract.endSeason);

  const faYear = legacy?.contract?.free_agency_year || null;
  let optionType = null;
  if (Array.isArray(contract.options)) {
    const option = contract.options.find((opt) => opt.season === seasonKey);
    optionType = option?.type || null;
  }

  const view = {
    salary,
    yearsLeft,
    freeAgentYear: faYear,
    optionType,
    rights: legacy?.bird_rights ? normRights(legacy.bird_rights) : 'None',
    contractId: contract.startSeason
      ? `${contract.type === 'extension' ? 'ext' : 'std'}_${contract.startSeason.replace('-', '')}`
      : null,
  };

  for (const key of Object.keys(view)) {
    if (view[key] == null) delete view[key];
  }

  return view;
}

function buildEvaluations(legacy) {
  const traits =
    legacy?.traits && typeof legacy.traits === 'object'
      ? legacy.traits
      : undefined;
  const grades =
    legacy?.grades && typeof legacy.grades === 'object'
      ? legacy.grades
      : undefined;
  const blurbs =
    legacy?.blurbs && typeof legacy.blurbs === 'object'
      ? legacy.blurbs
      : undefined;

  const offenseRoles = Array.isArray(legacy?.roles?.offense)
    ? legacy.roles.offense
    : [legacy?.roles?.offense1, legacy?.roles?.offense2].filter(Boolean);
  const defenseRoles = Array.isArray(legacy?.roles?.defense)
    ? legacy.roles.defense
    : [legacy?.roles?.defense1, legacy?.roles?.defense2].filter(Boolean);

  const subroles =
    legacy?.subRoles && typeof legacy.subRoles === 'object'
      ? legacy.subRoles
      : { offense: [], defense: [] };

  const meta = {};
  if (legacy?.last_updated) meta.updatedAt = legacy.last_updated;
  if (legacy?.last_updated_by) meta.updatedBy = legacy.last_updated_by;

  const evaluations = {};
  if (traits || grades) {
    evaluations.grades = { ...(traits || {}), ...(grades || {}) };
    if (!Object.keys(evaluations.grades).length) delete evaluations.grades;
  }
  if (offenseRoles.length || defenseRoles.length) {
    evaluations.roles = {
      offense: offenseRoles.length ? offenseRoles[0] : null,
      defense: defenseRoles.length ? defenseRoles[0] : null,
    };
    if (!evaluations.roles.offense && !evaluations.roles.defense)
      delete evaluations.roles;
  }
  const normalizedSubroles = {
    offense: Array.isArray(subroles.offense) ? subroles.offense : [],
    defense: Array.isArray(subroles.defense) ? subroles.defense : [],
  };
  if (normalizedSubroles.offense.length || normalizedSubroles.defense.length) {
    evaluations.subroles = normalizedSubroles;
  }
  if (blurbs && Object.keys(blurbs).length) {
    evaluations.blurbs = blurbs;
  }
  const shootingProfile =
    legacy?.shootingProfile || legacy?.blurbs?.shootingProfile || null;
  if (shootingProfile != null) evaluations.shootingProfile = shootingProfile;
  const twoWay =
    legacy?.twoWayMeter != null
      ? Number(legacy.twoWayMeter)
      : legacy?.blurbs?.twoWayMeter != null
        ? Number(legacy.blurbs.twoWayMeter)
        : null;
  if (Number.isFinite(twoWay)) evaluations.twoWayMeter = twoWay;
  if (Object.keys(meta).length) evaluations.meta = meta;

  return evaluations;
}

function buildBio(legacy) {
  const fallback = (key, altKeys = []) => {
    if (legacy?.bio && legacy.bio[key] != null) return legacy.bio[key];
    for (const alt of altKeys) {
      if (legacy?.bio && legacy.bio[alt] != null) return legacy.bio[alt];
      if (legacy?.[alt] != null) return legacy[alt];
    }
    return legacy?.[key] ?? null;
  };

  const height = fallback('height', ['HT']);
  const weight = fallback('weight', ['WT', 'weight_lbs']);
  const displayName = fallback('displayName', ['display_name', 'Name', 'name']);
  const position = fallback('position', ['Position', 'Pos']);
  const age = fallback('age', ['AGE']);

  const draft =
    legacy?.draft && typeof legacy.draft === 'object'
      ? {
          year: legacy.draft.year ?? null,
          round: legacy.draft.round ?? null,
          pick: legacy.draft.pick ?? null,
          teamId: toTeamId(legacy.draft.team) || null,
        }
      : undefined;

  const bio = {
    displayName,
    position,
    height: typeof height === 'number' ? `${height}` : height || null,
    weight:
      typeof weight === 'string' ? Number(weight) || null : (weight ?? null),
    age: typeof age === 'string' ? Number(age) || null : (age ?? null),
    dob: legacy?.bio?.birthdate || legacy?.birthdate || null,
    nationality: legacy?.bio?.nationality || legacy?.nationality || null,
    shoots: legacy?.bio?.shoots || legacy?.shoots || null,
    agent:
      legacy?.agent?.name || legacy?.agent?.agency
        ? {
            name: legacy.agent.name || null,
            agency: legacy.agent.agency || null,
          }
        : undefined,
    draft,
    nbaId: legacy?.nba_player_id || legacy?.nbaId || null,
  };

  for (const key of Object.keys(bio)) {
    if (
      bio[key] == null ||
      (typeof bio[key] === 'object' &&
        !Array.isArray(bio[key]) &&
        !Object.keys(bio[key] || {}).length)
    ) {
      delete bio[key];
    }
  }

  return bio;
}

function mapLegacyPlayerToNew(playerId, legacyPlayerDoc, seasonKey) {
  const bio = buildBio(legacyPlayerDoc);
  const stats = buildStats(legacyPlayerDoc);
  const evaluations = buildEvaluations(legacyPlayerDoc);
  const contract = buildContract(legacyPlayerDoc);
  const seasonContractView = contractViewForSeason(
    contract,
    seasonKey,
    legacyPlayerDoc
  );
  const teamCode = toTeamId(
    legacyPlayerDoc?.bio?.Team || legacyPlayerDoc?.Team || legacyPlayerDoc?.team
  );

  const seasonDoc = {
    ...(Object.keys(bio).length ? { bio } : {}),
    team: { code: teamCode },
    ...(Object.keys(stats).length ? { stats } : {}),
    contractView: seasonContractView,
    ...(Object.keys(evaluations).length ? { evaluations } : {}),
    meta: {
      ...(legacyPlayerDoc?.last_stats_update
        ? { lastStatsUpdate: legacyPlayerDoc.last_stats_update }
        : {}),
      ...(legacyPlayerDoc?.stats_carry_over
        ? { statsCarryOver: !!legacyPlayerDoc.stats_carry_over }
        : {}),
      ...(legacyPlayerDoc?.stats_season
        ? { statsSeasonTag: legacyPlayerDoc.stats_season }
        : {}),
    },
  };

  if (!Object.keys(seasonDoc.meta).length) delete seasonDoc.meta;
  if (
    !seasonDoc.contractView ||
    Object.values(seasonDoc.contractView).every((v) => v == null)
  ) {
    delete seasonDoc.contractView;
  }
  if (!teamCode) delete seasonDoc.team;
  if (!Object.keys(seasonDoc.evaluations || {}).length)
    delete seasonDoc.evaluations;
  const normalizedSeasonDoc = Object.keys(seasonDoc).length ? seasonDoc : null;

  const contracts = contract
    ? [
        {
          id: seasonContractView.contractId,
          data: contract,
        },
      ].filter((c) => c.id)
    : [];

  const xref =
    bio.nbaId != null
      ? {
          id: String(bio.nbaId),
          data: { playerId },
        }
      : null;

  const warnings = [];
  if (!teamCode) warnings.push('missing-team-code');
  if (!contracts.length && legacyPlayerDoc?.contract?.annual_salaries?.length) {
    warnings.push('contract-parse-failed');
  }

  const playerDoc = {};
  if (Object.keys(bio).length) playerDoc.bio = bio;

  return {
    playerId,
    playerDoc,
    seasonKey,
    seasonDoc: normalizedSeasonDoc,
    contracts,
    xref,
    warnings,
  };
}

function mapNewSeasonToLegacy(playerId, seasonKey, seasonDoc) {
  // Basic rollback converter: flatten new doc to legacy-friendly structure
  const legacy = {};
  if (seasonDoc?.bio) {
    legacy.bio = {
      ...seasonDoc.bio,
      display_name: seasonDoc.bio.displayName,
      Position: seasonDoc.bio.position,
      HT: seasonDoc.bio.height,
      WT: seasonDoc.bio.weight,
      AGE: seasonDoc.bio.age,
    };
  }
  if (seasonDoc?.team?.code) legacy.Team = seasonDoc.team.code;
  if (seasonDoc?.stats) {
    legacy.system = { stats: {} };
    for (const [modernKey, value] of Object.entries(seasonDoc.stats)) {
      switch (modernKey) {
        case 'pts':
          legacy.system.stats.PTS = value;
          break;
        case 'ast':
          legacy.system.stats.AST = value;
          break;
        case 'reb':
          legacy.system.stats.TRB = value;
          break;
        case 'fgPct':
          legacy.system.stats['FG%'] = value;
          break;
        case 'tpPct':
          legacy.system.stats['3P%'] = value;
          break;
        case 'ftPct':
          legacy.system.stats['FT%'] = value;
          break;
        default:
          legacy.system.stats[modernKey.toUpperCase()] = value;
          break;
      }
    }
  }
  if (seasonDoc?.evaluations) {
    legacy.traits = seasonDoc.evaluations.grades || {};
    legacy.roles = {
      offense1: seasonDoc.evaluations.roles?.offense || null,
      defense1: seasonDoc.evaluations.roles?.defense || null,
    };
    legacy.subRoles = seasonDoc.evaluations.subroles || {
      offense: [],
      defense: [],
    };
    legacy.blurbs = seasonDoc.evaluations.blurbs || {};
    legacy.shootingProfile = seasonDoc.evaluations.shootingProfile || null;
    legacy.twoWayMeter = seasonDoc.evaluations.twoWayMeter || null;
  }
  if (seasonDoc?.contractView) {
    legacy.contract = {
      free_agency_year: seasonDoc.contractView.freeAgentYear || null,
      rights: seasonDoc.contractView.rights || null,
    };
  }
  legacy.stats_season = seasonDoc?.meta?.statsSeasonTag || null;
  legacy.stats_carry_over = seasonDoc?.meta?.statsCarryOver || false;
  legacy.last_stats_update = seasonDoc?.meta?.lastStatsUpdate || null;
  return legacy;
}

module.exports = {
  mapLegacyPlayerToNew,
  mapNewSeasonToLegacy,
  TEAM_CODE,
  TEAM_ALIASES,
};
