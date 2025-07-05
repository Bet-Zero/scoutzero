# Lists Component Hierarchy

Parent-child relationships for components in `src/features/lists`.

```
src/features/lists
├── AddToListButton/ (parent)
│   └── AddToListModal.jsx
├── ListPreviewModal/ (parent)
│   └── ListExportWrapper/ (parent)
│       ├── ListExportPlayerRowSingle.jsx
│       ├── ListExportPlayerRowTwoColumn.jsx
│       ├── ListExportRowCompactSingle.jsx
│       ├── ListExportRowCompactTwoColumn.jsx
│       └── ListTierExport.jsx (parent)
│           └── TierPlayerTile.jsx
├── ListTierHeader/ (parent)
│   └── ListPlayerRow.jsx
├── TieredListView/ (parent)
│   └── TierPlayerTile.jsx
├── CreateListModal.jsx
├── ExportOptionsModal.jsx
├── ListColumnToggle.jsx
├── ListControls.jsx
├── ListExportToggle.jsx
├── ListRankToggle.jsx
├── ListRowStyleToggle.jsx
├── ListExportTypeToggle.jsx
└── RankedListTierToggle.jsx
```

- **Parent** components: `AddToListButton`, `ListPreviewModal`, `ListExportWrapper`, `ListTierExport`, `ListTierHeader`, `TieredListView`.
- **Child** components are the remaining files that do not nest other list components.
