# Architect Schema v2 - Quick Reference Card

## 🎯 Decision Matrix

| Question | Answer | Details |
|----------|--------|---------|
| **Should we implement this?** | ✅ YES (with mods) | Core concept is sound, needs performance layer |
| **What's the main change?** | Add snapshot layer | Diffs = source of truth, snapshots = reads |
| **Performance impact?** | ✅ Same as current | Hybrid approach: 30 queries vs 900 (pure diff) |
| **Storage impact?** | ✅ 50% reduction | 1 MB/world vs 1.5 MB (current) |
| **Timeline?** | 6-8 weeks | Staged rollout with testing |
| **Risk level?** | 🟡 Medium | Needs careful migration testing |

## 📊 Key Metrics

### Read Performance (30 Teams)
```
Current:    30 queries  →  ~100ms     ✅
Pure Diff:  960 queries →  ~5-10s     ❌
Hybrid:     30 queries  →  ~100ms     ✅
```

### Storage per World
```
Current:    1.5 MB  (full copies)           📦
Pure Diff:  20 KB   (diffs only)            📦✨✨✨
Hybrid:     1 MB    (snapshots + diffs)     📦✅
```

### Write Latency
```
Current:    Fast    (2 writes)              ⚡
Pure Diff:  Fast    (2 writes)              ⚡
Hybrid:     Medium  (4+ writes + regen)     ⏱️
```

## 🏗️ Architecture at a Glance

```
/architect/
  ├── baseTeams/          # Real NBA (immutable)
  ├── basePlayers/        # Real NBA (immutable)
  └── worlds/{worldId}/
      ├── metadata        # World info
      ├── diffs/          # Source of truth ⭐
      ├── snapshot/       # For reads 🚀
      └── actions/        # Audit log 📜
```

## 🔄 Data Flow

### Reading (Hybrid Approach)
```
1. Try snapshot first → /worlds/{id}/snapshot/teams/{code}
2. Fallback to base  → /baseTeams/{code}
3. Return complete data (no merging needed)
```

### Writing (Hybrid Approach)
```
1. Update diff        → /worlds/{id}/diffs/teams/{code}
2. Regenerate snapshot → /worlds/{id}/snapshot/teams/{code}
3. Log action         → /worlds/{id}/actions/{actionId}
```

## ✅ What to Implement

### Phase 1: Foundation
- [ ] Migrate `/teams` → `/architect/baseTeams`
- [ ] Migrate `/players` → `/architect/basePlayers`
- [ ] Create world metadata structure
- [ ] Build diff extraction utilities

### Phase 2: Core
- [ ] World CRUD (create, read, update, delete)
- [ ] Snapshot generation (base + diff → snapshot)
- [ ] Read logic (snapshot with base fallback)
- [ ] Write logic (diff + snapshot regen)

### Phase 3: Migration
- [ ] Shadow deploy (parallel writes)
- [ ] Validation testing
- [ ] Batch migrate user worlds
- [ ] Cutover + deprecate old

## ❌ What to Avoid

### DO NOT Implement
- ❌ Pure diff-based reads (too slow)
- ❌ Client-side merge logic (error-prone)
- ❌ Cached totals (fragile, can drift)
- ❌ Naive migration (test extensively first)

### DO Implement
- ✅ Snapshot layer (denormalized for reads)
- ✅ Server-side snapshot regen (Cloud Function)
- ✅ World metadata (creator, date, name)
- ✅ Action history (audit trail)
- ✅ On-demand totals (compute when needed)

## 🧪 Testing Checklist

Before going live:

- [ ] **Diff extraction** handles all edge cases
- [ ] **Snapshot generation** completes in <1s per team
- [ ] **Read performance** matches current (<200ms p95)
- [ ] **Migration** tested on sample worlds (100% success)
- [ ] **Security rules** prevent base data writes
- [ ] **Background jobs** regenerate snapshots on NBA updates
- [ ] **Rollback plan** ready (restore from archive)

## 🚨 Critical Paths

### Snapshot Regeneration (Background Job)
```javascript
// Triggered: After NBA data updates
// Frequency: Weekly or on-demand
// Duration: ~1-2s per world

async function regenerateSnapshots(worldId) {
  const diffs = await getDiffs(worldId);
  
  for (const teamCode of diffs.teamsTouched) {
    const base = await getBaseTeam(teamCode);
    const diff = diffs.teams[teamCode];
    const snapshot = merge(base, diff);
    await saveSnapshot(worldId, teamCode, snapshot);
  }
}
```

### Read with Fallback
```javascript
async function getTeam(worldId, teamCode) {
  // Try snapshot first
  const snapshot = await getSnapshot(worldId, teamCode);
  if (snapshot) return snapshot;
  
  // Fallback to base
  const base = await getBaseTeam(teamCode);
  return base;
}
```

## 📚 Documentation Links

| Document | Purpose | Read Time |
|----------|---------|-----------|
| [EXECUTIVE-SUMMARY.md](./EXECUTIVE-SUMMARY.md) | Decision guide | 5 min |
| [README.md](./README.md) | Navigation | 3 min |
| [04-COMPREHENSIVE-REVIEW.md](./04-COMPREHENSIVE-REVIEW.md) | Full analysis | 30 min |
| [05-VISUAL-DIAGRAMS.md](./05-VISUAL-DIAGRAMS.md) | Architecture diagrams | 15 min |
| [02-SAMPLE-SCHEMAS.md](./02-SAMPLE-SCHEMAS.md) | Schema examples | 10 min |
| [03-FILE-TREE.md](./03-FILE-TREE.md) | File structure | 10 min |

## 🎓 Key Concepts

### Immutable Base
Real NBA data that never changes from user actions. Updated only by data pipeline.

### Diff-Only Storage
Worlds store only what changed (roster swaps, contract extensions). Everything else references base.

### Snapshot Denormalization
Pre-merged complete state for fast reads. Regenerated when base or diffs change.

### Action History
Log of GM decisions (trades, signings). Foundation for undo, explain, and multiplayer.

## 💡 Pro Tips

1. **Start Small**: Test on 1 world before migrating all
2. **Validate Extensively**: Diff extraction is tricky, test edge cases
3. **Monitor Performance**: Track snapshot regen time, optimize if >2s
4. **Use Cloud Functions**: Server-side snapshot generation prevents client abuse
5. **Plan Rollback**: Keep old schema accessible for 2 weeks post-migration

## 🆘 Troubleshooting

| Issue | Likely Cause | Solution |
|-------|--------------|----------|
| Slow reads | Using pure diff approach | Add snapshot layer |
| Stale data | Snapshot not regenerated | Trigger manual regen |
| Missing players | Diff extraction incomplete | Check migration logic |
| High costs | Too many queries | Batch reads, use snapshots |
| Merge errors | Complex override logic | Simplify diff structure |

---

**Questions?** See [04-COMPREHENSIVE-REVIEW.md](./04-COMPREHENSIVE-REVIEW.md) for detailed analysis.

**Ready to implement?** See [EXECUTIVE-SUMMARY.md](./EXECUTIVE-SUMMARY.md) for roadmap.
