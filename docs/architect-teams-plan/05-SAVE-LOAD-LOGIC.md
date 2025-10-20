# Save & Load Logic - Complete Implementation Guide

## Overview
This document explains exactly how data is saved to and loaded from Firestore for both team-level operations (trades, signings) and player-level operations (contract extensions, option decisions).

---

## Reading Data (Load Logic)

### Pattern: Fallback Chain
**World Snapshot → Parent Snapshot → Base**

```javascript
/**
 * Get team data with fallback chain
 * @param {string} worldId - World ID (null for base only)
 * @param {string} teamCode - Team abbreviation (e.g., "LAL")
 * @returns {Promise<TeamData>}
 */
async function getTeam(worldId, teamCode) {
  // Base mode: No world selected
  if (!worldId) {
    return await getDoc(`/architect/baseTeams/${teamCode}`);
  }
  
  // Try current world snapshot
  let teamDoc = await getDoc(`/architect/worlds/${worldId}/snapshot/teams/${teamCode}`);
  if (teamDoc.exists()) {
    return teamDoc.data();
  }
  
  // Try parent world (recursive up the chain)
  const worldMeta = await getDoc(`/architect/worlds/${worldId}/metadata`);
  if (worldMeta.data().parentWorldId) {
    // Recursively check parent
    teamDoc = await getTeam(worldMeta.data().parentWorldId, teamCode);
    if (teamDoc) return teamDoc;
  }
  
  // Fall back to base
  return await getDoc(`/architect/baseTeams/${teamCode}`);
}
```

### Get Player Data

```javascript
/**
 * Get player contract data
 * @param {string} worldId - World ID (null for base only)
 * @param {string} teamCode - Current team of player
 * @param {string} playerId - Player ID
 * @returns {Promise<PlayerData>}
 */
async function getPlayer(worldId, teamCode, playerId) {
  // Base mode: No world selected
  if (!worldId) {
    return await getDoc(`/architect/basePlayers/${playerId}`);
  }
  
  // Try world-specific player override
  let playerDoc = await getDoc(
    `/architect/worlds/${worldId}/snapshot/teams/${teamCode}/players/${playerId}`
  );
  
  if (playerDoc.exists()) {
    // Merge override with base
    const basePlayer = await getDoc(`/architect/basePlayers/${playerId}`);
    return mergePlayerOverride(basePlayer.data(), playerDoc.data());
  }
  
  // Try parent world
  const worldMeta = await getDoc(`/architect/worlds/${worldId}/metadata`);
  if (worldMeta.data().parentWorldId) {
    playerDoc = await getPlayer(worldMeta.data().parentWorldId, teamCode, playerId);
    if (playerDoc) return playerDoc;
  }
  
  // Fall back to base
  return await getDoc(`/architect/basePlayers/${playerId}`);
}

/**
 * Merge player override with base data
 */
function mergePlayerOverride(basePlayer, override) {
  return {
    ...basePlayer,
    contract: {
      ...basePlayer.contract,
      ...(override.overrides?.contract || {}),
      salariesByYear: mergeSalariesByYear(
        basePlayer.contract.salariesByYear,
        override.overrides?.contract?.salariesByYear
      )
    }
  };
}

function mergeSalariesByYear(baseSalaries, overrideSalaries) {
  if (!overrideSalaries) return baseSalaries;
  
  const merged = [...baseSalaries];
  overrideSalaries.forEach(override => {
    const idx = merged.findIndex(s => s.season === override.season);
    if (idx >= 0) {
      merged[idx] = { ...merged[idx], ...override };
    }
  });
  return merged;
}
```

### Get Full League (All 30 Teams)

