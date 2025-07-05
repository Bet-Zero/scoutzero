# Table Component Hierarchy

This document maps the React components under `src/features/table`. Parent components are noted when they render other components from the same folder.

```
src/features/table
└── PlayerTable/ (parent)
    ├── PlayerTableHeader/ (parent)
    │   ├── SearchBar.jsx
    │   └── ControlButtons.jsx
    ├── PlayerRow/ (parent)
    │   ├── PlayerNameMini.jsx
    │   ├── ShootingProfileMini.jsx
    │   ├── RolePill.jsx
    │   ├── PlayerDrawer/ (parent)
    │   │   ├── BadgeMini.jsx
    │   │   ├── OverallBlurbMini.jsx
    │   │   ├── PlayerSubRolesMini.jsx
    │   │   ├── PlayerContractMini.jsx
    │   │   ├── PlayerStatsMini.jsx
    │   │   └── PlayerTraitsMiniGrid.jsx
    │   └── index.jsx
    ├── SubRolePill.jsx (child standalone)
    └── TwoWayMini.jsx (child standalone)
```

- **Parent** components: `PlayerTable`, `PlayerTableHeader`, `PlayerRow`, `PlayerDrawer`.
- **Child** components are the remaining files which don't render other table components.
