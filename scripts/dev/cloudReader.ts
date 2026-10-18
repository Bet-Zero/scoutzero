/** Existing Firebase client or short-lived Google identity; never a production writer. */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { applicationDefault } from 'firebase-admin/app';
import { privateJson } from './cloudStorage.js';
import type { Getter } from './cloudData.js';

const SOURCE = 'https://firestore.googleapis.com/v1/projects/scoutzero-bf1ae/databases/(default)/documents/';
export function assertSourceRequest(url: string) {
  const parsed = new URL(url);
  if (!url.startsWith(SOURCE) || parsed.username || parsed.password || parsed.hash ||
      parsed.origin !== 'https://firestore.googleapis.com') throw new Error('Reader destination is not the fixed source');
  const bits = parsed.pathname.slice(new URL(SOURCE).pathname.length).split('/');
  const roots = ['players_v2', 'architect_basePlayers', 'architect_baseTeams', 'architect_baseEntitlements', 'architect_basePickRules'];
  if (bits.some((bit) => !bit || ['.', '..'].includes(bit) || /%2f|%5c|%2e/i.test(bit)) ||
      !((bits.length <= 2 && roots.includes(bits[0])) ||
        ([3, 4].includes(bits.length) && bits[0] === 'players_v2' && ['contracts', 'seasons', 'views'].includes(bits[2])))) throw new Error('Reader collection or document is not approved');
}

export async function retryRead(get: Getter, url: string, pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))) {
  assertSourceRequest(url);
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try { response = await get(url); }
    catch { if (attempt === 3) throw new Error('Source network request failed; prior baseline retained'); await pause(250 * 2 ** attempt); continue; }
    if (![408, 429, 500, 502, 503, 504].includes(response.status) || attempt === 3) return response;
    await response.body?.cancel();
    await pause(250 * 2 ** attempt);
  }
}

function bearerReader(token: () => Promise<string>): Getter {
  return (url) => retryRead(async (target) => fetch(target, {
    method: 'GET', redirect: 'error', headers: { Authorization: 'Bearer ' + await token() },
    signal: AbortSignal.timeout(30000),
  }), url);
}

export async function firebaseReader(configPath: string): Promise<Getter> {
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  if (config.projectId !== 'scoutzero-bf1ae' || typeof config.apiKey !== 'string' || !config.apiKey) {
    throw new Error('Firebase reader requires the existing project public client configuration');
  }
  const sessionFile = path.resolve('.scoutzero-dev/reader/firebase-session.json');
  let session: { refreshToken?: string; localId?: string; idToken?: string; expiresAt?: number } = {};
  try { session = JSON.parse(await readFile(sessionFile, 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Private reader session is invalid'); }
  let pending: Promise<string> | undefined;
  async function authenticate() {
    const refresh = !!session.refreshToken;
    const url = refresh ? 'https://securetoken.googleapis.com/v1/token' : 'https://identitytoolkit.googleapis.com/v1/accounts:signUp';
    const response = await fetch(url + '?key=' + encodeURIComponent(config.apiKey), {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: { 'content-type': refresh ? 'application/x-www-form-urlencoded' : 'application/json' },
      body: refresh ? new URLSearchParams({ grant_type: 'refresh_token', refresh_token: session.refreshToken! }) : JSON.stringify({ returnSecureToken: true }),
    }).catch(() => { throw new Error('Firebase reader authentication network failure'); });
    if (!response.ok) throw new Error('Firebase reader authentication failed: HTTP ' + response.status);
    const body = await response.json();
    const uid = refresh ? body.user_id : body.localId;
    if (session.localId && session.localId !== uid) throw new Error('Firebase reader identity changed');
    session = { localId: uid, idToken: refresh ? body.id_token : body.idToken,
      refreshToken: refresh ? body.refresh_token : body.refreshToken,
      expiresAt: Date.now() + Number(refresh ? body.expires_in : body.expiresIn) * 1000 };
    if (!session.idToken || !session.refreshToken || !Number.isFinite(session.expiresAt)) throw new Error('Invalid Firebase reader session response');
    await privateJson(sessionFile, session);
    return session.idToken;
  }
  const token = async () => {
    if (session.idToken && (session.expiresAt || 0) > Date.now() + 60000) return session.idToken;
    pending ??= authenticate().finally(() => { pending = undefined; });
    return pending;
  };
  await token();
  await privateJson(path.resolve('.scoutzero-dev/reader/public-config.json'), config);
  return bearerReader(token);
}

export async function googleReader(gcloud = false): Promise<Getter> {
  if (gcloud) {
    let token: string;
    try { token = execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
    catch { throw new Error('No existing short-lived gcloud reader is available; no login or key was created'); }
    if (!token) throw new Error('Existing gcloud reader returned no token');
    return bearerReader(async () => token);
  }
  const credential = applicationDefault();
  try { await credential.getAccessToken(); }
  catch { throw new Error('No configured Google read identity is usable in this executor; no service-account key or IAM grant was created'); }
  return bearerReader(async () => {
    const result = await credential.getAccessToken();
    if (!result.access_token) throw new Error('Google reader did not provide a short-lived token');
    return result.access_token;
  });
}