```javascript
/**
 * Get all teams for league view
 * Optimized: Batch read world snapshots, then fill gaps from base
 */
async function getLeague(worldId) {
  const allTeamCodes = [
    "ATL", "BOS", "BKN", "CHA", "CHI", "CLE", "DAL", "DEN", "DET", "GSW",
    "HOU", "IND", "LAC", "LAL", "MEM", "MIA", "MIL", "MIN", "NOP", "NYK",
    "OKC", "ORL", "PHI", "PHX", "POR", "SAC", "SAS", "TOR", "UTA", "WAS"
  ];
  
  if (!worldId) {
    // Base mode: Read all from baseTeams
    return await Promise.all(
      allTeamCodes.map(code => getDoc(`/architect/baseTeams/${code}`))
    );
  }
  
  // World mode: Read snapshots + fill gaps from base
  const snapshotQuery = await getDocs(
    `/architect/worlds/${worldId}/snapshot/teams`
  );
  
  const snapshotMap = new Map();
  snapshotQuery.docs.forEach(doc => {
    snapshotMap.set(doc.id, doc.data());
  });
  
  // Fill missing teams from base (or parent)
  const teams = await Promise.all(
    allTeamCodes.map(async (code) => {
      if (snapshotMap.has(code)) {
        return snapshotMap.get(code);
      }
      
      // Try parent, then base
      const worldMeta = await getDoc(`/architect/worlds/${worldId}/metadata`);
      if (worldMeta.data().parentWorldId) {
        const parentTeam = await getTeam(worldMeta.data().parentWorldId, code);
        if (parentTeam) return parentTeam;
      }
      
      return await getDoc(`/architect/baseTeams/${code}`);
    })
  );
  
  return teams;
}
```

**Performance:**
- World with 2 modified teams: 2 queries (world) + 28 queries (base) = **30 queries**
- Base mode: 30 queries (all from base) = **30 queries**
- **Same performance regardless of world! ✅**

---

## Writing Data (Save Logic)

### Team-Level Operations

#### 1. Execute Trade

```javascript
/**
 * Execute trade between two teams
 * @param {string} worldId - World ID
 * @param {TradeData} tradeData - Trade details
 */
async function executeTrade(worldId, tradeData) {
  const { teamA, teamB, playersAtoB, playersBtoA } = tradeData;
  
  // Step 1: Load current team states
  const teamAData = await getTeam(worldId, teamA);
  const teamBData = await getTeam(worldId, teamB);
  
  // Step 2: Validate trade (CBA rules)
  const validation = await validateTrade({
    teamA: teamAData,
    teamB: teamBData,
    playersAtoB,
    playersBtoA
  });
  
  if (!validation.isValid) {
    throw new Error(`Trade invalid: ${validation.reason}`);
  }
  
  // Step 3: Update rosters
  const newTeamA = {
    ...teamAData,
    roster: [
      ...teamAData.roster.filter(p => !playersAtoB.includes(p)),
      ...playersBtoA
    ]
  };
  
  const newTeamB = {
    ...teamBData,
    roster: [
      ...teamBData.roster.filter(p => !playersBtoA.includes(p)),
      ...playersAtoB
    ]
  };
  
  // Step 4: Recalculate cap totals
  newTeamA.totals = await calculateCapTotals(newTeamA, worldId);
  newTeamB.totals = await calculateCapTotals(newTeamB, worldId);
  
  // Step 5: Update source metadata
  newTeamA.source = {
    type: "world-snapshot",
    worldId,
    generatedAt: new Date().toISOString(),
    baseTeamVersion: teamAData.source?.scrapedAt || new Date().toISOString()
  };
  newTeamB.source = { /* same */ };
  
  // Step 6: Atomic write (both teams or neither)
  const batch = db.batch();
  
  batch.set(
    db.doc(`/architect/worlds/${worldId}/snapshot/teams/${teamA}`),
    newTeamA
  );
  
  batch.set(
    db.doc(`/architect/worlds/${worldId}/snapshot/teams/${teamB}`),
    newTeamB
  );
  
  batch.update(
    db.doc(`/architect/worlds/${worldId}/metadata`),
    {
      lastModifiedAt: new Date().toISOString(),
      actionCount: FieldValue.increment(1),
      modifiedTeams: FieldValue.arrayUnion(teamA, teamB),
      lastAction: {
        type: "trade",
        timestamp: new Date().toISOString(),
        description: `Traded ${playersAtoB.join(", ")} to ${teamB} for ${playersBtoA.join(", ")}`
      }
    }
  );
  
  await batch.commit();
  
  return { success: true, newTeamA, newTeamB };
}
```

