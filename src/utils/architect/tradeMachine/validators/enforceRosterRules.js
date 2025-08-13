import { validationFlags } from '@/config/validationFlags.js';

export function enforceRosterWindow(team, ctx, notifier = {}) {
  const { warn = () => {}, reject = () => {} } = notifier;
  const mode = validationFlags.roster || 'warn';
  const twoWayMode = validationFlags.twoWayRoster || 'warn';

  const rosterMin = 13;
  const rosterMax = 15;
  const twoWayMax = 3;

  const projected = team.projectedRosterCount || 0;
  const twoWaySlots = (team.incomingPlayers || []).filter(
    (p) => p.contractType === 'two-way'
  ).length;

  if (projected < rosterMin) {
    const msg = `Roster count (${projected}) below minimum ${rosterMin}`;
    mode === 'error' ? reject(msg) : warn(msg);
  }

  if (projected > rosterMax) {
    const msg = `Roster count (${projected}) exceeds maximum ${rosterMax}`;
    mode === 'error' ? reject(msg) : warn(msg);
  }

  if (twoWaySlots > twoWayMax) {
    const msg = `Two-way slots exceeded (${twoWaySlots}/${twoWayMax})`;
    twoWayMode === 'error' ? reject(msg) : warn(msg);
  }

  return [];
}

export function enforceTiming(team, tradeCtx = {}, notifier = {}) {
  const { warn = () => {}, reject = () => {} } = notifier;
  const mode = validationFlags.timing || 'warn';
  const rejects = [];

  // Moratorium check
  const { asOfDate } = tradeCtx;
  const moratoriumEnd = new Date('2025-07-06').getTime();
  if (asOfDate && new Date(asOfDate).getTime() < moratoriumEnd) {
    const msg = 'Trade moratorium in effect until July 6';
    mode === 'error' ? reject(msg) : warn(msg);
  }

  // Dec 15 / Jan 15 eligibility
  const players = team.sends || [];
  players.forEach((p) => {
    if (p.signedDate) {
      const signed = new Date(p.signedDate).getTime();
      const dec15 = new Date('2024-12-15').getTime();
      const jan15 = new Date('2025-01-15').getTime();
      if (signed > dec15 || (p.signAndTrade && signed > jan15)) {
        const msg = `${p.name || 'Player'} not eligible until ${p.signAndTrade ? 'Jan 15' : 'Dec 15'}`;
        mode === 'error' ? reject(msg) : warn(msg);
      }
    }
  });

  // 30-day waiting period after signing
  players.forEach((p) => {
    if (p.signedDate && asOfDate) {
      const waitDays =
        (new Date(asOfDate) - new Date(p.signedDate)) / (1000 * 60 * 60 * 24);
      if (waitDays < 30) {
        const msg = `${p.name || 'Player'} cannot be traded until 30 days after signing`;
        mode === 'error' ? reject(msg) : warn(msg);
      }
    }
  });

  return rejects;
}
