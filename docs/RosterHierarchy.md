# Roster Component Hierarchy

Relationships among components in `src/features/roster`.

```
src/features/roster
├── RosterViewer.jsx (parent)
│   ├── AddPlayerDrawer/ (parent)
│   │   ├── PlayerRowMini.jsx
│   │   └── addPlayer/
│   │       ├── BasicFilters.jsx
│   │       ├── ContractFilters.jsx
│   │       ├── DrawerHeader.jsx
│   │       ├── FilterTabs.jsx (parent)
│   │       ├── PlayerSearchBar.jsx
│   │       └── RolesFilters.jsx
│   ├── RosterControls.jsx
│   ├── RosterSection/ (parent)
│   │   ├── StarterCard.jsx
│   │   ├── RotationCard.jsx
│   │   ├── BenchCard.jsx
│   │   ├── EmptySlot.jsx
│   │   └── index.jsx
│   ├── SaveRosterModal.jsx
│   └── RosterPreviewModal.jsx (parent)
│       └── RosterSection/
├── RosterExportWrapper.jsx
├── RosterExportModal.jsx
├── RosterExportCapture.jsx
├── CreateRosterModal.jsx
└── PlayerRowMini.jsx
- **Parent** components: `RosterViewer`, `AddPlayerDrawer`, `FilterTabs`, `RosterSection`, `RosterPreviewModal`.
- **Child** components are the remaining files that do not render other roster components.
