-- Add user_id column to parlays table
ALTER TABLE public.parlays ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for user_id queries
CREATE INDEX idx_parlays_user_id ON public.parlays(user_id);

-- Drop existing policy
DROP POLICY IF EXISTS "Service role can manage parlays" ON public.parlays;

-- Create new RLS policies for authenticated users
CREATE POLICY "Users can view their own parlays" 
ON public.parlays 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own parlays" 
ON public.parlays 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own parlays" 
ON public.parlays 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own parlays" 
ON public.parlays 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);