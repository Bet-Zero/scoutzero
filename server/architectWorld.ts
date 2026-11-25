/** HTTP adapter for the existing initializer. Closed unless explicitly configured. */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import {
  initializeApp,
  getApps,
  applicationDefault,
  cert,
} from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import {
  getFirestore,
  FieldValue,
  type Firestore,
} from 'firebase-admin/firestore';
import {
  initializeArchitectWorldService,
  type InitializeArchitectWorldRequest,
} from '../functions/src/architect/initializeWorldService.js';
import {
  CURRENT_WORLD_PACKAGES,
  readPrivateWorldPackages,
  httpRetainedContractRegistry,
} from '../functions/src/architect/privateWorldPackages.js';
import { canonicalStringify } from '../functions/src/architect/trustedContractBaseline.js';
import {
  reserveWorldInitialization,
  finishWorldInitialization,
  WorldAdmissionError,
  assertWorldInitializationLease,
} from '../functions/src/architect/worldAdmission.js';

import {
  removeArchitectWorld,
  type RemovalInput,
  type WorldTreePager,
} from '../functions/src/architect/worldLifecycle.js';
import { createWorldTreePager } from './worldTreePager.js';

type Request = Pick<
  IncomingMessage,
  'method' | 'headers' | typeof Symbol.asyncIterator
> & { body?: unknown };
type Response = Pick<ServerResponse, 'setHeader' | 'end' | 'statusCode'>;
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const LOOPBACK = /^127\.0\.0\.1:\d+$/;
const VERCEL_HOST = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.vercel\.app$/;

export function worldHttpConfiguration(env: NodeJS.ProcessEnv) {
  if (env.SCOUTZERO_WORLD_HTTP_ENABLED !== 'true') return null;
  const local = env.SCOUTZERO_WORLD_LOCAL_PROOF === 'true' && !env.VERCEL_ENV;
  const preview = env.SCOUTZERO_WORLD_PROTECTED_PREVIEW === 'true';
  const previewHost = preview ? (env.VERCEL_URL ?? '') : undefined;
  if (local) {
    if (
      preview ||
      env.GCLOUD_PROJECT !== 'demo-architect-review' ||
      !LOOPBACK.test(env.FIRESTORE_EMULATOR_HOST ?? '') ||
      !LOOPBACK.test(env.FIREBASE_AUTH_EMULATOR_HOST ?? '')
    )
      throw new Error('Invalid isolated proof environment.');
  } else if (
    env.GCLOUD_PROJECT !== 'scoutzero-bf1ae' ||
    env.FIRESTORE_EMULATOR_HOST ||
    env.FIREBASE_AUTH_EMULATOR_HOST ||
    env.FUNCTIONS_EMULATOR ||
    env.SCOUTZERO_WORLD_LOCAL_PROOF ||
    (preview
      ? env.VERCEL !== '1' ||
        env.VERCEL_ENV !== 'preview' ||
        env.VERCEL_TARGET_ENV !== 'preview' ||
        !VERCEL_HOST.test(previewHost!) ||
        previewHost === env.VERCEL_PROJECT_PRODUCTION_URL ||
        Boolean(env.SCOUTZERO_WORLD_ORIGIN)
      : env.VERCEL_ENV !== 'production')
  ) {
    throw new Error('World HTTP runtime is not authorized.');
  }
  const owner = env.SCOUTZERO_WORLD_OWNER_UID ?? '';
  const origin = previewHost
    ? `https://${previewHost}`
    : (env.SCOUTZERO_WORLD_ORIGIN ?? '');
  if (
    !ID.test(owner) ||
    (!local && !origin.startsWith('https://')) ||
    new URL(origin).origin !== origin
  )
    throw new Error('Owner/origin configuration is missing.');
  return { local, owner, origin, previewHost, projectId: env.GCLOUD_PROJECT! };
}

function previewServiceAccount(value: string | undefined, projectId: string) {
  const key = JSON.parse(value ?? 'null');
  if (
    key?.type !== 'service_account' ||
    key.project_id !== projectId ||
    typeof key.client_email !== 'string' ||
    !key.client_email.endsWith(`@${projectId}.iam.gserviceaccount.com`) ||
    typeof key.private_key !== 'string' ||
    !key.private_key.startsWith('-----BEGIN PRIVATE KEY-----')
  )
    throw new Error('Preview service identity is invalid.');
  return {
    client_email: key.client_email as string,
    private_key: key.private_key as string,
  };
}

