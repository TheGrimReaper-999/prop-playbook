

## Plan: Create API-Sports Fixtures Table and Populate Function

### Goal
Create a new separate table for API-Sports fixtures data (distinct from the existing `nba_fixtures` which uses RapidAPI data), and build an edge function to populate it for the 2025-2026 NBA season (October 2025 - June 2026).

### Step 1: Create New Database Table

Create a new table `api_sports_fixtures` that captures all fields from the API-Sports response:

```sql
CREATE TABLE api_sports_fixtures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Core game identifiers
  game_id INTEGER NOT NULL UNIQUE,  -- API-Sports game ID
  
  -- Date/Time fields (stored in UTC)
  game_date TIMESTAMPTZ NOT NULL,
  game_time TEXT,
  game_timestamp BIGINT,
  timezone TEXT DEFAULT 'UTC',
  
  -- Game metadata
  stage TEXT,
  week TEXT,
  venue TEXT,
  
  -- Status
  status_long TEXT,
  status_short TEXT,
  status_timer TEXT,
  
  -- League info
  league_id INTEGER,
  league_name TEXT,
  league_type TEXT,
  league_season TEXT,
  league_logo TEXT,
  
  -- Country info
  country_id INTEGER,
  country_name TEXT,
  country_code TEXT,
  country_flag TEXT,
  
  -- Home team
  home_team_id INTEGER,
  home_team_name TEXT,
  home_team_logo TEXT,
  
  -- Away team
  away_team_id INTEGER,
  away_team_name TEXT,
  away_team_logo TEXT,
  
  -- Home scores
  home_score_q1 INTEGER,
  home_score_q2 INTEGER,
  home_score_q3 INTEGER,
  home_score_q4 INTEGER,
  home_score_ot INTEGER,
  home_score_total INTEGER,
  
  -- Away scores
  away_score_q1 INTEGER,
  away_score_q2 INTEGER,
  away_score_q3 INTEGER,
  away_score_q4 INTEGER,
  away_score_ot INTEGER,
  away_score_total INTEGER,
  
  -- Raw JSON backup
  raw_data JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for common queries
CREATE INDEX idx_api_sports_fixtures_game_date ON api_sports_fixtures(game_date);
CREATE INDEX idx_api_sports_fixtures_home_team ON api_sports_fixtures(home_team_id);
CREATE INDEX idx_api_sports_fixtures_away_team ON api_sports_fixtures(away_team_id);
CREATE INDEX idx_api_sports_fixtures_season ON api_sports_fixtures(league_season);

-- RLS policy for read access
ALTER TABLE api_sports_fixtures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read api sports fixtures" ON api_sports_fixtures
  FOR SELECT USING (true);
```

### Step 2: Create Edge Function `populate-api-sports-fixtures`

Create a new edge function that:

1. **Iterates through dates** from October 1, 2025 to June 30, 2026
2. **Fetches games for each date** using API-Sports endpoint:
   - `https://v1.basketball.api-sports.io/games?league=12&season=2025-2026&date=YYYY-MM-DD`
3. **Maps all response fields** to the database columns
4. **Upserts in batches** with `onConflict: 'game_id'` to handle duplicates
5. **Rate limits requests** (100ms delay between calls to respect API limits)
6. **Logs progress** every 10 days processed

```text
Function location: supabase/functions/populate-api-sports-fixtures/index.ts
```

**Key implementation details:**
- Uses `API_SPORTS_KEY` secret (already configured)
- Uses service role key for database writes
- Runs in background using `EdgeRuntime.waitUntil`
- Returns immediately with progress info
- Handles errors gracefully, continuing on failures

### Step 3: Date Range Handling

The function will process approximately 274 days:
- **Start**: October 1, 2025
- **End**: June 30, 2026

With rate limiting (100ms delay), this will take roughly 30 seconds to complete.

### File Changes Summary

| File | Action |
|------|--------|
| Database migration | Create `api_sports_fixtures` table with all fields |
| `supabase/functions/populate-api-sports-fixtures/index.ts` | Create new edge function |

### Why Keep Tables Separate?

1. **Different data sources** - RapidAPI vs API-Sports have different field names and IDs
2. **Different update frequencies** - can update them independently
3. **No risk of breaking existing functionality** - parlay status, player stats, etc. continue using `nba_fixtures`
4. **Flexibility for comparison** - can compare data quality between sources
5. **Clear naming** - `api_sports_` prefix makes the source obvious

### Testing

After implementation:
1. Deploy the edge function
2. Call it to trigger population:
   ```bash
   POST /populate-api-sports-fixtures
   ```
3. Verify data in database:
   ```sql
   SELECT COUNT(*), league_season FROM api_sports_fixtures GROUP BY league_season;
   ```

