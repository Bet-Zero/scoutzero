# ARCHITECT_AGENTS.md

## 🎯 Purpose
This document defines how **AI agents** (and contributors) should interact with the **HoopZero Architect** feature. Architect is a **strict NBA GM simulator**, not a casual toy. Treat all logic, migrations, and saves with precision.

---

## 🌐 Worlds / Universes
- **Every Architect session = a saved world.**
- Each world is **separate from real NBA data** once launched.  
- **Never overwrite** `/teams/` or real NBA base data with user-generated moves.  
- All user actions must save to `/teamPlans/` (or equivalent world path).  
- A world persists until explicitly reset or deleted. Starting fresh creates a **new world**, not a reset of the old one.

---

## 📂 Data & Firestore Rules
- **Players/Teams Base Data**: Untouchable reference layer (`/players/`, `/teams/`).  
- **Team Plans**: All user-generated GM work (trades, signings, waives, etc) must save to `/teamPlans/`.  
- **Manual Apply Required**:  
  - `submit` = validation only (does not save).  
  - `apply` = commit changes to Firestore under that world.  
- **Shadow Collections**: Use `/players_v2/` or equivalent for migrations/tests before overwriting anything live.

---

## ⚖️ CBA Rules
- Architect enforces **strict CBA compliance**.  
- Validator = hard fail if rules break. Suggestions may be offered.  
- No soft overrides by default. An override toggle can exist but defeats purpose.  
- Contract logic (BYC, apron rules, Stepien, etc) must be respected.

---

## 🔄 Sync & Divergence
- **Sync Frequency**: Weekly scheduled updates + event-based/manual triggers for big moves.  
- **Domino Divergence**: If a user trade conflicts with a real-life move, user’s world takes precedence.  
- Never retroactively alter user-controlled rosters.  
- Conflicts can be flagged, simulated around, or adjusted, but not overwritten.

---

## 🚀 MVP Scope
Must-ship features (Phase 1):  
- Migration + schema stability.  
- Roster Manager.  
- Contract System.  
- Trade Machine (submit → apply).  
- Weekly/event-based data sync.  
- Logos, headshots, polished UI.  
- Accelerated sim mode.  

---

## ⚠️ Safety Rules
- Always preserve the **single source of truth**: base NBA data untouched, worlds saved separately.  
- Never silently overwrite Firestore data.  
- Use reference maps (`oldField → newField`) when migrating schemas.  
- Provide rollback paths (shadow collections, reset to real-life snapshot).  

---

## 📝 Notes for AI Agents
- Follow the **Saved World** principle at all times.  
- Treat Architect as **professional simulation software**, not a game.  
- Prioritize correctness, clarity, and Firestore safety over speed.  
- When unsure, stop and request clarification before writing code.  
