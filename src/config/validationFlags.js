export const validationFlags = {
  rosterEnforcement: 'warn',
  timingEnforcement: 'warn',
  consent: 'error',
  reAcquisition: 'error',
  seasonalCash: 'warn',
  twoWayRoster: 'warn',
  moratorium: { startMonth: 7, startDay: 1, endMonth: 7, endDay: 6 },
  faExceptionTrade: 'on',
  faExceptionEligible: undefined,
  faExceptionAutoSelect: true,
};
