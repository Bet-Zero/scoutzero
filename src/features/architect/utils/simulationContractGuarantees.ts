/**
 * Protection greater than Base Compensation is conflicting evidence, not full
 * protection. The immutable Contract release retains the original; the world
 * display carries unknowns. Salary, cap hit, bonuses and options are unchanged.
 */
export function withholdConflictingGuarantees<T>(contract: T): T {
  if (!contract || typeof contract !== 'object') return contract;
  const raw = contract as Record<string, unknown>;
  if (!Array.isArray(raw.salariesByYear)) return contract;
  return {
    ...raw,
    salariesByYear: raw.salariesByYear.map((row) => {
      if (!row || typeof row !== 'object') return row;
      if (
        typeof row.salary === 'number' &&
        typeof row.guaranteedAmount === 'number' &&
        row.guaranteedAmount > row.salary
      )
        return { ...row, guaranteed: null, guaranteedAmount: null };
      return row;
    }),
  } as T;
}
