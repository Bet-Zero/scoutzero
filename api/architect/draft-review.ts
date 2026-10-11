import type { IncomingMessage, ServerResponse } from 'node:http';
import { serveDraftReview } from '../../server/draftReview.js';

/** Vercel Node function; kept outside Vite's public/static asset graph. */
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
) {
  await serveDraftReview(req, res);
}
