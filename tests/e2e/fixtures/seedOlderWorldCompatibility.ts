/** Run the prior trusted initializers in an empty, loopback-only compatibility run. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import {
  inventoryDigests,
  readWorldInventory,
  verifyOriginalWorld,
  type OriginalWorldExpectation,
} from '../../helpers/worldPreservation';

const projectId = 'demo-architect-review';
const owner = 'zero_billing_owner';
const fixtures = [
  {
    commit: '3d58931d0e8770a33a1d6c400883873f458752d0',
    worldId: 'compat-historical',
    season: '2025-26',
    teams: 0,
    entitlements: 0,
  },
  {
    commit: '907e2b56f4710572de3de7457df096d0ed23f35b',
    worldId: 'compat-pre-b5',
    season: '2026-27',
    teams: 30,
    entitlements: 240,
  },
] as const;
const financialPin =
  '577df3452b1c54cfcd80d14d96f7b1adb35dff2c967bf386c7171190eee05419';
const draftPin =
  '80db88485241f511f8a3f2ab1c9229fdee8802994ba0835e020b20373aa652c8';
const archivePin =
  'f4131c0c951d8e04a1a392b22c05f5d5a9a2991e4b36ae3b406d20c08e33dd66';

async function main() {
  if (
    process.env.GCLOUD_PROJECT !== projectId ||
    process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8082' ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099' ||
    process.env.VERCEL_ENV
  )
    throw new Error(
      'Compatibility fixtures require the isolated local demo emulators.'
    );

  const invocation = process.argv[2];
  if (invocation) {
    const fixture = fixtures.find(({ worldId }) => worldId === invocation);
    if (!fixture) throw new Error('Unknown older-world fixture.');
    const { initializeArchitectWorld } = createRequire(import.meta.url)(
      resolve('functions/src/architect/initializeWorld.ts')
    );
    await initializeArchitectWorld.run({
      auth: { uid: owner },
      data: {
        worldId: fixture.worldId,
        worldName: fixture.worldId,
        userId: owner,
        currentSeason: fixture.season,
      },
    });
    return;
  }

  const root = resolve('.scoutzero-dev/starting-data');
  const sha256 = (bytes: Buffer) =>
    createHash('sha256').update(bytes).digest('hex');
  const archive = resolve(root, 'current-recovery.tar.xz');
  const financial = resolve(
    '.scoutzero-dev/world-packages/financial-current-v4.json'
  );
  if (
    sha256(readFileSync(archive)) !== archivePin ||
    sha256(readFileSync(financial)) !== financialPin
  )
    throw new Error(
      'Compatibility inputs do not match the accepted package pins.'
    );
  const draft = execFileSync('tar', [
    '-xJOf',
    archive,
    'current-season-v1/window-fixed/draft-candidate.json',
  ]);
  if (sha256(draft) !== draftPin)
    throw new Error('Wrong pre-B5 draft package.');
  const draftFile = resolve(root, 'compat-pre-b5-draft.json');
  writeFileSync(draftFile, draft, { mode: 0o600 });

  const app = initializeApp({ projectId });
  const db = getFirestore(app);
  if (
    !(
      await db
        .collection('architect_worlds')
        .where('createdBy', '==', owner)
        .limit(1)
        .get()
    ).empty
  )
    throw new Error('Start with fresh compatibility emulator data.');
  const auth = getAuth(app);
  await auth.getUser(owner).catch((error) => {
    if (error.code !== 'auth/user-not-found') throw error;
    return auth.createUser({
      uid: owner,
      email: 'zero-billing-owner@example.test',
      password: 'local-proof-only-password',
    });
  });
  const manifests: OriginalWorldExpectation[] = [];
  const functionsModules = resolve('functions/node_modules');
  const tsx = resolve('node_modules/tsx/dist/loader.mjs');
  const script = fileURLToPath(import.meta.url);
  // Pass only loopback emulator configuration and the older package paths to the old code.
  const env = {
    PATH: process.env.PATH,
    GCLOUD_PROJECT: projectId,
    FUNCTIONS_EMULATOR: 'true',
    FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST,
    FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST,
  };
  for (const fixture of fixtures) {
    const checkout = mkdtempSync(resolve(root, 'older-code-'));
    const source = execFileSync(
      'git',
      [
        'archive',
        fixture.commit,
        'functions/package.json',
        'functions/src',
        'public/architect/contract-source-releases',
      ],
      { maxBuffer: 32 * 1024 * 1024 }
    );
    execFileSync('tar', ['-x', '-C', checkout], { input: source });
    symlinkSync(
      functionsModules,
      resolve(checkout, 'functions/node_modules'),
      'dir'
    );
    const assets = resolve(checkout, 'functions/src/architect/assets');
    mkdirSync(assets, { recursive: true });
    cpSync(
      resolve(checkout, 'public/architect/contract-source-releases'),
      assets,
      { recursive: true }
    );
    execFileSync(process.execPath, ['--import', tsx, script, fixture.worldId], {
      cwd: checkout,
      env: fixture.entitlements
        ? {
            ...env,
            SCOUTZERO_SIMULATION_FINANCIAL_FILE: financial,
            SCOUTZERO_SIMULATION_FINANCIAL_SHA256: financialPin,
            SCOUTZERO_SIMULATION_DRAFT_FILE: draftFile,
            SCOUTZERO_SIMULATION_DRAFT_SHA256: draftPin,
          }
        : env,
      stdio: 'inherit',
    });
    const inventory = await readWorldInventory(
      db.collection('architect_worlds').doc(fixture.worldId)
    );
    const metadata = inventory['.'];
    if (
      metadata.createdBy !== owner ||
      metadata.currentSeason !== fixture.season ||
      Object.keys(inventory).filter((path) =>
        /^entitlements\/[^/]+$/.test(path)
      ).length !== fixture.entitlements
    )
      throw new Error('Unexpected older-world membership or metadata.');
    const expected: OriginalWorldExpectation = {
      worldId: fixture.worldId,
      identity: {
        createdBy: owner,
        currentSeason: fixture.season,
        asOfDate: metadata.asOfDate as string,
        contractSourceRelease:
          metadata.contractSourceRelease as OriginalWorldExpectation['identity']['contractSourceRelease'],
        draftBaseline: metadata.draftBaseline ?? null,
        simulationFinancialBaseline:
          metadata.simulationFinancialBaseline ?? null,
      },
      documents: inventoryDigests(inventory),
    };
    verifyOriginalWorld(expected, inventory, fixture.teams);
    manifests.push(expected);
  }
  const manifest = resolve(root, 'older-world-compatibility.json');
  const bytes = JSON.stringify(manifests);
  writeFileSync(manifest, bytes, { flag: 'wx', mode: 0o600 });
  writeFileSync(`${manifest}.sha256`, `${sha256(Buffer.from(bytes))}\n`, {
    flag: 'wx',
    mode: 0o600,
  });
  console.log('Created and pinned two older-world compatibility fixtures.');
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : 'Older-world fixture creation failed.'
  );
  process.exitCode = 1;
});
