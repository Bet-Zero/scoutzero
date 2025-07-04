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
│ │ ├── PlayerTable/index.jsx Main table; uses usePlayerData + filters
│ │ ├── PlayerRow/index.jsx Expandable player row
│ │ ├── PlayerDrawer/index.jsx Drawer with detailed info
│ │ ├── PlayerStatsMini/index.jsx Compact stats display
│ │ ├── PlayerContractMini/index.jsx Contract snippet
│ │ ├── PlayerSubRolesMini/index.jsx Shows subrole pills
│ │ ├── PlayerNameMini/index.jsx Styled name display
│ │ ├── PlayerTraitsMiniGrid/index.jsx Mini trait grid
│ │ ├── OverallBlurbMini/index.jsx Short overall blurb
│ │ ├── RolePill/index.jsx Main role pill
│ │ ├── SubRolePill/index.jsx Subrole label
│ │ ├── ShootingProfileMini/index.jsx Shooting profile tag
│ │ ├── TwoWayMini/index.jsx Mini two-way meter
│ │ ├── PlayerTableHeader/index.jsx Column headers
│ │ ├── SearchBar/index.jsx Search box
│ │ └── ControlButtons/index.jsx Show/hide filter buttons
│ ├── profile/ Player profile editor pieces
│ │ ├── PlayerDetails/index.jsx Bio and contract section
│ │ ├── PlayerRolesSection/index.jsx Editable offense/defense roles
│ │ ├── PlayerStatsTable/index.jsx Full stats table
│ │ ├── PlayerTraitsGrid/index.jsx Editable trait grid
│ │ ├── TwoWayMeter/index.jsx Two-way slider
│ │ ├── ShootingProfileSelector/index.jsx Pick shooting profile tier
│ │ ├── BadgeSelector/index.jsx Choose player badges
│ │ ├── SubRoleSelector/index.jsx Manage subroles
│ │ ├── OverallBlurbBox/index.jsx Text area for overall blurb
│ │ ├── BreakdownModal/index.jsx Modal showing trait/role info
│ │ ├── TeamPlayerDropdowns/index.jsx Team & player dropdowns
│ │ ├── TeamPlayerSelector/index.jsx Roster-based player selector
│ │ ├── PlayerHeader/index.jsx Header with name/info
│ │ ├── PlayerNavigation/index.jsx Prev/next navigation
│ │ └── ProfilePlayerPosition/index.jsx Displays primary position
│ ├── roster/ Roster builder tools
│ │ ├── RosterViewer/index.jsx Orchestrates sections of the roster
│ │ ├── RosterControls/index.jsx Team selectors & options
│ │ ├── RosterSection/index.jsx Displays starter/bench groups
│ │ ├── RosterExportWrapper/index.jsx Export container
│ │ ├── RosterExportModal/index.jsx Export roster to image/JSON
│ │ ├── SaveRosterModal/index.jsx Save roster to Firestore
│ │ ├── CreateRosterModal/index.jsx Create new roster project
│ │ ├── StarterCard/index.jsx Card for starting player
│ │ ├── BenchCard/index.jsx Bench card
│ │ ├── RotationCard/index.jsx Rotation slot card
│ │ ├── EmptySlot/index.jsx Placeholder for empty slot
│ │ ├── PlayerRowMini/index.jsx Compact row for drawer list
│ │ ├── AddPlayerDrawer/index.jsx Drawer with filters for adding players
│ │ └── addPlayer/
│ │ ├── DrawerHeader/index.jsx Header inside drawer
│ │ ├── PlayerSearchBar/index.jsx Search field
│ │ ├── FilterTabs/index.jsx Tabs for filter groups
│ │ ├── BasicFilters/index.jsx Team/position filters
│ │ ├── RolesFilters/index.jsx Offense/defense role filters
│ │ └── ContractFilters/index.jsx Contract filtering
│ ├── lists/ Player list management
│ │ ├── ListControls/index.jsx Edit list settings
│ │ ├── AddToListButton/index.jsx Adds a player into a list
│ │ ├── ListPlayerRow/index.jsx Full row built on PlayerRow
│ │ ├── TieredListView/index.jsx Grouped tier display
│ │ ├── TierPlayerTile/index.jsx Player tile in tier view
│ │ ├── ListRowStyleToggle/index.jsx Toggle ranked vs tile view
│ │ ├── ListRankToggle/index.jsx Show/hide ranks
│ │ ├── ListTierHeader/index.jsx Tier header bar
│ │ ├── ListExportWrapper/index.jsx Handles export operations
│ │ ├── ExportOptionsModal/index.jsx Options for exporting list
│ │ ├── CreateListModal/index.jsx Create new list dialog
│ │ ├── ListColumnToggle/index.jsx Toggle visible columns
│ │ ├── ListExportToggle/index.jsx Toggle export mode
│ │ ├── ListTierExport/index.jsx Export tiered list
│ │ ├── ListExportPlayerRowSingle/index.jsx Single column export row
│ │ ├── ListExportPlayerRowTwoColumn/index.jsx Two column export row
│ │ ├── ListExportRowCompactSingle/index.jsx Single column compact row
│ │ ├── ListExportRowCompactTwoColumn/index.jsx Two column compact row
│ │ ├── RankedListTierToggle/index.jsx Switch ranked vs tier view
│ │ └── ListExportTypeToggle/index.jsx Choose export type
│ ├── filters/ Filtering UI modules
│ │ ├── FiltersPanel/index.jsx Slide-out filter panel
│ │ ├── FilterContent/index.jsx Container for filter form
│ │ ├── FilterPill/index.jsx Pill representing an active filter
│ │ ├── ActiveFiltersDisplay/index.jsx Shows current filter pills
│ │ ├── FilterPanel/index.jsx Full filter sidebar
│ │ ├── FilterPanelCondensed/index.jsx Condensed filter controls
│ │ └── sections/
│ │ ├── MetadataFilters/index.jsx Filters by team/conf/etc
│ │ ├── PhysicalFilters/index.jsx Height/weight filtering
│ │ ├── ContractFilters/index.jsx Contract-based filtering
│ │ ├── RoleFilters/index.jsx Filter by primary roles
│ │ ├── TraitFilters/index.jsx Filter by trait grades
│ │ ├── StatFilters/index.jsx Advanced stat filters
│ │ ├── BadgeFilters/index.jsx Filter by badges
│ │ ├── OverallGradeFilter/index.jsx Filter by overall grade
│ │ └── ViewControls/index.jsx Sorting and view settings
│ └── tierMaker/ Tier list creation tools
│ ├── TierMakerBoard/index.jsx Drag-and-drop board of tiers
│ ├── TierRow/index.jsx Row representing a tier
│ └── CreateTierListModal/index.jsx Modal for saving tier lists
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
