import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import { createServer } from 'node:http';
import test from 'node:test';
import { chromium } from 'playwright';
import {
  hostedFailureCode,
  verifyHostedReviewStages,
} from '../../scripts/architect/hostedDraftReviewAssertions.js';

test(
  'remaining hosted proof covers historical scope, auth, failure/reset and rejects broken contracts',
  { timeout: 45000 },
  async () => {
    // Public synthetic presentation only. Actual component and derivation tests
    // independently bind these labels and scope transitions to the product.
    const header =
      '<span>Needs input · Apply unavailable</span><p>Starting position: 2030-06-05.</p>';
    const row =
      '<details open><summary>Public qualified pick</summary>BODY</details>';
    const guard =
      'The retained pick evidence does not establish this world’s date.';
    const scope =
      'Historical starting position only. Missing or different world dates remain unverified.';
    const world =
      header +
      row.replace('BODY', guard) +
      '<button onclick="showHistorical()">Inspect retained starting position</button>';
    const historical =
      header +
      row.replace('BODY', 'Recorded ownership: Supported for this team') +
      `<p>${scope}</p><button onclick="showWorld()">Return to date-limited review</button>`;
    const unavailable =
      '<span>Needs input · Apply unavailable</span><p>The retained pick review is unavailable. First-round trades still need a complete review.</p>';
    let scenario = '';
    const html =
      () => `<!doctype html><meta charset="utf-8"><button role="tab" onclick="openTrade()">Trade Machine</button>
    <div role="dialog" aria-label="Trade Machine" hidden style="position:fixed;inset:0;z-index:10;background:white;min-height:10px">${scenario === 'no-card' ? '' : '<div data-testid="trade-team-card-PHI">Primary team ready</div>'}<div id="mount">${scenario === 'stale-reload' ? '<section data-testid="real-draft-review">stale</section>' : ''}</div></div>
    <script>
      const restoreFromUrl=${JSON.stringify(['auto-restore', 'auto-stale-reload'].includes(scenario))};
      window.launcherClicks=0;
      function openTrade() {
        window.launcherClicks++;
        document.querySelector('[role=dialog]').hidden=false;
        if (restoreFromUrl) {
          const url=new URL(location.href);url.searchParams.set('room','trade');history.replaceState({},'',url);
        }
      }
      if (restoreFromUrl && new URL(location.href).searchParams.get('room')==='trade')
        document.querySelector('[role=dialog]').hidden=false;
      if (${JSON.stringify(scenario === 'auto-stale-reload')} && new URL(location.href).searchParams.get('room')==='trade') {
        const card=document.querySelector('[data-testid=trade-team-card-PHI]');card.hidden=true;
        setTimeout(()=>document.querySelector('#mount').innerHTML='<section data-testid="real-draft-review">stale</section>',25);
        setTimeout(()=>card.hidden=false,50);
      }
      const world=${JSON.stringify(world)}, historical=${JSON.stringify(historical)};
      function show(value) { document.querySelector('#mount').innerHTML='<section data-testid="real-draft-review">'+value+'</section>'; }
      function showWorld() { show(world); }
      function showHistorical() { show(historical); }
    </script>`;
    const server = createServer((req, res) => {
      if (req.url === '/api/architect/draft-review') {
        res.writeHead(scenario === 'auth-open' ? 200 : 401);
        res.end();
      } else {
        res.setHeader('Content-Type', 'text/html');
        res.end(html());
      }
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const browser = await chromium
      .launch({
        executablePath:
          process.env.GITHUB_ACTIONS === 'true'
            ? undefined
            : ['/usr/bin/chromium', '/usr/bin/google-chrome'].find(
                fs.existsSync
              ),
        timeout: 10000,
      })
      .catch(async (error) => {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
        throw error;
      });
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(1000);
      const cases = [
        ['', null],
        ['auto-restore', null],
        ['auto-stale-reload', 'STALE_REVIEW_AFTER_RELOAD'],
        ['no-card', 'RELOAD_PRIMARY_TEAM_NOT_READY'],
        ['no-start', 'REVIEW_RENDER_TIMEOUT'],
        ['no-apply', 'APPLY_SAFEGUARD_REQUIRED'],
        ['no-rows', 'REVIEW_ROWS_REQUIRED'],
        ['two-rows', 'QUALIFIED_PICK_ROW_COUNT_MISMATCH'],
        ['wrong-label', 'QUALIFIED_PICK_LABEL_MISMATCH'],
        ['no-guard', 'WORLD_DATE_GUARD_REQUIRED'],
        ['current-support', 'WORLD_DATE_GUARD_REQUIRED'],
        ['no-inspection', 'HISTORICAL_INSPECTION_UNAVAILABLE'],
        ['no-scope', 'HISTORICAL_SCOPE_DISCLOSURE_REQUIRED'],
        ['no-ownership', 'QUALIFIED_PICK_OWNERSHIP_NOT_SUPPORTED'],
        ['no-return', 'WORLD_REVIEW_RESET_FAILED'],
        ['auth-open', 'APP_AUTHENTICATION_NOT_ENFORCED'],
        ['cancel-stale', 'STALE_REVIEW_AFTER_CANCEL'],
        ['no-unavailable', 'UNAVAILABLE_REVIEW_NOT_RENDERED'],
        ['failure-apply', 'FAILURE_APPLY_SAFEGUARD_REQUIRED'],
        ['stale-reload', 'STALE_REVIEW_AFTER_RELOAD'],
        ['write-attempt', 'UNEXPECTED_NETWORK_OPERATION'],
        ['wrong-qualified', 'QUALIFIED_PICK_REQUIRED'],
      ] as const;
      for (const [name, expected] of cases) {
        scenario = name;
        await page.goto(`http://127.0.0.1:${address.port}`);
        await page.getByRole('tab').click();
        await page.evaluate(() => (window as any).showWorld());
        await page.evaluate((name) => {
          const panel = document.querySelector(
            '[data-testid=real-draft-review]'
          )!;
          if (name === 'no-start') panel.querySelector('p')!.remove();
          if (name === 'no-apply') panel.querySelector('span')!.remove();
          if (name === 'no-rows') panel.querySelector('details')!.remove();
          if (name === 'two-rows')
            panel.append(panel.querySelector('details')!.cloneNode(true));
          if (name === 'wrong-label')
            panel.querySelector('summary')!.textContent = 'Wrong pick';
          if (name === 'no-guard')
            panel.querySelector('details')!.innerHTML =
              '<summary>Public qualified pick</summary>Unknown';
          if (name === 'current-support')
            panel.append(
              document.createTextNode(
                'Recorded ownership: Supported for this team'
              )
            );
          if (name === 'no-inspection') panel.querySelector('button')!.remove();
          const original = (window as any).showHistorical;
          (window as any).showHistorical = () => {
            original();
            const p = document.querySelector(
              '[data-testid=real-draft-review]'
            )!;
            if (name === 'no-scope') p.querySelectorAll('p')[1].remove();
            if (name === 'no-ownership')
              p.querySelector('details')!.textContent =
                'Public qualified pick: Needs complete ownership evidence';
            if (name === 'no-return') p.querySelector('button')!.remove();
          };
        }, name);
        let unavailableMode = false;
        const run = () =>
          verifyHostedReviewStages({
            page,
            release: {
              records: [
                {
                  label: 'Public qualified pick',
                  ownership: {
                    pick: {
                      draftYear: name === 'wrong-qualified' ? 2029 : 2028,
                    },
                    claims: [{ team: 'PHI', status: 'owned-unconditionally' }],
                  },
                },
              ],
            },
            primaryTeam: 'PHI',
            setPhase: () => {},
            setUnavailable: (value) => {
              unavailableMode = value;
            },
            forbiddenRequests: () => (name === 'write-attempt' ? 1 : 0),
            stage: async (cancel) => {
              if (cancel) {
                if (name !== 'cancel-stale')
                  await page
                    .locator('[data-testid=real-draft-review]')
                    .evaluate((el) => el.remove());
              } else
                await page.evaluate(
                  ({ value }) => (window as any).show(value),
                  {
                    value:
                      unavailableMode && name !== 'no-unavailable'
                        ? name === 'failure-apply'
                          ? unavailable.replace('Apply unavailable', '')
                          : unavailable
                        : world,
                  }
                );
            },
          });
        if (expected)
          await assert.rejects(
            run(),
            (error) => hostedFailureCode(error) === expected,
            name
          );
        else {
          await assert.doesNotReject(run(), name || 'closed-on-reload');
          assert.equal(
            await page
              .getByRole('dialog', { name: 'Trade Machine' })
              .isVisible(),
            true
          );
          assert.equal(
            await page.evaluate(() => (window as any).launcherClicks),
            name === 'auto-restore' ? 0 : 1
          );
        }
      }
      assert.equal(
        hostedFailureCode(new Error('private arbitrary exception')),
        'UNEXPECTED_HOSTED_FAILURE'
      );
      assert.equal(
        hostedFailureCode({ code: 'QUALIFIED_PICK_REQUIRED' }),
        'UNEXPECTED_HOSTED_FAILURE'
      );
    } finally {
      await browser.close();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }
);
