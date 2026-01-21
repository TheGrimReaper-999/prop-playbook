import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SavedParlay, ParlayLeg } from '@/contexts/BetSlipContext';
import { teamMatchesAbbrev } from '@/lib/team-utils';

export type LegStatus = 'pending' | 'win' | 'loss';
export type ParlayStatus = 'pending' | 'win' | 'loss';

export interface LegResult {
  legId: string;
  status: LegStatus;
  actualValue?: number;
  opponentAbbrev?: string;
  isHome?: boolean;
  gameDate?: string;
}

export interface ParlayResult {
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
  const stl = stats.steals || 0;
  const blk = stats.blocks || 0;

  switch (statType) {
    case 'pts': return pts;
    case 'reb': return reb;
    case 'ast': return ast;
    case '3pm': return fg3m;
    case 'stl': return stl;
    case 'blk': return blk;
    case 'pra': return pts + reb + ast;
    case 'pr': return pts + reb;
    case 'pa': return pts + ast;
    case 'ra': return reb + ast;
    case 'stl+blk': return stl + blk;
    default: return 0;
  }
};

// Check if a game has finished based on fixture status
const isGameFinished = (status: string): boolean => {
  const finishedStatuses = ['post', 'final', 'completed', 'finished'];
  return finishedStatuses.some(s => status?.toLowerCase().includes(s));
};

// Calculate overall parlay status
const calculateParlayStatus = (legResults: LegResult[]): ParlayStatus => {
  if (legResults.some(r => r.status === 'loss')) return 'loss';
  if (legResults.every(r => r.status === 'win')) return 'win';
  return 'pending';
};

// OPTIMIZED: Batch fetch all data and compute statuses
const fetchParlayStatuses = async (parlays: SavedParlay[]): Promise<Map<string, ParlayResult>> => {
  const results = new Map<string, ParlayResult>();
  
  if (parlays.length === 0) return results;

  // 1. Collect all unique player names across all parlays
  const allLegs = parlays.flatMap(p => p.legs);
  const playerNames = [...new Set(allLegs.map(l => l.player.name))];
  
  if (playerNames.length === 0) return results;

  // 2. Batch fetch all players
  const { data: players } = await supabase
    .from('nba_players')
    .select('id, full_name')
    .in('full_name', playerNames);

  const playerIdMap = new Map<string, string>();
  players?.forEach(p => playerIdMap.set(p.full_name.toLowerCase(), p.id));

  // 3. Find earliest parlay date for stats query
  const earliestDate = parlays.reduce((min, p) => 
    p.createdAt < min ? p.createdAt : min, 
    parlays[0]?.createdAt || new Date().toISOString()
  );

  const playerIds = Array.from(playerIdMap.values());
  if (playerIds.length === 0) {
    // No players found, return all pending
    parlays.forEach(parlay => {
      results.set(parlay.id, {
        parlayId: parlay.id,
        status: 'pending',
        legResults: parlay.legs.map(l => ({ legId: l.legId, status: 'pending' })),
      });
    });
    return results;
  }

  // 4. Batch fetch all stats for all players since earliest parlay
  const { data: allStats } = await supabase
    .from('nba_player_stats')
    .select('*')
    .in('player_id', playerIds)
    .gte('game_date', earliestDate)
    .order('game_date', { ascending: true });

  // 5. Get unique event_ids from stats AND from leg eventIds (for future games)
  const statsEventIds = (allStats || []).map(s => s.event_id);
  const legEventIds = allLegs.map(l => l.eventId).filter(Boolean) as string[];
  const allEventIds = [...new Set([...statsEventIds, ...legEventIds])];
  
  // Batch fetch fixture statuses with team info and game date
  const { data: fixtures } = await supabase
    .from('nba_fixtures')
    .select('event_id, status, home_team_abbrev, away_team_abbrev, home_team_name, away_team_name, game_date')
    .in('event_id', allEventIds);

  const fixtureMap = new Map<string, typeof fixtures extends (infer T)[] | null ? T : never>();
  fixtures?.forEach(f => fixtureMap.set(f.event_id, f));

  // 6. Group stats by player_id for efficient lookup
  const statsByPlayer = new Map<string, typeof allStats>();
  (allStats || []).forEach(stat => {
    const existing = statsByPlayer.get(stat.player_id!) || [];
    existing.push(stat);
    statsByPlayer.set(stat.player_id!, existing);
  });

  // 7. Calculate status for each parlay
  for (const parlay of parlays) {
    const legResults: LegResult[] = [];

    for (const leg of parlay.legs) {
      const playerId = playerIdMap.get(leg.player.name.toLowerCase());
      
      if (!playerId) {
        legResults.push({ legId: leg.legId, status: 'pending' });
        continue;
      }

      const playerStats = statsByPlayer.get(playerId) || [];
      let relevantStat: typeof playerStats[0] | undefined;

      // If leg has an eventId, use it directly for precise matching
      if (leg.eventId) {
        relevantStat = playerStats.find(s => s.event_id === leg.eventId);
      } else {
        // Fallback for old parlays: find first game after parlay creation
        relevantStat = playerStats.find(s => s.game_date >= parlay.createdAt);
      }

      // Get fixture info for opponent display - use eventId directly if available
      const fixtureEventId = relevantStat?.event_id || leg.eventId;
      const fixture = fixtureEventId ? fixtureMap.get(fixtureEventId) : undefined;
      
      // Determine opponent and home/away status (even for pending games)
      let opponentAbbrev: string | undefined;
      let isHome: boolean | undefined;
      let gameDate: string | undefined = fixture?.game_date;
      
      if (fixture && leg.player.team) {
        const playerTeam = leg.player.team;
        isHome = teamMatchesAbbrev(playerTeam, fixture.home_team_abbrev) ||
                 (fixture.home_team_name?.toLowerCase().includes(playerTeam.toLowerCase()) ?? false);
        opponentAbbrev = isHome 
          ? (fixture.away_team_abbrev || fixture.away_team_name || undefined)
          : (fixture.home_team_abbrev || fixture.home_team_name || undefined);
      }

      // If no stats yet or game not finished, return pending with opponent info
      if (!relevantStat) {
        legResults.push({ legId: leg.legId, status: 'pending', opponentAbbrev, isHome, gameDate });
        continue;
      }

      const fixtureStatus = fixture?.status;
      if (!fixtureStatus || !isGameFinished(fixtureStatus)) {
        legResults.push({ legId: leg.legId, status: 'pending', opponentAbbrev, isHome, gameDate });
        continue;
      }

      // Calculate result
      const actualValue = getStatValue(relevantStat, leg.statType);
      const line = parseFloat(leg.mainLine);

      let status: LegStatus = 'pending';
      if (leg.decision === 'TAKE OVER') {
        status = actualValue > line ? 'win' : 'loss';
      } else if (leg.decision === 'TAKE UNDER') {
        status = actualValue < line ? 'win' : 'loss';
      }

      legResults.push({ legId: leg.legId, status, actualValue, opponentAbbrev, isHome, gameDate });
    }

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
    refetchInterval: 60000,
    staleTime: 30000,
  });
};
