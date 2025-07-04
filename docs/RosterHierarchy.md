# Roster Component Hierarchy

Relationships among components in `src/features/roster`.

```
src/features/roster
├── RosterViewer.jsx (parent)
│   ├── AddPlayerDrawer.jsx (parent)
│   │   ├── PlayerRowMini.jsx
│   │   └── addPlayer
│   │       ├── DrawerHeader.jsx
│   │       ├── PlayerSearchBar.jsx
│   │       └── FilterTabs.jsx (parent)
│   │           ├── BasicFilters.jsx
│   │           ├── RolesFilters.jsx
│   │           └── ContractFilters.jsx
│   ├── RosterControls.jsx
│   ├── RosterSection.jsx (parent)
│   │   ├── StarterCard.jsx
│   │   ├── RotationCard.jsx
│   │   ├── BenchCard.jsx
│   │   └── EmptySlot.jsx
│   ├── SaveRosterModal.jsx
│   └── RosterPreviewModal.jsx (parent)
│       └── RosterSection.jsx
├── RosterExportWrapper.jsx
├── RosterExportModal.jsx
├── CreateRosterModal.jsx
└── PlayerRowMini.jsx
```

- **Parent** components: `RosterViewer.jsx`, `AddPlayerDrawer.jsx`, `FilterTabs.jsx`, `RosterSection.jsx`, `RosterPreviewModal.jsx`.
- **Child** components are the remaining files that do not render other roster components.
