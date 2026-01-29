// The Odds API v4 implementation based on developer guide
// Direct API calls to fetch NBA player props from BetMGM

const API_BASE = 'https://api.the-odds-api.com';

// Map internal stat types to The Odds API market keys
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

interface TheOddsApiOutcome {
  name: string;  // "Over" or "Under"
  description: string;  // Player name
  price: number;  // American odds
  point: number;  // Line
}

interface TheOddsApiMarket {
  key: string;
  outcomes: TheOddsApiOutcome[];
}

interface TheOddsApiBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: TheOddsApiMarket[];
}

interface TheOddsApiEvent {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
}

interface TheOddsApiGameWithOdds extends TheOddsApiEvent {
  bookmakers: TheOddsApiBookmaker[];
}

interface RateLimitInfo {
  remaining: string | null;
  used: string | null;
  last: string | null;
}

/**
 * Convert American odds to decimal odds
 */
function americanToDecimal(american: number): number {
  if (american > 0) {
    return (american / 100) + 1;
  } else {
    return (100 / Math.abs(american)) + 1;
  }
}

/**
 * Format American odds with + sign for positive values
 */
function formatAmerican(american: number): string {
  return american > 0 ? `+${american}` : `${american}`;
}

/**
 * Parse player odds from The Odds API response
 * Prioritizes BetMGM as specified in the developer guide
 */
function parsePlayerOdds(bookmakers: TheOddsApiBookmaker[], marketKey: string): PlayerOdds[] {
  const playerOdds: PlayerOdds[] = [];
  
  // Prefer BetMGM as it's the primary bookmaker for player props
  const bookmaker = bookmakers?.find(b => b.key === 'betmgm');
  
  if (!bookmaker) return playerOdds;
  
  const market = bookmaker.markets?.find(m => m.key === marketKey);
  if (!market) return playerOdds;
  
  // Check if this is an alternate market (only Over outcomes)
  const isAlternateMarket = marketKey.includes('_alternate');
  
  if (isAlternateMarket) {
    // Alternate lines only have Over outcomes at different line values
    for (const outcome of market.outcomes) {
      if (outcome.name === 'Over') {
        const overAmerican = outcome.price;
        
        playerOdds.push({
          playerName: outcome.description,
          line: outcome.point,
          overOdds: americanToDecimal(overAmerican),
          underOdds: 0, // No under odds for alternate lines
          overOddsAmerican: formatAmerican(overAmerican),
          underOddsAmerican: '', // No under odds for alternate lines
        });
      }
    }
  } else {
    // Standard markets have both Over and Under outcomes
    // Group outcomes by player name and line
    const playerOutcomes: Record<string, { over?: TheOddsApiOutcome; under?: TheOddsApiOutcome }> = {};
    
    for (const outcome of market.outcomes) {
      const playerName = outcome.description;
      const line = outcome.point;
      const key = `${playerName}-${line}`;
      
      if (!playerOutcomes[key]) {
        playerOutcomes[key] = {};
      }
      
      if (outcome.name === 'Over') {
        playerOutcomes[key].over = outcome;
      } else if (outcome.name === 'Under') {
        playerOutcomes[key].under = outcome;
      }
    }
    
    // Convert to player odds format
    for (const [, outcomes] of Object.entries(playerOutcomes)) {
      if (outcomes.over && outcomes.under) {
        const overAmerican = outcomes.over.price;
        const underAmerican = outcomes.under.price;
        
        playerOdds.push({
          playerName: outcomes.over.description,
          line: outcomes.over.point,
          overOdds: americanToDecimal(overAmerican),
          underOdds: americanToDecimal(underAmerican),
          overOddsAmerican: formatAmerican(overAmerican),
          underOddsAmerican: formatAmerican(underAmerican),
        });
      }
    }
  }
  
  return playerOdds;
}

/**
 * Get API key from environment variables
 */
function getApiKey(): string {
  const apiKey = import.meta.env.VITE_THE_ODDS_API_KEY;
  if (!apiKey) {
    throw new Error('VITE_THE_ODDS_API_KEY not configured. Please add it to your .env file.');
  }
  return apiKey;
}

/**
 * Extract rate limit information from response headers
 */
function extractRateLimit(headers: Headers): RateLimitInfo {
  return {
    remaining: headers.get('x-requests-remaining'),
    used: headers.get('x-requests-used'),
    last: headers.get('x-requests-last'),
  };
}

