import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import { createServer, type Server } from 'node:http';
import test from 'node:test';
import { chromium, type Browser } from 'playwright';
import { continueHostedRequest } from '../../scripts/architect/hostedDraftReviewPolicy.js';
import {
  selectHostedDraftReviewPick,
  HOSTED_DRAFT_REVIEW_PRIMARY_TEAM,
  type HostedSelectionPhase,
} from '../../scripts/architect/hostedDraftReviewSelection.js';

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

test(
  'GM selection distinguishes an empty inventory from a selectable pick',
  { timeout: 30000 },
  async () => {
    const browser = await chromium.launch({
      executablePath:
        process.env.GITHUB_ACTIONS === 'true'
          ? undefined
          : ['/usr/bin/chromium', '/usr/bin/google-chrome'].find(fs.existsSync),
      timeout: 10000,
    });
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(1000);
      // Public DOM fixtures exercise the browser driver's selection logic only.
      // Actual production components/resolver have separate focused UI tests;
      // these fixtures are not hosted GM evidence and never touch Firebase.
      const fixture = (inventory: string) => `
      <button role="tab" onclick="document.querySelector('[role=dialog]').hidden=false">Trade Machine</button>
      <div role="dialog" aria-label="Trade Machine" hidden>
        <div data-testid="trade-team-card-${HOSTED_DRAFT_REVIEW_PRIMARY_TEAM}">
          <button onclick="document.querySelector('#inventory').hidden=false">Picks (1)</button>
          <div id="inventory" hidden>${inventory}</div>
        </div>
        <label>Select Team</label><select onchange="document.querySelector('#den').hidden=false">
          <option value="">Select Team</option><option value="nuggets">Denver Nuggets</option>
        </select>
        <div id="den" data-testid="trade-team-card-DEN" hidden>Denver Nuggets</div>
      </div>`;
      let phase: HostedSelectionPhase | undefined;
      await page.setContent(
        fixture(
          '<div>No draft picks to show.<span>This team has no tradeable picks loaded.</span></div>'
        )
      );
      await assert.rejects(
        selectHostedDraftReviewPick(page, (value) => {
          phase = value;
        }),
        { message: 'LIVE_PICK_INVENTORY_REQUIRED' }
      );
      assert.equal(phase, 'live-pick-inventory-empty');

      await page.setContent(fixture('<div>2030 - Round 2</div>'));
      await assert.rejects(
        selectHostedDraftReviewPick(page, (value) => {
          phase = value;
        })
      );
      assert.equal(phase, 'find-first-round-pick');

      await page.setContent(fixture('<div>2030 - Round 1</div>'));
      await assert.rejects(selectHostedDraftReviewPick(page, () => {}));

      const pickFixture = (destination: string) => fixture(`
      <div><span>2028 - Round 1</span><button onclick="document.querySelector('#menu').hidden=false">•••</button>
        <div id="menu" hidden><button onclick="this.textContent=this.textContent==='Cancel Trade'?'Trade to ${destination}':'Cancel Trade';this.parentElement.hidden=true">Trade to ${destination}</button></div>
      </div>`);
      // The real team loader passes the source teamName into this menu. The
      // live DEN document uses uppercase; the old case-sensitive driver failed.
      for (const destination of ['Denver Nuggets', 'DENVER NUGGETS', 'dEnVeR NuGgEtS']) {
        await page.setContent(pickFixture(destination));
        const stage = await selectHostedDraftReviewPick(page, (value) => {
          phase = value;
        });
        await stage();
        assert.equal(phase, 'stage-pick-destination');
        assert.equal(await page.locator('#menu button').textContent(), 'Cancel Trade');
        await stage(true);
        assert.equal(phase, 'cancel-pick-destination');
        assert.equal(await page.locator('#menu button').textContent(), `Trade to ${destination}`);
      }
      // Case tolerance must not permit a different or merely similar team.
      for (const destination of ['Denver Nuggets II', 'Los Angeles Lakers']) {
        await page.setContent(pickFixture(destination));
        const stage = await selectHostedDraftReviewPick(page, () => {});
        await assert.rejects(stage());
        assert.equal(await page.locator('#menu button').textContent(), `Trade to ${destination}`);
      }
    } finally {
      await browser.close();
    }
  }
);
