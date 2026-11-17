import { auth } from '@/firebaseConfig';

export class WorldHttpError extends Error {
  constructor(public readonly status: number) {
    super(
      status === 429
        ? 'World creation limit reached. Retry your pending creation later.'
        : 'World creation could not be confirmed. Retry your pending creation.'
    );
  }
}

/** Fixed same-origin transport; Trade Machine and Firestore persistence stay shared. */
export async function initializeWorldOverHttp(input: unknown): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('You must be logged in to create worlds');
  const response = await fetch('/api/architect/world', {
    method: 'POST',
    credentials: 'omit',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await user.getIdToken()}`,
    },
    body: JSON.stringify(input),
  });
  const result: unknown = await response.json().catch(() => null);
  if (
    !response.ok ||
    !result ||
    typeof result !== 'object' ||
    !('ok' in result) ||
    result.ok !== true
  ) {
    throw new WorldHttpError(response.ok ? 503 : response.status);
  }
}
