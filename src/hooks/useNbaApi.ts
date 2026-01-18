import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Types based on RapidAPI NBA Free Data responses
export interface RapidApiPlayer {
  playerId: string;
  playerName: string;
  playerSlug: string;
  team: string;
  teamId: string;
  pos: string;
  height: string;
  weight: string;
  birthDate: string;
  college: string;
  country: string;
  draftYear: string;
  draftRound: string;
  draftNumber: string;
  headShotUrl?: string;
}

export interface PlayerInfo {
  playerId: string;
  playerName: string;
  playerSlug: string;
  pos: string;
  height: string;
  weight: string;
  birthDate: string;
  age: string;
  exp: string;
  college: string;
  country: string;
  draftYear: string;
  draftRound: string;
  draftNumber: string;
  jersey: string;
  team: string;
  teamId: string;
  headShotUrl?: string;
  stats?: {
    ppg: string;
    rpg: string;
    apg: string;
    spg: string;
    bpg: string;
    fgPct: string;
    fg3Pct: string;
    ftPct: string;
    gamesPlayed: string;
    min: string;
  };
}

export interface GameLog {
  gameId: string;
  gameDate: string;
  matchup: string;
  wl: string;
  min: string;
  pts: string;
  reb: string;
  ast: string;
  stl: string;
  blk: string;
  tov: string;
  fgm: string;
  fga: string;
  fgPct: string;
  fg3m: string;
  fg3a: string;
  fg3Pct: string;
  ftm: string;
  fta: string;
  ftPct: string;
  plusMinus: string;
}

export interface RapidApiTeam {
  teamId: string;
  teamName: string;
  teamSlug: string;
  teamAbbr: string;
  teamCity: string;
  teamLogo: string;
  conference: string;
  division: string;
}

export interface DivisionTeams {
  division: string;
  teams: RapidApiTeam[];
}

// Fetch player list by team ID
export const usePlayerList = (teamId: number | null) => {
  return useQuery({
    queryKey: ['nba-player-list', teamId],
    queryFn: async (): Promise<RapidApiPlayer[]> => {
      const { data, error } = await supabase.functions.invoke('nba-stats', {
        body: { action: 'player-list', teamId }
      });
      
      if (error) throw error;
      
      // The API returns an array of players
      return data || [];
    },
    enabled: !!teamId && teamId > 0,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
};

// Fetch player info by player ID
export const usePlayerInfo = (playerId: string | null) => {
  return useQuery({
    queryKey: ['nba-player-info', playerId],
    queryFn: async (): Promise<PlayerInfo | null> => {
      const { data, error } = await supabase.functions.invoke('nba-stats', {
        body: { action: 'player-info', playerId }
      });
      
      if (error) throw error;
      
      // API returns player info object or array with one player
      return Array.isArray(data) ? data[0] : data;
    },
    enabled: !!playerId,
    staleTime: 5 * 60 * 1000,
  });
};

// Fetch player game log by player ID
export const usePlayerGameLog = (playerId: string | null) => {
  return useQuery({
    queryKey: ['nba-player-gamelog', playerId],
    queryFn: async (): Promise<GameLog[]> => {
      const { data, error } = await supabase.functions.invoke('nba-stats', {
        body: { action: 'player-gamelog', playerId }
      });
      
      if (error) throw error;
      
      // Return the gamelog array
      return data?.gamelog || data || [];
    },
    enabled: !!playerId,
    staleTime: 5 * 60 * 1000,
  });
};

// Fetch all NBA teams from all divisions
export const useAllNbaTeams = () => {
  return useQuery({
    queryKey: ['nba-all-teams'],
    queryFn: async (): Promise<DivisionTeams[]> => {
      const { data, error } = await supabase.functions.invoke('nba-stats', {
        body: { action: 'all-teams' }
      });
      
      if (error) throw error;
      
      return data || [];
    },
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });
};

// Fetch teams by division
export const useTeamsByDivision = (division: 'southwest' | 'pacific' | 'northwest' | 'southeast' | 'atlantic' | 'central') => {
  return useQuery({
    queryKey: ['nba-teams', division],
    queryFn: async (): Promise<RapidApiTeam[]> => {
      const { data, error } = await supabase.functions.invoke('nba-stats', {
        body: { action: `teams-${division}` }
      });
      
      if (error) throw error;
      
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
  });
};

// Find team info from all divisions by team name
export const useTeamInfoByName = (teamName: string | null) => {
  const { data: allTeams, isLoading } = useAllNbaTeams();
  
  const teamInfo = allTeams?.reduce<RapidApiTeam | null>((found, division) => {
    if (found) return found;
    const match = division.teams?.find((t: RapidApiTeam) => 
      t.teamName?.toLowerCase().includes(teamName?.toLowerCase() || '') ||
      teamName?.toLowerCase().includes(t.teamName?.toLowerCase() || '')
    );
    return match || null;
  }, null);
  
  return { data: teamInfo, isLoading };
};
