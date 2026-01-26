import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface StatTypeLeader {
  stat_type: string;
  total: number;
  wins: number;
  losses: number;
  win_rate: number;
}

export interface PlayerLeader {
  player_name: string;
  player_id: string | null;
  total: number;
  wins: number;
  losses: number;
  win_rate: number;
}

export function useStatTypeLeaderboard() {
  return useQuery({
    queryKey: ['leaderboard-stat-types'],
    queryFn: async (): Promise<StatTypeLeader[]> => {
      const { data, error } = await supabase
        .from('predictions')
        .select('stat_type, outcome')
        .eq('processed', true)
        .not('outcome', 'is', null);

      if (error) throw error;

      // Aggregate by stat type
      const statMap = new Map<string, { wins: number; losses: number; total: number }>();
      
      (data || []).forEach(p => {
        const current = statMap.get(p.stat_type) || { wins: 0, losses: 0, total: 0 };
        current.total++;
        if (p.outcome === 'win') current.wins++;
        if (p.outcome === 'loss') current.losses++;
        statMap.set(p.stat_type, current);
      });

      const results: StatTypeLeader[] = [];
      statMap.forEach((stats, stat_type) => {
        const decisions = stats.wins + stats.losses;
        results.push({
          stat_type,
          total: stats.total,
          wins: stats.wins,
          losses: stats.losses,
          win_rate: decisions > 0 ? (stats.wins / decisions) * 100 : 0,
        });
      });

      return results.sort((a, b) => b.win_rate - a.win_rate);
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function usePlayerLeaderboard() {
  return useQuery({
    queryKey: ['leaderboard-players'],
    queryFn: async (): Promise<PlayerLeader[]> => {
      const { data, error } = await supabase
        .from('predictions')
        .select('player_name, player_id, outcome')
        .eq('processed', true)
        .not('outcome', 'is', null);

      if (error) throw error;

      // Aggregate by player
      const playerMap = new Map<string, { player_id: string | null; wins: number; losses: number; total: number }>();
      
      (data || []).forEach(p => {
        const current = playerMap.get(p.player_name) || { player_id: p.player_id, wins: 0, losses: 0, total: 0 };
        current.total++;
        if (p.outcome === 'win') current.wins++;
        if (p.outcome === 'loss') current.losses++;
        playerMap.set(p.player_name, current);
      });

      const results: PlayerLeader[] = [];
      playerMap.forEach((stats, player_name) => {
        const decisions = stats.wins + stats.losses;
        results.push({
          player_name,
          player_id: stats.player_id,
          total: stats.total,
          wins: stats.wins,
          losses: stats.losses,
          win_rate: decisions > 0 ? (stats.wins / decisions) * 100 : 0,
        });
      });

      return results.sort((a, b) => {
        if (b.win_rate !== a.win_rate) return b.win_rate - a.win_rate;
        return b.total - a.total;
      });
    },
    staleTime: 1000 * 60 * 5,
  });
}
