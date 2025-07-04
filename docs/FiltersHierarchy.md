# Filters Component Hierarchy

This document outlines the parent-child relationships for React components under `src/features/filters`.

```
src/features/filters
├── FiltersPanel.jsx (parent)
│   ├── FilterPanelCondensed.jsx
│   └── FilterPanel.jsx (parent)
│       └── sections
│           ├── MetadataFilters.jsx
│           ├── PhysicalFilters.jsx
│           ├── ContractFilters.jsx
│           ├── RoleFilters.jsx
│           ├── StatFilters.jsx
│           ├── TraitFilters.jsx
│           ├── OverallGradeFilter.jsx
│           ├── BadgeFilters.jsx
│           └── ViewControls.jsx
├── ActiveFiltersDisplay.jsx (parent)
│   └── FilterPill.jsx (parent)
│       └── FilterContent.jsx
```

- **Parent** components: `FiltersPanel.jsx`, `FilterPanel.jsx`, `ActiveFiltersDisplay.jsx`, `FilterPill.jsx`.
- **Child** components are the remaining files which do not render other filters components.
