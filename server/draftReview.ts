import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  DRAFT_REVIEW_PROJECT_ID as PROJECT_ID,
  DRAFT_REVIEW_DOCUMENT,
  DRAFT_REVIEW_PART_COUNT,
  draftReviewPartDocument,
  verifyDraftReviewManifest,
  readDraftReviewPart,
  verifyDraftReviewBytes,
} from './draftReviewFirestore.js';

// Rejection filter only. Google's lookup below must still validate this exact
// token. The filter also prevents a misconfigured API key accepting another app.
function sessionSubject(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const claims = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8')
    );
    return claims.aud === PROJECT_ID &&
      claims.iss === `https://securetoken.google.com/${PROJECT_ID}` &&
      typeof claims.sub === 'string' &&
      claims.sub.length > 0 &&
      claims.sub.length <= 128
      ? claims.sub
      : null;
  } catch {
    return null;
  }
}

async function boundedBody(
  response: Response,
  maximum: number
): Promise<Buffer> {
  if (!response.ok || !response.body) throw new Error('Unavailable response');
  if (Number(response.headers.get('content-length')) > maximum) {
    await response.body.cancel();
    throw new Error('Response exceeds limit');
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) throw new Error('Response exceeds limit');
      chunks.push(value);
    }
    return Buffer.concat(chunks, size);
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

/** Runtime dependencies are server-owned; HTTP callers cannot supply them. */
export async function serveDraftReview(
  req: Pick<IncomingMessage, 'method' | 'headers'>,
  res: Pick<ServerResponse, 'setHeader' | 'end' | 'statusCode'>,
  env: NodeJS.ProcessEnv = process.env,
  request: typeof fetch = fetch
): Promise<void> {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('Vary', 'Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const finish = (status: number) => {
    res.statusCode = status;
    res.end();
  };
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    finish(405);
    return;
  }
  const authorization = req.headers.authorization;
  if (!authorization || !/^Bearer [^\s]{1,8192}$/.test(authorization)) {
    finish(401);
    return;
  }
  const subject = sessionSubject(authorization.slice(7));
  if (!subject) {
    finish(401);
    return;
  }
  try {
    const apiKey = env.VITE_FIREBASE_API_KEY;
    if (!apiKey || env.VITE_FIREBASE_PROJECT_ID !== PROJECT_ID)
      throw new Error('Hosted review is not configured');

    // Google's project-keyed lookup validates the existing Firebase ID token.
    // Never consult emulator variables or accept a locally decoded JWT as proof.
    const account = await request(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: authorization.slice(7) }),
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      }
    );
    if (
      account.status === 400 ||
      account.status === 401 ||
      account.status === 403
    ) {
      finish(401);
      return;
    }
    const decoded: unknown = JSON.parse(
      (await boundedBody(account, 65536)).toString('utf8')
    );
    const users =
      decoded && typeof decoded === 'object' && 'users' in decoded
        ? decoded.users
        : null;
    if (
      !Array.isArray(users) ||
      users.length !== 1 ||
      typeof users[0]?.localId !== 'string' ||
      users[0].localId !== subject ||
      users[0].disabled === true
    ) {
      finish(401);
      return;
    }

    // Use the caller's Firebase session: Firestore rules remain authoritative.
    // No service/admin credential, provider URL, emulator or mutable latest alias.
    const readDocument = async (name: string, limit: number) => {
      const response = await request(
        `https://firestore.googleapis.com/v1/${name}`,
        {
          method: 'GET',
          headers: { Authorization: authorization },
          redirect: 'error',
          cache: 'no-store',
          signal: AbortSignal.timeout(10000),
        }
      );
      return JSON.parse(
        (await boundedBody(response, limit)).toString('utf8')
      ) as unknown;
    };
    verifyDraftReviewManifest(await readDocument(DRAFT_REVIEW_DOCUMENT, 16384));
    const parts = await Promise.all(
      Array.from({ length: DRAFT_REVIEW_PART_COUNT }, async (_, index) =>
        readDraftReviewPart(
          await readDocument(draftReviewPartDocument(index), 750000),
          index
        )
      )
    );
    const bytes = Buffer.concat(parts);
    verifyDraftReviewBytes(bytes);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(bytes);
  } catch {
    // Do not leak credentials, private locations, upstream bodies, or errors.
    finish(503);
  }
}
