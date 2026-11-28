/** HTTP adapter for the existing initializer. Closed unless explicitly configured. */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import {
  initializeApp,
  getApps,
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
  WorldInitializationError,
  type InitializeArchitectWorldRequest,
} from '../functions/src/architect/initializeWorldService.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  canonicalStringify,
  DEFAULT_TRUSTED_CONTRACT_RELEASE,
  RETAINED_TRUSTED_CONTRACT_RELEASES,
  TrustedContractReleaseRegistry,
} from '../functions/src/architect/trustedContractBaseline.js';
import {
  PRIVATE_PACKAGES_COLLECTION,
  readSimulationPackageBytes,
  type SimulationPackageKind,
} from '../functions/src/architect/simulationPackageSource.js';
import { parseSimulationFinancialBaseline } from '../functions/src/architect/simulationFinancialBaseline.js';
import { parseSimulationDraftBaseline } from '../functions/src/architect/simulationDraftBaseline.js';
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
const PROJECT_ID = 'scoutzero-bf1ae';
const LOCAL_PROJECT_ID = 'demo-architect-review';
const SHA256 = /^[0-9a-f]{64}$/;

const retainedContracts = new TrustedContractReleaseRegistry({
  releases: RETAINED_TRUSTED_CONTRACT_RELEASES,
  defaultRelease: DEFAULT_TRUSTED_CONTRACT_RELEASE,
  readArtifact: ({ filename }) =>
    readFileSync(resolve('public/architect/contract-source-releases', filename)),
});

export function worldHttpConfiguration(env: NodeJS.ProcessEnv) {
  if (env.SCOUTZERO_WORLD_HTTP_ENABLED !== 'true') return null;
  const local = env.SCOUTZERO_WORLD_LOCAL_PROOF === 'true' && !env.VERCEL_ENV;
  const projectId = local ? LOCAL_PROJECT_ID : PROJECT_ID;
  if (
    env.GCLOUD_PROJECT !== projectId ||
    (local
      ? !LOOPBACK.test(env.FIRESTORE_EMULATOR_HOST ?? '') ||
        !LOOPBACK.test(env.FIREBASE_AUTH_EMULATOR_HOST ?? '')
      : env.VERCEL !== '1' ||
        env.VERCEL_ENV !== 'production' ||
        Boolean(env.FIRESTORE_EMULATOR_HOST || env.FIREBASE_AUTH_EMULATOR_HOST ||
          env.FUNCTIONS_EMULATOR || env.SCOUTZERO_WORLD_LOCAL_PROOF))
  ) {
    throw new Error('World HTTP runtime is not authorized.');
  }
  const origin = new URL(env.SCOUTZERO_WORLD_ORIGIN ?? '');
  if (
    origin.origin !== env.SCOUTZERO_WORLD_ORIGIN ||
    (local ? origin.protocol !== 'http:' || !LOOPBACK.test(origin.host) : origin.protocol !== 'https:') ||
    env.SCOUTZERO_SIMULATION_LIVE !== 'true' ||
    env.SCOUTZERO_SIMULATION_PACKAGE_SOURCE !== 'firestore' ||
    !SHA256.test(env.SCOUTZERO_SIMULATION_FINANCIAL_SHA256 ?? '') ||
    !SHA256.test(env.SCOUTZERO_SIMULATION_DRAFT_SHA256 ?? '')
  ) {
    throw new Error('World HTTP runtime configuration is incomplete.');
  }
  return { local, origin, projectId };
}

function serviceAccount(value: string | undefined, projectId: string) {
  const key = JSON.parse(value ?? 'null');
  if (
    key?.type !== 'service_account' ||
    key.project_id !== projectId ||
    typeof key.client_email !== 'string' ||
    !key.client_email.endsWith(`@${projectId}.iam.gserviceaccount.com`) ||
    typeof key.private_key !== 'string' ||
    !key.private_key.startsWith('-----BEGIN PRIVATE KEY-----')
  )
    throw new Error('World service identity is invalid.');
  return {
    client_email: key.client_email as string,
    private_key: key.private_key as string,
  };
}

