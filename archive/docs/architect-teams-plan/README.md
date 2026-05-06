# Architect Teams Plan Archive

**Status:** Historical planning/design bundle.

This archive stores the older Architect planning package that originally lived
under `docs/architect-teams-plan/`.

Use the live runtime/reference set at
[docs/architect/README.md](../../../docs/architect/README.md) for current
implementation truth.

## Archived Bundle Contents

- `00-IMPLEMENTATION-STATUS.md` - historical planning-status snapshot
- `01-GOALS.md` through `07-IMPLEMENTATION-PLAN.md` - original planning and design docs
- `summaries/` - condensed planning summaries and the historical execution prompt
- `ARCHITECT_PLAN_INDEX.md` - historical root-level Architect plan router retained for provenance

## Why This Is Archived

The bundle is useful for historical design context, but it is not the current
source of truth for:

- save/load behavior
- world lifecycle ownership
- Firestore persistence contracts
- current Architect runtime feature behavior

Those active references now live in the current Architect runtime router and
its linked docs.
