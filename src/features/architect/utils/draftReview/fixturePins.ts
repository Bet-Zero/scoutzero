// Independently retained expected pins. Never accept a pin from mutation payloads.
// Synthetic software authority only; not NBA readiness or production permission.
import type { DraftPickReleasePin } from '@/schemas/draftPickRelease';
export const SYNTHETIC_DRAFT_REVIEW_PINS: Readonly<Record<string, DraftPickReleasePin>> = {
  "synthetic-draft-review-v1-legal": {
    "payloadSha256": "5629be9dc449f949d2cf39cb0890d9ba9afb4a4f5a84f577add8586f402527a7",
    "release": {
      "id": "synthetic-draft-review-v1-legal",
      "schemaVersion": 1,
      "evidenceSha256": "901c28ea802784cc1bb1cdcaffa09a9ee80e9fbde95486296bb768ca404e47c2",
      "assessmentSha256": "88909f597df0b52f9bf16f8faa256a89457dc2e23605a7277e941b9d1af0ab04",
      "asOf": "2026-07-15T00:00:00Z",
      "review": {
        "status": "accepted",
        "reference": "BZE-315 authorized synthetic fixture scope only",
        "limitations": []
      }
    }
  },
  "synthetic-draft-review-v1-ownership": {
    "payloadSha256": "66b02a52281b2e0aa1b973b449614da297cac62a3a8ddbdc80ef20d86daf49a4",
    "release": {
      "id": "synthetic-draft-review-v1-ownership",
      "schemaVersion": 1,
      "evidenceSha256": "5adb445b46b51602130812748f4c21609196c7c79b11cb793869b6454214d61e",
      "assessmentSha256": "88909f597df0b52f9bf16f8faa256a89457dc2e23605a7277e941b9d1af0ab04",
      "asOf": "2026-07-15T00:00:00Z",
      "review": {
        "status": "accepted",
        "reference": "BZE-315 authorized synthetic fixture scope only",
        "limitations": []
      }
    }
  },
  "synthetic-draft-review-v1-stepien": {
    "payloadSha256": "773e145379381222cbbb5b32cd2f484fd0968fc3c0428ea499e8c909192d6c41",
    "release": {
      "id": "synthetic-draft-review-v1-stepien",
      "schemaVersion": 1,
      "evidenceSha256": "78e40d6b77c7f4eec542ac7c9ce6de6f3669e02245d207461b3c4d3856580d89",
      "assessmentSha256": "88909f597df0b52f9bf16f8faa256a89457dc2e23605a7277e941b9d1af0ab04",
      "asOf": "2026-07-15T00:00:00Z",
      "review": {
        "status": "accepted",
        "reference": "BZE-315 authorized synthetic fixture scope only",
        "limitations": []
      }
    }
  },
  "synthetic-draft-review-v1-cash": {
    "payloadSha256": "63f68eb33dbfa5de5f4e11a2f69a5004c816d08efbf4c28b4755b82bca277086",
    "release": {
      "id": "synthetic-draft-review-v1-cash",
      "schemaVersion": 1,
      "evidenceSha256": "7214ecae4cafac3271b7ff803573e0a5676330ed66ffc7c7a6d803852b2a2439",
      "assessmentSha256": "88909f597df0b52f9bf16f8faa256a89457dc2e23605a7277e941b9d1af0ab04",
      "asOf": "2026-07-15T00:00:00Z",
      "review": {
        "status": "accepted",
        "reference": "BZE-315 authorized synthetic fixture scope only",
        "limitations": []
      }
    }
  },
  "synthetic-draft-review-v1-apron": {
    "payloadSha256": "83a93d8f84b9e2374400091c173b9fdea5097abb08a3d316a3ecbcb82f768f33",
    "release": {
      "id": "synthetic-draft-review-v1-apron",
      "schemaVersion": 1,
      "evidenceSha256": "1336bccb4192c64e35ba5d2dd8766814ce791ee497d384b6efa7e65c91c005a2",
      "assessmentSha256": "88909f597df0b52f9bf16f8faa256a89457dc2e23605a7277e941b9d1af0ab04",
      "asOf": "2026-07-15T00:00:00Z",
      "review": {
        "status": "accepted",
        "reference": "BZE-315 authorized synthetic fixture scope only",
        "limitations": []
      }
    }
  },
  "synthetic-draft-review-v1-missing": {
    "payloadSha256": "b1a48530f3f829cbb117f8a82eef6c2cdf705360935f1b7ec6986e6c34a3d2f2",
    "release": {
      "id": "synthetic-draft-review-v1-missing",
      "schemaVersion": 1,
      "evidenceSha256": "e50c3d2ea4d850550803a8763b139f80abc71a9aa6e2a12aeb8c9a999c4240e8",
      "assessmentSha256": "88909f597df0b52f9bf16f8faa256a89457dc2e23605a7277e941b9d1af0ab04",
      "asOf": "2026-07-15T00:00:00Z",
      "review": {
        "status": "accepted",
        "reference": "BZE-315 authorized synthetic fixture scope only",
        "limitations": []
      }
    }
  },
  "synthetic-draft-review-v1-conflicting": {
    "payloadSha256": "bb193e3dc93ab56e1a770cfd3c6ab33f350e6b8fb316cd96cf88f37078a8554f",
    "release": {
      "id": "synthetic-draft-review-v1-conflicting",
      "schemaVersion": 1,
      "evidenceSha256": "451c84263369d2557c12dd9e4556ee55a79bd29af7c7d42e6db2feda122f00fb",
      "assessmentSha256": "88909f597df0b52f9bf16f8faa256a89457dc2e23605a7277e941b9d1af0ab04",
      "asOf": "2026-07-15T00:00:00Z",
      "review": {
        "status": "accepted",
        "reference": "BZE-315 authorized synthetic fixture scope only",
        "limitations": []
      }
    }
  }
};