// Cache for today's events to avoid redundant API calls
let todayEventsCache: TheOddsApiEvent[] | null = null;
let eventsCacheTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Rate limiting to prevent API 429 errors
let lastApiCallTime: number = 0;
const MIN_API_CALL_INTERVAL = 1000; // 1 second between API calls

/**
 * Rate limiting wrapper for API calls
 */
async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const timeSinceLastCall = now - lastApiCallTime;
  
  if (timeSinceLastCall < MIN_API_CALL_INTERVAL) {
    const waitTime = MIN_API_CALL_INTERVAL - timeSinceLastCall;
    console.log(`⏱️ Rate limiting: waiting ${waitTime}ms before API call`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastApiCallTime = Date.now();
  console.log(`🌐 Making API call: ${url.replace(/apiKey=[^&]+/, 'apiKey=[REDACTED]')}`);
  
  return fetch(url);
}

// Player-specific cache to store all stat types for a player
interface PlayerCacheData {
  mainLines: Record<string, PlayerOdds>; // statType -> PlayerOdds
  alternateLines: Record<string, PlayerOdds[]>; // statType -> PlayerOdds[]
  timestamp: number;
}
let playerCache: Record<string, PlayerCacheData> = {};
const PLAYER_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

/**
 * Get all available stat types for a player (cached)
 * Fetches main lines and alternate lines for all stat types at once
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
  let lastRateLimit: RateLimitInfo | null = null;

  // Get all supported stat types
  const statTypes = Object.keys(STAT_TYPE_TO_MARKET);
  
  // Fetch main lines for all stat types
  for (const statType of statTypes) {
    try {
      const { odds, rateLimit } = await fetchPlayerProps(statType);
      const playerOdds = findPlayerOdds(odds, playerName);
      
      if (playerOdds) {
        mainLines[statType] = playerOdds;
      }
      
      if (rateLimit) {
        lastRateLimit = rateLimit;
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
      const { odds, rateLimit } = await fetchAlternateLines(statType);
      const playerAlternateOdds = findMatchingPlayerOdds(odds, playerName);
      
      if (playerAlternateOdds.length > 0) {
        alternateLines[statType] = playerAlternateOdds;
      }
      
      if (rateLimit) {
        lastRateLimit = rateLimit;
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

  return { mainLines, alternateLines, rateLimit: lastRateLimit };
}

/**
 * Fetch player odds for a specific game/event
 * This gets all players from that specific game for the given stat type
 */
export async function fetchPlayerPropsByGame(
  eventId: string,
  statType: string
): Promise<{ odds: PlayerOdds[]; rateLimit: RateLimitInfo | null }> {
  const apiKey = getApiKey();
  const marketKey = STAT_TYPE_TO_MARKET[statType];
  
  if (!marketKey) {
    throw new Error(`Unsupported stat type: ${statType}`);
  }

  const oddsUrl = new URL(`${API_BASE}/v4/sports/basketball_nba/events/${eventId}/odds`);
  oddsUrl.searchParams.set('apiKey', apiKey);
  oddsUrl.searchParams.set('regions', 'us');
  oddsUrl.searchParams.set('bookmakers', 'fanduel,betmgm,draftkings');
  oddsUrl.searchParams.set('markets', marketKey);
  oddsUrl.searchParams.set('oddsFormat', 'american');

  console.log(`🎲 Fetching game odds: ${oddsUrl.toString().replace(apiKey, '[REDACTED]')}`);

  const response = await rateLimitedFetch(oddsUrl.toString());
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('The Odds API odds error:', response.status, errorText);
    
    // Special handling for rate limit errors
    if (response.status === 429) {
      console.error('🚨 Rate limit exceeded! Please wait before making more requests.');
      console.error('💡 Consider upgrading your API plan or implementing better caching.');
      throw new Error(`Rate limit exceeded: ${response.status} - ${errorText}`);
    }
    
    throw new Error(`Odds API error: ${response.status} - ${errorText}`);
  }

  const gameWithOdds: TheOddsApiGameWithOdds = await response.json();
  console.log(`🎲 Received game odds for event ${eventId}`);

  // Parse player odds from bookmakers
  const playerOdds = parsePlayerOdds(gameWithOdds.bookmakers, marketKey);
  
  // Extract rate limit info
  const rateLimit = extractRateLimit(response.headers);

  return { odds: playerOdds, rateLimit };
}

