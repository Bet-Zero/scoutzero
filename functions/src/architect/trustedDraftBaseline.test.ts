import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadTrustedDraftBaseline } from './trustedDraftBaseline';
import pin from './fixtures/governedDraftWorldPin.json';

afterEach(() => vi.unstubAllEnvs());
describe('governed draft initializer source boundary', () => {
  it('installs no source by default', () => {
    vi.stubEnv('SCOUTZERO_GOVERNED_DRAFT_FIXTURE', '');
    expect(loadTrustedDraftBaseline()).toBeNull();
  });
  it('rejects a fixture request in production', () => {
    vi.stubEnv('SCOUTZERO_GOVERNED_DRAFT_FIXTURE', pin.releaseId);
    vi.stubEnv('FUNCTIONS_EMULATOR', 'false');
    expect(() => loadTrustedDraftBaseline()).toThrow('local demo emulator');
  });
  it('requires the pinned selection and all local emulator constraints', () => {
    vi.stubEnv('SCOUTZERO_GOVERNED_DRAFT_FIXTURE', pin.releaseId);
    vi.stubEnv('FUNCTIONS_EMULATOR', 'true');
    vi.stubEnv('GCLOUD_PROJECT', 'demo-architect-review');
    vi.stubEnv('FIRESTORE_EMULATOR_HOST', '127.0.0.1:8082');
    expect(loadTrustedDraftBaseline()?.baseline.records).toHaveLength(21);
    vi.stubEnv('GCLOUD_PROJECT', 'scoutzero-production');
    expect(() => loadTrustedDraftBaseline()).toThrow('local demo emulator');
  });
});
