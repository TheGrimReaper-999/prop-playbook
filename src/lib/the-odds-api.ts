// The Odds API v4 implementation - uses edge function with fallback API keys
// All API calls go through the edge function for better key management

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Map internal stat types to The Odds API market keys (for reference)
export const STAT_TYPE_TO_MARKET: Record<string, string> = {
  'pts': 'player_points',
  'reb': 'player_rebounds',
  'ast': 'player_assists',
  '3pm': 'player_threes',
  'stl': 'player_steals',
  'blk': 'player_blocks',
  'pr': 'player_points_rebounds',
  'pa': 'player_points_assists',
  'ra': 'player_rebounds_assists',
  'pra': 'player_points_rebounds_assists',
};

// Map internal stat types to alternate line market keys
export const STAT_TYPE_TO_ALTERNATE_MARKET: Record<string, string> = {
  'pts': 'player_points_alternate',
  'reb': 'player_rebounds_alternate',
  'ast': 'player_assists_alternate',
  '3pm': 'player_threes_alternate',
  'stl': 'player_steals_alternate',
  'blk': 'player_blocks_alternate',
};

export interface PlayerOdds {
  playerName: string;
  line: number;
  overOdds: number;
  underOdds: number;
  overOddsAmerican: string;
  underOddsAmerican: string;
}

interface RateLimitInfo {
  remaining: string | null;
  used: string | null;
  last: string | null;
}

interface NBAEvent {
  id: string;
  home_team: string;
  away_team: string;
  commence_time: string;
}

// Cache for today's events
let todayEventsCache: NBAEvent[] | null = null;
let eventsCacheTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Player-specific cache
interface PlayerCacheData {
  mainLines: Record<string, PlayerOdds>;
  alternateLines: Record<string, PlayerOdds[]>;
  timestamp: number;
}
let playerCache: Record<string, PlayerCacheData> = {};
const PLAYER_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

/**
 * Call the edge function with fallback API key support
 */
