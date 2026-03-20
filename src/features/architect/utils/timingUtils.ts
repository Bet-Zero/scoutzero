type DateLike = string | number | Date;

interface MoratoriumWindow {
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
}

interface SignedDateCarrier {
  signedDate?: DateLike | null;
}

export { violatesReacquisitionBar } from './reacqUtils';

export function isWithinMoratorium(
  date: DateLike,
  { startMonth, startDay, endMonth, endDay }: MoratoriumWindow
): boolean {
  const d = new Date(date);
  const y = d.getUTCFullYear();
  const start = Date.UTC(y, startMonth - 1, startDay);
  const end = Date.UTC(y, endMonth - 1, endDay, 23, 59, 59);
  return d.getTime() >= start && d.getTime() <= end;
}

export function daysSince(a: DateLike, b: DateLike): number {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

export function violates30Day(
  player: SignedDateCarrier | null | undefined,
  date: DateLike
): boolean {
  const signedDate = player?.signedDate;
  return Boolean(signedDate) && daysSince(signedDate as DateLike, date) < 30;
}
