/** Durable browser request identity. No tokens or source packages are stored here. */
export type PendingWorldCreation = {
  worldId: string;
  worldName: string;
  description: string;
  userId: string;
  currentSeason: string | null;
  parentWorldId: null;
};

const key = (uid: string) => `architect.pendingWorldCreation.${uid}`;
const unavailable = () =>
  new Error(
    'World creation recovery is unavailable in this browser. No new request was started.'
  );

function storage(): Storage {
  try {
    return window.localStorage;
  } catch {
    throw unavailable();
  }
}

function parseRequest(raw: string, uid: string): PendingWorldCreation {
  try {
    const saved = JSON.parse(raw);
    const p = saved?.request;
    if (
      saved.version !== 1 ||
      !p ||
      p.userId !== uid ||
      typeof p.worldId !== 'string' ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(p.worldId) ||
      typeof p.worldName !== 'string' ||
      !p.worldName.trim() ||
      p.worldName.length > 120 ||
      typeof p.description !== 'string' ||
      p.description.length > 2000 ||
      !(
        p.currentSeason === null ||
        (typeof p.currentSeason === 'string' &&
          /^\d{4}-\d{2}$/.test(p.currentSeason))
      ) ||
      p.parentWorldId !== null ||
      Object.keys(p).sort().join() !==
        'currentSeason,description,parentWorldId,userId,worldId,worldName'
    ) {
      throw unavailable();
    }
    return p as PendingWorldCreation;
  } catch {
    throw unavailable();
  }
}

export function readPendingWorldCreation(
  uid: string
): PendingWorldCreation | null {
  try {
    const raw = storage().getItem(key(uid));
    return raw === null ? null : parseRequest(raw, uid);
  } catch {
    throw unavailable();
  }
}

export function retainWorldCreation(request: PendingWorldCreation): void {
  try {
    const raw = JSON.stringify({ version: 1, request });
    parseRequest(raw, request.userId);
    storage().setItem(key(request.userId), raw);
    if (storage().getItem(key(request.userId)) !== raw) throw unavailable();
  } catch {
    throw unavailable();
  }
}

/** Call only after the UI's active-world owner has selected this exact world. */
export function acknowledgeWorldCreation(uid: string, worldId: string): void {
  if (readPendingWorldCreation(uid)?.worldId === worldId) {
    storage().removeItem(key(uid));
  }
}

/** Web Locks serialize same-owner operations across tabs as well as in one page. */
export async function withWorldCreationLock<T>(
  uid: string,
  run: () => Promise<T>
): Promise<T> {
  if (typeof navigator === 'undefined' || !navigator.locks) throw unavailable();
  return navigator.locks.request(key(uid), run);
}
