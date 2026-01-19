-- Add pnl column to parlays table for profit/loss tracking
ALTER TABLE public.parlays ADD COLUMN pnl numeric DEFAULT NULL;