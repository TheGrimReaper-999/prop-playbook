import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface CareerStats {
  legsTaken: number;
  legsWon: number;
  legsLost: number;
  noBets: number;
  winRate: number;
  totalPredictions: number;
}

export function useCareerStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['career-stats', user?.id],
    queryFn: async (): Promise<CareerStats> => {
      if (!user) {
        return {
          legsTaken: 0,
          legsWon: 0,
          legsLost: 0,
          noBets: 0,
          winRate: 0,
          totalPredictions: 0,
        };
      }

      // Fetch processed predictions with outcomes
      const { data: predictions, error } = await supabase
        .from('predictions')
        .select('outcome, decision')
        .eq('user_id', user.id)
        .eq('processed', true);

      if (error) {
        console.error('[useCareerStats] Error fetching predictions:', error);
        throw error;
      }

      // Calculate stats
      const wins = predictions?.filter(p => p.outcome === 'win').length || 0;
      const losses = predictions?.filter(p => p.outcome === 'loss').length || 0;
      const noBets = predictions?.filter(p => p.decision === 'NO BET').length || 0;
      const taken = wins + losses; // Legs with actual decisions (not NO BET)
      const totalPredictions = predictions?.length || 0;
      
      const winRate = taken > 0 ? (wins / taken) * 100 : 0;

      return {
        legsTaken: taken,
        legsWon: wins,
        legsLost: losses,
        noBets,
        winRate,
        totalPredictions,
      };
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
