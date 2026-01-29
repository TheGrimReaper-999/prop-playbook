# The Odds API v4 Developer Guide - NBA Player Props (BetMGM)

## Overview
This document provides a comprehensive guide for accessing NBA player props data from The Odds API v4, specifically from BetMGM, which offers comprehensive player-specific betting markets through this API.

## API Key Management
- **API Key**: Required for all requests
- **Usage Cost**: 1 credit per region per market
- **Rate Limiting**: Monitor response headers for quota usage
- **Example Key Format**: `0a9c9b7e269478d03a30a7a24177b683`

## Base URL
```
https://api.the-odds-api.com
```

## Available Regions & Bookmakers

### US Region (8 bookmakers)
- **BetMGM** (`betmgm`) - **Primary bookmaker for player props**
- DraftKings (`draftkings`)
- FanDuel (`fanduel`)
- BetRivers (`betrivers`)
- BetOnline.ag (`betonlineag`)
- Bovada (`bovada`)
- MyBookie.ag (`mybookieag`)
- LowVig.ag (`lowvig`)

### UK Region (19 bookmakers)
- Sky Bet, Paddy Power, William Hill, Betfair, etc.
- No player props available in UK region

### Important Note
- **BetMGM offers comprehensive player props** through this API
- Other bookmakers may have limited or no player prop availability

## NBA Player Props - BetMGM

### Available Player Markets

#### Individual Player Stats (6 markets)
- `player_points` - Player points over/under
- `player_assists` - Player assists over/under
- `player_rebounds` - Player rebounds over/under
- `player_steals` - Player steals over/under
- `player_blocks` - Player blocks over/under
- `player_threes` - Player 3-pointers made over/under

#### Combined Player Stats (4 markets)
- `player_points_rebounds` - Points + rebounds
- `player_points_assists` - Points + assists
- `player_rebounds_assists` - Rebounds + assists
- `player_points_rebounds_assists` - Points + rebounds + assists

#### Player Performance Props (4 markets)
- `player_double_double` - Double double (yes/no)
- `player_triple_double` - Triple double (yes/no)
- `player_first_basket` - First basket scorer
- `player_first_team_basket` - First team basket scorer

#### Alternate Lines (5 markets)
- `player_points_alternate` - Multiple point lines (5+, 10+, 15+, etc.)
- `player_assists_alternate` - Multiple assist lines
- `player_rebounds_alternate` - Multiple rebound lines
- `player_steals_alternate` - Multiple steal lines
- `player_threes_alternate` - Multiple 3-pointer lines

#### Quarter/Half Specific (3 markets)
- `player_points_q1` - First quarter points
- `player_assists_q1` - First quarter assists
- `player_rebounds_q1` - First quarter rebounds

**Total Player Prop Markets Available: 22**

## API Endpoints

### 1. Get Available Sports
```bash
GET /v4/sports/?apiKey={apiKey}
```
**Cost**: Free (no quota usage)

### 2. Get NBA Games with Player Props
```bash
GET /v4/sports/basketball_nba/odds?regions=us&bookmakers=betmgm&markets=player_points&apiKey={apiKey}
```

### 3. Get Available Markets for Specific Game
```bash
GET /v4/sports/basketball_nba/events/{eventId}/markets?regions=us&bookmakers=betmgm&apiKey={apiKey}
```

### 4. Get Player Props for Specific Game
```bash
GET /v4/sports/basketball_nba/events/{eventId}/odds?regions=us&bookmakers=betmgm&markets=player_points,player_assists,player_rebounds&apiKey={apiKey}
```

## Sample API Calls

### Get NBA Player Points Props
```bash
curl "https://api.the-odds-api.com/v4/sports/basketball_nba/odds?regions=us&bookmakers=fanduel&markets=player_points&apiKey=YOUR_API_KEY"
```

### Get Multiple Player Prop Markets
```bash
curl "https://api.the-odds-api.com/v4/sports/basketball_nba/odds?regions=us&bookmakers=fanduel&markets=player_points,player_assists,player_rebounds&apiKey=YOUR_API_KEY"
```

### Get All Available Markets for Specific Game
```bash
curl "https://api.the-odds-api.com/v4/sports/basketball_nba/events/4329ccf40a387789800b68750d2cd999/markets?regions=us&bookmakers=fanduel&apiKey=YOUR_API_KEY"
```

## Response Structure

### Player Points Market Example
```json
{
  "id": "4329ccf40a387789800b68750d2cd999",
  "sport_key": "basketball_nba",
  "commence_time": "2026-01-30T00:10:00Z",
  "home_team": "Washington Wizards",
  "away_team": "Milwaukee Bucks",
  "bookmakers": [{
    "key": "betmgm",
    "title": "BetMGM",
    "last_update": "2026-01-29T18:49:41Z",
    "markets": [{
      "key": "player_points",
      "outcomes": [
        {
          "name": "Over",
          "description": "Myles Turner",
          "price": -118,
          "point": 15.5
        },
        {
          "name": "Under", 
          "description": "Myles Turner",
          "price": -110,
          "point": 15.5
        }
      ]
    }]
  }]
}
```

