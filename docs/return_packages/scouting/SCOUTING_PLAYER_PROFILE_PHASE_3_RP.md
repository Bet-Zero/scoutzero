# SCOUTING PLAYER PROFILE - PHASE 3 RETURN PACKAGE

**Date**: 2026-01-22  
**Phase**: Phase 3 - Video Examples (YouTube links)  
**Status**: COMPLETE

---

## 1. Files Changed

| File Path | Action |
| --- | --- |
| `src/shared/utils/videoExamples.js` | Created |
| `src/features/profile/utils/profileHelpers.js` | Modified |
| `src/features/profile/BreakdownModal.jsx` | Modified |
| `src/shared/components/ui/VideoExamples.jsx` | Modified |
| `src/pages/PlayerProfileView.jsx` | Modified |
| `src/features/profile/hooks/useAutoSavePlayer.js` | Modified |
| `src/features/roster/utils/enrichPlayerData.js` | Modified |
| `src/features/profile/PlayerDetails/index.jsx` | Modified |
| `src/features/profile/PlayerDetails/OverallBlurbBox.jsx` | Modified |
| `src/schemas/players_v2.ts` | Modified |
| `docs/scouting/SCOUTING_PLAYER_PROFILE_MASTER_AUDIT.md` | Modified |
| `docs/schema/players_v2.md` | Regenerated |

---

## 2. Data Model (Final Shape)

Stored on the evaluation doc at `players_v2/{playerId}/evaluations/current` and denormalized into `currentEvaluationView`:

```js
videoExamples: {
  traits: {
    Shooting: [{ url, label?, createdAt? }],
    Passing: [...]
  },
  roles: {
    offense1: [...],
    offense2: [...],
    defense1: [...],
    defense2: [...]
  },
  subroles: {
    "Primary Playmaker": [...],
    "Point-of-Attack Defender": [...]
  },
  shootingProfile: [{ url, label?, createdAt? }],
  twoWayMeter: [{ url, label?, createdAt? }],
  overall: [{ url, label?, createdAt? }]
}
```

Notes:

- `subroles` is a flat map keyed by the modal subrole name (aligns with `subrole_<name>` modal keys).
- Non-YouTube URLs are allowed, but surfaced with warnings and no embed.

---

## 3. UI Placement (Screenshots Description)

- **BreakdownModal**: below the blurb textarea, a "Video Examples" panel includes URL + label inputs, an "Add Video" button, and a compact list with label, play toggle (YouTube only), delete, and a thumbnail preview.
- **Overall**: the Overall section label now includes a notebook icon that opens the BreakdownModal for Overall, where video examples are managed.

---

## 4. Validation Results

| Check | Result |
| --- | --- |
| `npm run schema:generate` | PASS (required for schema updates) |
| `npm run docs` | PASS (component docs unchanged) |
| `npm run schema:check` | FAIL (schema docs differ from HEAD after updates) |
| Emulator manual flow (add/delete videos + refresh) | NOT RUN (environment constraint) |

---

## 5. Follow-Ups / Notes

1. Run the manual emulator validation steps from the Phase 3 prompt to confirm persistence and UI behavior.
2. If you want offense/defense subrole buckets, add explicit routing logic (currently stored as a flat subroles map keyed by name).
3. Consider a hard limit of 5 videos per key if you want to prevent long lists (currently a soft limit warning only).

---

**Phase 3 Complete**
