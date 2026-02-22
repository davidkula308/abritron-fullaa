-- Add VPS configurations table for persistent VPS connections per user
CREATE TABLE IF NOT EXISTS public.vps_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'custom',
  host text,
  port integer DEFAULT 22,
  username text,
  password text,
  region text,
  status text DEFAULT 'disconnected',
  last_connected text,
  is_free_vps boolean DEFAULT false,
  specs jsonb DEFAULT '{}'::jsonb,
  expires_at text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vps_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own vps_configs" ON public.vps_configs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own vps_configs" ON public.vps_configs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own vps_configs" ON public.vps_configs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own vps_configs" ON public.vps_configs FOR DELETE USING (auth.uid() = user_id);

-- Change strategies action constraint to allow BOTH as a valid value
ALTER TABLE public.strategies DROP CONSTRAINT IF EXISTS strategies_action_check;
ALTER TABLE public.strategies ADD CONSTRAINT strategies_action_check CHECK (action = ANY (ARRAY['BUY'::text, 'SELL'::text, 'ALERT'::text, 'BOTH'::text]));
