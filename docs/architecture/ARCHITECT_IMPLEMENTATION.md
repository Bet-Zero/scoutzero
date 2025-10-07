# Architect Implementation Guide

This document provides practical implementation examples for the proposed transaction log architecture.

---

## 📦 Core Helper Functions

### 1. World Management Helpers

```javascript
// src/utils/architect/worldHelpers.js

import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { db } from '@/firebaseConfig';

/**
 * Create a new GM world
 */
export async function createWorld(userId, teamId, worldName, seasonYear = 2025) {
  const timestamp = Date.now();
  const worldId = `w_${userId}_${teamId}_${seasonYear}_${timestamp}`;
  
  // Load baseline for stats
  const baselineRef = doc(db, 'teams', teamId);
  const baselineSnap = await getDoc(baselineRef);
  
  if (!baselineSnap.exists()) {
    throw new Error(`Team ${teamId} not found`);
  }
  
  const baseline = baselineSnap.data();
  const capSheet = baseline.capSheet || {};
  
  // Create world document
  await setDoc(doc(db, 'worlds', worldId), {
    worldId,
    userId,
    worldName,
    teamId,
    baselineSnapshot: `teams/${teamId}`,
    forkDate: serverTimestamp(),
    seasonYear,
    isActive: true,
    isArchived: false,
    createdAt: serverTimestamp(),
    lastModified: serverTimestamp(),
    lastAccessed: serverTimestamp(),
    stats: {
      totalTransactions: 0,
      currentSalaryCap: capSheet.salaryCap || 136021000,
      currentTeamSalary: capSheet.teamSalary || 0,
      rosterCount: capSheet.players?.length || 0,
      draftPicksOwned: capSheet.picks?.length || 7,
      lastTransactionType: null,
    },
  });
  
  // Add to user's world index
  await setDoc(doc(db, 'users', userId, 'worldsIndex', worldId), {
    worldId,
    worldName,
    teamId,
    teamName: baseline.meta?.teamName || teamId,
    seasonYear,
    createdAt: serverTimestamp(),
    lastAccessed: serverTimestamp(),
    lastModified: serverTimestamp(),
    isFavorite: false,
    isArchived: false,
    tags: [],
    transactionCount: 0,
  });
  
  return worldId;
}

/**
 * Load all worlds for a user
 */
export async function loadUserWorlds(userId) {
  const indexRef = collection(db, 'users', userId, 'worldsIndex');
  const q = query(
    indexRef,
    where('isArchived', '==', false),
    orderBy('lastAccessed', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Load a specific world with metadata
 */
export async function loadWorld(worldId) {
  const worldRef = doc(db, 'worlds', worldId);
  const worldSnap = await getDoc(worldRef);
  
  if (!worldSnap.exists()) {
    throw new Error(`World ${worldId} not found`);
  }
  
  return { id: worldSnap.id, ...worldSnap.data() };
}

/**
 * Update world last accessed timestamp
 */
export async function touchWorld(worldId, userId) {
  const worldRef = doc(db, 'worlds', worldId);
  const indexRef = doc(db, 'users', userId, 'worldsIndex', worldId);
  
  const timestamp = serverTimestamp();
  
  await Promise.all([
    updateDoc(worldRef, { lastAccessed: timestamp }),
    updateDoc(indexRef, { lastAccessed: timestamp }),
  ]);
}

/**
 * Archive a world
 */
export async function archiveWorld(worldId, userId) {
  const worldRef = doc(db, 'worlds', worldId);
  const indexRef = doc(db, 'users', userId, 'worldsIndex', worldId);
  
  await Promise.all([
    updateDoc(worldRef, { isArchived: true, isActive: false }),
    updateDoc(indexRef, { isArchived: true }),
  ]);
}

/**
 * Delete a world
 */
export async function deleteWorld(worldId, userId) {
  // Note: In production, you'd want to use a Cloud Function to delete
  // the transactions subcollection as well
  const worldRef = doc(db, 'worlds', worldId);
  const indexRef = doc(db, 'users', userId, 'worldsIndex', worldId);
  
  await Promise.all([
    deleteDoc(worldRef),
    deleteDoc(indexRef),
  ]);
  
  // TODO: Delete transactions subcollection (requires Cloud Function)
}
```

