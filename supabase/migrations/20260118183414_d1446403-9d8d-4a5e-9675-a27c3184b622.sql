-- Add API player ID column to nba_players for faster lookups
ALTER TABLE public.nba_players 
ADD COLUMN api_player_id text;

-- Create index for API player ID
CREATE INDEX idx_nba_players_api_id ON public.nba_players(api_player_id);