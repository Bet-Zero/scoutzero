import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import { createServer, type Server } from 'node:http';
import test from 'node:test';
import { chromium, type Browser } from 'playwright';
import { continueHostedRequest } from '../../scripts/architect/hostedDraftReviewPolicy.js';

// A real browser probe runs separately from the concurrent pure-logic suite.
// Its only identity is a public test marker, and both origins are localhost.
test('preview identity never follows a real browser cross-origin redirect', { timeout: 30000 }, async () => {
  const seen: (string | string[] | undefined)[] = [];
  const servers: Server[] = [];
  let browser: Browser | undefined;
  const listen = async (server: Server) => {
    servers.push(server);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    return `http://127.0.0.1:${address.port}`;
  };
  try {
    const destination = await listen(createServer((req, res) => {
      seen.push(req.headers['x-vercel-trusted-oidc-idp-token']);
      res.end('redirect completed');
    }));
    const sourceOrigin = await listen(createServer((req, res) => {
      seen.push(req.headers['x-vercel-trusted-oidc-idp-token']);
      res.writeHead(302, { Location: destination });
      res.end();
    }));
    browser = await chromium.launch({
      // GitHub's unrelated system Chromium can stall during startup. CI installs
      // the matching Playwright browser, as the protected hosted workflow does.
      executablePath: process.env.GITHUB_ACTIONS === 'true'
        ? undefined
        : ['/usr/bin/chromium', '/usr/bin/google-chrome'].find(
            (file) => fs.existsSync(file)
          ),
      timeout: 10000,
    });
    const context = await browser.newContext();
    context.setDefaultTimeout(5000);
    await context.route('**/*', (route) =>
      continueHostedRequest(route, sourceOrigin, 'fake-test-identity')
    );
    const page = await context.newPage();
    await page.goto(sourceOrigin, { timeout: 5000 });
    assert.equal(await page.locator('body').innerText(), 'redirect completed');
    assert.ok(seen.length >= 2, 'the redirect must actually reach the second origin');
    assert.equal(seen[0], 'fake-test-identity');
    assert.ok(seen.slice(1).every((value) => value === undefined));
  } finally {
    try {
      await browser?.close();
    } finally {
      await Promise.all(servers.map((server) => {
        server.closeAllConnections();
        return new Promise<void>((resolve) => server.close(() => resolve()));
      }));
    }
  }
});
