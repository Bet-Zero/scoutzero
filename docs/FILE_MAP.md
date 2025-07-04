/ Project root
├── AGENTS.md AI contributor guidelines
├── README.md Project overview and setup instructions
├── DEVELOPER_GUIDE.md Detailed architecture notes
├── package.json Node dependencies and scripts
├── vite.config.js Vite config with src aliasing
├── tailwind.config.js Tailwind CSS setup
├── postcss.config.js PostCSS pipeline
├── jsconfig.json Configures "@/” import alias
├── index.html HTML page mounting the React app
├── data/ Sample player data and import resources
│ ├── players.json Flattened player dataset
│ └── ... Additional JSON/CSV files
├── public/ Static assets for deployment
│ ├── players.json Public copy of player data
│ └── assets/ Team logos & headshots
└── src/ Application source
├── App.jsx Defines React Router routes
├── main.jsx Entrypoint that renders <App />
├── index.css Global Tailwind styles
├── PasswordGate.jsx Simple password wrapper
├── firebaseConfig.js Firebase initialization
├── firebaseHelpers.js JS helper for Firestore reads/writes
├── firebase_helpers.py Python script for admin uploads
├── components/
│ ├── layout/
│ │ └── SiteLayout.jsx Page wrapper used by routes
│ └── shared/
│ ├── PlayerHeadshot.jsx Renders player images
│ ├── TeamLogo.jsx Displays team logos
│ ├── DropdownGroup.jsx Styled dropdown menu group
│ └── ui/
│ ├── Modal.jsx Generic modal component
│ ├── Dialog.jsx Confirmation dialog
│ ├── VideoExamples.jsx Optional video embed
│ ├── ToggleButton.jsx Simple toggle button
│ ├── drawers/
│ │ ├── DrawerShell.jsx Base sliding drawer
│ │ └── OpenDrawerButton.jsx Trigger to open drawers
│ ├── filters/
│ │ ├── RangeSelector.jsx Range slider control
│ │ ├── RoleChecklist.jsx Checkbox list for roles
│ │ ├── MultiSelectFilter.jsx Reusable multi-select
│ │ └── BadgeFilterSelect.jsx Badge selection widget
│ └── grades/
│ └── OverallGradeBlock.jsx Displays overall letter grade
├── features/
│ ├── table/ Player table components
│ │ ├── PlayerTable.jsx Main table; uses usePlayerData + filters
│ │ ├── PlayerRow.jsx Expandable player row
│ │ ├── PlayerDrawer.jsx Drawer with detailed info
│ │ ├── PlayerStatsMini.jsx Compact stats display
│ │ ├── PlayerContractMini.jsx Contract snippet
│ │ ├── PlayerSubRolesMini.jsx Shows subrole pills
│ │ ├── PlayerNameMini.jsx Styled name display
│ │ ├── PlayerTraitsMiniGrid.jsx Mini trait grid
│ │ ├── OverallBlurbMini.jsx Short overall blurb
│ │ ├── RolePill.jsx Main role pill
│ │ ├── SubRolePill.jsx Subrole label
│ │ ├── ShootingProfileMini.jsx Shooting profile tag
│ │ ├── TwoWayMini.jsx Mini two-way meter
│ │ ├── PlayerTableHeader.jsx Column headers
│ │ ├── SearchBar.jsx Search box
│ │ └── ControlButtons.jsx Show/hide filter buttons
│ ├── profile/ Player profile editor pieces
│ │ ├── PlayerDetails.jsx Bio and contract section
│ │ ├── PlayerRolesSection.jsx Editable offense/defense roles
│ │ ├── PlayerStatsTable.jsx Full stats table
│ │ ├── PlayerTraitsGrid.jsx Editable trait grid
│ │ ├── TwoWayMeter.jsx Two-way slider
│ │ ├── ShootingProfileSelector.jsx Pick shooting profile tier
│ │ ├── BadgeSelector.jsx Choose player badges
│ │ ├── SubRoleSelector.jsx Manage subroles
│ │ ├── OverallBlurbBox.jsx Text area for overall blurb
│ │ ├── BreakdownModal.jsx Modal showing trait/role info
│ │ ├── TeamPlayerDropdowns.jsx Team & player dropdowns
│ │ ├── TeamPlayerSelector.jsx Roster-based player selector
│ │ ├── PlayerHeader.jsx Header with name/info
│ │ ├── PlayerNavigation.jsx Prev/next navigation
│ │ └── ProfilePlayerPosition.jsx Displays primary position
│ ├── roster/ Roster builder tools
│ │ ├── RosterViewer.jsx Orchestrates sections of the roster
│ │ ├── RosterControls.jsx Team selectors & options
│ │ ├── RosterSection.jsx Displays starter/bench groups
│ │ ├── RosterExportWrapper.jsx Export container
│ │ ├── RosterExportModal.jsx Export roster to image/JSON
│ │ ├── SaveRosterModal.jsx Save roster to Firestore
│ │ ├── CreateRosterModal.jsx Create new roster project
│ │ ├── StarterCard.jsx Card for starting player
│ │ ├── BenchCard.jsx Bench card
│ │ ├── RotationCard.jsx Rotation slot card
│ │ ├── EmptySlot.jsx Placeholder for empty slot
│ │ ├── PlayerRowMini.jsx Compact row for drawer list
│ │ ├── AddPlayerDrawer.jsx Drawer with filters for adding players
│ │ └── addPlayer/
│ │ ├── DrawerHeader.jsx Header inside drawer
│ │ ├── PlayerSearchBar.jsx Search field
│ │ ├── FilterTabs.jsx Tabs for filter groups
│ │ ├── BasicFilters.jsx Team/position filters
│ │ ├── RolesFilters.jsx Offense/defense role filters
│ │ └── ContractFilters.jsx Contract filtering
│ ├── lists/ Player list management
│ │ ├── ListControls.jsx Edit list settings
│ │ ├── AddToListButton.jsx Adds a player into a list
│ │ ├── ListPlayerRow.jsx Full row built on PlayerRow
│ │ ├── TieredListView.jsx Grouped tier display
│ │ ├── TierPlayerTile.jsx Player tile in tier view
│ │ ├── ListRowStyleToggle.jsx Toggle ranked vs tile view
│ │ ├── ListRankToggle.jsx Show/hide ranks
│ │ ├── ListTierHeader.jsx Tier header bar
│ │ ├── ListExportWrapper.jsx Handles export operations
│ │ ├── ExportOptionsModal.jsx Options for exporting list
│ │ ├── CreateListModal.jsx Create new list dialog
│ │ ├── ListColumnToggle.jsx Toggle visible columns
│ │ ├── ListExportToggle.jsx Toggle export mode
│ │ ├── ListTierExport.jsx Export tiered list
│ │ ├── ListExportPlayerRowSingle.jsx Single column export row
│ │ ├── ListExportPlayerRowTwoColumn.jsx Two column export row
│ │ ├── ListExportRowCompactSingle.jsx Single column compact row
│ │ ├── ListExportRowCompactTwoColumn.jsx Two column compact row
│ │ ├── RankedListTierToggle.jsx Switch ranked vs tier view
│ │ └── ListExportTypeToggle.jsx Choose export type
│ ├── filters/ Filtering UI modules
│ │ ├── FiltersPanel.jsx Slide-out filter panel
│ │ ├── FilterContent.jsx Container for filter form
│ │ ├── FilterPill.jsx Pill representing an active filter
│ │ ├── ActiveFiltersDisplay.jsx Shows current filter pills
│ │ ├── FilterPanel.jsx Full filter sidebar
│ │ ├── FilterPanelCondensed.jsx Condensed filter controls
│ │ └── sections/
│ │ ├── MetadataFilters.jsx Filters by team/conf/etc
│ │ ├── PhysicalFilters.jsx Height/weight filtering
│ │ ├── ContractFilters.jsx Contract-based filtering
│ │ ├── RoleFilters.jsx Filter by primary roles
│ │ ├── TraitFilters.jsx Filter by trait grades
│ │ ├── StatFilters.jsx Advanced stat filters
│ │ ├── BadgeFilters.jsx Filter by badges
│ │ ├── OverallGradeFilter.jsx Filter by overall grade
│ │ └── ViewControls.jsx Sorting and view settings
│ └── tierMaker/ Tier list creation tools
│ ├── TierMakerBoard.jsx Drag-and-drop board of tiers
│ ├── TierRow.jsx Row representing a tier
│ └── CreateTierListModal.jsx Modal for saving tier lists
├── hooks/
│ ├── usePlayerData.js Load players via Firebase
│ ├── useFilteredPlayers.js Filter/sort players memoized
│ ├── useFirebaseQuery.js Generic Firestore collection hook
│ ├── useAutoSavePlayer.js Auto-save profile edits
│ └── useRosterManager.js Manage roster state and Firestore sync
├── utils/
│ ├── profileHelpers.js Modal titles and blurb helpers
│ ├── filtering/
│ │ ├── index.js Re-exports filtering modules
│ │ ├── filterHelpers.js Helper functions for filters
│ │ ├── playerFilterUtils.js Core filtering and sorting logic
│ │ ├── playerFilterDefaults.js Default filter values
│ │ ├── statFilters.js Stat options
│ │ ├── physicalOptions.js Height/weight choices
│ │ ├── teamOptions.js Team select options
│ │ └── addPlayerUtils.js Filters for AddPlayerDrawer
│ ├── formatting/
│ │ ├── formatHeight.js Format height values
│ │ ├── formatSalary.js Format salary text
│ │ ├── playerAliasMap.js Map of common name variants
│ │ └── teamColors.js Team color data
│ ├── roles/
│ │ ├── roleOptions.js Offense/defense role lists
│ │ ├── roleLabel.js Map role values to labels
│ │ ├── expandPositionGroup.js Expand grouped positions
│ │ ├── positionMap.js Short position mapping
│ │ └── subRoleUtils.js Helpers for subrole lists
│ └── roster/
│ ├── rosterUtils.js Roster manipulation helpers
│ ├── contractUtils.js Contract parsing logic
│ ├── normalizePlayerData.js Normalize Firestore player docs
│ └── index.js Re-exports roster utilities
├── constants/
│ ├── badgeList.js Definitions of player badges
│ ├── SubRoleMasterList.js Master list of subroles
│ └── styles.js Common inline style objects
├── firebase/
│ ├── listHelpers.js CRUD helpers for saved lists
│ └── rosterHelpers.js CRUD helpers for roster projects
└── pages/
├── PlayerTableView.jsx Route rendering PlayerTable
├── PlayerProfileView.jsx Route for editing player profiles
├── TeamRosterView.jsx Main roster builder page
├── RostersHome.jsx List of saved rosters
├── ListsHome.jsx Entry for player lists
├── ListManager.jsx Full list management view
├── ListPresentationView.jsx Printable/export view of a list
├── TierMakerView.jsx Page hosting tier maker board
├── TierListsHome.jsx Shows saved tier lists
├── ExportRowPreview.jsx Displays sample export row
└── NotFound.jsx Fallback 404 page
