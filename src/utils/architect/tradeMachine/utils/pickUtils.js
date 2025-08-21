export function isMeaningfulProtection(protection) {
  if (!protection) return false;
  // Consider a pick meaningfully protected if it has conditions that could
  // reasonably prevent conveyance in the intended year
  return protection.some((p) => p.comparison === '<' && p.value >= 8);
}
