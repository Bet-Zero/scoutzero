/**
 * Trade utility helpers unrelated to TPE validation.
 * Kept behind a JS compatibility shim so `tradeUtilities.js` can remain stable.
 */

interface TradeUtilityMiscProtectionMetaLike {
  type?: unknown;
  maxPosition?: unknown;
}

interface TradeUtilityMiscProtectionCarrierLike {
  protectionMeta?: unknown;
  protection?: unknown;
}

interface TradeUtilityMiscPickOption {
  label: string;
  value: string;
}

function isTradeUtilityMiscObjectLike(
  value: unknown
): value is TradeUtilityMiscProtectionCarrierLike {
  return typeof value === 'object' && value !== null;
}

// Date and formatting utilities (from tradeUtils.js)
export const isExpired = (expiryDate: unknown): boolean => {
  if (!expiryDate) return false;
  const expiry = new Date(expiryDate as string);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return expiry <= today;
};

export const formatDate = (dateStr: unknown): string => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr as string).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const formatSalary = (amount: unknown): string =>
  `$${((amount || 0) as { toLocaleString(): string }).toLocaleString()}`;

/**
 * Phase 4: Determines if a protection value is "meaningful" for Stepien purposes.
 *
 * Supports:
 * - Legacy string protection: "Top 3", "Lottery", etc.
 * - Pick object with protectionMeta
 */
export const isMeaningfulProtection = (protectionOrPick: unknown): boolean => {
  if (!protectionOrPick) return false;

  const protectionMeta = isTradeUtilityMiscObjectLike(protectionOrPick)
    ? protectionOrPick.protectionMeta
    : undefined;

  if (typeof protectionOrPick === 'object' && protectionMeta) {
    const { type, maxPosition } =
      protectionMeta as TradeUtilityMiscProtectionMetaLike;
    if (type === 'always' || type === 'never') {
      return false;
    }
    if (type === 'position' && typeof maxPosition === 'number') {
      return maxPosition > 0;
    }
    if (type === 'lottery' || type === 'playoff') {
      return true;
    }
    return false;
  }

  let protection = protectionOrPick;
  const protectionValue = isTradeUtilityMiscObjectLike(protectionOrPick)
    ? protectionOrPick.protection
    : undefined;

  if (typeof protectionOrPick === 'object' && protectionValue) {
    protection = protectionValue;
  }

  if (typeof protection !== 'string') return false;

  if (protection === 'Swap (+)' || protection === 'Swap (-)') {
    return false;
  }

  return (
    /top\s*[1-9]\d*/i.test(protection) ||
    /lottery/i.test(protection) ||
    /1-14/i.test(protection)
  );
};

// Pick options and configurations (from pickOptions.js)
export const getPickOptions = (): TradeUtilityMiscPickOption[] => [
  { label: 'Unprotected', value: '' },
  { label: 'Protected Top 3', value: 'Top 3' },
  { label: 'Protected Top 5', value: 'Top 5' },
  { label: 'Protected Top 8', value: 'Top 8' },
  { label: 'Protected Top 10', value: 'Top 10' },
  { label: 'Lottery Protected', value: 'Lottery' },
  { label: 'Protected Top 20', value: 'Top 20' },
];

/**
 * Phase 4: Normalizes legacy protection values.
 * Converts "Swap (+)" and "Swap (-)" protection strings to unprotected (null).
 */
export function normalizeProtectionValue<T>(protection: T): T | null {
  if (!protection) return null;

  if (protection === 'Swap (+)' || protection === 'Swap (-)') {
    return null;
  }

  return protection;
}