/**
 * Fetch alternate lines for a specific game/event
 * This gets all alternate lines for players from that specific game
 */
export async function fetchAlternateLinesByGame(
  eventId: string,
  statType: string
): Promise<{ odds: PlayerOdds[]; rateLimit: RateLimitInfo | null }> {
  const apiKey = getApiKey();
  const marketKey = STAT_TYPE_TO_ALTERNATE_MARKET[statType];
  
  if (!marketKey) {
    throw new Error(`Alternate lines not supported for stat type: ${statType}`);
  }

  const oddsUrl = new URL(`${API_BASE}/v4/sports/basketball_nba/events/${eventId}/odds`);
  oddsUrl.searchParams.set('apiKey', apiKey);
  oddsUrl.searchParams.set('regions', 'us');
  oddsUrl.searchParams.set('bookmakers', 'fanduel,betmgm,draftkings');
  oddsUrl.searchParams.set('markets', marketKey);
  oddsUrl.searchParams.set('oddsFormat', 'american');

  console.log(`🎲 Fetching alternate lines for game: ${oddsUrl.toString().replace(apiKey, '[REDACTED]')}`);

  const response = await rateLimitedFetch(oddsUrl.toString());
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('The Odds API alternate lines error:', response.status, errorText);
    throw new Error(`Alternate lines API error: ${response.status} - ${errorText}`);
  }

  const gameWithOdds: TheOddsApiGameWithOdds = await response.json();
  console.log(`🎲 Received alternate lines for event ${eventId}`);

  // Parse player odds from bookmakers (only Over outcomes for alternate lines)
  const playerOdds = parsePlayerOdds(gameWithOdds.bookmakers, marketKey);
  
  // Extract rate limit info
  const rateLimit = extractRateLimit(response.headers);

  return { odds: playerOdds, rateLimit };
}
/**
 * Find which game a player is participating in
 * Returns the event ID if found, null otherwise
 */
/**
 * Find game by team name (more efficient than searching by player)
 * Returns the event ID if found, null otherwise
 */
