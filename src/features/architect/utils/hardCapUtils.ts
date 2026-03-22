type NumericLike = number | string | null | undefined;

interface HardCapBucketLike {
  type?: unknown;
  used?: NumericLike;
  remaining?: NumericLike;
  amount?: NumericLike;
}

interface HardCapFirstApronState {
  active?: boolean;
  season?: unknown;
  year?: unknown;
}

interface HardCapUsageState {
  used?: NumericLike;
}

interface HardCapTeamState {
  hardCapTriggered?: unknown;
  hardCapFirstApron?: HardCapFirstApronState | null;
  faExceptionBuckets?: HardCapBucketLike[];
  mle?: HardCapUsageState | null;
  bae?: HardCapUsageState | null;
  hardCapped?: NumericLike;
  hardCapYear?: unknown;
  exceptions?: Record<string, unknown> | null;
  teamCode?: string | null;
  players?: unknown[] | null;
}

interface HardCapSettingsLike {
  firstApron?: NumericLike;
  secondApron?: NumericLike;
}

export const checkIfActionTriggersHardCap = (
  actionType: unknown
): 'FirstApron' | null => {
  switch (actionType) {
    case 'NonTaxMLE':
    case 'BAE':
    case 'SignAndTrade':
      return 'FirstApron';
    default:
      return null;
  }
};

export const applyHardCapTrigger = (
  teamCapSheet: HardCapTeamState,
  actionType: unknown,
  currentYear: unknown
): HardCapTeamState => {
  const triggeredCap = checkIfActionTriggersHardCap(actionType);

  if (!triggeredCap) return teamCapSheet;

  const existingCap = teamCapSheet?.hardCapTriggered;

  if (!existingCap) {
    return {
      ...teamCapSheet,
      hardCapTriggered: triggeredCap,
      hardCapYear: currentYear,
    };
  }

  const capPriority: Record<string, number> = {
    None: 0,
    FirstApron: 1,
    SecondApron: 2,
  };

  if (capPriority[triggeredCap] > capPriority[String(existingCap)]) {
    return {
      ...teamCapSheet,
      hardCapTriggered: triggeredCap,
      hardCapYear: currentYear,
    };
  }

  return teamCapSheet;
};

export const wouldExceedHardCap = (
  teamCapSheet: HardCapTeamState | null | undefined,
  projectedTotalSalary: NumericLike,
  capSettings: HardCapSettingsLike
): boolean => {
  const { hardCapTriggered, hardCapFirstApron } =
    (teamCapSheet || {}) as HardCapTeamState;
  if (!hardCapTriggered && !hardCapFirstApron?.active) return false;

  let hardCapLimit: NumericLike = null;

  if (hardCapFirstApron?.active) {
    hardCapLimit = capSettings.firstApron;
  } else if (hardCapTriggered === true || hardCapTriggered === 'FirstApron') {
    hardCapLimit = capSettings.firstApron;
  } else if (hardCapTriggered === 'SecondApron') {
    hardCapLimit = capSettings.secondApron;
  }

  return hardCapLimit !== null && Number(projectedTotalSalary) > Number(hardCapLimit);
};

export const getHardCapLimit = (
  teamCapSheet: HardCapTeamState | null | undefined,
  capSettings: HardCapSettingsLike
): NumericLike => {
  const { hardCapTriggered } = (teamCapSheet || {}) as HardCapTeamState;
  if (!hardCapTriggered) return null;

  if (hardCapTriggered === 'FirstApron') return capSettings.firstApron;
  if (hardCapTriggered === 'SecondApron') return capSettings.secondApron;

  return null;
};

export const isHardCappedAtFirstApron = (
  teamSeasonState: HardCapTeamState = {},
  season?: unknown
): boolean => {
  const hc = teamSeasonState.hardCapFirstApron;
  if (hc?.active) {
    if (!season) return true;

    if (hc.season === season || hc.year === season) return true;

    if (typeof season === 'number' && typeof hc.season === 'string') {
      const seasonKey = `${season - 1}-${String(season % 100).padStart(2, '0')}`;
      if (hc.season === seasonKey) return true;
    }

    return false;
  }

  if (teamSeasonState.faExceptionBuckets) {
    const hardCapTriggers = ['NTMLE', 'BAE'];
    const hasUsedHardCapException = teamSeasonState.faExceptionBuckets.some(
      (bucket) =>
        hardCapTriggers.includes(String(bucket.type)) &&
        (Number(bucket.used) > 0 ||
          Number(bucket.remaining) < Number(bucket.amount))
    );
    if (hasUsedHardCapException) {
      return true;
    }
  }

  const mle = teamSeasonState.mle || {};
  const bae = teamSeasonState.bae || {};
  const usedNTPMLE = Number(mle.used || 0) > 0;
  const usedBAE = Number(bae.used || 0) > 0;
  if (usedNTPMLE || usedBAE) {
    return true;
  }

  if (teamSeasonState.hardCapped === 1) return true;

  if (
    teamSeasonState.hardCapTriggered === 'FirstApron' ||
    teamSeasonState.hardCapTriggered === true
  ) {
    return true;
  }

  return false;
};

export const isHardCappedAtSecondApron = (
  teamSeasonState: HardCapTeamState = {}
): boolean => {
  if (teamSeasonState.hardCapped === 2) return true;
  if (teamSeasonState.hardCapTriggered === 'SecondApron') return true;
  return false;
};

export const getFirstApronHardCapReason = (
  teamSeasonState: HardCapTeamState = {}
): string => {
  const mle = teamSeasonState.mle || {};
  const bae = teamSeasonState.bae || {};
  const usedNTPMLE = Number(mle.used || 0) > 0;
  const usedBAE = Number(bae.used || 0) > 0;

  if (usedNTPMLE && usedBAE) return 'Usage of Non-Taxpayer MLE & BAE';
  if (usedNTPMLE) return 'Usage of Non-Taxpayer MLE';
  if (usedBAE) return 'Usage of Bi-Annual Exception';

  if (teamSeasonState.faExceptionBuckets) {
    const usedBuckets = teamSeasonState.faExceptionBuckets.filter(
      (bucket) =>
        ['NTMLE', 'BAE'].includes(String(bucket.type)) &&
        (Number(bucket.used) > 0 ||
          Number(bucket.remaining) < Number(bucket.amount))
    );
    if (usedBuckets.length > 0) {
      const names = usedBuckets
        .map((bucket) =>
          bucket.type === 'NTMLE' ? 'Non-Taxpayer MLE' : 'BAE'
        )
        .join(' & ');
      return `Usage of ${names}`;
    }
  }

  if (teamSeasonState.hardCapTriggered === 'SignAndTrade') {
    return 'Acquired player via Sign & Trade';
  }

  if (teamSeasonState.hardCapped === 1 || teamSeasonState.hardCapTriggered) {
    return 'Roster moves (Sign & Trade, MLE, or BAE usage)';
  }

  return 'Roster moves';
};
