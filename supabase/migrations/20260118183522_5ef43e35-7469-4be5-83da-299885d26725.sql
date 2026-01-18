-- Allow updating api_player_id from client
CREATE POLICY "Allow updating api_player_id"
ON public.nba_players
FOR UPDATE
USING (true)
WITH CHECK (true);