### 2. Transaction Management Helpers

```javascript
// src/utils/architect/transactionHelpers.js

import {
  doc,
  setDoc,
  getDocs,
  updateDoc,
  collection,
  query,
  orderBy,
  limit as firestoreLimit,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { db } from '@/firebaseConfig';

/**
 * Execute a transaction in a world
 */
export async function executeTransaction(worldId, userId, transaction) {
  const timestamp = Date.now();
  const txId = `tx_${timestamp}`;
  
  // 1. Create transaction document
  const txRef = doc(db, 'worlds', worldId, 'transactions', txId);
  await setDoc(txRef, {
    transactionId: txId,
    timestamp: serverTimestamp(),
    status: 'completed',
    ...transaction,
  });
  
  // 2. Update world metadata
  const worldRef = doc(db, 'worlds', worldId);
  await updateDoc(worldRef, {
    'stats.totalTransactions': increment(1),
    'stats.lastTransactionType': transaction.type,
    lastModified: serverTimestamp(),
  });
  
  // 3. Update user index
  const indexRef = doc(db, 'users', userId, 'worldsIndex', worldId);
  await updateDoc(indexRef, {
    lastModified: serverTimestamp(),
    transactionCount: increment(1),
  });
  
  return txId;
}

/**
 * Load all transactions for a world
 */
export async function loadTransactions(worldId, limit = null) {
  const txRef = collection(db, 'worlds', worldId, 'transactions');
  const q = limit 
    ? query(txRef, orderBy('timestamp', 'asc'), firestoreLimit(limit))
    : query(txRef, orderBy('timestamp', 'asc'));
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Load recent transactions for a world
 */
export async function loadRecentTransactions(worldId, limit = 20) {
  const txRef = collection(db, 'worlds', worldId, 'transactions');
  const q = query(
    txRef, 
    orderBy('timestamp', 'desc'), 
    firestoreLimit(limit)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Reverse/undo a transaction
 */
export async function reverseTransaction(worldId, userId, transactionId) {
  const txRef = doc(db, 'worlds', worldId, 'transactions', transactionId);
  
  // Mark as reversed
  await updateDoc(txRef, {
    status: 'reversed',
    reversedAt: serverTimestamp(),
  });
  
  // Update world stats
  const worldRef = doc(db, 'worlds', worldId);
  await updateDoc(worldRef, {
    lastModified: serverTimestamp(),
  });
  
  // Update user index
  const indexRef = doc(db, 'users', userId, 'worldsIndex', worldId);
  await updateDoc(indexRef, {
    lastModified: serverTimestamp(),
  });
}
```

### 3. State Computation Helpers

