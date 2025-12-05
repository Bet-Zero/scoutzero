// hardCapUtils.js

// Check if a certain transaction type triggers a hard cap
export const checkIfActionTriggersHardCap = (actionType) => {
  switch (actionType) {
    case 'NonTaxMLE':
    case 'BAE':
    case 'SignAndTrade':
      return 'FirstApron';
    // You can extend this later for SecondApron triggers
    default:
      return null;
  }
};

// Apply a hard cap trigger to the teamCapSheet if one is activated
export const applyHardCapTrigger = (teamCapSheet, actionType, currentYear) => {
  const triggeredCap = checkIfActionTriggersHardCap(actionType);

  if (!triggeredCap) return teamCapSheet;

  const existingCap = teamCapSheet.hardCapTriggered;

  if (!existingCap) {
    return {
      ...teamCapSheet,
      hardCapTriggered: triggeredCap,
      hardCapYear: currentYear,
    };
  }

  // Only replace if new trigger is more restrictive (future-proofing)
  const capPriority = {
    None: 0,
    FirstApron: 1,
    SecondApron: 2,
  };

  if (capPriority[triggeredCap] > capPriority[existingCap]) {
    return {
      ...teamCapSheet,
      hardCapTriggered: triggeredCap,
      hardCapYear: currentYear,
    };
  }

  return teamCapSheet;
};

// Check if a team's projected salary exceeds its active hard cap
export const wouldExceedHardCap = (
  teamCapSheet,
  projectedTotalSalary,
  capSettings
) => {
  const { hardCapTriggered, hardCapFirstApron } = teamCapSheet || {};
  if (!hardCapTriggered && !hardCapFirstApron?.active) return false;

  let hardCapLimit = null;

  if (hardCapFirstApron?.active) {
    hardCapLimit = capSettings.firstApron;
  } else if (hardCapTriggered === true || hardCapTriggered === 'FirstApron') {
    hardCapLimit = capSettings.firstApron;
  } else if (hardCapTriggered === 'SecondApron') {
    hardCapLimit = capSettings.secondApron;
  }

  return hardCapLimit !== null && projectedTotalSalary > hardCapLimit;
};

// Return the hard cap limit value for a team, or null if none
export const getHardCapLimit = (teamCapSheet, capSettings) => {
  const { hardCapTriggered } = teamCapSheet || {};
  if (!hardCapTriggered) return null;

  if (hardCapTriggered === 'FirstApron') return capSettings.firstApron;
  if (hardCapTriggered === 'SecondApron') return capSettings.secondApron;

  return null;
};

export const isHardCappedAtFirstApron = (teamSeasonState = {}, season) => {
  const hc = teamSeasonState.hardCapFirstApron;
  if (hc?.active) {
    if (!season) return true;
    
    // Check direct matches
    if (hc.season === season || hc.year === season) return true;
    
    // Handle "2024-25" vs 2025 format mismatch
    if (typeof season === 'number' && typeof hc.season === 'string') {
        const seasonKey = `${season - 1}-${String(season % 100).padStart(2, '0')}`;
        if (hc.season === seasonKey) return true;
    }
    
    return false;
  }

  // Check for hard cap triggers from FA exception usage (Legacy bucket format)
  if (teamSeasonState.faExceptionBuckets) {
    const hardCapTriggers = ['NTMLE', 'BAE']; // Non-Taxpayer MLE and BAE trigger hard cap
    const hasUsedHardCapException = teamSeasonState.faExceptionBuckets.some(
      (bucket) =>
        hardCapTriggers.includes(bucket.type) &&
        (bucket.used > 0 || bucket.remaining < bucket.amount)
    );
    if (hasUsedHardCapException) {
      return true;
    }
  }

  // Check usage-based triggers (Property format used by ExceptionTracker)
  const mle = teamSeasonState.mle || {};
  const bae = teamSeasonState.bae || {};
  const usedNTPMLE = (mle.used || 0) > 0;
  const usedBAE = (bae.used || 0) > 0;
  if (usedNTPMLE || usedBAE) {
    return true;
  }

  // Check simple hardCapped status (used by ExceptionTracker)
  if (teamSeasonState.hardCapped === 1) return true;

  // Check hardCapTriggered property
  if (
    teamSeasonState.hardCapTriggered === 'FirstApron' ||
    teamSeasonState.hardCapTriggered === true
  ) {
    return true;
  }

  return false;
};

export const isHardCappedAtSecondApron = (teamSeasonState = {}) => {
  if (teamSeasonState.hardCapped === 2) return true;
  if (teamSeasonState.hardCapTriggered === 'SecondApron') return true;
  return false;
};

export const getFirstApronHardCapReason = (teamSeasonState = {}) => {
  // Check usage triggers first (specific)
  const mle = teamSeasonState.mle || {};
  const bae = teamSeasonState.bae || {};
  const usedNTPMLE = (mle.used || 0) > 0;
  const usedBAE = (bae.used || 0) > 0;

  if (usedNTPMLE && usedBAE) return 'Usage of Non-Taxpayer MLE & BAE';
  if (usedNTPMLE) return 'Usage of Non-Taxpayer MLE';
  if (usedBAE) return 'Usage of Bi-Annual Exception';

  // Check legacy bucket triggers
  if (teamSeasonState.faExceptionBuckets) {
      const usedBuckets = teamSeasonState.faExceptionBuckets.filter(b => 
          ['NTMLE', 'BAE'].includes(b.type) && (b.used > 0 || b.remaining < b.amount)
      );
      if (usedBuckets.length > 0) {
          const names = usedBuckets.map(b => b.type === 'NTMLE' ? 'Non-Taxpayer MLE' : 'BAE').join(' & ');
          return `Usage of ${names}`;
      }
  }

  // Check generic triggers
  if (teamSeasonState.hardCapTriggered === 'SignAndTrade') return 'Acquired player via Sign & Trade';
  
  // Default fallback
  if (teamSeasonState.hardCapped === 1 || teamSeasonState.hardCapTriggered) {
      return 'Roster moves (Sign & Trade, MLE, or BAE usage)';
  }
  
  return 'Roster moves';
};
