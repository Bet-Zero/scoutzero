function dateOnly(value: string): string | null {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

function exactInstant(value: string): number | null {
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Shared writer/reload interpretation for Trade Machine apron dates.
 * Persisted date-only evidence remains unchanged; only governed-season lookup
 * receives the writer's deterministic noon-UTC envelope instant.
 */
export function normalizeTradeApronEnvelopeDate(
  value: string
): string | null {
  if (exactInstant(value) !== null) return value;
  const day = dateOnly(value);
  return day ? `${day}T12:00:00Z` : null;
}
