# Architecture Documentation Index

This directory contains all architectural documentation for the HoopZero/ScoutZero project.

## 📂 Core Architecture Documents

### [ARCHITECT_REVIEW.md](./ARCHITECT_REVIEW.md)
High-level review and design document for the Architect feature (GM sandbox simulator).
- Foundation and current implementation
- Saved worlds/universes concept
- Phase roadmap (Solo → Smart Tools → Multiplayer → Hybrid AI)
- Realism vs fun stance
- Data & update strategy

### [ARCHITECT_AGENTS.md](./ARCHITECT_AGENTS.md)
Rules and guidelines for AI agents working on the Architect feature.
- Worlds/universes principles
- Firestore safety rules
- CBA compliance requirements
- Sync & divergence handling
- MVP scope definition

### [architect-schema-review/](./architect-schema-review/) 📦 **NEW**
**Comprehensive review of proposed Firestore schema v2 for Architect.**
- Detailed technical analysis of proposed diff-based storage approach
- Performance evaluation and concerns
- Recommended hybrid snapshot + diff solution
- Migration strategy and implementation roadmap
- Visual architecture diagrams

**Quick Navigation:**
- Start here: [README.md](./architect-schema-review/README.md) for overview
- Executive summary: [04-COMPREHENSIVE-REVIEW.md](./architect-schema-review/04-COMPREHENSIVE-REVIEW.md#executive-summary)
- Visual diagrams: [05-VISUAL-DIAGRAMS.md](./architect-schema-review/05-VISUAL-DIAGRAMS.md)

### [FIRESTORE_SCHEMA.md](./FIRESTORE_SCHEMA.md)
Current Firestore database schema documentation.
- Collection structure
- Document formats
- Data relationships

### [DATA_SOURCE_MAP.md](./DATA_SOURCE_MAP.md)
Mapping of data sources and their integration points.
- External data providers
- Internal data transformations
- Update frequencies

### [DIRECTION_CHARTER.md](./DIRECTION_CHARTER.md)
Project direction and strategic goals.
- Vision and mission
- Feature priorities
- Technical decisions

### [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md)
Overall project context and conventions.
- Data collections overview
- Coding conventions
- Testing & QA approach

## 🔍 How to Use This Documentation

### For New Contributors
1. Start with [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) for high-level overview
2. Read [DIRECTION_CHARTER.md](./DIRECTION_CHARTER.md) for project goals
3. Review [FIRESTORE_SCHEMA.md](./FIRESTORE_SCHEMA.md) for data structure

### For Architect Feature Work
1. Read [ARCHITECT_REVIEW.md](./ARCHITECT_REVIEW.md) for feature design
2. Follow [ARCHITECT_AGENTS.md](./ARCHITECT_AGENTS.md) for development rules
3. Reference [architect-schema-review/](./architect-schema-review/) for schema design

### For Data Pipeline Work
1. Check [DATA_SOURCE_MAP.md](./DATA_SOURCE_MAP.md) for sources
2. Review [FIRESTORE_SCHEMA.md](./FIRESTORE_SCHEMA.md) for target schema
3. See `/docs/DATA_PIPELINE_DIAGNOSTIC_PROMPT.md` for troubleshooting

## 🆕 Recent Additions

### Architect Schema v2 Review (Latest)
Complete technical review of proposed Firestore schema redesign:
- ✅ Core concept validated: Immutable base + diff worlds
- ⚠️ Performance concerns identified: Pure diff approach too slow
- 💡 Solution recommended: Hybrid snapshot + diff system
- 📊 Metrics: 50% storage savings, same read performance as current
- 🗺️ Roadmap: 6-8 week implementation with staged rollout

**Location:** [architect-schema-review/](./architect-schema-review/)

## 📋 Document Status

| Document | Last Updated | Status |
|----------|-------------|--------|
| ARCHITECT_REVIEW.md | - | Active |
| ARCHITECT_AGENTS.md | - | Active |
| architect-schema-review/ | Oct 2024 | 🆕 New |
| FIRESTORE_SCHEMA.md | - | Active |
| DATA_SOURCE_MAP.md | - | Active |
| DIRECTION_CHARTER.md | - | Active |
| PROJECT_CONTEXT.md | - | Active |

## 🔗 Related Documentation

- [Main README](../../README.md) - Project overview
- [Developer Guide](../../DEVELOPER_GUIDE.md) - Development setup
- [API Documentation](../api/) - API reference
- [Guides](../guides/) - How-to guides
- [Compliance](../compliance/) - Rules and regulations

---

**Note:** When adding new architecture documents, please update this index and add a brief description.
