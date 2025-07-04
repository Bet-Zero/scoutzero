# Table Component Hierarchy

This document maps the React components under `src/features/table`. Parent components are noted when they render other components from the same folder.

```
src/features/table
├── PlayerTable.jsx (parent)
│   ├── PlayerTableHeader.jsx (parent)
│   │   ├── SearchBar.jsx
│   │   └── ControlButtons.jsx
│   └── PlayerRow.jsx (parent)
│       ├── PlayerNameMini.jsx
│       ├── ShootingProfileMini.jsx
│       ├── RolePill.jsx
│       ├── PlayerDrawer.jsx (parent)
│       │   ├── BadgeMini.jsx
│       │   ├── OverallBlurbMini.jsx
│       │   ├── PlayerSubRolesMini.jsx
│       │   ├── PlayerContractMini.jsx
│       │   ├── PlayerStatsMini.jsx
│       │   └── PlayerTraitsMiniGrid.jsx
│       └── (uses external components: AddToListButton, TeamLogo, OverallGradeBlock)
├── TwoWayMini.jsx (child standalone)
└── SubRolePill.jsx (child standalone)
```

- **Parent** components: `PlayerTable.jsx`, `PlayerTableHeader.jsx`, `PlayerRow.jsx`, `PlayerDrawer.jsx`.
- **Child** components are the remaining files which don't render other table components.
