export const generateDefaultPicks = () => {
  const years = [2026, 2027, 2028, 2029, 2030, 2031, 2032];
  const picks = [];
  years.forEach((year) => {
    picks.push({ year, round: '1st' });
    picks.push({ year, round: '2nd' });
  });
  return picks;
};

export const attachDefaultPicks = (capSheet = {}) => {
  if (!Array.isArray(capSheet.picks)) {
    capSheet.picks = generateDefaultPicks();
  }
  return capSheet;
};
