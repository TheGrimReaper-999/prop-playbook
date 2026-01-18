-- Make team columns nullable for international/special games
ALTER TABLE public.nba_fixtures 
ALTER COLUMN home_team_id DROP NOT NULL,
ALTER COLUMN home_team_name DROP NOT NULL,
ALTER COLUMN home_team_abbrev DROP NOT NULL,
ALTER COLUMN away_team_id DROP NOT NULL,
ALTER COLUMN away_team_name DROP NOT NULL,
ALTER COLUMN away_team_abbrev DROP NOT NULL;