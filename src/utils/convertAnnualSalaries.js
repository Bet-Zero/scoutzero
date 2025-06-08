export default function convertAnnualSalaries(annualSalaries = []) {
  const salaryMap = {};
  (annualSalaries || []).forEach((s) => {
    let raw = s.salary;
    if (typeof raw === 'string') {
      raw = raw.replace(/[\$,]/g, '');
      if (raw.includes('M')) {
        raw = raw.replace('M', '');
        salaryMap[s.year] = parseFloat(raw);
      } else {
        salaryMap[s.year] = parseFloat(raw) / 1_000_000;
      }
    } else if (typeof raw === 'number') {
      salaryMap[s.year] = raw / 1_000_000;
    } else {
      salaryMap[s.year] = null;
    }
    if (isNaN(salaryMap[s.year])) salaryMap[s.year] = null;
  });
  return salaryMap;
}
