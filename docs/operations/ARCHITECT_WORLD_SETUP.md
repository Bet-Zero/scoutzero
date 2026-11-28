# Current-season Architect world setup

The normal ScoutZero website uses Firebase Auth for account identity, Firestore
for saved worlds and private starting data, and the site's Vercel endpoint for
initializing and removing worlds. This is a one-time setup on the existing
Firebase project and Vercel production environment. Subsequent app releases
follow the usual merge-to-main deployment.

## Compare before release

In Firebase project `scoutzero-bf1ae`, capture the active Firestore Rules
release and composite index inventory with existing access. Retain the exact
Rules release for rollback. The live rules captured on November 25 were
`firestore.owner-preview.rules` from commit
`1353a2d0acb4ef176e9dd216cc420a9082485b4f`, SHA-256
`9689576ca2c543f564857982a13d49effb6ddf131c0bf5a985171deea39e6df6`.
The [public Rules capture](../../tests/fixtures/architect/normalWorldProductionBaseline.rules)
retains those bytes for review and testing. Confirm the live digest before
applying the [targeted Rules change](ARCHITECT_WORLD_RULES.patch).
If the live copy has drifted, review the same scoped changes against the active
file before publishing. An unchanged copy produces candidate SHA-256
`1ac1bcea447d13e59ab74d62555df9339c3ecb031327de92c4d336ac4dc722a1`.

The change extends existing governed world permissions to the authenticated
owner of a world stamped by the server with `worldLifecycleVersion: 1`. It
reserves the stamp and deletion field, stops client writes while a world is
being deleted, and preserves the previous access paths for existing worlds.
Keep the other site's collections and Rules as deployed. The package,
initialization-claim and usage paths remain denied to browsers. The captured
Rules already require the absence of `worldLifecycle` for managed root updates,
child finalization and all descendant writes. The patch extends those checks to
new ordinary worlds and adds the same fence to legacy writes during deletion.
The Rules emulator test applies the patch, checks both digests and exercises the
managed, existing legacy and retained access paths.

Both History indexes were enabled on November 25. Confirm those definitions
are still enabled and leave all existing indexes in place.

| Collection group | Array contains | Descending |
| --- | --- | --- |
| `events` | `teamCodes` | `occurredAt` |
| `events` | `teamsAffected` | `timestamp` |

## Install and enable together

Recover the two private approved packages using Linear BZE-243. Check the plan
before any production operation. The installer verifies the two pinned digests,
season, date, team coverage and compressed sizes. Installation creates only
missing documents in one transaction and verifies any existing documents.

```sh
npx tsx scripts/emu/installCurrentWorldPackages.ts --plan scoutzero-bf1ae \
  /private/path/financial-current-v4.json /private/path/draft-connected-v5.json
```

After explicit approval, an agent with existing Firebase admin access runs the
same command with `--install`, publishes the compared Rules and restores any
missing History index. Set the values below on the existing Vercel project. Use the
existing service identity via a sensitive **Production** variable. It needs
Firestore document access and Firebase Auth user lookup for token revocation
checks. The identity value stays in the provider secret settings.

| Vercel Production setting | Value |
| --- | --- |
| `GCLOUD_PROJECT` | `scoutzero-bf1ae` |
| `SCOUTZERO_WORLD_ORIGIN` | `https://scoutzero.vercel.app` |
| `SCOUTZERO_WORLD_GOOGLE_CREDENTIALS` | Existing Firebase service-account JSON, stored as sensitive |
| `SCOUTZERO_SIMULATION_PACKAGE_SOURCE` | `firestore` |
| `SCOUTZERO_SIMULATION_FINANCIAL_SHA256` | Financial digest printed by the installer |
| `SCOUTZERO_SIMULATION_DRAFT_SHA256` | Draft digest printed by the installer |
| `SCOUTZERO_WORLD_HTTP_ENABLED` | `true` |
| `SCOUTZERO_SIMULATION_LIVE` | `true` |
| `VITE_SCOUTZERO_WORLD_HTTP` | `true` |
| `VITE_SCOUTZERO_SIMULATION_LIVE` | `true` |

The reviewed merge builds the website with those settings. On the normal site,
use two regular test accounts to check create, a committed move, History,
reload, and owner-only access. Verify rename, archive, restore and delete
against test worlds. Roll back site activation with the preceding site
deployment if needed. Keep the additive Rules fence and indexes in place while
any deletion is unfinished. Keep both releases and all saved worlds for
recovery.
