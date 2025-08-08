import { passesRosterWindow } from '@/utils/architect/rosterUtils.js';
import { validationFlags } from '@/config/validationFlags.js';

export function enforceRosterWindow(
  teamCtx,
  tradeCtx = {},
  { warn = () => {}, reject = () => {} } = {}
) {
  const check = passesRosterWindow(teamCtx.postTradeTeam, {
    require14to15: !tradeCtx?.graceMode,
  });
  const stdMsg = check.reasons.find((r) => r.startsWith('Standard'));
  const twoWayMsg = check.reasons.find((r) => r.startsWith('Two-way'));
  if (stdMsg) {
    if (validationFlags.rosterEnforcement === 'error') reject(stdMsg);
    if (validationFlags.rosterEnforcement === 'warn') warn(stdMsg);
  }
  if (twoWayMsg) {
    if (validationFlags.twoWayRoster === 'error') reject(twoWayMsg);
    if (validationFlags.twoWayRoster === 'warn') warn(twoWayMsg);
  }
  return check;
}
