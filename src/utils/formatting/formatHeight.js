export function formatHeight(inches = 0) {
  if (inches === 0 || inches === null || inches === undefined) return '0\'0"';
  const feet = Math.floor(inches / 12);
  const remainingInches = inches % 12;
  return `${feet}'${remainingInches}"`;
}
