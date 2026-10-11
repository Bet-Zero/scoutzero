import { readFile, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import {
  inspectDraftReviewCloud,
  draftCloudFailureSummary,
} from './draftReviewCloudPreflight.js';
import {
  digest,
  readInstallation,
  publishInstallation,
} from './draftReviewInstallation.js';

const mode = process.env.DRAFT_OPERATION;
const token = process.env.SCOUTZERO_GCP_ACCESS_TOKEN ?? '';
let snapshot:
  | { rulesetName: string; content: string; sha256: string }
  | undefined;
try {
  if (mode === 'inspect') {
    const first = await inspectDraftReviewCloud(token, fetch, {
      retain: (value) => {
        snapshot = value;
      },
    });
    let second: typeof snapshot;
    await inspectDraftReviewCloud(token, fetch, {
      retain: (value) => {
        second = value;
      },
    });
    if (
      !snapshot ||
      !second ||
      snapshot.sha256 !== second.sha256 ||
      snapshot.rulesetName !== second.rulesetName
    )
      throw new Error('RULES_CHANGED_DURING_INSPECTION');
    console.log(
      JSON.stringify({
        ...first,
        rulesetName: snapshot.rulesetName,
        stableDoubleRead: true,
      })
    );
  } else if (mode === 'publish') {
    const bundle = await readInstallation(
      token,
      process.env.INSTALLATION_GENERATION ?? '',
      process.env.APPROVED_INSTALLATION_SHA256 ?? ''
    );
    console.log(JSON.stringify(await publishInstallation(token, bundle)));
  } else throw new Error('OPERATION_REJECTED');
} catch (error) {
  const message = error instanceof Error ? error.message : '';
  console.error(
    JSON.stringify(
      /^[A-Z_]+(?:_[0-9]{3})?$/.test(message)
        ? { code: message }
        : mode === 'publish'
          ? { code: 'INSTALLATION_FAILED_INSPECT_BEFORE_RETRY' }
          : draftCloudFailureSummary(error)
    )
  );
  process.exitCode = 1;
} finally {
  if (snapshot) {
    // Public GitHub artifacts must never contain plaintext production rules.
    // This certificate is public. Its evidence-decryption key stays outside Git.
    const path = `${process.env.RUNNER_TEMP}/draft-rules-private.json`;
    try {
      const expected = await readFile('firestore.rules', 'utf8');
      const bytes = JSON.stringify({
        ...snapshot,
        repositoryRules: expected,
        capturedAt: new Date().toISOString(),
      });
      await writeFile(path, bytes, { mode: 0o600, flag: 'wx' });
      execFileSync(
        'openssl',
        [
          'cms',
          '-encrypt',
          '-binary',
          '-aes-256-cbc',
          '-in',
          path,
          '-outform',
          'DER',
          '-out',
          `${process.env.RUNNER_TEMP}/draft-rules.cms`,
          'scripts/architect/draftReviewInspectionCertificate.pem',
        ],
        { stdio: 'ignore' }
      );
      console.log(
        JSON.stringify({
          evidenceSha256: digest(bytes),
          encryptedEvidence: 'draft-rules.cms',
        })
      );
    } finally {
      await rm(path, { force: true });
    }
  }
}
