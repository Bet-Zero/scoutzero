import { describe, expect, it } from 'vitest';
import {
  hostedPreviewOrigin,
  hostedRequestPolicy,
  originScopedHeaders,
  continueHostedRequest,
} from '../../scripts/architect/hostedDraftReviewPolicy';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { chromium, type Browser } from 'playwright';
import fs from 'node:fs';

const origin =
  'https://scoutzero-i57k4xfum-brents-projects-686e97fc.vercel.app';
describe('hosted browser proof security boundary', () => {
  it('accepts only a deployment origin for this ScoutZero project', () => {
    expect(hostedPreviewOrigin(origin)).toBe(origin);
    for (const value of [
      origin + '/api',
      origin + '?token=private',
      origin + '#x',
      origin.replace('https:', 'http:'),
      origin.replace('scoutzero-', 'other-'),
      'https://scoutzero.vercel.app',
      'https://attacker.example',
      'https://user:password@' + origin.slice(8),
    ])
      expect(() => hostedPreviewOrigin(value)).toThrow();
  });
  it('strips any inherited protection credential on all other origins', () => {
    const headers = {
      'X-Vercel-Trusted-OIDC-IdP-Token': 'old',
      'x-vercel-protection-bypass': 'old-secret',
      authorization: 'Bearer firebase-session',
    };
    expect(
      originScopedHeaders(
        origin + '/api/architect/draft-review',
        headers,
        origin,
        'fresh'
      )
    ).toEqual({
      authorization: headers.authorization,
      'x-vercel-trusted-oidc-idp-token': 'fresh',
    });
    for (const other of [
      'https://identitytoolkit.googleapis.com',
      origin + '.attacker.example',
    ])
      expect(originScopedHeaders(other, headers, origin, 'fresh')).toEqual({
        authorization: headers.authorization,
      });
  });
  it('blocks writes even when disguised as a read method', () => {
    for (const path of [
      '/v1/projects/p/databases/(default)/documents:commit',
      '/v1/projects/p/databases/(default)/documents:batchWrite',
      '/google.firestore.v1.Firestore/Write/channel',
    ])
      for (const method of ['GET', 'POST', 'PATCH', 'DELETE'])
        expect(
          hostedRequestPolicy(
            'https://firestore.googleapis.com' + path,
            method,
            origin
          )
        ).toBe('deny');
    expect(
      hostedRequestPolicy(
        origin + '/api/architect/draft-review',
        'POST',
        origin
      )
    ).toBe('deny');
    expect(
      hostedRequestPolicy(
        'https://us-central1-scoutzero-bf1ae.cloudfunctions.net/apply',
        'POST',
        origin
      )
    ).toBe('deny');
  });
  it('allows Firestore reads and the existing anonymous authentication lifecycle', () => {
    expect(
      hostedRequestPolicy(
        'https://firestore.googleapis.com/v1/projects/p/databases/(default)/documents/a/b',
        'GET',
        origin
      )
    ).toBe('read');
    expect(
      hostedRequestPolicy(
        'https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel',
        'POST',
        origin
      )
    ).toBe('read');
    for (const action of ['signUp', 'lookup', 'delete'])
      expect(
        hostedRequestPolicy(
          'https://identitytoolkit.googleapis.com/v1/accounts:' + action,
          'POST',
          origin
        )
      ).toBe('auth');
    expect(
      hostedRequestPolicy(
        'https://identitytoolkit.googleapis.com/v1/accounts:update',
        'POST',
        origin
      )
    ).toBe('deny');
  });
  it('does not leak the preview identity through a real browser cross-origin redirect', async () => {
    const seen: (string | string[] | undefined)[] = [];
    const target = createServer((req, res) => {
      seen.push(req.headers['x-vercel-trusted-oidc-idp-token']);
      res.end('redirect completed');
    });
    target.listen(0, '127.0.0.1');
    await once(target, 'listening');
    const address = target.address();
    if (!address || typeof address === 'string')
      throw new Error('fixture unavailable');
    const destination = `http://127.0.0.1:${address.port}`;
    const source = createServer((req, res) => {
      seen.push(req.headers['x-vercel-trusted-oidc-idp-token']);
      res.writeHead(302, { Location: destination });
      res.end();
    });
    source.listen(0, '127.0.0.1');
    await once(source, 'listening');
    const sourceAddress = source.address();
    if (!sourceAddress || typeof sourceAddress === 'string')
      throw new Error('fixture unavailable');
    const sourceOrigin = `http://127.0.0.1:${sourceAddress.port}`;
    let browser: Browser | undefined;
    try {
      browser = await chromium.launch({
        executablePath: ['/usr/bin/chromium', '/usr/bin/google-chrome'].find(
          (file) => fs.existsSync(file)
        ),
      });
      const context = await browser.newContext();
      await context.route('**/*', (route) =>
        continueHostedRequest(route, sourceOrigin, 'fake-test-identity')
      );
      const page = await context.newPage();
      await page.goto(sourceOrigin);
      expect(await page.locator('body').innerText()).toBe('redirect completed');
      expect(seen[0]).toBe('fake-test-identity');
      expect(seen.slice(1).every((value) => value === undefined)).toBe(true);
    } finally {
      await browser?.close();
      source.closeAllConnections();
      target.closeAllConnections();
      await Promise.all([
        new Promise<void>((resolve) => source.close(() => resolve())),
        new Promise<void>((resolve) => target.close(() => resolve())),
      ]);
    }
  }, 20000);
});
