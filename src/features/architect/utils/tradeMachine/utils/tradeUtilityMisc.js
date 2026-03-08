/**
 * Trade utility helpers unrelated to TPE validation.
 * Kept in JS so `tradeUtilities.js` can remain a compatibility barrel.
 */

// Date and formatting utilities (from tradeUtils.js)
export const isExpired = (expiryDate) => {
  if (!expiryDate) return false;
  const expiry = new Date(expiryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return expiry <= today;
};

export const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const formatSalary = (amount) => `$${(amount || 0).toLocaleString()}`;

/**
 * Phase 4: Determines if a protection value is "meaningful" for Stepien purposes.
 *
 * Supports:
 * - Legacy string protection: "Top 3", "Lottery", etc.
 * - Pick object with protectionMeta
 */
export const isMeaningfulProtection = (protectionOrPick) => {
  if (!protectionOrPick) return false;

  if (typeof protectionOrPick === 'object' && protectionOrPick.protectionMeta) {
    const { type, maxPosition } = protectionOrPick.protectionMeta;
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
  if (typeof protectionOrPick === 'object' && protectionOrPick.protection) {
    protection = protectionOrPick.protection;
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
export const getPickOptions = () => [
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
export function normalizeProtectionValue(protection) {
  if (!protection) return null;

  if (protection === 'Swap (+)' || protection === 'Swap (-)') {
    return null;
  }

  return protection;
}
