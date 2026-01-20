-- Table to store prediction records for error tracking
CREATE TABLE public.predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  parlay_id UUID REFERENCES public.parlays(id) ON DELETE CASCADE,
  player_id UUID REFERENCES public.nba_players(id) ON DELETE SET NULL,
  player_name TEXT NOT NULL,
  stat_type TEXT NOT NULL,
  prop_line NUMERIC NOT NULL,
  predicted_mean NUMERIC NOT NULL,
  predicted_sigma NUMERIC,
  p_over_model NUMERIC,
  p_under_model NUMERIC,
  decision TEXT NOT NULL,
  event_id TEXT,
  actual_value NUMERIC,
  outcome TEXT,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table to store per-player error tracking data
CREATE TABLE public.player_error_trackers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES public.nba_players(id) ON DELETE CASCADE,
  stat_type TEXT NOT NULL,
  error_ema NUMERIC DEFAULT 0,
  recent_errors NUMERIC[] DEFAULT '{}',
  beta NUMERIC DEFAULT 0.3,
  total_predictions INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, stat_type)
);

-- Enable RLS
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_error_trackers ENABLE ROW LEVEL SECURITY;

-- Predictions: Users can view their own predictions
CREATE POLICY "Users can view their own predictions"
ON public.predictions
FOR SELECT
USING (auth.uid() = user_id);

-- Predictions: Users can insert their own predictions
CREATE POLICY "Users can insert their own predictions"
ON public.predictions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Predictions: Service role can update predictions (for feedback processing)
CREATE POLICY "Service can update predictions"
ON public.predictions
FOR UPDATE
USING (true);

-- Error trackers: Anyone can read (model needs this for all players)
CREATE POLICY "Anyone can read error trackers"
ON public.player_error_trackers
FOR SELECT
USING (true);

-- Error trackers: Service role can insert/update
CREATE POLICY "Service can insert error trackers"
ON public.player_error_trackers
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service can update error trackers"
ON public.player_error_trackers
FOR UPDATE
USING (true);

-- Index for efficient lookups
CREATE INDEX idx_predictions_user_id ON public.predictions(user_id);
CREATE INDEX idx_predictions_player_id ON public.predictions(player_id);
CREATE INDEX idx_predictions_processed ON public.predictions(processed) WHERE processed = false;
CREATE INDEX idx_error_trackers_player_stat ON public.player_error_trackers(player_id, stat_type);