/** Preserve exact display totals; full detailed books live in the same atomic history. */
export function compactSyntheticSeasonEventTotals(
  totals: Record<string, unknown>
) {
  return Object.fromEntries(
    Object.entries(totals).map(([team, value]) => {
      if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Synthetic season event totals are incomplete.');
      const scalar = Object.fromEntries(
        Object.entries(value).filter(
          ([, field]) =>
            field === null ||
            ['number', 'string', 'boolean'].includes(typeof field)
        )
      );
      for (const key of ['teamSalary', 'apronTeamSalary', 'taxSalary'])
        if (typeof scalar[key] !== 'number' || !Number.isFinite(scalar[key]))
          throw new Error(`Synthetic season event requires complete ${key}.`);
      return [team, scalar];
    })
  );
}