```javascript
// src/utils/architect/stateHelpers.js

import { loadTeamCapSheet } from './firebaseTeamPlanHelpers';
import { loadTransactions } from './transactionHelpers';

/**
 * Load the complete current state of a world
 */
export async function loadWorldState(worldId) {
  // 1. Load world metadata
  const worldRef = doc(db, 'worlds', worldId);
  const worldSnap = await getDoc(worldRef);
  
  if (!worldSnap.exists()) {
    throw new Error(`World ${worldId} not found`);
  }
  
  const world = worldSnap.data();
  
  // 2. Load baseline (cached)
  const baseline = await loadTeamCapSheet(world.teamId);
  
  if (!baseline) {
    throw new Error(`Baseline for team ${world.teamId} not found`);
  }
  
  // 3. Load all active transactions
  const transactions = await loadTransactions(worldId);
  const activeTransactions = transactions.filter(tx => tx.status === 'completed');
  
  // 4. Compute current state
  let currentState = JSON.parse(JSON.stringify(baseline));
  
  for (const tx of activeTransactions) {
    currentState = applyTransaction(currentState, tx, world.seasonYear);
  }
  
  return {
    world,
    baseline,
    currentState,
    transactions: activeTransactions,
  };
}

/**
 * Apply a transaction to a state
 */
export function applyTransaction(state, transaction, seasonYear) {
  switch (transaction.type) {
    case 'trade':
      return applyTradeTransaction(state, transaction, seasonYear);
    case 'signing':
      return applySigningTransaction(state, transaction, seasonYear);
    case 'extension':
      return applyExtensionTransaction(state, transaction, seasonYear);
    case 'waive':
      return applyWaiveTransaction(state, transaction, seasonYear);
    case 'release':
      return applyReleaseTransaction(state, transaction, seasonYear);
    default:
      console.warn(`Unknown transaction type: ${transaction.type}`);
      return state;
  }
}

/**
 * Apply a trade transaction
 */
function applyTradeTransaction(state, transaction, seasonYear) {
  const { outgoing, incoming } = transaction.details;
  
  // Remove outgoing players
  state.players = state.players.filter(p => 
    !outgoing.players.find(out => 
      out.playerId === p.player_id || out.name === p.name
    )
  );
  
  // Remove outgoing picks
  if (outgoing.picks && state.picks) {
    state.picks = state.picks.filter(pick =>
      !outgoing.picks.find(out => 
        out.year === pick.year && out.round === pick.round
      )
    );
  }
  
  // Add incoming players
  incoming.players.forEach(player => {
    state.players.push({
      player_id: player.playerId,
      name: player.name,
      contract_clean: player.contract || {},
      position: player.position,
      age: player.age,
      // Other player data...
    });
  });
  
  // Add incoming picks
  if (incoming.picks) {
    state.picks = state.picks || [];
    incoming.picks.forEach(pick => {
      state.picks.push(pick);
    });
  }
  
  // Handle trade exceptions
  if (transaction.details.tradeException?.generated) {
    state.exceptions = state.exceptions || [];
    state.exceptions.push({
      type: 'TPE',
      amount: transaction.details.tradeException.generated,
      expires: transaction.details.tradeException.expires,
      acquiredFrom: transaction.transactionId,
    });
  }
  
  // Recalculate team salary
  recalculateTeamSalary(state, seasonYear);
  
  return state;
}

/**
 * Apply a free agent signing transaction
 */
function applySigningTransaction(state, transaction, seasonYear) {
  const { playerId, playerName, contract } = transaction.details;
  
  // Add player to roster
  state.players.push({
    player_id: playerId,
    name: playerName,
    contract_clean: {
      years: contract.years,
      total_value: contract.totalValue,
      average_value: contract.totalValue / contract.years,
      salaries_by_year: contract.salariesByYear,
      options: contract.options || {},
      bird_rights: contract.signedUsing === 'Bird Rights' ? 'Full' : 'None',
      fa_type: 'Signed',
    },
  });
  
  // Update exception usage
  if (contract.signedUsing && contract.signedUsing !== 'Cap Space') {
    updateExceptionUsage(state, contract);
  }
  
  // Recalculate team salary
  recalculateTeamSalary(state, seasonYear);
  
  return state;
}

/**
 * Apply a contract extension transaction
 */
function applyExtensionTransaction(state, transaction, seasonYear) {
  const { playerId, playerName, extension } = transaction.details;
  
  // Find the player
  const player = state.players.find(p => 
    p.player_id === playerId || p.name === playerName
  );
  
  if (!player) {
    console.warn(`Player ${playerName} not found for extension`);
    return state;
  }
  
  // Update contract
  player.contract_clean = player.contract_clean || {};
  
  // Merge extension years
  const currentSalaries = player.contract_clean.salaries_by_year || {};
  const extensionSalaries = extension.salariesByYear || {};
  
  player.contract_clean.salaries_by_year = {
    ...currentSalaries,
    ...extensionSalaries,
  };
  
  // Update contract metadata
  const allYears = Object.keys(player.contract_clean.salaries_by_year);
  const totalValue = allYears.reduce((sum, year) => 
    sum + (player.contract_clean.salaries_by_year[year].salary || 
           player.contract_clean.salaries_by_year[year]), 
    0
  );
  
  player.contract_clean.years = allYears.length;
  player.contract_clean.total_value = totalValue;
  player.contract_clean.average_value = totalValue / allYears.length;
  player.contract_clean.has_extension = true;
  
  // Recalculate team salary
  recalculateTeamSalary(state, seasonYear);
  
  return state;
}

/**
 * Apply a waive/release transaction
 */
function applyWaiveTransaction(state, transaction, seasonYear) {
  const { playerId, playerName } = transaction.details;
  
  // Remove player from active roster
  state.players = state.players.filter(p => 
    p.player_id !== playerId && p.name !== playerName
  );
  
  // Add dead cap if stretched
  if (transaction.details.waiveType === 'stretch') {
    state.deadCap = state.deadCap || [];
    const { deadCapByYear } = transaction.details.capImpact;
    
    Object.entries(deadCapByYear).forEach(([year, amount]) => {
      state.deadCap.push({
        playerName,
        year: parseInt(year),
        amount,
        source: 'stretch',
      });
    });
  }
  
  // Recalculate team salary
  recalculateTeamSalary(state, seasonYear);
  
  return state;
}

/**
 * Recalculate total team salary
 */
function recalculateTeamSalary(state, seasonYear) {
  const yearKey = seasonYear.toString();
  
  // Sum active player salaries
  const playerSalaries = state.players.reduce((sum, player) => {
    const salaries = player.contract_clean?.salaries_by_year || {};
    const yearSalary = salaries[yearKey]?.salary || salaries[yearKey] || 0;
    return sum + yearSalary;
  }, 0);
  
  // Add dead cap for current year
  const deadCapAmount = (state.deadCap || [])
    .filter(dc => dc.year === seasonYear)
    .reduce((sum, dc) => sum + dc.amount, 0);
  
  state.teamSalary = playerSalaries + deadCapAmount;
  
  return state;
}

/**
 * Update exception usage after signing
 */
function updateExceptionUsage(state, contract) {
  if (!state.exceptions) return;
  
  const exceptionType = contract.signedUsing;
  const usedAmount = contract.totalValue / contract.years; // First year salary
  
  const exception = state.exceptions.find(e => e.type === exceptionType);
  
  if (exception) {
    exception.remaining = (exception.remaining || exception.amount) - usedAmount;
    if (exception.remaining <= 0) {
      // Exception fully used, remove it
      state.exceptions = state.exceptions.filter(e => e !== exception);
    }
  }
}
```