export type WorldHttpDependencies = {
  db: Firestore;
  verifyToken: (token: string) => Promise<DecodedIdToken>;
  packages: () => ReturnType<typeof readPrivateWorldPackages>;
  now?: () => number;
  pager?: WorldTreePager;
};

async function readInput(
  req: Request
): Promise<InitializeArchitectWorldRequest | RemovalInput> {
  let body = req.body;
  if (body === undefined) {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.length;
      if (size > 8192) throw new WorldAdmissionError(413, 'request-too-large');
      chunks.push(bytes);
    }
    body = Buffer.concat(chunks).toString('utf8');
  }
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (typeof body === 'string') {
    if (Buffer.byteLength(body) > 8192)
      throw new WorldAdmissionError(413, 'request-too-large');
    body = JSON.parse(body);
  }
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Buffer.byteLength(JSON.stringify(body)) > 8192
  )
    throw new WorldAdmissionError(400, 'invalid-request');
  const data = body as Record<string, unknown>;
  if (data.operation !== undefined) {
    if (
      !['delete', 'cleanup'].includes(data.operation as string) ||
      Object.keys(data).some(
        (key) =>
          !['operation', 'worldId', 'userId', 'expectedParentWorldId'].includes(
            key
          )
      ) ||
      typeof data.worldId !== 'string' ||
      !ID.test(data.worldId) ||
      (data.expectedParentWorldId !== undefined &&
        (typeof data.expectedParentWorldId !== 'string' ||
          !ID.test(data.expectedParentWorldId)))
    )
      throw new WorldAdmissionError(400, 'invalid-request');
    return data as RemovalInput;
  }
  const allowed = [
    'worldId',
    'worldName',
    'description',
    'userId',
    'currentSeason',
    'parentWorldId',
    'expectedParentDraftRevision',
  ];
  if (
    Object.keys(data).some((key) => !allowed.includes(key)) ||
    typeof data.worldId !== 'string' ||
    !ID.test(data.worldId) ||
    typeof data.worldName !== 'string' ||
    !data.worldName.trim() ||
    data.worldName.length > 120 ||
    (data.description !== undefined &&
      (typeof data.description !== 'string' || data.description.length > 2000))
  )
    throw new WorldAdmissionError(400, 'invalid-request');
  return data as InitializeArchitectWorldRequest;
}

