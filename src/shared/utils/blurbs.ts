export type Blurbs = {
  traits: Record<string, string>;
  roles: Record<string, string>;
  subroles: Record<string, string>;
  shootingProfile: string;
  twoWayMeter: string;
  overall: string;
};

const EMPTY_BLRUBS: Blurbs = {
  traits: {},
  roles: {},
  subroles: {},
  shootingProfile: '',
  twoWayMeter: '',
  overall: '',
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const coerceText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return String(value);
};

// Note: BLRUBS typo is preserved — public export name cannot be changed without coordinating callers.
export const DEFAULT_BLRUBS: Blurbs = { ...EMPTY_BLRUBS };

export const normalizeBlurbs = (raw: unknown): Blurbs => {
  if (!isPlainObject(raw)) {
    return { ...EMPTY_BLRUBS, traits: {}, roles: {}, subroles: {} };
  }

  const hasNested =
    isPlainObject(raw.traits) ||
    isPlainObject(raw.roles) ||
    isPlainObject(raw.subroles) ||
    isPlainObject(raw.subRoles) ||
    Object.prototype.hasOwnProperty.call(raw, 'shootingProfile') ||
    Object.prototype.hasOwnProperty.call(raw, 'twoWayMeter') ||
    Object.prototype.hasOwnProperty.call(raw, 'overall');

  if (hasNested) {
    const subroles = isPlainObject(raw.subroles)
      ? raw.subroles
      : isPlainObject(raw.subRoles)
        ? raw.subRoles
        : {};

    return {
      traits: isPlainObject(raw.traits) ? { ...(raw.traits as Record<string, string>) } : {},
      roles: isPlainObject(raw.roles) ? { ...(raw.roles as Record<string, string>) } : {},
      subroles: { ...(subroles as Record<string, string>) },
      shootingProfile:
        typeof raw.shootingProfile === 'string' ? raw.shootingProfile : '',
      twoWayMeter: typeof raw.twoWayMeter === 'string' ? raw.twoWayMeter : '',
      overall: typeof raw.overall === 'string' ? raw.overall : '',
    };
  }

  const normalized: Blurbs = {
    ...EMPTY_BLRUBS,
    traits: {},
    roles: {},
    subroles: {},
  };

  Object.entries(raw).forEach(([key, value]) => {
    const text = coerceText(value);
    if (key.startsWith('trait_')) normalized.traits[key.slice(6)] = text;
    else if (key.startsWith('role_')) normalized.roles[key.slice(5)] = text;
    else if (key.startsWith('subrole_')) normalized.subroles[key.slice(8)] = text;
    else if (key === 'shooting_profile') normalized.shootingProfile = text;
    else if (key === 'two_way_meter') normalized.twoWayMeter = text;
    else if (key === 'overall') normalized.overall = text;
  });

  return normalized;
};
