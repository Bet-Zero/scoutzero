# Profile Component Hierarchy

Overview of the components under `src/features/profile` and how they relate.

```
src/features/profile
├── PlayerDetails.jsx (parent)
│   ├── PlayerHeader.jsx (parent)
│   │   ├── ProfilePlayerName.jsx
│   │   └── ProfilePlayerPosition.jsx
│   ├── PlayerStatsTable.jsx
│   ├── PlayerTraitsGrid.jsx
│   ├── PlayerRolesSection.jsx (parent)
│   │   ├── SubRoleSelector.jsx
│   │   ├── ShootingProfileSelector.jsx
│   │   └── TwoWayMeter.jsx
│   ├── BadgeSelector.jsx
│   └── OverallBlurbBox.jsx
├── BreakdownModal.jsx
├── TeamPlayerDropdowns.jsx
├── TeamPlayerSelector.jsx
└── PlayerNavigation.jsx
```

- **Parent** components: `PlayerDetails.jsx`, `PlayerHeader.jsx`, `PlayerRolesSection.jsx`.
- **Child** components are the remaining files which do not render other profile components.
