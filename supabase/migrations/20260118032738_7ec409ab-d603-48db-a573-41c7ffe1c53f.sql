-- Add image_url column to nba_players
ALTER TABLE public.nba_players ADD COLUMN image_url text;

-- Add logo_url column to nba_teams
ALTER TABLE public.nba_teams ADD COLUMN logo_url text;