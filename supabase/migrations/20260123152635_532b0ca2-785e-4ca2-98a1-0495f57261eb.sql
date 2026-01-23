-- Fix: Restrict predictions UPDATE policy to service role only
-- This prevents authenticated users from modifying any prediction record

DROP POLICY IF EXISTS "Service can update predictions" ON public.predictions;

CREATE POLICY "Service role can update predictions"
ON public.predictions
FOR UPDATE
TO service_role
USING (true);