### Alternate Lines Example (5+, 10+, etc.)
```json
{
  "key": "player_points_alternate",
  "outcomes": [
    {
      "name": "Over",
      "description": "Kyle Kuzma",
      "price": 600,
      "point": 24.5
    },
    {
      "name": "Over",
      "description": "Kyle Kuzma", 
      "price": 185,
      "point": 19.5
    },
    {
      "name": "Over",
      "description": "Kyle Kuzma",
      "price": -200,
      "point": 14.5
    }
  ]
}
```

## Key Parameters

### Required Parameters
- `apiKey` - Your API key
- `regions` - Use "us" for BetMGM player props
- `bookmakers` - Use "betmgm" for player props

### Optional Parameters
- `markets` - Comma-separated list of markets
- `oddsFormat` - "decimal" (default) or "american"
- `dateFormat` - "iso" (default) or "unix"
- `eventIds` - Filter by specific game IDs

### Odds Format Options
- **Decimal Format** (default): 1.85, 2.10, etc.
- **American Format**: -118, -110, +105, etc.
  - Add `&oddsFormat=american` for American odds

### Market Types
- **Standard Markets**: Over/Under pairs (player_points, player_assists, etc.)
- **Alternate Markets**: Over bets only at multiple lines (player_points_alternate, etc.)

## Usage Cost Optimization

### Cost Calculation
```
Cost = [number of markets] × [number of regions]
```

### Examples
- 1 market, 1 region = 1 credit
- 3 markets, 1 region = 3 credits
- 1 market, 3 regions = 3 credits

### Cost-Saving Tips
1. **Use specific markets** instead of all available markets
2. **Filter by specific games** using eventIds parameter
3. **Monitor quota usage** via response headers:
   - `x-requests-remaining` - Credits remaining
   - `x-requests-used` - Credits used
   - `x-requests-last` - Cost of last request

## Important Notes

### Player Props Availability
- **BetMGM offers comprehensive player props** through this API
- **22 different player prop markets** available
- **Standard over/under** and **alternate line** markets
- **American and decimal** odds formats supported
- **Quarter-specific** markets available

### Data Freshness
- Player props update frequently (check `last_update` timestamps)
- Real-time odds updates approximately every 30 seconds
- Some props may not be available until closer to game time
- BetMGM typically posts props 2-6 hours before game time

### Limitations
- No historical player props data available through standard endpoints
- Player props limited to NBA (other sports may have different availability)
- Alternate lines and quarter-specific props may have limited availability
- API returns all players for a game - no individual player filtering

## Best Practices

1. **Start with sports endpoint** to verify NBA is active
2. **Check available markets** before making requests
3. **Use specific game IDs** to reduce data transfer and costs
4. **Implement error handling** for missing markets or games
5. **Cache data appropriately** to minimize API calls
6. **Monitor quota usage** to avoid hitting limits

## Error Handling

### Common Error Codes
- `INVALID_KEY` - API key is invalid
- `MISSING_REGION` - Regions parameter required
- `MISSING_BOOKMAKER` - Bookmakers parameter required for some endpoints

### Response Headers for Monitoring
Always check these headers to track usage:
```
x-requests-remaining: 497
x-requests-used: 3
x-requests-last: 1
```

## Complete Example Workflow

```bash
# 1. Check available sports (free)
curl "https://api.the-odds-api.com/v4/sports/?apiKey=YOUR_API_KEY"

# 2. Get NBA games with player points props
curl "https://api.the-odds-api.com/v4/sports/basketball_nba/odds?regions=us&bookmakers=betmgm&markets=player_points&apiKey=YOUR_API_KEY"

# 3. Get all player prop markets for specific game
curl "https://api.the-odds-api.com/v4/sports/basketball_nba/events/GAME_ID/markets?regions=us&bookmakers=betmgm&apiKey=YOUR_API_KEY"

# 4. Get multiple player prop types
curl "https://api.the-odds-api.com/v4/sports/basketball_nba/events/GAME_ID/odds?regions=us&bookmakers=betmgm&markets=player_points,player_assists,player_rebounds&apiKey=YOUR_API_KEY"

# 5. Get American odds format
curl "https://api.the-odds-api.com/v4/sports/basketball_nba/events/GAME_ID/odds?regions=us&bookmakers=betmgm&markets=player_points&oddsFormat=american&apiKey=YOUR_API_KEY"

# 6. Get alternate lines (5+, 10+, etc.)
curl "https://api.the-odds-api.com/v4/sports/basketball_nba/events/GAME_ID/odds?regions=us&bookmakers=betmgm&markets=player_points_alternate&oddsFormat=american&apiKey=YOUR_API_KEY"
```

## Conclusion

The Odds API v4 provides comprehensive NBA player props data exclusively through BetMGM. This guide covers all necessary information for developers to integrate player props data into their applications while optimizing for cost and performance.
