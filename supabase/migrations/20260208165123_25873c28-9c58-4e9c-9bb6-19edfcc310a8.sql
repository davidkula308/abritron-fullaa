
-- Drop all RESTRICTIVE policies on strategies and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Users can create their own strategies" ON public.strategies;
DROP POLICY IF EXISTS "Users can delete their own strategies" ON public.strategies;
DROP POLICY IF EXISTS "Users can update their own strategies" ON public.strategies;
DROP POLICY IF EXISTS "Users can view their own strategies" ON public.strategies;

CREATE POLICY "Users can view their own strategies"
ON public.strategies FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own strategies"
ON public.strategies FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own strategies"
ON public.strategies FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own strategies"
ON public.strategies FOR DELETE
USING (auth.uid() = user_id);
