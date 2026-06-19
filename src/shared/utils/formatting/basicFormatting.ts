export function formatHeight(inches: number = 0): string {
  if (inches === 0 || inches === null || inches === undefined) return '0\'0"';
  const feet = Math.floor(inches / 12);
  const remainingInches = inches % 12;
  return `${feet}'${remainingInches}"`;
}

export function formatSalary(salary: number | string | null | undefined): string {
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

export function formatMillions(
  value: number | string | null | undefined,
  decimals: number = 1
): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }

  const numeric =
    typeof value === 'string'
      ? Number(value.replace(/[^0-9.-]/g, ''))
      : Number(value);

  const sign = numeric < 0 ? '-' : '';
  const absValue = Math.abs(numeric);
  const factor = 10 ** decimals;
  const roundedMillions = Math.round((absValue / 1_000_000) * factor) / factor;

  return `${sign}$${roundedMillions.toFixed(decimals)}M`;
}

export function formatCurrencyFull(
  value: number | string | null | undefined
): string {
  if (value === null || value === undefined || value === '') return '';
  const num =
    typeof value === 'number'
      ? value
      : Number(String(value).replace(/[^0-9]/g, ''));
  if (Number.isNaN(num)) return '';
  return `$${num.toLocaleString()}`;
}

export function formatCurrency(
  value: number | string | null | undefined
): string {
  if (value === null || value === undefined || value === '') return '-';
  const num =
    typeof value === 'number'
      ? value
      : Number(String(value).replace(/[^0-9.-]/g, ''));
  if (Number.isNaN(num)) return '-';
  return `$${num.toLocaleString('en-US')}`;
}

// Fallback formatter — prefer displayName from player data when available.
export function formatName(name: string = ''): string {
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

export function formatContractSummary(
  currentSalary: number | null | undefined,
  totalYears: number | null | undefined
): string {
  if (!currentSalary || !totalYears) return '—';
  const absSalary = Math.abs(currentSalary);
  const sign = currentSalary < 0 ? '-' : '';
  const salaryDisplay =
    absSalary >= 1_000_000
      ? `${sign}$${(absSalary / 1_000_000).toFixed(1)}M`
      : absSalary >= 1_000
        ? `${sign}$${(absSalary / 1_000).toFixed(1)}K`
        : `${sign}$${absSalary.toLocaleString('en-US')}`;

  return `${salaryDisplay} / ${totalYears} yrs`;
}

export const playerAliasMap: Record<string, string> = {};
