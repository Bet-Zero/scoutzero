/ Project root
├── AGENTS.md                     AI contributor guidelines
├── README.md                     Project overview and setup instructions
├── DEVELOPER_GUIDE.md            Detailed architecture notes
├── package.json                  Node dependencies and scripts
├── vite.config.js                Vite config with src aliasing
├── tailwind.config.js            Tailwind CSS setup
├── postcss.config.js             PostCSS pipeline
├── jsconfig.json                 Configures "@/" import alias
├── index.html                    HTML page mounting the React app
├── data/                         Sample player data and import resources
│   ├── players.json              Flattened player dataset
│   └── ...                       Additional JSON/CSV files
├── public/                       Static assets for deployment
│   ├── players.json              Public copy of player data
│   ├── fonts/                    Web fonts
│   └── assets/                   Team logos & headshots
└── src/                          Application source
    ├── App.jsx                   Defines React Router routes
    ├── main.jsx                  Entrypoint that renders <App />
    ├── index.css                 Global Tailwind styles
    ├── styles/                   Additional style sheets
    │   └── antonFont.css         Anton font face
    ├── PasswordGate.jsx          Simple password wrapper
    ├── firebaseConfig.js         Firebase initialization
    ├── firebaseHelpers.js        JS helper for Firestore reads/writes
    ├── firebase_helpers.py       Python script for admin uploads
    ├── components/
    │   ├── layout/
    │   │   └── SiteLayout.jsx    Page wrapper used by routes
    │   └── shared/
    │       ├── DropdownGroup.jsx
    │       ├── PlayerHeadshot.jsx
    │       ├── TeamLogo.jsx
    │       └── ui/
    │           ├── Dialog.jsx
    │           ├── Modal.jsx
    │           ├── ToggleButton.jsx
    │           ├── VideoExamples.jsx
    │           ├── drawers/
    │           │   ├── DrawerShell.jsx
    │           │   └── OpenDrawerButton.jsx
    │           ├── filters/
    │           │   ├── BadgeFilterSelect.jsx
    │           │   ├── MultiSelectFilter.jsx
    │           │   ├── RangeSelector.jsx
    │           │   └── RoleChecklist.jsx
    │           └── grades/
    │               └── OverallGradeBlock.jsx
    ├── features/
    │   ├── table/
    │   │   └── PlayerTable/
    │   │       ├── index.jsx
    │   │       ├── PlayerRow/
    │   │       │   ├── index.jsx
    │   │       │   └── PlayerDrawer/
    │   │       │       ├── index.jsx
    │   │       │       ├── BadgeMini.jsx
    │   │       │       ├── OverallBlurbMini.jsx
    │   │       │       ├── PlayerContractMini.jsx
    │   │       │       ├── PlayerStatsMini.jsx
    │   │       │       ├── PlayerSubRolesMini.jsx
    │   │       │       └── PlayerTraitsMiniGrid.jsx
    │   │       ├── PlayerTableHeader/
    │   │       │   ├── ControlButtons.jsx
    │   │       │   ├── SearchBar.jsx
    │   │       │   └── index.jsx
    │   │       ├── RolePill.jsx
    │   │       ├── ShootingProfileMini.jsx
    │   │       ├── SubRolePill.jsx
    │   │       └── TwoWayMini.jsx
    │   ├── profile/
    │   │   ├── BreakdownModal.jsx
    │   │   ├── PlayerDetails/
    │   │   │   ├── BadgeSelector.jsx
    │   │   │   ├── OverallBlurbBox.jsx
    │   │   │   ├── PlayerHeader/
    │   │   │   │   ├── ProfilePlayerName.jsx
    │   │   │   │   ├── ProfilePlayerPosition.jsx
    │   │   │   │   └── index.jsx
    │   │   │   ├── PlayerRolesSection/
    │   │   │   │   ├── ShootingProfileSelector.jsx
    │   │   │   │   ├── SubRoleSelector.jsx
    │   │   │   │   ├── TwoWayMeter.jsx
    │   │   │   │   └── index.jsx
    │   │   │   ├── PlayerStatsTable.jsx
    │   │   │   ├── PlayerTraitsGrid.jsx
    │   │   │   └── index.jsx
    │   │   ├── PlayerNavigation.jsx
    │   │   ├── TeamPlayerDropdowns.jsx
    │   │   └── TeamPlayerSelector.jsx
    │   ├── roster/
    │   │   ├── AddPlayerDrawer/
    │   │   │   ├── PlayerRowMini.jsx
    │   │   │   ├── addPlayer/
    │   │   │   │   ├── BasicFilters.jsx
    │   │   │   │   ├── ContractFilters.jsx
    │   │   │   │   ├── DrawerHeader.jsx
    │   │   │   │   ├── FilterTabs.jsx
    │   │   │   │   ├── PlayerSearchBar.jsx
    │   │   │   │   └── RolesFilters.jsx
    │   │   │   └── index.jsx
    │   │   ├── CreateRosterModal.jsx
    │   │   ├── RosterControls.jsx
    │   │   ├── RosterExportCapture.jsx
    │   │   ├── RosterExportModal.jsx
    │   │   ├── RosterExportWrapper.jsx
    │   │   ├── RosterPreviewModal.jsx
    │   │   ├── RosterSection/
    │   │   │   ├── BenchCard.jsx
    │   │   │   ├── EmptySlot.jsx
    │   │   │   ├── RotationCard.jsx
    │   │   │   ├── StarterCard.jsx
    │   │   │   └── index.jsx
    │   │   ├── RosterViewer.jsx
    │   │   └── SaveRosterModal.jsx
    │   ├── lists/
    │   │   ├── AddToListButton/
    │   │   │   ├── AddToListModal.jsx
    │   │   │   └── index.jsx
    │   │   ├── CreateListModal.jsx
    │   │   ├── ExportOptionsModal.jsx
    │   │   ├── ListColumnToggle.jsx
    │   │   ├── ListControls.jsx
    │   │   ├── ListExportToggle.jsx
    │   │   ├── ListExportTypeToggle.jsx
    │   │   ├── ListPreviewModal/
    │   │   │   ├── ListExportWrapper/
    │   │   │   │   ├── ListExportPlayerRowSingle.jsx
    │   │   │   │   ├── ListExportPlayerRowTwoColumn.jsx
    │   │   │   │   ├── ListExportRowCompactSingle.jsx
    │   │   │   │   ├── ListExportRowCompactTwoColumn.jsx
    │   │   │   │   └── index.jsx
    │   │   │   └── index.jsx
    │   │   ├── ListRankToggle.jsx
    │   │   ├── ListRowStyleToggle.jsx
    │   │   ├── ListTierHeader/
    │   │   │   ├── ListPlayerRow.jsx
    │   │   │   └── index.jsx
    │   │   ├── RankedListTierToggle.jsx
    │   │   ├── TierPlayerTile.jsx
    │   │   └── TieredListView/
    │   │       └── index.jsx
    │   ├── filters/
    │   │   ├── ActiveFiltersDisplay/
    │   │   │   ├── FilterPill/
    │   │   │   │   ├── FilterContent.jsx
    │   │   │   │   └── FilterPill.jsx
    │   │   │   └── index.jsx
    │   │   └── FiltersPanel/
    │   │       ├── FilterPanel/
    │   │       │   ├── sections/
    │   │       │   │   ├── BadgeFilters.jsx
    │   │       │   │   ├── ContractFilters.jsx
    │   │       │   │   ├── MetadataFilters.jsx
    │   │       │   │   ├── OverallGradeFilter.jsx
    │   │       │   │   ├── PhysicalFilters.jsx
    │   │       │   │   ├── RoleFilters.jsx
    │   │       │   │   ├── StatFilters.jsx
    │   │       │   │   ├── TraitFilters.jsx
    │   │       │   │   └── ViewControls.jsx
    │   │       │   └── index.jsx
    │   │       ├── FilterPanelCondensed.jsx
    │   │       └── index.jsx
    │   └── tierMaker/
    │       ├── CreateTierListModal.jsx
    │       ├── TierMakerBoard.jsx
    │       └── TierRow.jsx
    ├── hooks/
    │   ├── useAutoSavePlayer.js
    │   ├── useFirebaseQuery.js
    │   ├── useFilteredPlayers.js
    │   ├── usePlayerData.js
    │   └── useRosterManager.js
    ├── utils/
    │   ├── profileHelpers.js
    │   ├── filtering/
    │   │   ├── addPlayerUtils.js
    │   │   ├── filterHelpers.js
    │   │   ├── index.js
    │   │   ├── physicalOptions.js
    │   │   ├── playerFilterDefaults.js
    │   │   ├── playerFilterUtils.js
    │   │   ├── statFilters.js
    │   │   └── teamOptions.js
    │   ├── formatting/
    │   │   ├── formatHeight.js
    │   │   ├── formatSalary.js
    │   │   ├── playerAliasMap.js
    │   │   ├── teamColors.js
    │   │   └── teamLogos.js
    │   ├── roles/
    │   │   ├── expandPositionGroup.js
    │   │   ├── index.js
    │   │   ├── positionMap.js
    │   │   ├── roleLabel.js
    │   │   ├── roleOptions.js
    │   │   └── subRoleUtils.js
    │   └── roster/
    │       ├── contractUtils.js
    │       ├── index.js
    │       ├── normalizePlayerData.js
    │       └── rosterUtils.js
    ├── constants/
    │   ├── SubRoleMasterList.js
    │   ├── badgeList.js
    │   └── styles.js
    ├── firebase/
    │   ├── listHelpers.js
    │   └── rosterHelpers.js
    └── pages/
        ├── ExportRowPreview.jsx
        ├── ListManager.jsx
        ├── ListPresentationView.jsx
        ├── ListsHome.jsx
        ├── NotFound.jsx
        ├── PlayerProfileView.jsx
        ├── PlayerTableView.jsx
        ├── RostersHome.jsx
        ├── TeamRosterView.jsx
        ├── RosterExportView.jsx
        ├── TierListHome.jsx
        ├── TierListsHome.jsx
        └── TierMakerView.jsx
