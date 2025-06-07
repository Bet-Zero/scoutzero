export default function formatSalary(salary) {
  if (!salary) return '—';
  const salaryValue =
    typeof salary === 'string'
      ? parseFloat(salary.replace(/[^0-9.]/g, ''))
      : salary;
  if (salaryValue >= 1000000) {
    return `$${(salaryValue / 1000000).toFixed(1)}M`;
  } else if (salaryValue >= 1000) {
    return `$${(salaryValue / 1000).toFixed(0)}K`;
  }
  return `$${salaryValue?.toLocaleString() || '—'}`;
}
