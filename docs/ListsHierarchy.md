# Lists Component Hierarchy

Parent-child relationships for components in `src/features/lists`.

```
src/features/lists
├── AddToListButton.jsx (parent)
│   └── AddToListModal.jsx
├── ListPreviewModal.jsx (parent)
│   └── ListExportWrapper.jsx (parent)
│       ├── ListExportPlayerRowSingle.jsx
│       ├── ListExportPlayerRowTwoColumn.jsx
│       ├── ListExportRowCompactSingle.jsx
│       ├── ListExportRowCompactTwoColumn.jsx
│       └── ListTierExport.jsx (parent)
│           └── TierPlayerTile.jsx
├── ListTierHeader.jsx (parent)
│   └── ListPlayerRow.jsx
├── TieredListView.jsx (parent)
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

- **Parent** components: `AddToListButton.jsx`, `ListPreviewModal.jsx`, `ListExportWrapper.jsx`, `ListTierExport.jsx`, `ListTierHeader.jsx`, `TieredListView.jsx`.
- **Child** components are the remaining files that do not nest other list components.
