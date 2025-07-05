# Filters Component Hierarchy

This document outlines the parent-child relationships for React components under `src/features/filters`.

```
src/features/filters
├── FiltersPanel/ (parent)
│   ├── FilterPanelCondensed.jsx
│   └── FilterPanel/ (parent)
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
├── ActiveFiltersDisplay/ (parent)
│   └── FilterPill/ (parent)
│       └── FilterContent.jsx
```

- **Parent** components: `FiltersPanel`, `FilterPanel`, `ActiveFiltersDisplay`, `FilterPill`.
- **Child** components are the remaining files which do not render other filters components.
