# Collection repair validation

Concrete failures: missing proxy support in the bios request context; source
originals absent from foundation output; source-wide HTTP 429 becoming failures
for many remaining players.

Repairs reuse the existing collectors and managed proxy configuration. No Google
identity, infrastructure, publisher grant or production approval was added.

Actually run:

- `npm run test:cloud-dev`: passed, including stop-on-429/missing accounting and
  original UTF-8 byte/hash/capture receipt checks.
- `npm run typecheck`: passed.
- `npm run cloud:typecheck`: passed.
- `npm run validate:project`: passed after retrying outside the socket-restricted
  sandbox; the first attempt failed on the tsx local IPC socket, before validation.
- Targeted Markdown validation for the operating guide and progress note.
- `graphify update .`: AST update completed, 16,841 nodes; generated files ignored.
- Real bios probe with the managed proxy: passed for one existing NBA player.
- Fresh identity rebuild retained all six original responses (two NBA JSON,
  four configured free-agent HTML pages); mapping matched the original generation.
- Fresh 30-team double capture and parsing: complete, factual qualification pending.
- Exact-run contract resume is recovering retained rate-limited members.

Full local suite intentionally skipped: no `RUN FULL SUITE` authorization, and
these changes concern collection tooling. No production write or publication
command was executed. Current-season data factual review and full-generation
emulator/browser verification remain separate pending gates.
