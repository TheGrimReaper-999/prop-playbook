
# Plan: Integrate API-Sports Game IDs for Odds Population in BetSlip

## Overview

This plan implements a robust odds fetching system that:
1. Uses `api_sports_fixtures` game IDs to fetch odds efficiently
2. Links today's homepage fixtures to BetSlip odds lookups
3. Supports all available stat types with appropriate error handling
4. Adds player point milestone support for advanced mode

---

## Current Architecture

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         CURRENT FLOW                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  BetSlip Page                                                       │
│       │                                                             │
│       ▼                                                             │
│  useOdds.fetchOddsForPlayer()                                       │
│       │                                                             │
│       ▼                                                             │
│  findPlayerGame() ─── API Call ──→ API-Sports /games (by date)      │
│       │                                                             │
│       ▼                                                             │
│  apiSports.getOdds() ─── API Call ──→ API-Sports /odds              │
│       │                                                             │
│       ▼                                                             │
│  Parse odds & match player name                                     │
│                                                                     │
│  PROBLEM: Extra API call for games when we already have game IDs    │
│  in api_sports_fixtures table                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Proposed Architecture

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         NEW FLOW                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Homepage (TodayFixtures)                                           │
│       │                                                             │
│       ▼                                                             │
│  useSchedule() ──→ nba_fixtures (RapidAPI source)                   │
│       │                                                             │
│       ▼                                                             │
│  Display games with game IDs from api_sports_fixtures               │
│                                                                     │
│  ═══════════════════════════════════════════════════════════════    │
│                                                                     │
│  BetSlip Page                                                       │
│       │                                                             │
│       ▼                                                             │
│  useGameId() ──→ Query api_sports_fixtures by team name & date      │
│       │                                                             │
│       ▼                                                             │
│  apiSports.getOdds(gameId) ──→ API-Sports /odds (single API call)   │
│       │                                                             │
│       ▼                                                             │
│  Parse odds & populate BetSlip leg                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create useGameId Hook

Create a new hook to look up API-Sports game ID from the database.

**File:** `src/hooks/useGameId.ts`

```typescript
// Hook to find API-Sports game_id for a player's team on a given date
// Queries api_sports_fixtures table by team name matching
// Returns game_id if found, null otherwise
```

**Features:**
- Query `api_sports_fixtures` where home_team_name OR away_team_name matches
- Match by today's date (UTC)
- Use fuzzy team name matching (Lakers → Los Angeles Lakers)
- Cache results to avoid repeated queries

---

### Step 2: Update useOdds Hook

Modify the odds fetching logic to use database game IDs first.

**File:** `src/hooks/useOdds.ts`

**Changes:**
- Add optional `apiSportsGameId` parameter to `fetchOddsForPlayer`
- If no gameId provided, query `api_sports_fixtures` for the team
- Remove the API call to `/games` endpoint (use DB instead)
- Fall back to API call only if DB lookup fails

---

### Step 3: Update BetSlip Odds Auto-Fetch

Enhance the auto-fetch logic to find game IDs efficiently.

**File:** `src/pages/BetSlip.tsx`

**Changes:**
- Before fetching odds, query for the API-Sports game ID
- Pass gameId directly to `fetchOddsForPlayer`
- Show more specific error if no game found today

---

### Step 4: Add Stat Type Coverage

Ensure all stat types have proper bet ID mappings and parsers.

**File:** `src/lib/api-sports.ts`

**Current Mapping (Already Implemented):**
| Stat Type | Bet ID | Description |
|-----------|--------|-------------|
| pts | 117 | Player Points |
| ast | 118 | Player Assists |
| reb | 119 | Player Rebounds |
| 3pm | 120 | Player Triples |
| pa | 238 | Points + Assists |
| ra | 240 | Rebounds + Assists |
| pr | 241 | Points + Rebounds |
| pra | 242 | Points + Reb + Ast |

**Note:** These are already mapped. The system will show "Odds not found" for stat types not available from the API.

---

### Step 5: Add Player Point Milestone for Advanced Mode (Optional Enhancement)

Add support for milestone bets in advanced mode.