#### 2. Sign Free Agent

```javascript
/**
 * Sign free agent to team
 * @param {string} worldId - World ID
 * @param {string} teamCode - Team signing player
 * @param {SigningData} signingData - Signing details
 */
async function signFreeAgent(worldId, teamCode, signingData) {
  const { playerId, years, salary, signedUsing } = signingData;
  
  // Step 1: Load team state
  const teamData = await getTeam(worldId, teamCode);
  
  // Step 2: Validate signing (cap space, exception availability)
  const validation = await validateSigning(teamData, signingData);
  if (!validation.isValid) {
    throw new Error(`Signing invalid: ${validation.reason}`);
  }
  
  // Step 3: Update roster
  const newTeam = {
    ...teamData,
    roster: [...teamData.roster, playerId]
  };
  
  // Step 4: Update exceptions if used
  if (signedUsing === "MLE") {
    newTeam.exceptions.mle.usedAmount += salary;
    newTeam.exceptions.mle.remainingAmount -= salary;
    newTeam.totals.isHardCapped = true;  // Triggers hard cap
    newTeam.totals.hardCapLevel = "First Apron";
  }
  
  // Step 5: Remove cap hold if player had one
  if (teamData.capHolds) {
    newTeam.capHolds = teamData.capHolds.filter(h => h.playerId !== playerId);
  }
  
  // Step 6: Recalculate totals
  newTeam.totals = await calculateCapTotals(newTeam, worldId);
  
  // Step 7: Create new player contract (or override)
  const newPlayerContract = {
    playerId,
    displayName: signingData.playerName,
    teamCode,
    contract: {
      contractType: "VETERAN CONTRACT",
      signedUsing,
      signingTeam: teamCode,
      signingDate: new Date().toISOString().split('T')[0],
      startSeason: getCurrentSeason(),
      endSeason: calculateEndSeason(years),
      contractLength: years,
      totalValue: salary * years,
      salariesByYear: generateSalaryStructure(years, salary),
      // ... other contract fields
    }
  };
  
  // Step 8: Atomic write
  const batch = db.batch();
  
  batch.set(
    db.doc(`/architect/worlds/${worldId}/snapshot/teams/${teamCode}`),
    newTeam
  );
  
  // If new player (not in base), create base player doc or world override
  batch.set(
    db.doc(`/architect/basePlayers/${playerId}`),
    newPlayerContract,
    { merge: true }  // Don't overwrite if exists
  );
  
  batch.update(
    db.doc(`/architect/worlds/${worldId}/metadata`),
    {
      lastModifiedAt: new Date().toISOString(),
      actionCount: FieldValue.increment(1),
      modifiedTeams: FieldValue.arrayUnion(teamCode),
      lastAction: {
        type: "signing",
        timestamp: new Date().toISOString(),
        description: `Signed ${signingData.playerName} using ${signedUsing}`
      }
    }
  );
  
  await batch.commit();
  
  return { success: true, newTeam };
}
```

#### 3. Waive Player

