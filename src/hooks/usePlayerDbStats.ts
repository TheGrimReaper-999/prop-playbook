import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ensurePlayerStats, extractStatValues, StatValues } from './usePlayerStats';
import { GameLogEntry, PlayerStats } from './useNbaApi';

export interface PlayerDbStats {
  games: GameLogEntry[];
  statValues: StatValues;
  derivedAverages: PlayerStats | null;
}

// Calculate season averages from game log entries
const calculateDerivedAverages = (games: GameLogEntry[]): PlayerStats | null => {
  if (games.length === 0) return null;

  const totals = games.reduce(
    (acc, game) => ({
      pts: acc.pts + (parseFloat(game.pts) || 0),
      reb: acc.reb + (parseFloat(game.reb) || 0),
      ast: acc.ast + (parseFloat(game.ast) || 0),
      stl: acc.stl + (parseFloat(game.stl) || 0),
      blk: acc.blk + (parseFloat(game.blk) || 0),
      fgm: acc.fgm + (parseFloat(game.fgm) || 0),
      fga: acc.fga + (parseFloat(game.fga) || 0),
      fg3m: acc.fg3m + (parseFloat(game.fg3m) || 0),
      fg3a: acc.fg3a + (parseFloat(game.fg3a) || 0),
      ftm: acc.ftm + (parseFloat(game.ftm) || 0),
      fta: acc.fta + (parseFloat(game.fta) || 0),
    }),
    { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0 }
  );

  const count = games.length;
  const fgPct = totals.fga > 0 ? ((totals.fgm / totals.fga) * 100).toFixed(1) : '0';
  const fg3Pct = totals.fg3a > 0 ? ((totals.fg3m / totals.fg3a) * 100).toFixed(1) : '0';
  const ftPct = totals.fta > 0 ? ((totals.ftm / totals.fta) * 100).toFixed(1) : '0';

  return {
    gamesPlayed: count.toString(),
    min: '0', // Not tracked in aggregate
    ppg: (totals.pts / count).toFixed(1),
    rpg: (totals.reb / count).toFixed(1),
    apg: (totals.ast / count).toFixed(1),
    spg: (totals.stl / count).toFixed(1),
    bpg: (totals.blk / count).toFixed(1),
    fgPct,
    fg3Pct,
    ftPct,
  };
};

// Hook to fetch player stats from database with sync fallback
export const usePlayerDbStats = (
  dbPlayerId: string | null,
  playerName: string,
  teamName?: string
) => {
  return useQuery<PlayerDbStats>({
    queryKey: ['player-db-stats', dbPlayerId],
    queryFn: async () => {
      if (!dbPlayerId) {
        return { games: [], statValues: extractStatValues([]), derivedAverages: null };
      }

      const games = await ensurePlayerStats(dbPlayerId, playerName, teamName);
      const statValues = extractStatValues(games);
      const derivedAverages = calculateDerivedAverages(games);

      return { games, statValues, derivedAverages };
    },
    enabled: !!dbPlayerId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Hook to refetch player stats on demand
export const useRefreshPlayerStats = () => {
  const queryClient = useQueryClient();

  return {
    refreshStats: async (dbPlayerId: string) => {
      await queryClient.invalidateQueries({ queryKey: ['player-db-stats', dbPlayerId] });
    },
  };
};