**Concept:**
Milestones are different bet types (e.g., "Will player score 25+ points?") vs. standard over/under props.

**Implementation:**
- Add new bet type constant for point milestones (if available in API)
- Create parser for milestone odds format
- Integrate into advanced mode alternate lines

**Note:** This requires API investigation to confirm available bet types. If not available from API-Sports, milestone lines would need manual entry.

---

## Detailed File Changes

### 1. New File: `src/hooks/useGameId.ts`

```typescript
import { supabase } from '@/integrations/supabase/client';

interface GameIdResult {
  gameId: number | null;
  homeTeam: string;
  awayTeam: string;
}

/**
 * Find API-Sports game_id for a team playing today
 */
export async function findApiSportsGameId(
  teamName: string
): Promise<GameIdResult | null> {
  // Get today's date range (UTC)
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  
  const todayEnd = new Date();
  todayEnd.setUTCHours(23, 59, 59, 999);
  
  // Query api_sports_fixtures
  const { data, error } = await supabase
    .from('api_sports_fixtures')
    .select('game_id, home_team_name, away_team_name')
    .gte('game_date', todayStart.toISOString())
    .lte('game_date', todayEnd.toISOString())
    .or(`home_team_name.ilike.%${teamName}%,away_team_name.ilike.%${teamName}%`)
    .limit(1)
    .single();
    
  if (error || !data) return null;
  
  return {
    gameId: data.game_id,
    homeTeam: data.home_team_name,
    awayTeam: data.away_team_name,
  };
}
```

### 2. Update: `src/hooks/useOdds.ts`

**Key Changes:**
- Import `findApiSportsGameId` from new hook
- Replace `findPlayerGame()` with database lookup
- Keep API fallback for robustness

```typescript
// In fetchOddsDirect, replace:
// let targetGameId = gameId;
// if (!targetGameId && teamName) {
//   targetGameId = await findPlayerGame(teamName) || undefined;
// }

// With:
let targetGameId = gameId;
if (!targetGameId && teamName) {
  const gameResult = await findApiSportsGameId(teamName);
  if (gameResult) {
    targetGameId = gameResult.gameId ?? undefined;
    console.log(`✅ Found game from DB: ${gameResult.homeTeam} vs ${gameResult.awayTeam}`);
  }
}
```

### 3. Update: `src/pages/BetSlip.tsx`

**Key Changes:**
- Add gameId lookup before odds fetch
- Store gameId with leg for later use
- Improve error messaging

---

## Error Handling Matrix

| Scenario | User Feedback |
|----------|---------------|
| No game today for team | "No game scheduled today for [Team]. Odds unavailable." |
| Game exists but no odds for stat type | "Odds not available for [Player] [Stat]. Enter manually." |
| API rate limit exceeded | "Rate limit reached. Please try again later." |
| API-Sports unavailable | "Odds service temporarily unavailable." |
| Player name not found in odds | "Could not match [Player] in available odds. Enter manually." |

---

## Testing Checklist

1. **Game ID Lookup**
   - [ ] Verify correct game_id returned for "Lakers" → Los Angeles Lakers
   - [ ] Verify null returned when no game today
   - [ ] Test partial team name matching ("Celtics" → "Boston Celtics")

2. **Odds Fetching**
   - [ ] Points (pts) odds populate correctly
   - [ ] Rebounds (reb) odds populate correctly
   - [ ] Assists (ast) odds populate correctly
   - [ ] 3-pointers (3pm) odds populate correctly
   - [ ] Combo stats (pra, pr, pa, ra) show appropriate over/under

3. **Error States**
   - [ ] Clear message when no game today
   - [ ] Clear message when odds unavailable for stat type
   - [ ] Manual entry still works after errors

4. **Performance**
   - [ ] Database query faster than API call
   - [ ] No duplicate API calls per leg

---

## Technical Notes

- The `api_sports_fixtures` and `nba_fixtures` tables share identical team names, enabling direct matching
- Game IDs from API-Sports (e.g., 470114) are integer values
- Bet365 (bookmaker ID 4) is prioritized for consistent odds formatting
- The system already handles American odds conversion from decimal
