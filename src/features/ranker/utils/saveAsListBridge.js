const normalizePlayerIds = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item.id === 'string') return item.id;
      return null;
    })
    .filter(Boolean);
};

export const buildRankerListName = (sessionName) => {
  const date = new Date().toISOString().slice(0, 10);
  return `Ranker — ${sessionName || 'Ranking'} — ${date}`;
};

export const resolveFinalOrderIds = ({ adjustments, currentRanking }) => {
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
}) => {
  if (!isOwner || !userId) return null;

  const normalizedPoolIds = normalizePlayerIds(poolIds);
  const finalOrderIds = resolveFinalOrderIds({ adjustments, currentRanking });
  const listName = buildRankerListName(sessionName);

  let listId;
  try {
    listId = await createListFn(listName, userId);
  } catch (err) {
    throw new Error(`Failed to create list: ${err?.message || err}`);
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
    throw new Error(`Failed to save list payload: ${err?.message || err}`);
  }

  return { listId, listName };
};