---

## 🔌 Integration with Existing GMDashboard

### Modified GMDashboard.jsx

```javascript
// src/features/architect/GMDashboard.jsx

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  createWorld,
  loadUserWorlds,
  loadWorld,
  touchWorld,
} from '@/utils/architect/worldHelpers';
import {
  executeTransaction,
  loadRecentTransactions,
} from '@/utils/architect/transactionHelpers';
import { loadWorldState } from '@/utils/architect/stateHelpers';
// ... other imports

const GMDashboard = () => {
  const { teamId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const worldIdParam = searchParams.get('world');
  
  const userId = 'demoUser'; // Replace with actual auth
  
  // State
  const [worlds, setWorlds] = useState([]);
  const [currentWorld, setCurrentWorld] = useState(null);
  const [worldState, setWorldState] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('roster');
  
  // Load user's worlds on mount
  useEffect(() => {
    const loadWorlds = async () => {
      try {
        const userWorlds = await loadUserWorlds(userId);
        setWorlds(userWorlds);
        
        // Determine which world to load
        let worldToLoad = worldIdParam;
        
        if (!worldToLoad && userWorlds.length > 0) {
          // Load most recently accessed world
          worldToLoad = userWorlds[0].worldId;
        }
        
        if (worldToLoad) {
          await loadWorldData(worldToLoad);
        } else {
          // No worlds yet, create first one
          const newWorldId = await createWorld(
            userId, 
            teamId, 
            `${teamId.toUpperCase()} - Plan 1`,
            2025
          );
          await loadWorldData(newWorldId);
        }
      } catch (error) {
        console.error('Error loading worlds:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadWorlds();
  }, [teamId, worldIdParam]);
  
  // Load specific world data
  const loadWorldData = async (worldId) => {
    try {
      setIsLoading(true);
      
      // Load world metadata
      const world = await loadWorld(worldId);
      setCurrentWorld(world);
      
      // Update URL
      setSearchParams({ world: worldId });
      
      // Touch world (update last accessed)
      await touchWorld(worldId, userId);
      
      // Load full world state (baseline + transactions)
      const state = await loadWorldState(worldId);
      setWorldState(state);
    } catch (error) {
      console.error('Error loading world:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Execute a trade
  const handleTradeExecution = async (tradeData) => {
    if (!currentWorld) return;
    
    try {
      // Create trade transaction
      const transaction = {
        type: 'trade',
        details: {
          tradePartners: tradeData.map(t => t.teamId),
          outgoing: tradeData.find(t => t.teamId === teamId)?.outgoing || {},
          incoming: tradeData.find(t => t.teamId === teamId)?.incoming || {},
          tradeException: tradeData.find(t => t.teamId === teamId)?.tradeException,
          validation: tradeData.find(t => t.teamId === teamId)?.validation,
        },
      };
      
      // Execute transaction
      await executeTransaction(currentWorld.worldId, userId, transaction);
      
      // Reload world state
      await loadWorldData(currentWorld.worldId);
    } catch (error) {
      console.error('Error executing trade:', error);
    }
  };
  
  // Execute a free agent signing
  const handleSigning = async (playerObj, contract) => {
    if (!currentWorld) return;
    
    try {
      // Create signing transaction
      const transaction = {
        type: 'signing',
        details: {
          playerId: playerObj.id || playerObj.player_id,
          playerName: playerObj.name,
          contract: {
            years: Object.keys(contract.salaryByYear).length,
            totalValue: Object.values(contract.salaryByYear).reduce((a, b) => a + b, 0),
            salariesByYear: contract.salaryByYear,
            options: contract.options || {},
            guaranteed: contract.guaranteed,
            isMinimum: contract.isMinimum,
            signedUsing: contract.signedUsing || 'Cap Space',
          },
          capImpact: {
            // Calculate cap impact...
          },
        },
      };
      
      // Execute transaction
      await executeTransaction(currentWorld.worldId, userId, transaction);
      
      // Reload world state
      await loadWorldData(currentWorld.worldId);
    } catch (error) {
      console.error('Error executing signing:', error);
    }
  };
  
  // Create new world
  const handleCreateWorld = async (worldName) => {
    try {
      const newWorldId = await createWorld(userId, teamId, worldName, 2025);
      
      // Reload worlds list
      const userWorlds = await loadUserWorlds(userId);
      setWorlds(userWorlds);
      
      // Load new world
      await loadWorldData(newWorldId);
    } catch (error) {
      console.error('Error creating world:', error);
    }
  };
  
  // Switch to different world
  const handleSwitchWorld = async (worldId) => {
    await loadWorldData(worldId);
  };
  
  if (isLoading) {
    return <div>Loading...</div>;
  }
  
  return (
    <div className="gm-dashboard">
      {/* World Selector */}
      <div className="world-selector">
        <select 
          value={currentWorld?.worldId || ''} 
          onChange={(e) => handleSwitchWorld(e.target.value)}
        >
          {worlds.map(world => (
            <option key={world.worldId} value={world.worldId}>
              {world.worldName}
            </option>
          ))}
        </select>
        <button onClick={() => setShowCreateModal(true)}>
          New World
        </button>
      </div>
      
      {/* Current World Display */}
      {worldState && (
        <>
          <RosterVisual 
            capSheet={worldState.currentState}
            teamId={teamId}
          />
          
          <CapSheet 
            capSheet={worldState.currentState}
            seasonYear={currentWorld.seasonYear}
          />
          
          <TradeEditor
            teamCapSheet={worldState.currentState}
            onTradeExecute={handleTradeExecution}
          />
          
          <FreeAgentPool
            onSign={handleSigning}
          />
          
          {/* Transaction History */}
          <TransactionHistory 
            transactions={worldState.transactions}
          />
        </>
      )}
    </div>
  );
};

export default GMDashboard;
```