```javascript
/**
 * Waive/cut player from team
 * @param {string} worldId - World ID
 * @param {string} teamCode - Team waiving player
 * @param {WaiveData} waiveData - Waive details
 */
async function waivePlayer(worldId, teamCode, waiveData) {
  const { playerId, isStretched } = waiveData;
  
  // Step 1: Load team and player
  const teamData = await getTeam(worldId, teamCode);
  const playerData = await getPlayer(worldId, teamCode, playerId);
  
  // Step 2: Calculate dead cap
  const deadCapAmount = calculateDeadCap(playerData, isStretched);
  
  // Step 3: Update team
  const newTeam = {
    ...teamData,
    roster: teamData.roster.filter(p => p !== playerId),
    deadCap: [
      ...(teamData.deadCap || []),
      {
        playerId,
        playerName: playerData.displayName,
        originalSalary: getTotalRemainingSalary(playerData),
        amountByYear: deadCapAmount.byYear,
        waiveDate: new Date().toISOString().split('T')[0],
        isStretched,
        notes: isStretched ? `Stretched over ${deadCapAmount.years} years` : "Not stretched"
      }
    ]
  };
  
  // Step 4: Recalculate totals
  newTeam.totals = await calculateCapTotals(newTeam, worldId);
  
  // Step 5: Atomic write
  const batch = db.batch();
  
  batch.set(
    db.doc(`/architect/worlds/${worldId}/snapshot/teams/${teamCode}`),
    newTeam
  );
  
  batch.update(
    db.doc(`/architect/worlds/${worldId}/metadata`),
    {
      lastModifiedAt: new Date().toISOString(),
      actionCount: FieldValue.increment(1),
      modifiedTeams: FieldValue.arrayUnion(teamCode),
      lastAction: {
        type: "waive",
        timestamp: new Date().toISOString(),
        description: `Waived ${playerData.displayName}${isStretched ? " (stretched)" : ""}`
      }
    }
  );
  
  await batch.commit();
  
  return { success: true, deadCap: deadCapAmount };
}
```

---

### Player-Level Operations

#### 1. Contract Extension

```javascript
/**
 * Extend player contract
 * @param {string} worldId - World ID
 * @param {string} teamCode - Team extending player
 * @param {ExtensionData} extensionData - Extension details
 */
async function extendPlayer(worldId, teamCode, extensionData) {
  const { playerId, newYears, newSalaries } = extensionData;
  
  // Step 1: Load player
  const playerData = await getPlayer(worldId, teamCode, playerId);
  
  // Step 2: Validate extension (CBA rules)
  const validation = await validateExtension(playerData, extensionData);
  if (!validation.isValid) {
    throw new Error(`Extension invalid: ${validation.reason}`);
  }
  
  // Step 3: Create player override (only changed fields)
  const playerOverride = {
    playerId,
    overrides: {
      contract: {
        isExtension: true,
        endSeason: calculateEndSeason(newYears),
        contractLength: playerData.contract.contractLength + newYears.length,
        totalValue: playerData.contract.totalValue + sumSalaries(newSalaries),
        
        // Only new years (extension years)
        salariesByYear: newSalaries.map((salary, idx) => ({
          season: calculateSeason(playerData.contract.endSeason, idx + 1),
          salary,
          capHit: salary,
          guaranteed: true,
          guaranteedAmount: salary,
          option: null,
          tradeBonus: null,
          incentives: { likely: 0, unlikely: 0 }
        }))
      }
    },
    source: {
      type: "player-override",
      worldId,
      modifiedAt: new Date().toISOString(),
      reason: "Contract extension"
    }
  };
  
  // Step 4: Update team (if trade eligibility changes)
  const teamData = await getTeam(worldId, teamCode);
  const newTeam = {
    ...teamData,
    totals: await recalculateCapTotals(teamData, worldId, playerId, playerOverride)
  };
  
  // Step 5: Atomic write
  const batch = db.batch();
  
  // Write player override
  batch.set(
    db.doc(`/architect/worlds/${worldId}/snapshot/teams/${teamCode}/players/${playerId}`),
    playerOverride
  );
  
  // Update team snapshot
  batch.set(
    db.doc(`/architect/worlds/${worldId}/snapshot/teams/${teamCode}`),
    newTeam
  );
  
  batch.update(
    db.doc(`/architect/worlds/${worldId}/metadata`),
    {
      lastModifiedAt: new Date().toISOString(),
      actionCount: FieldValue.increment(1),
      modifiedTeams: FieldValue.arrayUnion(teamCode),
      lastAction: {
        type: "extension",
        timestamp: new Date().toISOString(),
        description: `Extended ${playerData.displayName} for ${newYears.length} years`
      }
    }
  );
  
  await batch.commit();
  
  return { success: true, playerOverride };
}
```

#### 2. Pick Up/Decline Option

