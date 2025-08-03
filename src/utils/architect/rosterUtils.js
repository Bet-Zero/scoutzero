// src/utils/architect/rosterUtils.js

export const rosterSizeAfterTrade = ({
  playersOnRoster,
  playersIncoming,
  playersOutgoing,
}) => playersOnRoster.length + playersIncoming.length - playersOutgoing.length;

export const passesRosterSizeRule = (count) => count >= 13 && count <= 15; // two-ways ignored
