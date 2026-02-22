-- Create strategies table
CREATE TABLE public.strategies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('indicator', 'advanced')),
  indicator_type TEXT,
  advanced_type TEXT,
  conditions JSONB DEFAULT '[]'::jsonb,
  parameters JSONB DEFAULT '{}'::jsonb,
  selected_pair TEXT,
  selected_timeframe TEXT,
  selected_account_id UUID REFERENCES public.trading_accounts(id) ON DELETE SET NULL,
  action TEXT CHECK (action IN ('BUY', 'SELL', 'ALERT')),
  notification_email TEXT,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own strategies" ON public.strategies FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own strategies" ON public.strategies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own strategies" ON public.strategies FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own strategies" ON public.strategies FOR DELETE USING (auth.uid() = user_id);

-- Create bots table
CREATE TABLE public.bots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT CHECK (file_type IN ('mq4', 'mq5', 'ex4', 'ex5')),
  description TEXT,
  parameters JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'stopped' CHECK (status IN ('running', 'stopped')),
  selected_pair TEXT,
  selected_timeframe TEXT,
  account_id UUID REFERENCES public.trading_accounts(id) ON DELETE SET NULL,
  open_positions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bots ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own bots" ON public.bots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own bots" ON public.bots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own bots" ON public.bots FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own bots" ON public.bots FOR DELETE USING (auth.uid() = user_id);

-- Create scheduled_trades table for the trade panel
CREATE TABLE public.scheduled_trades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  account_id UUID REFERENCES public.trading_accounts(id) ON DELETE CASCADE,
  pair TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  num_trades INTEGER NOT NULL DEFAULT 1,
  lot_size NUMERIC NOT NULL DEFAULT 0.01,
  take_profit NUMERIC,
  stop_loss NUMERIC,
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'cancelled', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_trades ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own scheduled_trades" ON public.scheduled_trades FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own scheduled_trades" ON public.scheduled_trades FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own scheduled_trades" ON public.scheduled_trades FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own scheduled_trades" ON public.scheduled_trades FOR DELETE USING (auth.uid() = user_id);

-- Add triggers for updated_at
CREATE TRIGGER update_strategies_updated_at BEFORE UPDATE ON public.strategies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bots_updated_at BEFORE UPDATE ON public.bots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_scheduled_trades_updated_at BEFORE UPDATE ON public.scheduled_trades FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();