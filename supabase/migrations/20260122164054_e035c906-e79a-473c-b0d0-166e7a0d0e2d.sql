-- Create API-Sports fixtures table (separate from RapidAPI nba_fixtures)
CREATE TABLE api_sports_fixtures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Core game identifiers
  game_id INTEGER NOT NULL UNIQUE,
  
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
CREATE INDEX idx_api_sports_fixtures_status ON api_sports_fixtures(status_short);

-- RLS policy for read access
ALTER TABLE api_sports_fixtures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read api sports fixtures" ON api_sports_fixtures
  FOR SELECT USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_api_sports_fixtures_updated_at
  BEFORE UPDATE ON api_sports_fixtures
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();