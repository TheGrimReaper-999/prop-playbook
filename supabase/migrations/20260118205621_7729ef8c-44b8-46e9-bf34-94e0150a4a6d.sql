-- Create table for storing parlays
CREATE TABLE public.parlays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_ip TEXT NOT NULL,
  name TEXT NOT NULL,
  legs JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.parlays ENABLE ROW LEVEL SECURITY;

-- Create index on user_ip for faster lookups
CREATE INDEX idx_parlays_user_ip ON public.parlays(user_ip);

-- RLS policies - edge function will use service role, so we need permissive policies
CREATE POLICY "Service role can manage parlays"
ON public.parlays
FOR ALL
USING (true)
WITH CHECK (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_parlays_updated_at
BEFORE UPDATE ON public.parlays
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();