/** Dependencies belong to the server process and cannot be supplied by HTTP callers. */
export function createArchitectWorldHandler(
  dependencies: WorldHttpDependencies,
  env: NodeJS.ProcessEnv
) {
  let pager = dependencies.pager;
  return async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
    res.setHeader('Vary', 'Authorization');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const reply = (status: number, body: object) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(body));
    };
    try {
      const config = worldHttpConfiguration(env);
      if (!config) {
        reply(404, { error: 'unavailable' });
        return;
      }
      if (config.previewHost && req.headers.host !== config.previewHost) {
        reply(404, { error: 'unavailable' });
        return;
      }
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        reply(405, { error: 'method-not-allowed' });
        return;
      }
      if (
        (req.headers.origin && req.headers.origin !== config.origin) ||
        !/^application\/json(?:;|$)/i.test(req.headers['content-type'] ?? '')
      ) {
        reply(403, { error: 'request-not-allowed' });
        return;
      }
      const bearer = req.headers.authorization;
      if (!bearer || !/^Bearer [^\s]{1,8192}$/.test(bearer)) {
        reply(401, { error: 'authentication-required' });
        return;
      }
      let user: DecodedIdToken;
      try {
        user = await dependencies.verifyToken(bearer.slice(7));
      } catch {
        reply(401, { error: 'authentication-required' });
        return;
      }
      if (
        user.uid !== config.owner ||
        user.firebase.sign_in_provider === 'anonymous' ||
        user.aud !== config.projectId ||
        user.iss !== `https://securetoken.google.com/${config.projectId}`
      ) {
        reply(403, { error: 'owner-admission-required' });
        return;
      }
      let data: InitializeArchitectWorldRequest | RemovalInput;
      try {
        data = await readInput(req);
      } catch (e) {
        if (e instanceof WorldAdmissionError) throw e;
        throw new WorldAdmissionError(400, 'invalid-request');
      }
      if (data.userId !== user.uid) {
        reply(403, { error: 'owner-mismatch' });
        return;
      }
      const ownerPreview = Boolean(config.previewHost);
      if ('operation' in data) {
        const result = await removeArchitectWorld(
          dependencies.db,
          data,
          (pager ??= createWorldTreePager(
            config.projectId,
            config.local ? env.FIRESTORE_EMULATOR_HOST : undefined
          )),
          dependencies.now ?? Date.now,
          ownerPreview
        );
        reply(200, { ok: true, worldId: data.worldId, ...result });
        return;
      }
      const packages = dependencies.packages(); // Corrupt/missing packages cause no admission or world writes.
      const hash = createHash('sha256')
        .update(canonicalStringify(data))
        .digest('hex');
      const reservation = await reserveWorldInitialization(
        dependencies.db,
        user.uid,
        data.worldId,
        hash,
        (dependencies.now ?? Date.now)(),
        data.parentWorldId ?? null,
        ownerPreview
      );
      if (!reservation.replay) {
        try {
          await initializeArchitectWorldService(
            dependencies.db,
            { data, auth: { uid: user.uid } },
            {
              loadFinancial: async () => packages.financial,
              loadDraft: async () => packages.draft,
              loadTrustedDraft: () => null,
              loadRetained: (pin) =>
                pin
                  ? httpRetainedContractRegistry.load(pin)
                  : httpRetainedContractRegistry.loadDefault(),
              financialSha256: CURRENT_WORLD_PACKAGES.financial.sha256,
              ownerPreview,
              serverTimestamp: () => FieldValue.serverTimestamp(),
              commitWrites: async (build) => {
                await dependencies.db.runTransaction(async (tx) => {
                  await assertWorldInitializationLease(
                    dependencies.db,
                    tx,
                    data.worldId,
                    reservation.lease!,
                    (dependencies.now ?? Date.now)()
                  );
                  build(tx);
                });
              },
            }
          );
          await finishWorldInitialization(
            dependencies.db,
            data.worldId,
            'complete',
            reservation.lease
          ).catch(() => {}); // The service already confirmed the atomic root commit.
        } catch (error) {
          // A committed world is authoritative even if its response/status update was lost.
          // Pending claims fail closed when quota prevents recording failure.
          await finishWorldInitialization(
            dependencies.db,
            data.worldId,
            'failed',
            reservation.lease
          ).catch(() => {});
          throw error;
        }
      }
      reply(200, { ok: true, worldId: data.worldId });
    } catch (error) {
      if (error instanceof WorldAdmissionError) {
        if (error.status === 429) res.setHeader('Retry-After', '60');
        reply(error.status, { error: error.code });
      } else {
        reply(503, { error: 'world-service-unavailable' });
      }
    }
  };
}

let runtime: ReturnType<typeof createArchitectWorldHandler> | undefined;
export async function serveArchitectWorld(req: Request, res: Response) {
  const env = process.env;
  try {
    const config = worldHttpConfiguration(env);
    if (!config) {
      res.statusCode = 404;
      res.end();
      return;
    }
    if (!runtime) {
      const name = 'architect-world-http';
      const key = config.previewHost
        ? previewServiceAccount(
            env.SCOUTZERO_WORLD_GOOGLE_CREDENTIALS,
            config.projectId
          )
        : undefined;
      const app =
        getApps().find((a) => a.name === name) ??
        initializeApp(
          {
            projectId: config.projectId,
            ...(config.local
              ? {}
              : {
                  credential: key
                    ? cert({
                        projectId: config.projectId,
                        clientEmail: key.client_email,
                        privateKey: key.private_key,
                      })
                    : applicationDefault(),
                }),
          },
          name
        );
      let packages: ReturnType<typeof readPrivateWorldPackages> | undefined;
      runtime = createArchitectWorldHandler(
        {
          db: getFirestore(app),
          verifyToken: (token) => getAuth(app).verifyIdToken(token, true),
          ...(key
            ? { pager: createWorldTreePager(config.projectId, undefined, key) }
            : {}),
          packages: () =>
            (packages ??= readPrivateWorldPackages(
              env.SCOUTZERO_WORLD_PACKAGE_DIRECTORY ?? ''
            )),
        },
        env
      );
    }
    await runtime(req, res);
  } catch {
    res.statusCode = 503;
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ error: 'world-service-unavailable' }));
  }
}
