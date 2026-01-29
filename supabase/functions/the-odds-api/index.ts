import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const API_BASE = 'https://api.the-odds-api.com';

// Map our internal stat types to The Odds API market keys
const STAT_TYPE_TO_MARKET: Record<string, string> = {
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

interface PlayerOdds {
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

function parsePlayerOdds(bookmakers: TheOddsApiBookmaker[], marketKey: string): PlayerOdds[] {
  const playerOdds: PlayerOdds[] = [];
  
  // Prefer FanDuel, then BetMGM, then DraftKings
  const bookmakerPriority = ['fanduel', 'betmgm', 'draftkings'];
  let bookmaker: TheOddsApiBookmaker | undefined;
  
  for (const key of bookmakerPriority) {
    bookmaker = bookmakers?.find(b => b.key === key);
    if (bookmaker) break;
  }
  
  // Fall back to any available bookmaker
  if (!bookmaker && bookmakers?.length > 0) {
    bookmaker = bookmakers[0];
  }
  
  if (!bookmaker) return playerOdds;
  
  const market = bookmaker.markets?.find(m => m.key === marketKey);
  if (!market) return playerOdds;
  
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
      
      // Convert American to decimal for compatibility
      const toDecimal = (american: number): number => {
        if (american > 0) {
          return (american / 100) + 1;
        } else {
          return (100 / Math.abs(american)) + 1;
        }
      };
      
      playerOdds.push({
        playerName: outcomes.over.description,
        line: outcomes.over.point,
        overOdds: toDecimal(overAmerican),
        underOdds: toDecimal(underAmerican),
        overOddsAmerican: overAmerican > 0 ? `+${overAmerican}` : `${overAmerican}`,
        underOddsAmerican: underAmerican > 0 ? `+${underAmerican}` : `${underAmerican}`,
      });
    }
  }
  
  return playerOdds;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('THE_ODDS_API_KEY');
    if (!apiKey) {
      throw new Error('THE_ODDS_API_KEY not configured');
    }

    const body = await req.json();
    const { action, statType, homeTeam, awayTeam } = body;
    
    switch (action) {
      case 'get_player_props': {
        // Get the market key for the stat type
        const marketKey = STAT_TYPE_TO_MARKET[statType];
        if (!marketKey) {
          throw new Error(`Unsupported stat type: ${statType}`);
        }

        // Step 1: Get list of NBA events first
        const eventsUrl = new URL(`${API_BASE}/v4/sports/basketball_nba/events`);
        eventsUrl.searchParams.set('apiKey', apiKey);

        console.log(`The Odds API events request: ${eventsUrl.toString().replace(apiKey, '[REDACTED]')}`);

        const eventsResponse = await fetch(eventsUrl.toString());
        
        if (!eventsResponse.ok) {
          const errorText = await eventsResponse.text();
          console.error('The Odds API events error:', eventsResponse.status, errorText);
          throw new Error(`Events API error: ${eventsResponse.status} - ${errorText}`);
        }

        const events: TheOddsApiEvent[] = await eventsResponse.json();
        console.log(`The Odds API returned ${events.length} NBA events`);

        // Filter events by team if specified
        let filteredEvents = events;
        if (homeTeam || awayTeam) {
          filteredEvents = events.filter(event => {
            const eventTeams = [event.home_team.toLowerCase(), event.away_team.toLowerCase()];
            const searchTerms = [homeTeam?.toLowerCase(), awayTeam?.toLowerCase()].filter(Boolean) as string[];
            
            return searchTerms.some(search => 
              eventTeams.some(team => 
                team.includes(search) || search.includes(team)
              )
            );
          });
          console.log(`Filtered to ${filteredEvents.length} events matching team(s)`);
        }

        // Only fetch odds for today's games (within next 24 hours) to save API credits
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        
        const todaysEvents = filteredEvents.filter(event => {
          const eventDate = new Date(event.commence_time);
          return eventDate >= now && eventDate <= tomorrow;
        });

        console.log(`Found ${todaysEvents.length} events starting within 24 hours`);

        if (todaysEvents.length === 0) {
          return new Response(JSON.stringify({
            success: true,
            action,
            market: marketKey,
            odds: [],
            message: 'No games found for today',
            rateLimit: {
              remaining: eventsResponse.headers.get('x-requests-remaining'),
              used: eventsResponse.headers.get('x-requests-used'),
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Step 2: For each event, fetch player props odds
        let allPlayerOdds: PlayerOdds[] = [];
        let lastRateLimit = { remaining: '', used: '' };

        for (const event of todaysEvents) {
          const oddsUrl = new URL(`${API_BASE}/v4/sports/basketball_nba/events/${event.id}/odds`);
          oddsUrl.searchParams.set('apiKey', apiKey);
          oddsUrl.searchParams.set('regions', 'us');
          oddsUrl.searchParams.set('bookmakers', 'fanduel,betmgm,draftkings');
          oddsUrl.searchParams.set('markets', marketKey);
          oddsUrl.searchParams.set('oddsFormat', 'american');

          console.log(`Fetching odds for event ${event.id}: ${event.home_team} vs ${event.away_team}`);

          const oddsResponse = await fetch(oddsUrl.toString());
          
          lastRateLimit = {
            remaining: oddsResponse.headers.get('x-requests-remaining') || '',
            used: oddsResponse.headers.get('x-requests-used') || '',
          };

          if (!oddsResponse.ok) {
            const errorText = await oddsResponse.text();
            console.error(`Odds API error for event ${event.id}:`, oddsResponse.status, errorText);
            continue; // Skip this event but continue with others
          }

          const gameWithOdds: TheOddsApiGameWithOdds = await oddsResponse.json();
          
          if (gameWithOdds.bookmakers && gameWithOdds.bookmakers.length > 0) {
            const gameOdds = parsePlayerOdds(gameWithOdds.bookmakers, marketKey);
            allPlayerOdds = allPlayerOdds.concat(gameOdds);
            console.log(`Parsed ${gameOdds.length} player odds from ${event.home_team} vs ${event.away_team}`);
          }
        }

        console.log(`Total: ${allPlayerOdds.length} player odds for market ${marketKey}`);

        return new Response(JSON.stringify({
          success: true,
          action,
          market: marketKey,
          odds: allPlayerOdds,
          rateLimit: lastRateLimit,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('The Odds API error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
