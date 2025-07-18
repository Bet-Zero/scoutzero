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
  const { hardCapTriggered } = teamCapSheet || {};
  if (!hardCapTriggered) return false;

  let hardCapLimit = null;

  if (hardCapTriggered === 'FirstApron') {
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
