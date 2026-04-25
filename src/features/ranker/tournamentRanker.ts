// src/features/ranker/tournamentRanker.ts
import type {
  RankerComparison,
  RankerPlayer,
} from '@/features/ranker/utils/rankingEngine';

type LegacyRankerPair = [RankerPlayer, RankerPlayer] | null;

class TournamentRanker {
  players: RankerPlayer[];
  winners: Map<string, Set<string>>;
  losers: Map<string, Set<string>>;
  ranked: RankerPlayer[];
  unranked: RankerPlayer[];
  comparisonCount: number;

  constructor(players: RankerPlayer[]) {
    this.players = players;
    this.winners = new Map(); // player → beats these players
    this.losers = new Map(); // player → lost to these players
    this.ranked = [];
    this.unranked = [...players];
    this.comparisonCount = 0;
    players.forEach((p) => {
      this.winners.set(p.id, new Set());
      this.losers.set(p.id, new Set());
    });
  }

  addResult(winner: string, loser: string) {
    this.winners.get(winner)?.add(loser);
    this.losers.get(loser)?.add(winner);
    this.updateTransitiveResults(winner, loser);
  }

  updateTransitiveResults(winner: string, loser: string) {
    // Anyone who beat the winner also beats the loser
    this.losers.get(winner)?.forEach((dominant) => {
      this.winners.get(dominant)?.add(loser);
      this.losers.get(loser)?.add(dominant);
    });

    // Anyone who lost to the loser also loses to the winner
    this.winners.get(loser)?.forEach((inferior) => {
      this.losers.get(inferior)?.add(winner);
      this.winners.get(winner)?.add(inferior);
    });
  }

  suggestPair(): LegacyRankerPair {
    if (this.unranked.length === 0) {
      return this.suggestAdjacentPair();
    }

    // Tournament-style pairing
    return this.findMostUncertainPair();
  }

  findMostUncertainPair(): LegacyRankerPair {
    const candidates: Array<{
      a: RankerPlayer;
      b: RankerPlayer;
      uncertainty: number;
    }> = [];

    // Look for players with overlapping possible ranks
    for (let i = 0; i < this.unranked.length; i++) {
      for (let j = i + 1; j < this.unranked.length; j++) {
        const a = this.unranked[i];
        const b = this.unranked[j];

        if (!this.isDecided(a, b)) {
          const uncertainty = this.getPairUncertainty(a, b);
          candidates.push({ a, b, uncertainty });
        }
      }
    }

    if (candidates.length === 0) {
      // All pairs are decided - rank remaining players
      return this.rankNextPlayer();
    }

    // Return the pair that will give most information
    candidates.sort((x, y) => y.uncertainty - x.uncertainty);
    return [candidates[0].a, candidates[0].b];
  }

  getPairUncertainty(a: RankerPlayer, b: RankerPlayer) {
    const aWins = this.winners.get(a.id)?.size ?? 0;
    const aLosses = this.losers.get(a.id)?.size ?? 0;
    const bWins = this.winners.get(b.id)?.size ?? 0;
    const bLosses = this.losers.get(b.id)?.size ?? 0;

    // More uncertainty when players have similar performance
    return 1 / (1 + Math.abs(aWins - aLosses - (bWins - bLosses)));
  }

  isDecided(a: RankerPlayer, b: RankerPlayer) {
    return (
      (this.winners.get(a.id)?.has(b.id) ?? false) ||
      (this.winners.get(b.id)?.has(a.id) ?? false)
    );
  }

  suggestAdjacentPair(): LegacyRankerPair {
    // Only compare adjacent players in the ranking
    for (let i = 0; i < this.ranked.length - 1; i++) {
      const a = this.ranked[i];
      const b = this.ranked[i + 1];

      if (!this.isDecided(a, b)) {
        return [a, b];
      }
    }
    return null; // Ranking complete!
  }

  rankNextPlayer(): LegacyRankerPair {
    // Find player with most definitive position
    const next = this.unranked.reduce<{
      player: RankerPlayer | null;
      certainty: number;
    }>(
      (best, player) => {
        const certainty =
          (this.winners.get(player.id)?.size ?? 0) +
          (this.losers.get(player.id)?.size ?? 0);
        return certainty > best.certainty ? { player, certainty } : best;
      },
      { player: null, certainty: -1 }
    ).player;

    if (!next) return null;

    // Insert into ranked list
    let position = 0;
    while (
      position < this.ranked.length &&
      (this.winners.get(next.id)?.has(this.ranked[position].id) ?? false)
    ) {
      position++;
    }

    this.ranked.splice(position, 0, next);
    this.unranked = this.unranked.filter((p) => p.id !== next.id);
    return this.suggestPair();
  }
}

// State management
let ranker: TournamentRanker | null = null;

export function resetRankedState() {
  ranker = null;
}

export function suggestNextPair(
  comparisons: RankerComparison[],
  players: RankerPlayer[]
): LegacyRankerPair {
  if (!ranker) {
    ranker = new TournamentRanker(players);
  }
  const activeRanker = ranker;

  // Apply new comparisons
  comparisons.slice(activeRanker.comparisonCount).forEach((c) => {
    activeRanker.addResult(c.winner, c.loser);
  });

  return activeRanker.suggestPair();
}
