// Consolidated basic formatting utilities
// Merged from: formatHeight.js, formatSalary.js, formatCurrencyFull.js, formatName.js, playerAliasMap.js

// Format height in inches to feet'inches" format
export function formatHeight(inches = 0) {
  if (inches === 0 || inches === null || inches === undefined) return '0\'0"';
  const feet = Math.floor(inches / 12);
  const remainingInches = inches % 12;
  return `${feet}'${remainingInches}"`;
}

// Format salary with appropriate abbreviations (M for millions, K for thousands)
export function formatSalary(salary) {
  if (!salary) return '—';
  const salaryValue =
    typeof salary === 'string'
      ? parseFloat(salary.replace(/[^0-9.-]/g, ''))
      : salary;
  const sign = salaryValue < 0 ? '-' : '';
  const absValue = Math.abs(salaryValue);
  if (absValue >= 1000000) {
    return `${sign}$${(absValue / 1000000).toFixed(1)}M`;
  } else if (absValue >= 1000) {
    return `${sign}$${(absValue / 1000).toFixed(0)}K`;
  }
  return `${sign}$${absValue.toLocaleString()}`;
}

// Format currency with full dollar amounts and commas
export function formatCurrencyFull(value) {
  if (value === null || value === undefined || value === '') return '';
  const num =
    typeof value === 'number'
      ? value
      : Number(String(value).replace(/[^0-9]/g, ''));
  if (Number.isNaN(num)) return '';
  return `$${num.toLocaleString()}`;
}

// Format player names with proper capitalization and suffix handling
export function formatName(name = '') {
  if (!name) return '';
  const suffixes = ['jr', 'sr', 'ii', 'iii', 'iv', 'v'];
  return name
    .trim()
    .split(' ')
    .map((word) => {
      if (suffixes.includes(word.toLowerCase())) return word.toUpperCase();
      if (word.length <= 2 && word === word.toUpperCase()) return word;
      if (word.includes("'")) {
        return word
          .split("'")
          .map(
            (part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
          )
          .join("'");
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

// Player alias mapping (currently empty but kept for compatibility)
export const playerAliasMap = {};