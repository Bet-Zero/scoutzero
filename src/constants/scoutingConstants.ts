export const TRAIT_ORDER = [
  'Shooting',
  'Passing',
  'Playmaking',
  'Rebounding',
  'Defense',
  'IQ',
  'Feel',
  'Energy',
] as const;

export type Trait = (typeof TRAIT_ORDER)[number];

export const DEFAULT_TRAITS = Object.fromEntries(
  TRAIT_ORDER.map((t) => [t, 0])
) as Record<Trait, number>;

export const getTraitColor = (rating: number): string => {
  if (rating >= 98) return '#13895b';
  if (rating >= 94) return '#369972';
  if (rating >= 91) return '#55b48f';
  if (rating >= 86) return '#6cbd9d';
  if (rating >= 80) return '#8bc8b0';
  if (rating >= 73) return '#bce6df';
  if (rating >= 66) return '#d9efe6';
  if (rating >= 56) return '#efd9d9';
  if (rating >= 46) return '#e6bcbc';
  if (rating >= 41) return '#c88b8b';
  if (rating >= 36) return '#bd6c6c';
  if (rating >= 26) return '#b45555';
  if (rating >= 16) return '#993636';
  return '#891313';
};
