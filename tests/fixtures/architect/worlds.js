/**
 * Test Fixtures: Architect Worlds
 * 
 * Sample world metadata structures for testing world management,
 * branching, and parent/child relationships.
 * 
 * @file tests/fixtures/architect/worlds.js
 */

export const SAMPLE_WORLD_METADATA = {
  worldId: 'world_1234567890_abc123',
  worldName: 'Test World',
  description: 'A test world for unit testing',
  createdBy: 'user_123',
  createdAt: '2025-01-01T00:00:00Z',
  lastModifiedAt: '2025-01-01T00:00:00Z',
  currentSeason: '2025-26',
  baselineSeason: '2025-26',
  parentWorldId: null,
  branchedFrom: null,
  childWorlds: [],
  modifiedTeams: [],
  actionCount: 0,
  tags: [],
  isArchived: false,
  isFavorite: false,
  stats: {
    totalTrades: 0,
    totalSignings: 0,
    totalWaives: 0,
    teamsInvolved: 0,
  },
};

export const PARENT_WORLD_METADATA = {
  worldId: 'world_parent_123',
  worldName: 'Parent World',
  description: 'A parent world for branching tests',
  createdBy: 'user_123',
  createdAt: '2025-01-01T00:00:00Z',
  lastModifiedAt: '2025-01-01T00:00:00Z',
  currentSeason: '2025-26',
  baselineSeason: '2025-26',
  parentWorldId: null,
  branchedFrom: null,
  childWorlds: ['world_child_456'],
  modifiedTeams: ['LAL', 'GSW'],
  actionCount: 2,
  tags: [],
  isArchived: false,
  isFavorite: false,
  stats: {
    totalTrades: 1,
    totalSignings: 0,
    totalWaives: 0,
    teamsInvolved: 2,
  },
};

export const CHILD_WORLD_METADATA = {
  worldId: 'world_child_456',
  worldName: 'Child World',
  description: 'A child world branched from parent',
  createdBy: 'user_123',
  createdAt: '2025-01-02T00:00:00Z',
  lastModifiedAt: '2025-01-02T00:00:00Z',
  currentSeason: '2025-26',
  baselineSeason: '2025-26',
  parentWorldId: 'world_parent_123',
  branchedFrom: '2025-01-02T00:00:00Z',
  childWorlds: [],
  modifiedTeams: ['BOS'],
  actionCount: 1,
  tags: [],
  isArchived: false,
  isFavorite: false,
  stats: {
    totalTrades: 0,
    totalSignings: 1,
    totalWaives: 0,
    teamsInvolved: 1,
  },
};

export const ARCHIVED_WORLD_METADATA = {
  worldId: 'world_archived_789',
  worldName: 'Archived World',
  description: 'An archived world',
  createdBy: 'user_123',
  createdAt: '2024-12-01T00:00:00Z',
  lastModifiedAt: '2024-12-15T00:00:00Z',
  currentSeason: '2024-25',
  baselineSeason: '2024-25',
  parentWorldId: null,
  branchedFrom: null,
  childWorlds: [],
  modifiedTeams: [],
  actionCount: 0,
  tags: [],
  isArchived: true,
  isFavorite: false,
  stats: {
    totalTrades: 0,
    totalSignings: 0,
    totalWaives: 0,
    teamsInvolved: 0,
  },
};

export const MULTI_USER_WORLD_METADATA = {
  worldId: 'world_user2_999',
  worldName: 'User 2 World',
  description: 'A world created by a different user',
  createdBy: 'user_456',
  createdAt: '2025-01-01T00:00:00Z',
  lastModifiedAt: '2025-01-01T00:00:00Z',
  currentSeason: '2025-26',
  baselineSeason: '2025-26',
  parentWorldId: null,
  branchedFrom: null,
  childWorlds: [],
  modifiedTeams: [],
  actionCount: 0,
  tags: [],
  isArchived: false,
  isFavorite: false,
  stats: {
    totalTrades: 0,
    totalSignings: 0,
    totalWaives: 0,
    teamsInvolved: 0,
  },
};