```javascript
/**
 * Pick up or decline player option
 * @param {string} worldId - World ID
 * @param {string} teamCode - Team with option
 * @param {OptionData} optionData - Option decision
 */
async function handleOption(worldId, teamCode, optionData) {
  const { playerId, season, decision } = optionData;  // decision: "pick-up" | "decline"
  
  // Step 1: Load player
  const playerData = await getPlayer(worldId, teamCode, playerId);
  
  // Step 2: Find option year
  const optionYear = playerData.contract.salariesByYear.find(s => s.season === season);
  if (!optionYear || !optionYear.option) {
    throw new Error(`No option found for ${season}`);
  }
  
  // Step 3: Create player override
  const playerOverride = {
    playerId,
    overrides: {
      contract: {
        salariesByYear: [
          {
            season,
            guaranteed: decision === "pick-up",
            guaranteedAmount: decision === "pick-up" ? optionYear.salary : 0,
            option: null  // Option exercised, no longer exists
          }
        ]
      }
    },
    source: {
      type: "player-override",
      worldId,
      modifiedAt: new Date().toISOString(),
      reason: `${optionYear.option} ${decision === "pick-up" ? "picked up" : "declined"}`
    }
  };
  
  // Step 4: Update team if option declined (remove player next season)
  let newTeam = null;
  if (decision === "decline") {
    const teamData = await getTeam(worldId, teamCode);
    newTeam = {
      ...teamData,
      // Don't remove from roster yet (happens at season transition)
      // But update cap hold if player becomes FA
      capHolds: [
        ...(teamData.capHolds || []),
        {
          playerId,
          playerName: playerData.displayName,
          amount: playerData.freeAgency.capHold,
          type: playerData.birdRights.status,
          isSigned: false,
          expiresOn: calculateNextOffseason()
        }
      ]
    };
    newTeam.totals = await calculateCapTotals(newTeam, worldId);
  }
  
  // Step 5: Atomic write
  const batch = db.batch();
  
  batch.set(
    db.doc(`/architect/worlds/${worldId}/snapshot/teams/${teamCode}/players/${playerId}`),
    playerOverride
  );
  
  if (newTeam) {
    batch.set(
      db.doc(`/architect/worlds/${worldId}/snapshot/teams/${teamCode}`),
      newTeam
    );
  }
  
  batch.update(
    db.doc(`/architect/worlds/${worldId}/metadata`),
    {
      lastModifiedAt: new Date().toISOString(),
      actionCount: FieldValue.increment(1),
      lastAction: {
        type: "option-decision",
        timestamp: new Date().toISOString(),
        description: `${decision === "pick-up" ? "Picked up" : "Declined"} ${optionYear.option} for ${playerData.displayName}`
      }
    }
  );
  
  await batch.commit();
  
  return { success: true, playerOverride };
}
```

---

## World Management

### Create World

```javascript
/**
 * Create new world
 * @param {WorldData} worldData - World details
 */
async function createWorld(worldData) {
  const { name, description, parentWorldId } = worldData;
  
  const worldId = generateWorldId();  // e.g., "world_" + randomString()
  
  const metadata = {
    worldId,
    worldName: name,
    description: description || "",
    createdBy: getCurrentUserId(),
    createdAt: new Date().toISOString(),
    lastModifiedAt: new Date().toISOString(),
    currentSeason: getCurrentSeason(),
    baselineSeason: getCurrentSeason(),
    parentWorldId: parentWorldId || null,
    branchedFrom: parentWorldId ? new Date().toISOString() : null,
    childWorlds: [],
    modifiedTeams: [],
    actionCount: 0,
    tags: [],
    isArchived: false,
    isFavorite: false
  };
  
  const batch = db.batch();
  
  // Create world metadata
  batch.set(
    db.doc(`/architect/worlds/${worldId}/metadata`),
    metadata
  );
  
  // Update parent's childWorlds if branching
  if (parentWorldId) {
    batch.update(
      db.doc(`/architect/worlds/${parentWorldId}/metadata`),
      {
        childWorlds: FieldValue.arrayUnion(worldId)
      }
    );
  }
  
  await batch.commit();
  
  return { worldId, metadata };
}
```

