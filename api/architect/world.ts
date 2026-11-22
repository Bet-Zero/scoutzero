import type { IncomingMessage, ServerResponse } from 'node:http';
import { serveArchitectWorld } from '../../server/architectWorld';

/** Adapter only; initialization/admission are independent of Vercel. */
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
) {
  await serveArchitectWorld(req, res);
}
