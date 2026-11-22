# Architect CBA Canon — which rulebook to use

**Use Canon v2.0, the accepted rulebook, through the lookup command:**

```bash
npm run architect:canon:lookup -- <LEAF>
```

The command reads the accepted version straight from its pinned git commit,
checks its fingerprint, and refuses to print anything if the check fails.
`scripts/architect/lookupAcceptedCanon.ts` holds the pin
(`ACCEPTED_CANON_PIN`).

**Don't use `ARCHITECT_CBA_CANON.md` in this folder as the rulebook.** It is
Canon v1.1, which an independent review rejected. It is kept byte-identical
as historical evidence. The accepted v2.0 file has the same name but is not on
`main`; it lives at the pinned commit on the authority branch below.

## Pinned accepted authority (Canon v2.0)

| Item | Value |
| --- | --- |
| Accepted candidate commit | `6cf8aaf358c158a88e630e8a7336f7e9c3febc17` |
| Durable authority ref | `refs/remotes/origin/architect/cba-canon-v2` |
| Artifact path at that commit | `docs/reference/cba/ARCHITECT_CBA_CANON.md` |
| Accepted SHA-256 | `23fe883f6f1aec7799fc3396bef404c250fd26beefa705582a5307766ad7ff76` |

If the authority ref is missing locally, fetch just that ref:

```bash
git fetch --no-tags origin architect/cba-canon-v2:refs/remotes/origin/architect/cba-canon-v2
```

If the ref is missing, the lookup command also prints a fetch instruction.

## Edition history

| Edition | Status | SHA-256 |
| --- | --- | --- |
| Canon v1.0 | Historical | `b8cf5d01356b3a83de4663f5bd6843e9aa58c8c06a84227385ae93bc02d969ef` |
| Canon v1.1 | Historical, **rejected by independent acceptance review** (the file in this folder) | `4a0760c81d7a5e95919a0373d5ff631b565d064d56b858fe3b8869ad2b6bb3f6` |
| Canon v2.0 | **Accepted**; pinned as above | `23fe883f6f1aec7799fc3396bef404c250fd26beefa705582a5307766ad7ff76` |

## Review record

- v1.1 Codex acceptance review (REJECT/BLOCK):
  `work/architect-completion/ARCHITECT_CBA_CANON_V1_1_CODEX_ACCEPTANCE_REVIEW.md`
- v1.1 Claude independent adjudication (rejection upheld):
  `work/architect-completion/ARCHITECT_CBA_CANON_V1_1_CLAUDE_ADJUDICATION.md`
- v2.0 repair plan:
  `work/architect-completion/ARCHITECT_CBA_CANON_V2_REPAIR_PLAN.md`
- The pin was previously recorded in the Phase 3A execution profile, now
  archived at `archive/docs/agent-guides/phase3a-execution.md`.
