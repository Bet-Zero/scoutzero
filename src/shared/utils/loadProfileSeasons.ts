/** Preserve stored records while keeping unqualified statistics out of profile display. */
import { SeasonDocZ, type SeasonDoc } from '@/schemas/players_v2';

export function loadProfileSeasons(documents: readonly { id: string; data: unknown }[]) {
  const seasons: Record<string, SeasonDoc> = {};
  const withheldIds: string[] = [];
  for (const document of documents) {
    const result = SeasonDocZ.safeParse(document.data);
    if (result.success) seasons[document.id] = result.data;
    else withheldIds.push(document.id);
  }
  return { seasons, withheldIds,
    warnings: withheldIds.length ? [`${withheldIds.length} season record${withheldIds.length === 1 ? '' : 's'} need${withheldIds.length === 1 ? 's' : ''} review. Statistics history may be incomplete.`] : [],
  };
}