### Advance Season

```javascript
/**
 * Advance world to next season
 * @param {string} worldId - World ID
 */
async function advanceSeason(worldId) {
  // Step 1: Get world metadata
  const worldMeta = await getDoc(`/architect/worlds/${worldId}/metadata`);
  const currentSeason = worldMeta.data().currentSeason;
  const nextSeason = calculateNextSeason(currentSeason);  // "2025-26" → "2026-27"
  
  // Step 2: Get all modified teams
  const modifiedTeams = worldMeta.data().modifiedTeams || [];
  
  // Step 3: Process each team for new season
  const batch = db.batch();
  
  for (const teamCode of modifiedTeams) {
    const teamData = await getTeam(worldId, teamCode);
    
    // Process contracts
    const newTeam = await processSeasonTransition(teamData, nextSeason, worldId);
    
    // Save updated team
    batch.set(
      db.doc(`/architect/worlds/${worldId}/snapshot/teams/${teamCode}`),
      newTeam
    );
  }
  
  // Step 4: Update world metadata
  batch.update(
    db.doc(`/architect/worlds/${worldId}/metadata`),
    {
      currentSeason: nextSeason,
      lastModifiedAt: new Date().toISOString(),
      lastAction: {
        type: "season-advance",
        timestamp: new Date().toISOString(),
        description: `Advanced to ${nextSeason} season`
      }
    }
  );
  
  await batch.commit();
  
  return { success: true, newSeason: nextSeason };
}

/**
 * Process team for season transition
 */
async function processSeasonTransition(teamData, newSeason, worldId) {
  const newTeam = { ...teamData };
  
  // 1. Remove expired contracts
  newTeam.roster = await Promise.all(
    teamData.roster.map(async (playerId) => {
      const player = await getPlayer(worldId, teamData.teamCode, playerId);
      const endSeason = player.contract.endSeason;
      
      // Keep if contract extends beyond new season
      return compareSeasons(endSeason, newSeason) >= 0 ? playerId : null;
    })
  ).then(roster => roster.filter(Boolean));
  
  // 2. Process options (auto-decline non-guaranteed by default)
  for (const playerId of newTeam.roster) {
    const player = await getPlayer(worldId, teamData.teamCode, playerId);
    const seasonSalary = player.contract.salariesByYear.find(s => s.season === newSeason);
    
    if (seasonSalary && !seasonSalary.guaranteed) {
      // Auto-remove non-guaranteed (can override with manual option pick-up)
      newTeam.roster = newTeam.roster.filter(p => p !== playerId);
      
      // Add to cap holds if has Bird rights
      if (player.birdRights.status !== "None") {
        newTeam.capHolds = [
          ...(newTeam.capHolds || []),
          {
            playerId,
            playerName: player.displayName,
            amount: player.freeAgency.capHold,
            type: player.birdRights.status
          }
        ];
      }
    }
  }
  
  // 3. Add empty roster charges if under 12
  while (newTeam.roster.length < 12) {
    newTeam.capHolds.push({
      playerId: `empty_${Date.now()}`,
      playerName: "Empty Roster Charge",
      amount: getLeagueMinimum(newSeason),
      type: "Empty Roster"
    });
  }
  
  // 4. Recalculate totals
  newTeam.season = newSeason;
  newTeam.totals = await calculateCapTotals(newTeam, worldId);
  
  return newTeam;
}
```

---

## Summary: Key Patterns

### Reading
1. **Always try world first**, then parent, then base
2. **Use batch reads** for league view (30 teams at once)
3. **Merge player overrides** with base player data

### Writing
1. **Always use atomic batches** (all-or-nothing)
2. **Update metadata** on every modification
3. **Recalculate totals** after roster changes
4. **Only write what changed** (snapshots or overrides)

### Performance
- **Reads:** 30 queries max (league view)
- **Writes:** 2-3 docs typical (trade = 2 teams + metadata)
- **Storage:** 100-200 KB per world (only modified teams)

**Result:** Fast, efficient, and scalable! ✅