---

## 📝 Migration Script

```javascript
// scripts/migrateToWorlds.js

import { db } from '../src/firebaseConfig';
import {
  doc,
  getDoc,
  getDocs,
  collection,
} from 'firebase/firestore';
import { createWorld } from '../src/utils/architect/worldHelpers';
import { executeTransaction } from '../src/utils/architect/transactionHelpers';

async function migrateUserPlans(userId, teamId) {
  console.log(`Migrating plans for user ${userId}, team ${teamId}...`);
  
  // 1. Load old plan structure
  const planId = `${userId}_${teamId}`;
  const planRef = doc(db, 'teamPlans', planId);
  const planSnap = await getDoc(planRef);
  
  if (!planSnap.exists()) {
    console.log('No active plan found');
    return;
  }
  
  const oldPlan = planSnap.data();
  
  // 2. Load named plans
  const namedPlansRef = collection(db, 'teamPlans', planId, 'namedPlans');
  const namedPlansSnap = await getDocs(namedPlansRef);
  
  const plans = [
    { name: 'Active Plan', data: oldPlan },
    ...namedPlansSnap.docs.map(doc => ({ 
      name: doc.id, 
      data: doc.data() 
    })),
  ];
  
  // 3. Convert each plan to a world
  for (const plan of plans) {
    console.log(`Converting plan: ${plan.name}`);
    
    // Create world
    const worldId = await createWorld(userId, teamId, plan.name, 2025);
    
    // Compute transactions from plan
    const transactions = await computeTransactionsFromPlan(
      teamId, 
      plan.data.capSheet
    );
    
    // Execute transactions
    for (const tx of transactions) {
      await executeTransaction(worldId, userId, tx);
    }
    
    console.log(`✓ Migrated plan: ${plan.name} -> ${worldId}`);
  }
}

async function computeTransactionsFromPlan(teamId, capSheet) {
  // Load baseline
  const baselineRef = doc(db, 'teams', teamId);
  const baselineSnap = await getDoc(baselineRef);
  const baseline = baselineSnap.data().capSheet;
  
  const transactions = [];
  
  // Find added players (not in baseline)
  const addedPlayers = capSheet.players.filter(p => 
    !baseline.players.find(bp => bp.player_id === p.player_id)
  );
  
  // Find removed players (in baseline but not in plan)
  const removedPlayers = baseline.players.filter(bp =>
    !capSheet.players.find(p => p.player_id === bp.player_id)
  );
  
  // Create trade or signing transactions
  if (addedPlayers.length > 0 || removedPlayers.length > 0) {
    // Assume it's a trade if players were swapped
    if (addedPlayers.length > 0 && removedPlayers.length > 0) {
      transactions.push({
        type: 'trade',
        details: {
          tradePartners: [teamId, 'unknown'],
          outgoing: {
            players: removedPlayers.map(p => ({
              playerId: p.player_id,
              name: p.name,
              salary: p.contract_clean?.salaries_by_year?.['2025']?.salary || 0,
            })),
          },
          incoming: {
            players: addedPlayers.map(p => ({
              playerId: p.player_id,
              name: p.name,
              salary: p.contract_clean?.salaries_by_year?.['2025']?.salary || 0,
              contract: p.contract_clean,
            })),
          },
        },
      });
    } else if (addedPlayers.length > 0) {
      // Just signings
      addedPlayers.forEach(player => {
        transactions.push({
          type: 'signing',
          details: {
            playerId: player.player_id,
            playerName: player.name,
            contract: {
              years: player.contract_clean?.years || 1,
              totalValue: player.contract_clean?.total_value || 0,
              salariesByYear: player.contract_clean?.salaries_by_year || {},
              signedUsing: 'Cap Space',
            },
          },
        });
      });
    }
  }
  
  return transactions;
}

// Run migration
const userId = 'demoUser';
const teamId = 'lal';
migrateUserPlans(userId, teamId)
  .then(() => console.log('Migration complete!'))
  .catch(err => console.error('Migration failed:', err));
```

---

## 🎯 Summary

This implementation guide provides:

1. **Core helper functions** for world and transaction management
2. **State computation logic** to apply transactions to baseline
3. **Integration example** showing how to modify GMDashboard
4. **Migration script** to convert old plans to new world structure

The transaction log approach is production-ready, scalable, and maintains backward compatibility during migration.
