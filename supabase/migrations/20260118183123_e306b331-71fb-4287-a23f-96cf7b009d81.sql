-- Create updated_at function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create NBA fixtures table for game schedule/results
CREATE TABLE public.nba_fixtures (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id text NOT NULL UNIQUE,
  game_date timestamp with time zone NOT NULL,
  home_team_id text NOT NULL,
  home_team_name text NOT NULL,
  home_team_abbrev text NOT NULL,
  home_team_logo text,
  home_team_score integer,
  away_team_id text NOT NULL,
  away_team_name text NOT NULL,
  away_team_abbrev text NOT NULL,
  away_team_logo text,
  away_team_score integer,
  status text NOT NULL DEFAULT 'scheduled',
  status_detail text,
  venue_name text,
  venue_city text,
  venue_state text,
  season text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create NBA player stats table for individual game performance
CREATE TABLE public.nba_player_stats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id uuid REFERENCES public.nba_players(id) ON DELETE CASCADE,
  player_name text NOT NULL,
  event_id text NOT NULL REFERENCES public.nba_fixtures(event_id) ON DELETE CASCADE,
  game_date timestamp with time zone NOT NULL,
  minutes integer,
  field_goals_made integer,
  field_goals_attempted integer,
  field_goal_pct numeric(5,1),
  three_pt_made integer,
  three_pt_attempted integer,
  three_pt_pct numeric(5,1),
  free_throws_made integer,
  free_throws_attempted integer,
  free_throw_pct numeric(5,1),
  rebounds integer,
  assists integer,
  blocks integer,
  steals integer,
  fouls integer,
  turnovers integer,
  points integer,
  plus_minus integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(player_id, event_id)
);

-- Enable RLS on fixtures
ALTER TABLE public.nba_fixtures ENABLE ROW LEVEL SECURITY;

-- Allow public read access to fixtures
CREATE POLICY "Anyone can read fixtures"
ON public.nba_fixtures
FOR SELECT
USING (true);

-- Enable RLS on player stats
ALTER TABLE public.nba_player_stats ENABLE ROW LEVEL SECURITY;

-- Allow public read access to player stats
CREATE POLICY "Anyone can read player stats"
ON public.nba_player_stats
FOR SELECT
USING (true);

-- Create indexes for performance
CREATE INDEX idx_fixtures_event_id ON public.nba_fixtures(event_id);
CREATE INDEX idx_fixtures_game_date ON public.nba_fixtures(game_date);
CREATE INDEX idx_fixtures_home_team ON public.nba_fixtures(home_team_abbrev);
CREATE INDEX idx_fixtures_away_team ON public.nba_fixtures(away_team_abbrev);

CREATE INDEX idx_player_stats_player_id ON public.nba_player_stats(player_id);
CREATE INDEX idx_player_stats_event_id ON public.nba_player_stats(event_id);
CREATE INDEX idx_player_stats_game_date ON public.nba_player_stats(game_date);
CREATE INDEX idx_player_stats_player_name ON public.nba_player_stats(player_name);

-- Create updated_at trigger for fixtures
CREATE TRIGGER update_nba_fixtures_updated_at
BEFORE UPDATE ON public.nba_fixtures
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();