async function callEdgeFunction(params: Record<string, string>): Promise<{ odds: PlayerOdds[]; events?: NBAEvent[] }> {
  const queryString = new URLSearchParams(params).toString();
  const url = `${SUPABASE_URL}/functions/v1/the-odds-api?${queryString}`;
  
  console.log(`🎲 Calling edge function: the-odds-api with params:`, params);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Edge function error:', response.status, errorText);
    throw new Error(`Edge function error: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error);
  }
  
  return data;
}

/**
 * Get NBA events for today (within next 24 hours)
 */
async function getTodayNBAEvents(): Promise<NBAEvent[]> {
  const now = Date.now();
  
  // Return cached events if still valid
  if (todayEventsCache && (now - eventsCacheTime) < CACHE_DURATION) {
    console.log(`🎲 Using cached NBA events (${todayEventsCache.length} events)`);
    return todayEventsCache;
  }

  console.log(`🎲 Fetching NBA events via edge function...`);
  
  const data = await callEdgeFunction({ action: 'events' });
  const events = data.events || [];
  
  console.log(`🎲 Received ${events.length} NBA events`);

  // Cache the results
  todayEventsCache = events;
  eventsCacheTime = now;

  return events;
}

/**
 * Fetch player prop odds for a specific stat type
 * Uses edge function with fallback API key support
 */
export async function fetchPlayerProps(statType: string): Promise<{
  odds: PlayerOdds[],
  rateLimit: RateLimitInfo | null
}> {
  console.log(`🎲 Fetching player props for statType: ${statType}`);

  const marketKey = STAT_TYPE_TO_MARKET[statType];
  if (!marketKey) {
    throw new Error(`Unsupported stat type: ${statType}`);
  }

  try {
    const data = await callEdgeFunction({ action: 'props', statType });
    console.log(`🎲 Total: ${data.odds.length} player odds for ${statType}`);
    return { odds: data.odds, rateLimit: null };
  } catch (error) {
    console.error('Error fetching player props:', error);
    throw error;
  }
}

/**
 * Fetch alternate lines for a specific stat type
 */
export async function fetchAlternateLines(statType: string): Promise<{
  odds: PlayerOdds[],
  rateLimit: RateLimitInfo | null
}> {
  console.log(`🎲 Fetching alternate lines for statType: ${statType}`);

  const marketKey = STAT_TYPE_TO_ALTERNATE_MARKET[statType];
  if (!marketKey) {
    console.log(`🎲 No alternate lines available for stat type: ${statType}`);
    return { odds: [], rateLimit: null };
  }

  try {
    const data = await callEdgeFunction({ action: 'props', statType, alternate: 'true' });
    console.log(`🎲 Total: ${data.odds.length} alternate lines for ${statType}`);
    return { odds: data.odds, rateLimit: null };
  } catch (error) {
    console.error('Error fetching alternate lines:', error);
    throw error;
  }
}

/**
 * Fetch player odds for a specific game/event
 */
export async function fetchPlayerPropsByGame(
  eventId: string,
  statType: string
): Promise<{ odds: PlayerOdds[]; rateLimit: RateLimitInfo | null }> {
  const marketKey = STAT_TYPE_TO_MARKET[statType];
  
  if (!marketKey) {
    throw new Error(`Unsupported stat type: ${statType}`);
  }

  console.log(`🎲 Fetching game odds for event ${eventId}, stat: ${statType}`);

  try {
    const data = await callEdgeFunction({ action: 'props', statType, eventId });
    console.log(`🎲 Received ${data.odds.length} player odds from event ${eventId}`);
    return { odds: data.odds, rateLimit: null };
  } catch (error) {
    console.error(`Error fetching odds for event ${eventId}:`, error);
    throw error;
  }
}

/**
 * Fetch alternate lines for a specific game/event
 */
export async function fetchAlternateLinesByGame(
  eventId: string,
  statType: string
): Promise<{ odds: PlayerOdds[]; rateLimit: RateLimitInfo | null }> {
  const marketKey = STAT_TYPE_TO_ALTERNATE_MARKET[statType];
  
  if (!marketKey) {
    throw new Error(`Alternate lines not supported for stat type: ${statType}`);
  }

  console.log(`🎲 Fetching alternate lines for event ${eventId}, stat: ${statType}`);

  try {
    const data = await callEdgeFunction({ action: 'props', statType, eventId, alternate: 'true' });
    console.log(`🎲 Received ${data.odds.length} alternate lines from event ${eventId}`);
    return { odds: data.odds, rateLimit: null };
  } catch (error) {
    console.error(`Error fetching alternate lines for event ${eventId}:`, error);
    throw error;
  }
}

/**
 * Find game by team name
 */
export async function findGameByTeam(teamName: string): Promise<string | null> {
  console.log(`🔍 Searching for NBA game containing team: ${teamName}`);
  
  const events = await getTodayNBAEvents();
  
  const teamGames = events.filter(event => {
    const homeTeamMatch = event.home_team.toLowerCase().includes(teamName.toLowerCase());
    const awayTeamMatch = event.away_team.toLowerCase().includes(teamName.toLowerCase());
    return homeTeamMatch || awayTeamMatch;
  });
  
  if (teamGames.length === 0) {
    console.log(`❌ No games found for team: ${teamName}`);
    return null;
  }
  
  const selectedGame = teamGames[0];
  console.log(`✅ Found game for ${teamName}: ${selectedGame.home_team} vs ${selectedGame.away_team}`);
  
  return selectedGame.id;
}

/**
 * Find which game a player is in by checking their team
 */
export async function findPlayerGameByTeam(playerName: string, teamName: string): Promise<string | null> {
  console.log(`🔍 Searching for NBA game containing player: ${playerName} (team: ${teamName})`);
  
  const eventId = await findGameByTeam(teamName);
  
  if (!eventId) {
    console.log(`❌ Could not find game for team: ${teamName}`);
    return null;
  }
  
  console.log(`🎲 Found team game, checking if ${playerName} is in the roster...`);
  
  try {
    const { odds } = await fetchPlayerPropsByGame(eventId, 'pts');
    const playerNames = odds.map(o => o.playerName);
    
    console.log(`📋 Found ${playerNames.length} players in this game (first 5):`, playerNames.slice(0, 5));
    
    const found = playerNames.some(name => {
      const normalizedName = name.toLowerCase().replace(/[^a-z\s]/g, '').trim();
      const normalizedSearch = playerName.toLowerCase().replace(/[^a-z\s]/g, '').trim();
      
      return normalizedName === normalizedSearch || 
             normalizedName.includes(normalizedSearch) || 
             normalizedSearch.includes(normalizedName);
    });
    
    if (found) {
      console.log(`✅ Found ${playerName} in team game (ID: ${eventId})`);
      return eventId;
    } else {
      console.log(`❌ ${playerName} not found in team game roster`);
      debugPlayerNameMatches(odds, playerName);
      return null;
    }
  } catch (error) {
    console.error(`Error fetching roster for team game ${eventId}:`, error);
    return null;
  }
}

/**
 * Find which game a player is in by searching all games
 */
export async function findPlayerGame(playerName: string): Promise<string | null> {
  console.log(`🔍 Searching for NBA game containing player: ${playerName}`);
  
  const events = await getTodayNBAEvents();
  
  for (const event of events) {
    try {
      const { odds } = await fetchPlayerPropsByGame(event.id, 'pts');
      const playerNames = odds.map(o => o.playerName);
      
      const found = playerNames.some(name => {
        const normalizedName = name.toLowerCase().replace(/[^a-z\s]/g, '').trim();
        const normalizedSearch = playerName.toLowerCase().replace(/[^a-z\s]/g, '').trim();
        
        return normalizedName === normalizedSearch || 
               normalizedName.includes(normalizedSearch) || 
               normalizedSearch.includes(normalizedName);
      });
      
      if (found) {
        console.log(`✅ Found ${playerName} in NBA game: ${event.home_team} vs ${event.away_team}`);
        return event.id;
      }
    } catch (error) {
      console.error(`Error checking NBA event ${event.id}:`, error);
      continue;
    }
  }
  
  console.log(`❌ Could not find ${playerName} in any NBA games today`);
  return null;
}

/**
 * Get all available stat types for a player (cached)
 */
export async function fetchAllPlayerData(playerName: string): Promise<{
  mainLines: Record<string, PlayerOdds>;
  alternateLines: Record<string, PlayerOdds[]>;
  rateLimit: RateLimitInfo | null;
}> {
  const normalizedPlayerName = playerName.toLowerCase().trim();
  const now = Date.now();
  
  // Check cache first
  const cached = playerCache[normalizedPlayerName];
  if (cached && (now - cached.timestamp) < PLAYER_CACHE_DURATION) {
    console.log(`🎲 Using cached player data for ${playerName}`);
    return {
      mainLines: cached.mainLines,
      alternateLines: cached.alternateLines,
      rateLimit: null,
    };
  }

  console.log(`🎲 Fetching all player data for ${playerName}`);
  
  const mainLines: Record<string, PlayerOdds> = {};
  const alternateLines: Record<string, PlayerOdds[]> = {};

  // Get all supported stat types
  const statTypes = Object.keys(STAT_TYPE_TO_MARKET);
  
  // Fetch main lines for all stat types
  for (const statType of statTypes) {
    try {
      const { odds } = await fetchPlayerProps(statType);
      const playerOdds = findPlayerOdds(odds, playerName);
      
      if (playerOdds) {
        mainLines[statType] = playerOdds;
      }
    } catch (error) {
      console.error(`Failed to fetch main lines for ${statType}:`, error);
      continue;
    }
  }

  // Fetch alternate lines for supported stat types
  const alternateStatTypes = Object.keys(STAT_TYPE_TO_ALTERNATE_MARKET);
  for (const statType of alternateStatTypes) {
    try {
      const { odds } = await fetchAlternateLines(statType);
      const playerAlternateOdds = findMatchingPlayerOdds(odds, playerName);
      
      if (playerAlternateOdds.length > 0) {
        alternateLines[statType] = playerAlternateOdds;
      }
    } catch (error) {
      console.error(`Failed to fetch alternate lines for ${statType}:`, error);
      continue;
    }
  }

  // Cache the results
  playerCache[normalizedPlayerName] = {
    mainLines,
    alternateLines,
    timestamp: now,
  };

  console.log(`🎲 Cached data for ${playerName}: ${Object.keys(mainLines).length} main lines, ${Object.keys(alternateLines).length} alternate line types`);

  return { mainLines, alternateLines, rateLimit: null };
}

/**
 * Find odds for a specific player using fuzzy name matching
 */
export function findPlayerOdds(
  allOdds: PlayerOdds[],
  playerName: string
): PlayerOdds | null {
  const normalizePlayerName = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const normalizedSearch = normalizePlayerName(playerName);
  
  // Exact match first
  const exactMatch = allOdds.find(
    odds => normalizePlayerName(odds.playerName) === normalizedSearch
  );
  
  if (exactMatch) return exactMatch;
  
  // Try partial match
  const partialMatch = allOdds.find(odds => {
    const normalizedOdds = normalizePlayerName(odds.playerName);
    return normalizedOdds.includes(normalizedSearch) || normalizedSearch.includes(normalizedOdds);
  });
  
  if (partialMatch) return partialMatch;
  
  // Try first name + last initial match
  const searchParts = normalizedSearch.split(' ');
  if (searchParts.length >= 2) {
    const firstName = searchParts[0];
    const lastName = searchParts[searchParts.length - 1];
    
    const initialMatch = allOdds.find(odds => {
      const normalizedOdds = normalizePlayerName(odds.playerName);
      const oddsParts = normalizedOdds.split(' ');
      
      if (oddsParts.length >= 2) {
        const oddsFirstName = oddsParts[0];
        const oddsLastName = oddsParts[oddsParts.length - 1];
        
        return (
          (oddsFirstName === firstName && oddsLastName.startsWith(lastName[0])) ||
          (oddsFirstName.startsWith(firstName[0]) && oddsLastName === lastName)
        );
      }
      return false;
    });
    
    if (initialMatch) return initialMatch;
  }
  
  return null;
}

/**
 * Debug function to find all possible name matches
 */
export function debugPlayerNameMatches(allOdds: PlayerOdds[], playerName: string): void {
  const normalizePlayerName = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const normalizedSearch = normalizePlayerName(playerName);
  console.log(`🔍 Debugging name matching for "${playerName}" (normalized: "${normalizedSearch}")`);
  
  const searchParts = normalizedSearch.split(' ');
  
  allOdds.forEach(odds => {
    const normalizedOdds = normalizePlayerName(odds.playerName);
    
    const hasPartialMatch = searchParts.some(searchPart => 
      normalizedOdds.includes(searchPart) || searchPart.includes(normalizedOdds)
    );
    
    if (hasPartialMatch) {
      console.log(`🎯 Potential match: "${odds.playerName}" (normalized: "${normalizedOdds}")`);
    }
  });
}

/**
 * Find matching player odds for alternate lines (multiple entries per player)
 */
export function findMatchingPlayerOdds(allOdds: PlayerOdds[], playerName: string): PlayerOdds[] {
  const normalizePlayerName = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const normalizedSearch = normalizePlayerName(playerName);
  
  return allOdds.filter(odds => {
    const normalizedOdds = normalizePlayerName(odds.playerName);
    
    if (normalizedOdds === normalizedSearch) {
      return true;
    }
    
    return normalizedOdds.includes(normalizedSearch) || normalizedSearch.includes(normalizedOdds);
  });
}