export async function findGameByTeam(teamName: string): Promise<string | null> {
  console.log(`🔍 Searching for NBA game containing team: ${teamName}`);
  
  // Get today's NBA events
  const events = await getTodayNBAEvents();
  
  // Find games where this team is playing
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

export async function findPlayerGameByTeam(playerName: string, teamName: string): Promise<string | null> {
  console.log(`🔍 Searching for NBA game containing player: ${playerName} (team: ${teamName})`);
  
  // First find the team's game
  const eventId = await findGameByTeam(teamName);
  
  if (!eventId) {
    console.log(`❌ Could not find game for team: ${teamName}`);
    return null;
  }
  
  console.log(`🎲 Found team game, checking if ${playerName} is in the roster...`);
  
  // Fetch the player list for this specific game
  try {
    const { odds } = await fetchPlayerPropsByGame(eventId, 'pts');
    const playerNames = odds.map(o => o.playerName);
    
    console.log(`📋 Found ${playerNames.length} players in this game (first 5):`, playerNames.slice(0, 5));
    
    // Check if our player is in this game
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
export async function findPlayerGame(playerName: string): Promise<string | null> {
  console.log(`🔍 Searching for NBA game containing player: ${playerName}`);
  
  // Get today's NBA events
  const events = await getTodayNBAEvents();
  
  // First, check if player is with Dallas Mavericks (Cooper Flagg's team)
  const mavericksGames = events.filter(event => 
    event.home_team.toLowerCase().includes('mavericks') || 
    event.away_team.toLowerCase().includes('mavericks')
  );
  
  if (mavericksGames.length > 0) {
    console.log(`🏀 Found ${mavericksGames.length} Mavericks games, checking those first`);
    
    for (const event of mavericksGames) {
      try {
        const { odds } = await fetchPlayerPropsByGame(event.id, 'pts');
        const playerNames = odds.map(o => o.playerName);
        
        // Check if our player is in this game
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
        console.error(`Error checking Mavericks game ${event.id}:`, error);
        continue;
      }
    }
  }
  
  // If not found in Mavericks games, check all other NBA games
  for (const event of events) {
    // Skip Mavericks games since we already checked them
    if (event.home_team.toLowerCase().includes('mavericks') || 
        event.away_team.toLowerCase().includes('mavericks')) {
      continue;
    }
    
    try {
      const { odds } = await fetchPlayerPropsByGame(event.id, 'pts');
      const playerNames = odds.map(o => o.playerName);
      
      // Check if our player is in this game
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
 * Get NBA events for today (within next 24 hours)
 * Uses caching to avoid redundant API calls
 */
async function getTodayNBAEvents(): Promise<TheOddsApiEvent[]> {
  const now = Date.now();
  
  // Return cached events if still valid
  if (todayEventsCache && (now - eventsCacheTime) < CACHE_DURATION) {
    console.log(`🎲 Using cached NBA events (${todayEventsCache.length} events)`);
    return todayEventsCache;
  }

  const apiKey = getApiKey();
  const eventsUrl = new URL(`${API_BASE}/v4/sports/basketball_nba/events`);
  eventsUrl.searchParams.set('apiKey', apiKey);

  console.log(`🎲 Fetching NBA events: ${eventsUrl.toString().replace(apiKey, '[REDACTED]')}`);

  const response = await rateLimitedFetch(eventsUrl.toString());
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('The Odds API events error:', response.status, errorText);
    throw new Error(`Events API error: ${response.status} - ${errorText}`);
  }

  const events: TheOddsApiEvent[] = await response.json();
  console.log(`🎲 The Odds API returned ${events.length} NBA events`);

  // Filter events for today (within 24 hours) to save API credits
  const tomorrow = new Date(now + 24 * 60 * 60 * 1000);
  
  const todaysEvents = events.filter(event => {
    const eventDate = new Date(event.commence_time);
    return eventDate >= new Date(now) && eventDate <= tomorrow;
  });

  console.log(`🎲 Found ${todaysEvents.length} events starting within 24 hours`);

  // Cache the results
  todayEventsCache = todaysEvents;
  eventsCacheTime = now;

  return todaysEvents;
}

/**
 * Fetch player prop odds for a specific game
 * Optimized with better error handling and early returns
 */
async function fetchGameOdds(
  eventId: string, 
  marketKey: string
): Promise<{ odds: PlayerOdds[], rateLimit: RateLimitInfo }> {
  const apiKey = getApiKey();
  const oddsUrl = new URL(`${API_BASE}/v4/sports/basketball_nba/events/${eventId}/odds`);
  oddsUrl.searchParams.set('apiKey', apiKey);
  oddsUrl.searchParams.set('regions', 'us');
  oddsUrl.searchParams.set('bookmakers', 'betmgm');
  oddsUrl.searchParams.set('markets', marketKey);
  oddsUrl.searchParams.set('oddsFormat', 'american');

  console.log(`🎲 Fetching odds for event ${eventId}`);

  const response = await rateLimitedFetch(oddsUrl.toString());
  const rateLimit = extractRateLimit(response.headers);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Odds API error for event ${eventId}:`, response.status, errorText);
    throw new Error(`Odds API error: ${response.status} - ${errorText}`);
  }

  const gameWithOdds: TheOddsApiGameWithOdds = await response.json();
  
  // Early return if no bookmakers
  if (!gameWithOdds.bookmakers?.length) {
    console.log(`🎲 No bookmakers found for event ${eventId}`);
    return { odds: [], rateLimit };
  }

  const gameOdds = parsePlayerOdds(gameWithOdds.bookmakers, marketKey);
  console.log(`🎲 Parsed ${gameOdds.length} player odds from event ${eventId}`);

  return { odds: gameOdds, rateLimit };
}

/**
 * Fetch player prop odds for a specific stat type
 * Implements the developer guide for NBA player props from BetMGM
 */
export async function fetchPlayerProps(statType: string): Promise<{
  odds: PlayerOdds[],
  rateLimit: RateLimitInfo | null
}> {
  console.log(`🎲 Fetching player props for statType: ${statType}`);

  // Get the market key for the stat type
  const marketKey = STAT_TYPE_TO_MARKET[statType];
  if (!marketKey) {
    throw new Error(`Unsupported stat type: ${statType}`);
  }

  try {
    // Get today's NBA events
    const events = await getTodayNBAEvents();

    if (events.length === 0) {
      console.log('🎲 No NBA games found for today');
      return { odds: [], rateLimit: null };
    }

    // Fetch odds for each event
    let allPlayerOdds: PlayerOdds[] = [];
    let lastRateLimit: RateLimitInfo | null = null;

    for (const event of events) {
      try {
        const { odds, rateLimit } = await fetchGameOdds(event.id, marketKey);
        allPlayerOdds = allPlayerOdds.concat(odds);
        lastRateLimit = rateLimit;
      } catch (error) {
        console.error(`Failed to fetch odds for event ${event.id}:`, error);
        // Continue with other events
        continue;
      }
    }

    console.log(`🎲 Total: ${allPlayerOdds.length} player odds for ${statType}`);
    
    if (lastRateLimit) {
      console.log(`🎲 Rate limit - Remaining: ${lastRateLimit.remaining}, Used: ${lastRateLimit.used}, Last: ${lastRateLimit.last}`);
    }

    return { odds: allPlayerOdds, rateLimit: lastRateLimit };
  } catch (error) {
    console.error('Error fetching player props:', error);
    throw error;
  }
}

/**
 * Fetch alternate lines for a specific stat type
 * Alternate lines only have "Over" outcomes at multiple line values
 */
export async function fetchAlternateLines(statType: string): Promise<{
  odds: PlayerOdds[],
  rateLimit: RateLimitInfo | null
}> {
  console.log(`🎲 Fetching alternate lines for statType: ${statType}`);

  // Get the alternate market key for the stat type
  const marketKey = STAT_TYPE_TO_ALTERNATE_MARKET[statType];
  if (!marketKey) {
    console.log(`🎲 No alternate lines available for stat type: ${statType}`);
    return { odds: [], rateLimit: null };
  }

  try {
    // Get today's NBA events
    const events = await getTodayNBAEvents();

    if (events.length === 0) {
      console.log('🎲 No NBA games found for today');
      return { odds: [], rateLimit: null };
    }

    // Fetch odds for each event
    let allPlayerOdds: PlayerOdds[] = [];
    let lastRateLimit: RateLimitInfo | null = null;

    for (const event of events) {
      try {
        const { odds, rateLimit } = await fetchGameOdds(event.id, marketKey);
        allPlayerOdds = allPlayerOdds.concat(odds);
        lastRateLimit = rateLimit;
      } catch (error) {
        console.error(`Failed to fetch alternate odds for event ${event.id}:`, error);
        // Continue with other events
        continue;
      }
    }

    console.log(`🎲 Total: ${allPlayerOdds.length} alternate lines for ${statType}`);
    
    if (lastRateLimit) {
      console.log(`🎲 Rate limit - Remaining: ${lastRateLimit.remaining}, Used: ${lastRateLimit.used}, Last: ${lastRateLimit.last}`);
    }

    return { odds: allPlayerOdds, rateLimit: lastRateLimit };
  } catch (error) {
    console.error('Error fetching alternate lines:', error);
    throw error;
  }
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
      .replace(/[^a-z\s]/g, '') // Remove non-letters except spaces
      .replace(/\s+/g, ' ')     // Normalize spaces
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
  
  // Try first name + last initial match (e.g., "Cooper Flagg" -> "C. Flagg")
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
        
        // Match first name and last initial, or first initial and last name
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

// Debug function to find all possible name matches
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
  
  // Show all players that contain parts of the name
  const searchParts = normalizedSearch.split(' ');
  
  allOdds.forEach(odds => {
    const normalizedOdds = normalizePlayerName(odds.playerName);
    const oddsParts = normalizedOdds.split(' ');
    
    // Check if any part matches
    const hasPartialMatch = searchParts.some(searchPart => 
      normalizedOdds.includes(searchPart) || searchPart.includes(normalizedOdds)
    );
    
    if (hasPartialMatch) {
      console.log(`🎯 Potential match: "${odds.playerName}" (normalized: "${normalizedOdds}")`);
    }
  });
}

// Optimized player matching function for multiple odds
export function findMatchingPlayerOdds(allOdds: PlayerOdds[], playerName: string): PlayerOdds[] {
  const normalizePlayerName = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z\s]/g, '') // Remove non-letters except spaces
      .replace(/\s+/g, ' ')     // Normalize spaces
      .trim();
  };

  const normalizedSearch = normalizePlayerName(playerName);
  
  return allOdds.filter(odds => {
    const normalizedOdds = normalizePlayerName(odds.playerName);
    
    // Exact match first
    if (normalizedOdds === normalizedSearch) {
      return true;
    }
    
    // Try partial match (more efficient than includes both ways)
    return normalizedOdds.includes(normalizedSearch) || normalizedSearch.includes(normalizedOdds);
  });
}
