// Independent fixed synthetic pin. No caller-supplied pin is authority.
import type { DraftPickReleasePin } from '@/schemas/draftPickRelease';
export const SYNTHETIC_DRAFT_SEASON_PIN: DraftPickReleasePin = {
  payloadSha256:
    '863bd7996e71ef9b5279d179378644f26098cb4fb2f5503d12debf78ebaccc8a',
  release: {
    asOf: '2026-07-01T04:00:00Z',
    assessmentSha256:
      'd3cdf58dada8ff14be78cfaa069ad4e6e43b51a683679068cff1e26947c79e3d',
    evidenceSha256:
      'dd7a19076758ae17b0f9a5cd942c0251e5883aead04d022357199543b4085784',
    id: 'synthetic-draft-review-v2-season',
    review: {
      status: 'accepted',
      reference: 'BZE-317 synthetic software fixture only',
      limitations: [],
    },
    schemaVersion: 1,
  },
};
