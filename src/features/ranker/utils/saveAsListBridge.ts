type RankerListItem = string | { id?: string | null };

type ResolveFinalOrderParams = {
  adjustments?: RankerListItem[] | null;
  currentRanking?: RankerListItem[] | null;
};

type RankerListPayload = {
  playerOrder: string[];
  playerIds: string[];
  playerNotes: Record<string, string>;
  description: 'Created from Ranker';
};

type CreateListFn = (name: string, userId: string) => Promise<string>;
type SaveListFn = (
  listId: string,
  payload: RankerListPayload,
  userId: string
) => Promise<void>;

type CreateRankerListFromRankingParams = ResolveFinalOrderParams & {
  isOwner: boolean;
  userId?: string | null;
  sessionName?: string | null;
  poolIds?: RankerListItem[] | null;
  createListFn: CreateListFn;
  saveListFn: SaveListFn;
};

type CreateRankerListResult = {
  listId: string;
  listName: string;
};

const normalizePlayerIds = (
  items: RankerListItem[] | null | undefined
): string[] => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item.id === 'string') return item.id;
      return null;
    })
    .filter((id): id is string => Boolean(id));
};

const getErrorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

export const buildRankerListName = (
  sessionName: string | null | undefined
): string => {
  const date = new Date().toISOString().slice(0, 10);
  return `Ranker — ${sessionName || 'Ranking'} — ${date}`;
};

export const resolveFinalOrderIds = ({
  adjustments,
  currentRanking,
}: ResolveFinalOrderParams): string[] => {
  const adjustedIds = normalizePlayerIds(adjustments);
  if (adjustedIds.length > 0) return adjustedIds;
  return normalizePlayerIds(currentRanking);
};

export const createRankerListFromRanking = async ({
  isOwner,
  userId,
  sessionName,
  poolIds,
  adjustments,
  currentRanking,
  createListFn,
  saveListFn,
}: CreateRankerListFromRankingParams): Promise<CreateRankerListResult | null> => {
  if (!isOwner || !userId) return null;

  const normalizedPoolIds = normalizePlayerIds(poolIds);
  const finalOrderIds = resolveFinalOrderIds({ adjustments, currentRanking });
  const listName = buildRankerListName(sessionName);

  let listId: string;
  try {
    listId = await createListFn(listName, userId);
  } catch (err) {
    throw new Error(`Failed to create list: ${getErrorMessage(err)}`);
  }

  try {
    await saveListFn(
      listId,
      {
        playerOrder: finalOrderIds,
        playerIds: normalizedPoolIds,
        playerNotes: {},
        description: 'Created from Ranker',
      },
      userId
    );
  } catch (err) {
    throw new Error(`Failed to save list payload: ${getErrorMessage(err)}`);
  }

  return { listId, listName };
};
