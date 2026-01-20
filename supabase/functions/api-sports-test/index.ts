import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Basketball API (covers NBA as league 12)
const API_BASE = 'https://v1.basketball.api-sports.io';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('API_SPORTS_KEY');
    if (!apiKey) {
      throw new Error('API_SPORTS_KEY not configured');
    }

    const { action, playerId, gameId, teamId, season, date, gameIds } = await req.json();
    
    let endpoint = '';
    const params = new URLSearchParams();

    // Default to current season (2025-2026) if not specified
    const currentSeason = season || '2025-2026';
    
    switch (action) {
      case 'test':
        // Simple connectivity/status test
        endpoint = '/status';
        break;
        
      case 'player-stats-by-game':
        // Get player stats for a specific game (boxscore)
        if (!gameId) throw new Error('gameId required');
        endpoint = '/games/statistics/players';
        params.append('id', gameId.toString());
        break;
        
      case 'player-stats-by-games':
        // Get player stats for multiple games at once (max 20)
        if (!gameIds || !Array.isArray(gameIds)) throw new Error('gameIds array required');
        endpoint = '/games/statistics/players';
        params.append('ids', gameIds.slice(0, 20).join('-'));
        break;
        
      case 'player-season-stats':
        // Get all stats for a player for a season (gamelog equivalent)
        if (!playerId) throw new Error('playerId required');
        endpoint = '/games/statistics/players';
        params.append('player', playerId.toString());
        params.append('season', currentSeason);
        break;
        
      case 'game':
        // Get specific game details
        if (!gameId) throw new Error('gameId required');
        endpoint = '/games';
        params.append('id', gameId.toString());
        break;
        
      case 'games-by-date':
        // Get all NBA games for a specific date (format: YYYY-MM-DD)
        if (!date) throw new Error('date required');
        endpoint = '/games';
        params.append('league', '12'); // NBA
        params.append('season', currentSeason);
        params.append('date', date);
        break;
        
      case 'team-games':
        // Get games for a specific team
        if (!teamId) throw new Error('teamId required');
        endpoint = '/games';
        params.append('league', '12');
        params.append('season', currentSeason);
        params.append('team', teamId.toString());
        break;
        
      case 'player-info':
        // Get player details by ID
        if (!playerId) throw new Error('playerId required');
        endpoint = '/players';
        params.append('id', playerId.toString());
        break;
        
      case 'search-player':
        // Search for a player by name
        const { search } = await req.json();
        if (!search) throw new Error('search required (min 3 chars)');
        endpoint = '/players';
        params.append('search', search);
        params.append('league', '12');
        break;
        
      case 'teams':
        // Get all NBA teams
        endpoint = '/teams';
        params.append('league', '12');
        params.append('season', currentSeason);
        break;
        
      case 'standings':
        // Get current NBA standings
        endpoint = '/standings';
        params.append('league', '12');
        params.append('season', currentSeason);
        break;

      case 'odds':
        // Get betting odds for a specific game
        if (!gameId) throw new Error('gameId required');
        endpoint = '/odds';
        params.append('game', gameId.toString());
        break;
        
      case 'odds-by-bet':
        // Get odds for a specific bet type (player props)
        // betId: 117=Points, 118=Assists, 119=Rebounds, 120=Triples, etc.
        const { betId } = await req.json();
        if (!betId) throw new Error('betId required');
        endpoint = '/odds';
        params.append('league', '12');
        params.append('season', currentSeason);
        params.append('bet', betId.toString());
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    const url = `${API_BASE}${endpoint}${params.toString() ? '?' + params.toString() : ''}`;
    console.log(`API-Sports request: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-apisports-key': apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API-Sports error:', response.status, errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('API-Sports response:', JSON.stringify(data).substring(0, 500));

    return new Response(JSON.stringify({
      success: true,
      action,
      data,
      // Include rate limit info from headers
      rateLimit: {
        remaining: response.headers.get('x-ratelimit-requests-remaining'),
        limit: response.headers.get('x-ratelimit-requests-limit'),
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('API-Sports test error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
