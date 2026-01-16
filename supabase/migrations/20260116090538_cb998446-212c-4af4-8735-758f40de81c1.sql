-- Create table for NBA players
CREATE TABLE public.nba_players (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    full_name TEXT NOT NULL,
    team_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for NBA teams
CREATE TABLE public.nba_teams (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    team_id INTEGER UNIQUE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security (public read access for autocomplete)
ALTER TABLE public.nba_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nba_teams ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (anyone can search)
CREATE POLICY "Anyone can read players" 
ON public.nba_players 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can read teams" 
ON public.nba_teams 
FOR SELECT 
USING (true);

-- Create indexes for faster search
CREATE INDEX idx_nba_players_full_name ON public.nba_players USING gin(to_tsvector('english', full_name));
CREATE INDEX idx_nba_players_team_name ON public.nba_players USING gin(to_tsvector('english', team_name));
CREATE INDEX idx_nba_teams_name ON public.nba_teams USING gin(to_tsvector('english', name));