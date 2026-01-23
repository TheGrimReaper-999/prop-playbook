-- Fix: Restrict player_error_trackers INSERT and UPDATE policies to service_role only
-- These operations should only be performed by the backend service, not authenticated users

DROP POLICY IF EXISTS "Service can insert error trackers" ON public.player_error_trackers;
DROP POLICY IF EXISTS "Service can update error trackers" ON public.player_error_trackers;

CREATE POLICY "Service role can insert error trackers"
ON public.player_error_trackers
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can update error trackers"
ON public.player_error_trackers
FOR UPDATE
TO service_role
USING (true);