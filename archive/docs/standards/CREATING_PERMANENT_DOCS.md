# Creating Permanent Documentation

Document durable knowledge where future users or developers will look for it.
Prefer updating the existing authoritative guide, README, contract or inline
explanation. A new file, component, feature directory or script does not by
itself require a new README, header, plan or evidence document.

Create a new document only when it has a distinct long-lived audience or purpose
that an existing home cannot serve clearly. Use the placement rules in
`DOCUMENTATION_STRUCTURE_STANDARD.md`. Technical placement is the agent's
judgment, not an owner approval request.

## Choosing a home

| Knowledge | Preferred home |
| --- | --- |
| Feature behavior and entry points | Existing feature README or `docs/reference/<feature>/` |
| Script usage, parameters and prerequisites | Existing tool README or operational guide |
| Public API contracts | Existing API/feature documentation |
| Complex user workflow | Existing guide; a new guide only for a distinct need |
| Schema contract | Canonical schemas and their generated reference |
| Implementation/review evidence | PR; an existing issue receives a concise status link |
| Active coordinated plan | Update the existing applicable plan, without duplicating the PR |

Do not create a folder README solely because a folder was created. Do not
restructure components into index files to satisfy a documentation template.
Keep source qualification, privacy, generated schema correctness and existing
product contracts intact.

## Useful content, when needed

A README or guide may explain purpose, entry points, non-obvious structure,
usage, public contracts, failure behavior and relevant links. Include only what
helps its audience. Do not populate empty headings or invent plan/issue links.

A short source comment may capture non-obvious intent, ownership or a critical
invariant. File headers are optional design aids, not a requirement for every
new or modified file. Git already records filename and history; do not duplicate
those mechanically or touch unrelated headers during a small task.

## Existing knowledge and evidence

Update a durable contract when its meaning changes. A local styling correction
usually needs no permanent documentation. For a new small script, usage in an
existing tooling guide or a clear CLI help message can be sufficient.

Generated docs are updated through their source command only when the relevant
schema/topology changes or an explicit doc-sync task requires it. Never manually
edit generated outputs. Do not regenerate the entire documentation tree for a
text, color or local behavior edit.

Ordinary tasks need no return package or planning file. Follow `AGENTS.md` for
explicitly requested packages, active coordinated work, evidence reuse, and
owner-reserved production approvals. Do not rewrite historical receipts to make
them match current process wording.
