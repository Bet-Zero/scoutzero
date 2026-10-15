import { readFile, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import type { DraftSourceSnapshot } from './draftSourceInventory.js';
import { canonicalStringify } from '../../src/features/architect/utils/contractSource/deterministicDigest.js';
import {
  inspectDraftReviewCloud,
  draftCloudFailureSummary,
} from './draftReviewCloudPreflight.js';
import {
  digest,
  readInstallation,
  publishInstallation,
} from './draftReviewInstallation.js';
import {
  readSourceInstallation,
  publishSourceInstallation,
} from './draftSourceInstallation.js';

const mode = process.env.DRAFT_OPERATION;
const token = process.env.SCOUTZERO_GCP_ACCESS_TOKEN ?? '';
let snapshot:
  | { rulesetName: string; content: string; sha256: string }
  | undefined;
let sourceInventory: DraftSourceSnapshot | undefined;
let stableSourceRead = false;
try {
  if (mode === 'inspect') {
    const first = await inspectDraftReviewCloud(token, fetch, {
      retain: (value) => {
        snapshot = value;
      },
      retainSourceInventory: (value) => {
        sourceInventory = value;
      },
    });
    let second: typeof snapshot;
    let secondInventory: DraftSourceSnapshot | undefined;
    await inspectDraftReviewCloud(token, fetch, {
      retain: (value) => {
        second = value;
      },
      retainSourceInventory: (value) => {
        secondInventory = value;
      },
    });
    if (
      !snapshot ||
      !second ||
      snapshot.sha256 !== second.sha256 ||
      snapshot.rulesetName !== second.rulesetName
    )
      throw new Error('RULES_CHANGED_DURING_INSPECTION');
    if (sourceInventory || secondInventory) {
      if (
        !sourceInventory ||
        !secondInventory ||
        canonicalStringify(sourceInventory.documents) !==
          canonicalStringify(secondInventory.documents)
      )
        throw new Error('SOURCE_CHANGED_DURING_INSPECTION');
      stableSourceRead = true;
    }
    console.log(
      JSON.stringify({
        ...first,
        rulesetName: snapshot.rulesetName,
        stableDoubleRead: true,
        sourceDocumentsInspected: Object.keys(sourceInventory?.documents ?? {})
          .length,
        sourceDocumentsPresent: Object.values(
          sourceInventory?.documents ?? {}
        ).filter(Boolean).length,
        stableSourceRead,
      })
    );
  } else if (mode === 'publish') {
    const bundle = await readInstallation(
      process.env.APPROVED_INSTALLATION_SHA256 ?? '',
      process.env.INSTALLATION_PASSPHRASE ?? ''
    );
    console.log(JSON.stringify(await publishInstallation(token, bundle)));
  } else if (mode === 'publish-source') {
    const approvedHash = process.env.APPROVED_SOURCE_SHA256 ?? '';
    const bytes = readSourceInstallation(
      approvedHash,
      process.env.INSTALLATION_PASSPHRASE ?? ''
    );
    console.log(
      JSON.stringify(
        await publishSourceInstallation(token, bytes, approvedHash)
      )
    );
  } else throw new Error('OPERATION_REJECTED');
} catch (error) {
  const message = error instanceof Error ? error.message : '';
  console.error(
    JSON.stringify(
      /^[A-Z_]+(?:_[0-9]{3})?$/.test(message)
        ? { code: message }
        : mode === 'publish' || mode === 'publish-source'
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
        sourceInventory,
        stableSourceRead,
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