function packageLoader(db: Firestore, env: NodeJS.ProcessEnv) {
  return async (kind: SimulationPackageKind) => {
    const bytes = await readSimulationPackageBytes(
      kind,
      undefined,
      async (id) => (await db.collection(PRIVATE_PACKAGES_COLLECTION).doc(id).get()).data()?.brotli,
      env
    );
    if (!bytes) throw new Error('Runtime package unavailable.');
    return bytes;
  };
}

export type WorldHttpDependencies = {
  db: Firestore;
  verifyToken: (token: string) => Promise<DecodedIdToken>;
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
    (data.parentWorldId != null &&
      (typeof data.parentWorldId !== 'string' ||
        !ID.test(data.parentWorldId) ||
        data.parentWorldId === data.worldId)) ||
    (data.currentSeason != null &&
      (typeof data.currentSeason !== 'string' ||
        !/^\d{4}-\d{2}$/.test(data.currentSeason) ||
        data.parentWorldId != null)) ||
    (data.expectedParentDraftRevision != null &&
      (!Number.isSafeInteger(data.expectedParentDraftRevision) ||
        Number(data.expectedParentDraftRevision) < 0)) ||
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
  const loadPackage = packageLoader(dependencies.db, env);
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
      if (req.headers.host !== config.origin.host) {
        reply(404, { error: 'unavailable' });
        return;
      }
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        reply(405, { error: 'method-not-allowed' });
        return;
      }
      if (
        (req.headers.origin && req.headers.origin !== config.origin.origin) ||
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
        !ID.test(user.uid) ||
        user.firebase.sign_in_provider === 'anonymous' ||
        user.aud !== config.projectId ||
        user.iss !== `https://securetoken.google.com/${config.projectId}`
      ) {
        reply(403, { error: 'account-not-eligible' });
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
      if ('operation' in data) {
        const result = await removeArchitectWorld(
          dependencies.db,
          data,
          (pager ??= createWorldTreePager(
            config.projectId,
            config.local ? env.FIRESTORE_EMULATOR_HOST : undefined
          )),
          dependencies.now ?? Date.now
        );
        reply(200, { ok: true, worldId: data.worldId, ...result });
        return;
      }
      const hash = createHash('sha256')
        .update(canonicalStringify(data))
        .digest('hex');
      const reservation = await reserveWorldInitialization(
        dependencies.db,
        user.uid,
        data.worldId,
        hash,
        (dependencies.now ?? Date.now)(),
        data.parentWorldId ?? null
      );
      if (!reservation.replay) {
        try {
          await initializeArchitectWorldService(
            dependencies.db,
            { data, auth: { uid: user.uid } },
            {
              loadFinancial: async () => parseSimulationFinancialBaseline(await loadPackage('financial')),
              loadDraft: async () => parseSimulationDraftBaseline(await loadPackage('draft')),
              loadFixtureDraft: () => null,
              loadRetained: (pin) =>
                pin ? retainedContracts.load(pin) : retainedContracts.loadDefault(),
              financialSha256: env.SCOUTZERO_SIMULATION_FINANCIAL_SHA256,
              worldLifecycleVersion: 1,
              serverTimestamp: () => FieldValue.serverTimestamp(),
              commitWrites: async (build) => {
                await dependencies.db.runTransaction(async (tx) => {
                  await assertWorldInitializationLease(
                    dependencies.db,
                    tx,
                    data.worldId,
                    reservation.lease,
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
      } else if (error instanceof WorldInitializationError) {
        const statuses = {
          'unauthenticated': 401,
          'permission-denied': 403,
          'invalid-argument': 400,
          'not-found': 404,
          'failed-precondition': 409,
          'aborted': 409,
          'already-exists': 409,
        } as const;
        reply(statuses[error.code], { error: error.code });
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
      const key = config.local
        ? undefined
        : serviceAccount(env.SCOUTZERO_WORLD_GOOGLE_CREDENTIALS, config.projectId);
      const app =
        getApps().find((a) => a.name === name) ??
        initializeApp(
          {
            projectId: config.projectId,
            ...(key ? {
              credential: cert({
                projectId: config.projectId,
                clientEmail: key.client_email,
                privateKey: key.private_key,
              }),
            } : {}),
          },
          name
        );
      runtime = createArchitectWorldHandler(
        {
          db: getFirestore(app),
          verifyToken: (token) => getAuth(app).verifyIdToken(token, true),
          ...(key
            ? { pager: createWorldTreePager(config.projectId, undefined, key) }
            : {}),
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
