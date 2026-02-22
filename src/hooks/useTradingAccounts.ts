import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Tables } from '@/integrations/supabase/types';

type TradingAccount = Tables<'trading_accounts'>;

export const useTradingAccounts = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = async () => {
    if (!user) {
      setAccounts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('trading_accounts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch accounts');
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh accounts every 10 seconds for live balance updates
  useEffect(() => {
    fetchAccounts();
    if (!user) return;
    const interval = setInterval(fetchAccounts, 10000);
    return () => clearInterval(interval);
  }, [user]);

  const deleteAccount = async (accountId: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('trading_accounts')
      .delete()
      .eq('id', accountId)
      .eq('user_id', user.id);

    if (error) {
      throw error;
    }

    await fetchAccounts();
  };

  const refreshBalances = async () => {
    if (!user) return;
    try {
      // Refresh cTrader accounts
      const { error } = await supabase.functions.invoke('ctrader-accounts', {
        body: { action: 'refresh_balances' },
      });
      if (error) {
        console.error('Failed to refresh cTrader balances:', error);
      }
      // Refresh MT5 accounts
      const { error: mt5Error } = await supabase.functions.invoke('mt5-accounts', {
        body: { action: 'refresh_balances' },
      });
      if (mt5Error) {
        console.error('Failed to refresh MT5 balances:', mt5Error);
      }
      await fetchAccounts();
    } catch (err) {
      console.error('refreshBalances error:', err);
      await fetchAccounts();
    }
  };

  return { accounts, loading, error, refetch: fetchAccounts, refreshBalances, deleteAccount };
};

export const useCTraderAuth = () => {
  const extractEdgeFunctionError = async (err: unknown) => {
    const fallback = err instanceof Error ? err.message : 'Request failed';
    if (!err || typeof err !== 'object') return fallback;

    // supabase-js FunctionsHttpError includes `context` (a Response)
    const ctx = (err as { context?: unknown }).context;
    const maybeResponse = ctx as { clone?: () => unknown; json?: () => Promise<unknown> } | undefined;
    if (maybeResponse?.clone && typeof maybeResponse.clone === 'function') {
      try {
        const cloned = maybeResponse.clone() as { json?: () => Promise<unknown> };
        const payload = cloned?.json ? await cloned.json().catch(() => null) : null;
        if (payload && typeof payload === 'object') {
          const msg = (payload as { error?: unknown }).error;
          if (typeof msg === 'string' && msg.trim()) return msg;
        }
      } catch {
        // ignore
      }
    }

    return fallback;
  };

  const startOAuth = async () => {
    const redirectUri = `${window.location.origin}/accounts/callback`;
    
    const { data, error } = await supabase.functions.invoke('ctrader-auth', {
      body: {
        action: 'get_auth_url',
        redirect_uri: redirectUri,
      },
    });

    if (error) throw error;
    
    if (!data?.auth_url) {
      throw new Error('Failed to get authentication URL');
    }
    
    // Open OAuth in a new window/tab since iframe redirects may be blocked
    window.open(data.auth_url, '_blank');
  };

  const exchangeCode = async (code: string) => {
    const redirectUri = `${window.location.origin}/accounts/callback`;
    
    const { data, error } = await supabase.functions.invoke('ctrader-auth', {
      body: {
        action: 'exchange_code',
        code,
        redirect_uri: redirectUri,
      },
    });

    if (error) throw error;
    return data;
  };

  const syncAccounts = async (accessToken: string, refreshToken?: string) => {
    const { data, error } = await supabase.functions.invoke('ctrader-accounts', {
      body: {
        action: 'sync_accounts',
        access_token: accessToken,
        refresh_token: refreshToken,
      },
    });

    if (error) {
      const message = await extractEdgeFunctionError(error);
      throw new Error(message);
    }
    return data;
  };

  return { startOAuth, exchangeCode, syncAccounts };
};
