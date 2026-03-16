/**
 * Engine utilities for trade validation
 * Consolidated from: debug.js, tradeKicker.js
 */

interface TradeKickerInfo {
  percentage: number;
  waived?: number;
}

interface TradeKickerPlayer {
  newSalary: number;
  tradeKicker?: TradeKickerInfo | null;
}

interface TradeKickerContext {
  daysRemainingInSeason?: number;
  daysInSeason?: number;
}

// Debug functionality (from debug.js)
class Debug {
  enabled: boolean;

  constructor() {
    this.enabled = false;
  }

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
  }

  log(message: string, data?: unknown) {
    if (this.enabled) {
      console.log(`[Trade Validator] ${message}`, data || '');
    }
  }

  error(message: string, error?: unknown) {
    if (this.enabled) {
      console.error(`[Trade Validator Error] ${message}`, error || '');
    }
  }
}

export const debug = new Debug();

// Trade kicker calculation (from tradeKicker.js)
export function computeTradeKicker(
  player: TradeKickerPlayer,
  tradeCtx?: TradeKickerContext | null
) {
  // No kicker if not specified
  if (!player.tradeKicker?.percentage) {
    return 0;
  }

  const baseSalary = player.newSalary;
  const kickerPct = player.tradeKicker.percentage;
  const kickerAmount = Math.floor(baseSalary * kickerPct);

  // Handle waiver if specified
  const waivedAmount = player.tradeKicker.waived
    ? Math.floor(kickerAmount * player.tradeKicker.waived)
    : 0;

  const effectiveKicker = kickerAmount - waivedAmount;

  // Prorate based on days if specified
  if (tradeCtx?.daysRemainingInSeason && tradeCtx?.daysInSeason) {
    return Math.floor(
      effectiveKicker * (tradeCtx.daysRemainingInSeason / tradeCtx.daysInSeason)
    );
  }

  return effectiveKicker;
}
