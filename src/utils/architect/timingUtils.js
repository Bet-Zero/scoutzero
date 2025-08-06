export function isWithinMoratorium(date, { startMonth, startDay, endMonth, endDay }) {
  const d = new Date(date);
  const y = d.getUTCFullYear();
  const start = Date.UTC(y, startMonth - 1, startDay);
  const end = Date.UTC(y, endMonth - 1, endDay, 23, 59, 59);
  return d.getTime() >= start && d.getTime() <= end;
}
export function daysSince(a, b) {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}
export function violates30Day(p, d) {
  return p?.signedDate && daysSince(p.signedDate, d) < 30;
}
export function violates2MonthAggregation(p, d) {
  return p?.signedDate && daysSince(p.signedDate, d) < 60;
}
