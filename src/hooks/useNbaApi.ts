import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Types based on RapidAPI NBA Free Data responses
export interface RapidApiPlayer {
  id?: string;
  playerId?: string;
  uid?: string;
  guid?: string;
  fullName?: string;
  playerName?: string;
  firstName?: string;
  lastName?: string;
  playerSlug?: string;
  team?: string;
  teamId?: string;
  pos?: string;
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
  image?: string;
  headShotUrl?: string;
}

export interface PlayerInfo {
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
  image?: string;
  headShotUrl?: string;
}

export interface PlayerStats {
  gamesPlayed: string;
  min: string;
  ppg: string;
  rpg: string;
  apg: string;
  spg: string;
  bpg: string;
  fgPct: string;
  fg3Pct: string;
  ftPct: string;
}

export interface GameLogEntry {
  gameId: string;
  gameDate: string;
  matchup: string;
  opponent: string;
  opponentLogo?: string;
  wl: string;
  score: string;
  min: string;
  pts: string;
  reb: string;
  ast: string;
  stl: string;
  blk: string;
  fgm: string;
  fga: string;
  fgPct: string;
  fg3m: string;
  fg3a: string;
  fg3Pct: string;
  ftm: string;
  fta: string;
  ftPct: string;
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
      
      const players = data?.response?.PlayerList || data?.PlayerList || data || [];
      return players;
    },
    enabled: !!teamId && teamId > 0,
    staleTime: 5 * 60 * 1000,
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
      
      // Parse the API response - data is in response.athlete
      const athlete = data?.response?.athlete;
      if (!athlete) return null;
      
      return {
        id: athlete.id,
        fullName: athlete.fullName || athlete.displayName,
        firstName: athlete.firstName,
        lastName: athlete.lastName,
        displayHeight: athlete.displayHeight,
        displayWeight: athlete.displayWeight,
        age: athlete.age,
        jersey: athlete.jersey,
        pos: athlete.position?.abbreviation,
        team: athlete.team?.displayName,
        image: athlete.headshot?.href,
        college: athlete.college?.name,
        country: athlete.displayBirthPlace,
        exp: athlete.displayExperience,
        draftYear: athlete.displayDraft,
      };
    },
    enabled: !!playerId,
    staleTime: 5 * 60 * 1000,
  });
};

// Fetch player splits (season stats) by player ID
export const usePlayerSplits = (playerId: string | null) => {
  return useQuery({
    queryKey: ['nba-player-splits', playerId],
    queryFn: async (): Promise<PlayerStats | null> => {
      const { data, error } = await supabase.functions.invoke('nba-stats', {
        body: { action: 'player-splits', playerId }
      });
      
      if (error) throw error;
      
      // Parse the splits response
      // labels: ["GP", "MIN", "FG", "FG%", "3PT", "3P%", "FT", "FT%", "OR", "DR", "REB", "AST", "BLK", "STL", "PF", "TO", "PTS"]
      // stats array matches labels order
      const splits = data?.response?.splits;
      if (!splits) return null;
      
      const allSplits = splits.splitCategories?.[0]?.splits?.[0]; // "All Splits" / Total
      if (!allSplits?.stats) return null;
      
      const stats = allSplits.stats;
      // Index mapping based on labels array
      return {
        gamesPlayed: stats[0] || '0',
        min: stats[1] || '0',
        ppg: stats[16] || '0',  // PTS is last
        rpg: stats[10] || '0',  // REB
        apg: stats[11] || '0',  // AST
        bpg: stats[12] || '0',  // BLK
        spg: stats[13] || '0',  // STL
        fgPct: stats[3] || '0', // FG%
        fg3Pct: stats[5] || '0', // 3P%
        ftPct: stats[7] || '0', // FT%
      };
    },
    enabled: !!playerId,
    staleTime: 5 * 60 * 1000,
  });
};

// Fetch player game log by player ID
export const usePlayerGameLog = (playerId: string | null) => {
  return useQuery({
    queryKey: ['nba-player-gamelog', playerId],
    queryFn: async (): Promise<GameLogEntry[]> => {
      const { data, error } = await supabase.functions.invoke('nba-stats', {
        body: { action: 'player-gamelog', playerId }
      });
      
      if (error) throw error;
      
      // Parse the gamelog response structure:
      // response.gamelog.events - Object with eventId keys containing game info
      // response.gamelog.seasonTypes - Array with season data containing categories (months)
      // Stats order: MIN(0), FG(1), FG%(2), 3PT(3), 3P%(4), FT(5), FT%(6), REB(7), AST(8), BLK(9), STL(10), PF(11), TO(12), PTS(13)
      const gamelog = data?.response?.gamelog;
      if (!gamelog?.events || !gamelog?.seasonTypes) return [];
      
      const events = gamelog.events;
      const seasonTypes = gamelog.seasonTypes || [];
      
      // Find the regular season stats
      const regularSeason = seasonTypes.find((season: { displayName: string }) => 
        season.displayName?.includes('Regular Season')
      );
      
      if (!regularSeason?.categories) return [];
      
      // Collect all game events from all months
      const allGameEvents: { eventId: string; stats: string[] }[] = [];
      
      for (const category of regularSeason.categories) {
        if (category.type === 'event' && category.events) {
          allGameEvents.push(...category.events);
        }
      }
      
      // Map events to GameLogEntry - take only first 10 recent games
      const entries: GameLogEntry[] = [];
      
      for (const gameEvent of allGameEvents.slice(0, 10)) {
        const eventId = gameEvent.eventId;
        const eventData = events[eventId];
        const stats = gameEvent.stats || [];
        
        if (eventData) {
          // Stats indices: MIN(0), FG(1), FG%(2), 3PT(3), 3P%(4), FT(5), FT%(6), REB(7), AST(8), BLK(9), STL(10), PF(11), TO(12), PTS(13)
          const fgSplit = (stats[1] || '0-0').split('-');
          const fg3Split = (stats[3] || '0-0').split('-');
          const ftSplit = (stats[5] || '0-0').split('-');
          
          entries.push({
            gameId: eventId,
            gameDate: eventData.gameDate || '',
            matchup: `${eventData.atVs || ''} ${eventData.opponent?.abbreviation || ''}`,
            opponent: eventData.opponent?.displayName || '',
            opponentLogo: eventData.opponent?.logo,
            wl: eventData.gameResult || '',
            score: eventData.score || '',
            min: stats[0] || '0',
            pts: stats[13] || '0',
            reb: stats[7] || '0',
            ast: stats[8] || '0',
            blk: stats[9] || '0',
            stl: stats[10] || '0',
            fgm: fgSplit[0] || '0',
            fga: fgSplit[1] || '0',
            fgPct: stats[2] || '0',
            fg3m: fg3Split[0] || '0',
            fg3a: fg3Split[1] || '0',
            fg3Pct: stats[4] || '0',
            ftm: ftSplit[0] || '0',
            fta: ftSplit[1] || '0',
            ftPct: stats[6] || '0',
          });
        }
      }
      
      return entries;
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
    staleTime: 10 * 60 * 1000,
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
