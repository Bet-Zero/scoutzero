type PickIdRecord = Record<string, unknown> & {
  id?: unknown;
  originalTeam?: unknown;
  year?: unknown;
  round?: unknown;
  pickIdWarning?: unknown;
};

const VALID_PICK_ID_PATTERN = /^[A-Z]{2,4}_\d{4}_[12]$/;

export function normalizeRound(input: unknown): 1 | 2 | null {
  if (input == null) return null;

  if (typeof input === 'number') {
    if (input === 1 || input === 2) return input;
    return null;
  }

  const str = String(input).toLowerCase().trim();

  if (str === '1' || str === '1st' || str === 'first') {
    return 1;
  }

  if (str === '2' || str === '2nd' || str === 'second') {
    return 2;
  }

  return null;
}

export function generatePickId(pick: PickIdRecord | null | undefined): string {
  if (!pick) return 'UNK_????_?';

  const team = pick.originalTeam || 'UNK';
  const year = pick.year || '????';
  const round = normalizeRound(pick.round);
  const roundStr = round != null ? round : '?';

  return `${team}_${year}_${roundStr}`;
}

export function ensurePickId(
  pick: PickIdRecord | null | undefined
): PickIdRecord {
  if (!pick) {
    return { id: 'UNK_????_?', pickIdWarning: 'Null or undefined pick' };
  }

  if (
    pick.id &&
    typeof pick.id === 'string' &&
    VALID_PICK_ID_PATTERN.test(pick.id)
  ) {
    return pick;
  }

  const id = generatePickId(pick);

  const missingFields: string[] = [];
  if (!pick.originalTeam) missingFields.push('originalTeam');
  if (!pick.year) missingFields.push('year');
  if (normalizeRound(pick.round) == null) missingFields.push('round');

  const result: PickIdRecord = { ...pick, id };

  if (missingFields.length > 0) {
    result.pickIdWarning = `Missing ${missingFields.join(', ')}`;
    if (
      typeof console !== 'undefined' &&
      import.meta?.env?.MODE !== 'production'
    ) {
      console.warn(
        `[pickIdUtils] Pick ID generated with missing fields: ${missingFields.join(', ')}`,
        pick
      );
    }
  }

  return result;
}

export function areSamePickById(a: unknown, b: unknown): boolean {
  if (!a || !b) return false;

  const idA = ensurePickId(a as PickIdRecord).id;
  const idB = ensurePickId(b as PickIdRecord).id;

  return idA === idB;
}
