-- Remove the foreign key constraint to allow all player stats
ALTER TABLE public.nba_player_stats 
DROP CONSTRAINT nba_player_stats_event_id_fkey;