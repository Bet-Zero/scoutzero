type UnknownRecord = Record<string, unknown>;

export type ArchitectBoundaryRecord = UnknownRecord;

export type ArchitectBoundarySalaryRow = UnknownRecord & {
  season: string;
};

export type ArchitectBoundaryContract = UnknownRecord & {
  salariesByYear?: ArchitectBoundarySalaryRow[];
};

export type ArchitectBoundaryPlayer = UnknownRecord & {
  displayName?: string;
  playerId?: string;
  player_id?: string;
  teamCode?: string | null;
  teamName?: string | null;
  contract?: ArchitectBoundaryContract | null;
  futureContract?: ArchitectBoundaryContract | null;
  bio?: UnknownRecord | null;
};

export type ArchitectBoundaryTeam = UnknownRecord & {
  entitlementIds?: string[];
  players?: ArchitectBoundaryPlayer[];
  roster?: unknown[];
  season?: string;
  teamCode?: string;
  teamName?: string;
  totals?: UnknownRecord | null;
};

export function isArchitectRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function requireArchitectRecord(
  value: unknown,
  context: string
): UnknownRecord {
  if (!isArchitectRecord(value)) {
    throw new Error(`${context} must be a Firestore object`);
  }

  return value;
}

export function readArchitectRecord(value: unknown): UnknownRecord | null {
  return isArchitectRecord(value) ? value : null;
}

export function readArchitectString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export function readArchitectNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function readArchitectBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

export function readArchitectUnknownArray(
  value: unknown,
  context: string
): unknown[] | undefined {
  if (value == null) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(`${context} must be an array when present`);
  }

  return value;
}

export function readArchitectStringArray(
  value: unknown,
  context: string
): string[] | undefined {
  if (value == null) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(`${context} must be an array when present`);
  }

  return value.map((item, index) => {
    const text = readArchitectString(item);
    if (!text) {
      throw new Error(`${context}[${index}] must be a non-empty string`);
    }

    return text;
  });
}

export function readArchitectContract(
  value: unknown,
  context: string
): ArchitectBoundaryContract | null {
  if (value == null) {
    return null;
  }

  const record = requireArchitectRecord(value, context);
  const salariesByYear = readArchitectSalaryRows(
    record.salariesByYear,
    `${context}.salariesByYear`
  );

  return salariesByYear
    ? { ...record, salariesByYear }
    : { ...record };
}

export function readArchitectPlayer(
  value: unknown,
  context: string,
  fallbackPlayerId?: string
): ArchitectBoundaryPlayer {
  const record = requireArchitectRecord(value, context);
  const playerId = readArchitectString(record.playerId) ?? fallbackPlayerId;
  const player_id = readArchitectString(record.player_id);
  const displayName = readArchitectString(record.displayName);
  const normalized: ArchitectBoundaryPlayer = { ...record };

  if (playerId) {
    normalized.playerId = playerId;
  }
  if (player_id) {
    normalized.player_id = player_id;
  }
  if (displayName) {
    normalized.displayName = displayName;
  }
  if (hasArchitectField(record, 'teamCode')) {
    normalized.teamCode = readArchitectString(record.teamCode) ?? null;
  }
  if (hasArchitectField(record, 'teamName')) {
    normalized.teamName = readArchitectString(record.teamName) ?? null;
  }
  if (hasArchitectField(record, 'contract')) {
    normalized.contract = readArchitectContract(
      record.contract,
      `${context}.contract`
    );
  }
  if (hasArchitectField(record, 'futureContract')) {
    normalized.futureContract = readArchitectContract(
      record.futureContract,
      `${context}.futureContract`
    );
  }
  if (hasArchitectField(record, 'bio')) {
    normalized.bio = readArchitectRecord(record.bio);
  }

  return normalized;
}

export function readArchitectTeam(
  value: unknown,
  context: string,
  fallbackTeamCode: string
): ArchitectBoundaryTeam {
  const record = requireArchitectRecord(value, context);
  const players = readArchitectPlayerArray(record.players, `${context}.players`);
  const roster = readArchitectUnknownArray(record.roster, `${context}.roster`);
  const entitlementIds = readArchitectStringArray(
    record.entitlementIds,
    `${context}.entitlementIds`
  );
  let totals: UnknownRecord | null | undefined;
  if (record.totals === null) {
    totals = null;
  } else if (record.totals !== undefined) {
    totals = requireArchitectRecord(record.totals, `${context}.totals`);
  }
  const teamCode = readArchitectString(record.teamCode) ?? fallbackTeamCode;
  const teamName = readArchitectString(record.teamName);
  const season = readArchitectString(record.season);

  return {
    ...record,
    teamCode,
    ...(teamName ? { teamName } : {}),
    ...(season ? { season } : {}),
    ...(players ? { players } : {}),
    ...(roster ? { roster } : {}),
    ...(entitlementIds ? { entitlementIds } : {}),
    ...(totals !== undefined ? { totals } : {}),
  };
}

function readArchitectPlayerArray(
  value: unknown,
  context: string
): ArchitectBoundaryPlayer[] | undefined {
  if (value == null) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(`${context} must be an array when present`);
  }

  return value.map((player, index) =>
    readArchitectPlayer(player, `${context}[${index}]`)
  );
}

function readArchitectSalaryRows(
  value: unknown,
  context: string
): ArchitectBoundarySalaryRow[] | undefined {
  if (value == null) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(`${context} must be an array when present`);
  }

  return value.map((row, index) => {
    const record = requireArchitectRecord(row, `${context}[${index}]`);
    const season = readArchitectString(record.season);
    if (!season) {
      throw new Error(`${context}[${index}].season must be a non-empty string`);
    }

    return { ...record, season };
  });
}

export function hasArchitectField(record: UnknownRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}
