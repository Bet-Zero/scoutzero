## Documentation & Atlas Files (AGENTS)

This project includes **auto-generated docs** under `atlas-docs/` for humans _and_ AI.

- **HUMAN_GUIDE.md** → plain-English overview of features & files
- **PLAIN_MAP.md** → skimmable file-by-file index
- **api.md** → list of exported functions/components
- **RULES_CATALOG.md / RULES_FLOW.md** → grouped rule sets + flow diagrams
- **all-deps.json** → machine-readable dependency graph (preferred for AI traversal)

### Refresh

```bash
npm run docs:all && npm run map:all
```

---

## Other Notes

- `DEVELOPER_GUIDE.md` → detailed file structure, key files, and component logic
- `README.md` → setup instructions & Atlas index
- Use `/features/profile/` and `/features/lists/` as **structural examples**

---

## Project Atlas (Docs Index) (README)

- **Human Guide:** `atlas-docs/HUMAN_GUIDE.md` (plain-English overview of features & files)
- **API Reference:** `atlas-docs/api.md` (exported functions/classes/components)
- **File Map:** `atlas-docs/PLAIN_MAP.md` (what’s where)
- **Rules:** `atlas-docs/RULES_CATALOG.md`, `atlas-docs/RULES_FLOW.md`
- **Dependency Graph (JSON):** `atlas-docs/all-deps.json` (for tools/AI)

### Refresh

```bash
npm run docs:all && npm run map:all
```
