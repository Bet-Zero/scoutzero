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
