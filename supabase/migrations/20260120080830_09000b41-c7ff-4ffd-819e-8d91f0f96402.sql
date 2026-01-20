-- Fix "Unknown Player" entries where we have a linked player_id
UPDATE nba_player_stats s
SET player_name = p.full_name
FROM nba_players p
WHERE s.player_id = p.id
AND s.player_name = 'Unknown Player'
AND p.full_name IS NOT NULL;