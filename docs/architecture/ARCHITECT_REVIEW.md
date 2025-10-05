# HoopZero Architect – Review Document (v1 Draft)

## 📌 Purpose
HoopZero Architect is designed to be a **true NBA GM simulator**. Its foundation is **strict CBA compliance**, realistic roster/contract logic, and a professional UI. Architect is not a “game” in the arcade sense — it’s a **simulation tool** that makes the user feel like they’re running an NBA front office with all the complexity and constraints that come with it.

---

## 🏗️ Current Foundation
- **Firestore Migration**: Schema restructured for players/teams with validation fixtures.  
- **CBA Validator**: Hard fail on rule violations, suggestion layer for adjustments.  
- **Roster Manager**: Core add/remove/trade functionality.  
- **Contract System**: Editable, rule-enforced contracts with validation on moves.  
- **Trade Machine 2.0**: Submit → validate → manual apply flow.  

---

## 🌐 Saved Worlds / Universes
- **Independent Saves**: Every Architect session is its own **saved world**, forked from real-life NBA data at the moment the user launches their team.  
- **Persistence**: Once created, this world is **separate and preserved** — all moves (trades, signings, releases, extensions) are stored to Firestore under that world, not mixed into the “real NBA” data.  
- **Branching**: Users can create multiple worlds (e.g. *“What if I ran the 2025 Lakers?”* vs. *“What if I ran the 2025 Knicks?”*). Each is isolated, with its own roster moves and history.  
- **Domino Divergence**: Real NBA moves continue syncing into untouched teams, but never overwrite user-controlled rosters. This creates the alternate-universe tension where moves in one world differ from reality.  
- **Return to Real Life**: At any time, users can start fresh from the “real NBA” snapshot, but that creates a **new world**, not a reset of the old one.  

---

## 🌍 Phase Roadmap

**Phase 1 – Solo Sandbox (MVP)**  
- Launch with strict CBA logic.  
- Roster/contract management.  
- Trades validated and applied via Firestore.  
- Weekly + event-driven sync to real NBA.  
- UI: sleek, professional, team logos, headshots, action icons.  
- Accelerated Sim Mode alongside real-time calendar mode.  

**Phase 2 – Smarter Single-User Tools**  
- Trade valuation engine.  
- Team need determinator.  
- Player fit calculator.  
- Reverse trade creator.  

**Phase 3 – Multiplayer League Mode**  
- Real humans control teams.  
- Trades/free agency require GM-to-GM approval.  
- Open bidding wars for free agents.  
- Scalable: full 30-team leagues or hybrid with AI.  

**Phase 4 – Hybrid Simulation + Multiplayer**  
- AI GMs fill unclaimed teams.  
- AI behaviors guided by needs, cap sheets, and fit logic.  
- Fully dynamic league ecosystem.  

---

## ⚖️ Realism vs. Fun Stance
- **Strict Rules**: Hard fail on CBA violations. No “soft pass.” Override toggle possible but against spirit.  
- **No Cheats**: Injuries, roster limits, and real-life constraints all enforced. Force-accept trades are temporary until valuations land.  
- **Sim Pacing**:  
  - Real-time mode (mirrors NBA calendar).  
  - Accelerated mode (fast-tracked offseason/trade logic).  
- **UI Vibe**: Balanced — sleek, professional, accessible.  
  - Dark/neutral base, team logos, headshots, icons.  
  - Polished and aesthetic, no gimmicky gamification.  

---

## 🔄 Data & Updates
- **Starting State**: Launch mirrors real NBA (rosters, contracts, injuries).  
- **User Control**: Once a user takes over a team, that team’s *real-life moves* no longer sync.  
- **League Moves**: All other teams continue syncing, with domino issues acknowledged.  
- **Frequency**:  
  - Weekly scheduled cleanups.  
  - Event-based/manual triggers for major moves.  
- **Branching**: Users can start from Opening Night, Trade Deadline, Playoffs, or current date.  
- **Update Control**:  
  - Auto-sync pipelines.  
  - Manual approval for all user actions (submit = validate, apply = save).  

---

## 🚀 MVP Priorities
**Must-Ship**  
- Firestore migration & schema stability.  
- Strict CBA validator.  
- Roster Manager.  
- Contract System.  
- Trade Machine 2.0 (submit/apply).  
- Data sync pipeline (weekly + events).  
- Accelerated sim mode.  
- Logos, headshots, polished UI.  

**Can Slip**  
- Snapshot branching (non-critical but desirable).  
- Trade valuation engine (can land in Phase 2).  
- Advanced fit/team-need calculators.  

---

## ⚠️ Risks & Rollbacks
**High-Risk Areas**  
- Schema mismatches → break lookups.  
- Domino conflicts from divergent moves.  
- Contract edge cases (BYC, options, apron logic).  
- Sync fragility (NBA moves outpace updates).  

**Rollback Plan**  
- Shadow collections for safe migration.  
- Manual approval flow prevents accidental saves.  
- Reference map for debugging.  
- Reset option to mirror real life if corrupted.  

---

## 🌀 Domino Conflict Mitigation Ideas (Future Exploration)
The “alternate universe” problem (user trades diverge from real-life moves) is unavoidable but can be reduced:  
1. **Ghost Simulation**: Track which players were “removed from reality” and auto-adjust other team needs accordingly.  
2. **Conflict Resolver**: When a real-life move involves a user-controlled player, the system either:  
   - Blocks it and flags “This move conflicts with your universe.”  
   - Or offers an AI-generated alternative move for the other team.  
3. **Weighted Divergence Mode**: Allow league moves to continue, but apply multipliers or filters so that overlapping players/teams get adjusted.  
4. **Branch Snapshots**: Encourage users to start universes at natural breakpoints (Opening Night, Trade Deadline) to reduce overlaps.  
