# Architect GM Desk — Goal and Acceptance

**User policy (locked):** Full GM desk work (Phases B–D). **Trade Machine interior stays unchanged** until Cap, FA, Roster, desk behavior, and league entry are reviewed. Trade refit is optional **Phase E** only (not started).

## Goal

One **GM desk** at `/gm/:teamId`: franchise context always visible; Cap, FA, Roster, History, etc. feel like one product; actions flow across rooms (trade → receipt → Cap with player highlighted). Trade keeps its current editor UI until Phase E is approved.

## Definition of done

| # | Criterion | Phase |
|---|-----------|-------|
| 1 | Refresh/share restores **room + season** via URL (`?room=&season=&player=`) | C |
| 2 | Team, world, mode, cap posture visible without opening Cap (TopBar + TeamStatusStrip) | 1 + B |
| 3 | Post-action receipt + navigation with **player highlight** | 2 + C |
| 4 | Activity rail: **committed** events + **trade draft** labeled non-committed | C |
| 5 | Cap, FA, Roster unified visually (**Trade exempt until Phase E**) | B |
| 6 | Compare + Guide linked from receipt (**Compare move** / **Guide next steps**) | D |
| 7 | League `/gm` shares **viewing season** + **last team** handoff | D |

## Anti-goals

- New mutation pipeline or Firestore writes
- Trade Machine reskin before Phase E approval
- Chatbot-style Guide (deterministic navigation only)

## Golden path

Apply trade → receipt in activity rail → **View Cap Sheet** → player highlighted → committed event in rail. Optional: **Compare move** / **Guide next steps** from receipt block.

## Approval gates

- **B:** Cap / FA / Roster feel like one product; Trade interior unchanged
- **C:** URL + selection dock + golden path without tab-hunting
- **D:** League handoff bar + receipt intelligence links
- **E:** Trade refit — separate sign-off
