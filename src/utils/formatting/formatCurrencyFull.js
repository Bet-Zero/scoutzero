export function formatCurrencyFull(value) {
  if (value === null || value === undefined || value === '') return '';
  const num =
    typeof value === 'number'
      ? value
      : Number(String(value).replace(/[^0-9]/g, ''));
  if (Number.isNaN(num)) return '';
  return `$${num.toLocaleString()}`;
}
