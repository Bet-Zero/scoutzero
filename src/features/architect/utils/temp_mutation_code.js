
/**
 * Compute MATCHED offer sheet finalization.
 *
 * GOAL:
 * 1. Validate status is MATCHED (and acting team is home team - handled by validator).
 * 2. Apply the contract terms from offer sheet to the home team's player.
 * 3. Remove offer sheet from BOTH home and offering teams.
 */
function computeFinalizeMatchedOfferSheetResult({ payload, currentState, seasonId, timestamp }) {
  const { homeTeam, offeringTeam, offerSheetId } = currentState; // Loaded by loadStateForMutation
  const { teamCode } = payload; // Should be homeTeamCode

  // 1. Find the offer sheet (on home team)
  const incomingOfferSheets = homeTeam.incomingOfferSheets || [];
  const offerSheet = incomingOfferSheets.find(os => os.id === offerSheetId);

  // Validation happens in validateMutation via validateOfferSheetResolution,
  // but we can do a sanity check here or let it fail if missing.
  if (!offerSheet) {
    return { success: false, error: `Offer sheet ${offerSheetId} not found on home team.` };
  }
  
  // 2. Prepare Home Team Update
  const updatedHomeTeam = { ...homeTeam };
  
  // 2a. Remove from incomingOfferSheets
  updatedHomeTeam.incomingOfferSheets = incomingOfferSheets.filter(os => os.id !== offerSheetId);
  
  // 2b. Apply contract to player
  // We need to find the player on the home team roster/players list.
  // The offer sheet has playerId.
  const playerId = offerSheet.playerId;
  const playerIndex = (updatedHomeTeam.players || []).findIndex(p => (p.player_id || p.id) === playerId);
  
  if (playerIndex === -1) {
    // If player somehow isn't on the roster, we might need to add them?
    // But for RFA, they should be on the roster (or cap hold).
    // If they were a textual cap hold, we need to promote them to a real player entry.
    // For MVP Phase 16/17, we assume they exist or we create a stub?
    // Let's assume they exist for now, or fail.
    return { success: false, error: `Player ${playerId} not found on home team roster for contract application.` };
  }
  
  // Clone the player to update contract
  const updatedPlayer = { ...updatedHomeTeam.players[playerIndex] };
  
  // Construct new contract from offer sheet
  // Offer sheet structure: salariesByYear: [{ season, salary, capHit, guaranteed }]
  // We need to convert this to the standard contract format.
  const newContract = {
    contractType: 'Standard', // Offer sheets are standard contracts
    signedUsing: 'Match', // Or "Matched Offer Sheet"
    signingTeam: teamCode,
    contractLength: offerSheet.contractYears,
    salariesByYear: offerSheet.salariesByYear.map(s => ({
      season: s.season,
      salary: s.salary,
      capHit: s.capHit,
      guaranteed: s.guaranteed,
      // Add option if present in offer sheet (Phase 17 doesn't explicitly mention options in OS schema yet, but safe to map)
    })),
    // Preserve other player contract info?
    // RFA matching replaces the contract.
  };
  
  updatedPlayer.contract = newContract;
  
  // Update player in team array
  updatedHomeTeam.players = [
    ...updatedHomeTeam.players.slice(0, playerIndex),
    updatedPlayer,
    ...updatedHomeTeam.players.slice(playerIndex + 1)
  ];
  
  // Recalculate totals
  updatedHomeTeam.totals = calculateTeamTotals(updatedHomeTeam, seasonId);

  // 3. Prepare Offering Team Update
  const updatedOfferingTeam = { ...offeringTeam };
  
  // 3a. Remove from offerSheets (outgoing)
  updatedOfferingTeam.offerSheets = (updatedOfferingTeam.offerSheets || []).filter(os => os.id !== offerSheetId);

  return {
    success: true,
    teamUpdates: [
      { teamCode: homeTeam.teamCode, team: updatedHomeTeam },
      { teamCode: offeringTeam.teamCode, team: updatedOfferingTeam }
    ],
    metadata: {
      type: 'finalizeMatchedOfferSheet',
      offerSheetId,
      playerId,
      homeTeam: homeTeam.teamCode,
      offeringTeam: offeringTeam.teamCode,
      timestamp
    }
  };
}
