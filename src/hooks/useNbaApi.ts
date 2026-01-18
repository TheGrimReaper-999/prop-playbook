import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Types based on RapidAPI NBA Free Data responses
// Player list returns different field names than player info
export interface RapidApiPlayer {
  // API uses 'id' not 'playerId' in player list
  id?: string;
  playerId?: string;
  uid?: string;
  guid?: string;
  // API uses 'fullName' not 'playerName'
  fullName?: string;
  playerName?: string;
  firstName?: string;
  lastName?: string;
  playerSlug?: string;
  team?: string;
  teamId?: string;
  pos?: string;
  // API uses 'displayHeight' and 'displayWeight'
  height?: string;
  displayHeight?: string;
  weight?: string;
  displayWeight?: string;
  birthDate?: string;
  age?: number;
  salary?: number;
  college?: string;
  country?: string;
  draftYear?: string;
  draftRound?: string;
  draftNumber?: string;
  // API uses 'image' not 'headShotUrl'
  image?: string;
  headShotUrl?: string;
}

export interface PlayerInfo {
  // Support multiple field naming conventions from API
  id?: string;
  playerId?: string;
  playerName?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  playerSlug?: string;
  pos?: string;
  height?: string;
  displayHeight?: string;
  weight?: string;
  displayWeight?: string;
  birthDate?: string;
  age?: string | number;
  exp?: string;
  college?: string;
  country?: string;
  draftYear?: string;
  draftRound?: string;
  draftNumber?: string;
  jersey?: string;
  team?: string;
  teamId?: string;
  // Support multiple image field names
  image?: string;
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
  id?: string;
  teamId?: string;
  name?: string;
  teamName?: string;
  teamSlug?: string;
  shortName?: string;
  abbrev?: string;
  teamAbbr?: string;
  teamCity?: string;
  logo?: string;
  logoDark?: string;
  teamLogo?: string;
  conference?: string;
  division?: string;
  href?: string;
}

export interface DivisionTeams {
  division: string;
  teams: {
    status?: string;
    response?: {
      teamList?: RapidApiTeam[];
    };
  } | RapidApiTeam[];
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
      
      // Handle nested API response: response.PlayerList or direct array
      const players = data?.response?.PlayerList || data?.PlayerList || data || [];
      return players;
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
  
  const teamInfo = allTeams?.reduce<(RapidApiTeam & { division?: string }) | null>((found, division) => {
    if (found) return found;
    
    // Handle nested API response structure: teams.response.teamList or teams array
    const teamList = Array.isArray(division.teams) 
      ? division.teams 
      : division.teams?.response?.teamList || [];
    
    const match = teamList.find((t: RapidApiTeam) => {
      const apiName = (t.name || t.teamName || '').toLowerCase();
      const searchName = (teamName || '').toLowerCase();
      return apiName.includes(searchName) || searchName.includes(apiName);
    });
    
    if (match) {
      return { ...match, division: division.division };
    }
    return null;
  }, null);
  
  return { data: teamInfo, isLoading };
};
