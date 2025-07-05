# Profile Component Hierarchy

Overview of the components under `src/features/profile` and how they relate.

```
src/features/profile
├── PlayerDetails/ (parent)
│   ├── PlayerHeader/ (parent)
│   │   ├── ProfilePlayerName.jsx
│   │   └── ProfilePlayerPosition.jsx
│   ├── PlayerStatsTable.jsx
│   ├── PlayerTraitsGrid.jsx
│   ├── PlayerRolesSection/ (parent)
│   │   ├── ShootingProfileSelector.jsx
│   │   ├── SubRoleSelector.jsx
│   │   ├── TwoWayMeter.jsx
│   │   └── index.jsx
│   ├── BadgeSelector.jsx
│   ├── OverallBlurbBox.jsx
│   └── index.jsx
├── BreakdownModal.jsx
├── TeamPlayerDropdowns.jsx
├── TeamPlayerSelector.jsx
└── PlayerNavigation.jsx
```

- **Parent** components: `PlayerDetails`, `PlayerHeader`, `PlayerRolesSection`.
- **Child** components are the remaining files which do not render other profile components.
