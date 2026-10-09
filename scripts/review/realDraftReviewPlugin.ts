import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';
import { REAL_DRAFT_REVIEW_PIN } from '../../src/features/architect/utils/draftPickRealReviewPin';

/** Local read-only installation. Never bundles or serves raw Linear evidence. */
export function realDraftReviewPlugin(): Plugin {
  return {
    name: 'retained-draft-review',
    configureServer(server) {
      server.middlewares.use(
        '/api/architect/draft-review',
        async (req, res) => {
          res.setHeader('Cache-Control', 'no-store');
          const file = process.env.SCOUTZERO_DRAFT_REVIEW_RELEASE;
          if (req.method !== 'GET' || !file) {
            res.statusCode = file ? 405 : 404;
            res.end();
            return;
          }
          try {
            const bytes = await readFile(file);
            if (
              createHash('sha256').update(bytes).digest('hex') !==
              REAL_DRAFT_REVIEW_PIN.payloadSha256
            )
              throw new Error('Unrecognized release');
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(bytes);
          } catch {
            res.statusCode = 503;
            res.end();
          }
        }
      );
    },
  };
}
