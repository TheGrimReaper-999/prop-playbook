import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SavedParlay, ParlayLeg } from '@/contexts/BetSlipContext';

export type LegStatus = 'pending' | 'win' | 'loss';
export type ParlayStatus = 'pending' | 'win' | 'loss';

interface LegResult {
  legId: string;
  status: LegStatus;
  actualValue?: number;
}

interface ParlayResult {
  parlayId: string;
  status: ParlayStatus;
  legResults: LegResult[];
}

// Get the actual stat value based on stat type
const getStatValue = (stats: any, statType: string): number => {
  const pts = stats.points || 0;
  const reb = stats.rebounds || 0;
  const ast = stats.assists || 0;
  const fg3m = stats.three_pt_made || 0;

  switch (statType) {
    case 'pts':
      return pts;
    case 'reb':
      return reb;
    case 'ast':
      return ast;
    case '3pm':
      return fg3m;
    case 'pra':
      return pts + reb + ast;
    case 'pr':
      return pts + reb;
    case 'pa':
      return pts + ast;
    case 'ra':
      return reb + ast;
    default:
      return 0;
  }
};

// Check if a game has finished based on fixture status
const isGameFinished = (status: string): boolean => {
  const finishedStatuses = ['post', 'final', 'completed', 'finished'];
  return finishedStatuses.some(s => status?.toLowerCase().includes(s));
};

// Fetch and calculate status for a single leg
const calculateLegStatus = async (leg: ParlayLeg, parlayCreatedAt: string): Promise<LegResult> => {
  // Get player ID from database
  const { data: player } = await supabase
    .from('nba_players')
    .select('id')
    .ilike('full_name', leg.player.name)
    .maybeSingle();

  if (!player) {
    return { legId: leg.legId, status: 'pending' };
  }

  // Get the most recent game stats AFTER the parlay was created
  const { data: stats } = await supabase
    .from('nba_player_stats')
    .select('*, event_id')
    .eq('player_id', player.id)
    .gte('game_date', parlayCreatedAt)
    .order('game_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!stats) {
    return { legId: leg.legId, status: 'pending' };
  }

  // Check if the game has finished
  const { data: fixture } = await supabase
    .from('nba_fixtures')
    .select('status')
    .eq('event_id', stats.event_id)
    .maybeSingle();

  if (!fixture || !isGameFinished(fixture.status)) {
    return { legId: leg.legId, status: 'pending' };
  }

  // Game is finished, calculate result
  const actualValue = getStatValue(stats, leg.statType);
  const line = parseFloat(leg.mainLine);

  let status: LegStatus = 'pending';
  if (leg.decision === 'TAKE OVER') {
    status = actualValue > line ? 'win' : 'loss';
  } else if (leg.decision === 'TAKE UNDER') {
    status = actualValue < line ? 'win' : 'loss';
  }

  return { legId: leg.legId, status, actualValue };
};

// Calculate overall parlay status
const calculateParlayStatus = (legResults: LegResult[]): ParlayStatus => {
  // If any leg lost, parlay is lost
  if (legResults.some(r => r.status === 'loss')) {
    return 'loss';
  }
  // If all legs won, parlay is won
  if (legResults.every(r => r.status === 'win')) {
    return 'win';
  }
  // Otherwise pending
  return 'pending';
};

// Fetch status for all parlays
const fetchParlayStatuses = async (parlays: SavedParlay[]): Promise<Map<string, ParlayResult>> => {
  const results = new Map<string, ParlayResult>();

  for (const parlay of parlays) {
    const legResults = await Promise.all(
      parlay.legs.map(leg => calculateLegStatus(leg, parlay.createdAt))
    );
    
    results.set(parlay.id, {
      parlayId: parlay.id,
      status: calculateParlayStatus(legResults),
      legResults,
    });
  }

  return results;
};

export const useParlayStatus = (parlays: SavedParlay[]) => {
  return useQuery({
    queryKey: ['parlay-status', parlays.map(p => p.id).join(',')],
    queryFn: () => fetchParlayStatuses(parlays),
    enabled: parlays.length > 0,
    refetchInterval: 60000, // Auto-refresh every 60 seconds
    staleTime: 30000,
  });
};
