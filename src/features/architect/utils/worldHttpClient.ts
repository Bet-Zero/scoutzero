import { auth } from '@/firebaseConfig';

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
  const result: unknown = await response.json();
  if (
    !response.ok ||
    !result ||
    typeof result !== 'object' ||
    !('ok' in result) ||
    result.ok !== true
  ) {
    throw new Error(
      response.status === 429
        ? 'World creation limit reached. Your saved worlds are unchanged.'
        : 'World creation is unavailable. Your saved worlds are unchanged.'
    );
  }
}
