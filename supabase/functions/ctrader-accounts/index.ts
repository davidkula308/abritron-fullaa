import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as encodeBase64, decode as decodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Spotware Connect API base (used by ctrader-trade too)
const CTRADER_API_BASE = 'https://api.spotware.com';

type AnyRecord = Record<string, unknown>;

async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const response = await fetch(url, options);
    if (response.ok || (response.status < 500 && response.status !== 429)) {
      return response;
    }
    console.warn(`Attempt ${attempt + 1}/${retries} failed with ${response.status}, retrying...`);
    if (attempt < retries - 1) {
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
    } else {
      return response; // return last failed response
    }
  }
  throw new Error('Unreachable');
}

interface ConnectTradingAccount {
  // Commonly seen identifiers across APIs
  tradingAccountId?: number | string;
  ctidTraderAccountId?: number | string;
  accountId?: number | string;
  id?: number | string;
  traderLogin?: number;

  brokerName?: string;
  brokerTitle?: string;
  accountType?: string;
  isLive?: boolean;

  // Balance fields
  balance?: number;
  equity?: number;
  moneyDigits?: number;
  leverage?: number | string;
  currency?: string;
}

function extractAccountsArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];

  const p = payload as AnyRecord;
  const candidates = [
    p.data,
    p.accounts,
    p.tradingAccounts,
    p.traderAccounts,
    p.items,
    p.records,
  ];

  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }

  return [];
}

function resolveAccountId(a: ConnectTradingAccount): string | null {
  const id =
    a.tradingAccountId ??
    a.ctidTraderAccountId ??
    a.accountId ??
    a.id;

  if (id === undefined || id === null) return null;
  return String(id);
}

function toRealMoney(value: unknown, moneyDigits?: number): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  if (typeof moneyDigits === 'number' && Number.isFinite(moneyDigits)) {
    return value / Math.pow(10, moneyDigits);
  }
  return value;
}

// Encryption utilities using Web Crypto API
async function getEncryptionKey(): Promise<CryptoKey> {
  const keyString = Deno.env.get('TOKEN_ENCRYPTION_KEY');
  if (!keyString) {
    throw new Error('TOKEN_ENCRYPTION_KEY not configured');
  }
  
  // Create a consistent 256-bit key from the secret
  const encoder = new TextEncoder();
  const keyData = encoder.encode(keyString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyData);
  
  return crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptToken(plaintext: string): Promise<string> {
  const key = await getEncryptionKey();
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  // Generate a random IV (12 bytes for AES-GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  
  // Combine IV + encrypted data and encode as base64
  const combined = new Uint8Array(iv.length + encryptedData.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encryptedData), iv.length);
  
  return encodeBase64(combined.buffer);
}

async function decryptToken(encryptedBase64: string): Promise<string> {
  const key = await getEncryptionKey();
  const combined = decodeBase64(encryptedBase64);
  
  // Extract IV (first 12 bytes) and encrypted data
  const iv = combined.slice(0, 12);
  const encryptedData = combined.slice(12);
  
  const decryptedData = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encryptedData
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(decryptedData);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace('Bearer ', '');
    
    // Create user client to verify token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      throw new Error('Invalid user token');
    }

    const { action, access_token, account_id, refresh_token } = await req.json();

    if (action === 'get_accounts') {
      // Fetch accounts via Spotware Connect API
      const accountsResponse = await fetchWithRetry(
        `${CTRADER_API_BASE}/connect/tradingaccounts?oauth_token=${encodeURIComponent(access_token)}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!accountsResponse.ok) {
        const errorText = await accountsResponse.text();
        console.error('cTrader Connect API response:', accountsResponse.status, errorText);
        throw new Error(`Failed to fetch accounts (${accountsResponse.status}): ${errorText}`);
      }

      const accountsPayload = await accountsResponse.json();
      return new Response(JSON.stringify(accountsPayload), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_account_details') {
      // Get detailed account info
      const detailsResponse = await fetchWithRetry(
        `${CTRADER_API_BASE}/connect/tradingaccounts/${encodeURIComponent(account_id)}?oauth_token=${encodeURIComponent(access_token)}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!detailsResponse.ok) {
        const errorText = await detailsResponse.text();
        console.error('cTrader Connect API response:', detailsResponse.status, errorText);
        throw new Error(`Failed to fetch account details (${detailsResponse.status}): ${errorText}`);
      }

      const detailsData = await detailsResponse.json();
      return new Response(JSON.stringify(detailsData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'sync_accounts') {
      // Fetch all accounts and sync to database via Spotware Connect API
      const accountsResponse = await fetchWithRetry(
        `${CTRADER_API_BASE}/connect/tradingaccounts?oauth_token=${encodeURIComponent(access_token)}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      // If API is down, still store the token so it works when API recovers
      if (!accountsResponse.ok) {
        const errorText = await accountsResponse.text();
        console.error('cTrader sync_accounts Connect API response:', accountsResponse.status, errorText);
        
        // Store the encrypted token even if we can't fetch accounts yet
        const encryptedAccessToken = await encryptToken(access_token);
        const encryptedRefreshToken = refresh_token ? await encryptToken(refresh_token) : null;
        
        // Check if user already has accounts in DB - update their tokens
        const { data: existingAccounts } = await supabase
          .from('trading_accounts')
          .select('id')
          .eq('user_id', user.id);
        
        if (existingAccounts && existingAccounts.length > 0) {
          for (const acct of existingAccounts) {
            const updateData: Record<string, unknown> = { access_token: encryptedAccessToken, last_synced_at: new Date().toISOString() };
            if (encryptedRefreshToken) updateData.refresh_token = encryptedRefreshToken;
            await supabase.from('trading_accounts').update(updateData).eq('id', acct.id);
          }
          return new Response(JSON.stringify({ success: true, count: existingAccounts.length, note: 'Tokens updated but API was unavailable for account sync. Balances will refresh when API recovers.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        throw new Error(`Spotware API is temporarily unavailable (${accountsResponse.status}). Please try again in a few minutes.`);
      }

      const responseData = await accountsResponse.json();
      console.log("Spotware API response sample:", JSON.stringify(responseData).slice(0, 1000));
      const accountsRaw = extractAccountsArray(responseData);
      const accounts: ConnectTradingAccount[] = accountsRaw as ConnectTradingAccount[];

      // Encrypt the access token and refresh token before storing
      const encryptedAccessToken = await encryptToken(access_token);
      const encryptedRefreshToken = refresh_token ? await encryptToken(refresh_token) : null;

      // Upsert accounts to database with encrypted token
      for (const account of accounts) {
        const resolvedAccountId = resolveAccountId(account);
        if (!resolvedAccountId) {
          console.error('Skipping account with missing identifier:', account);
          continue;
        }

        console.log('Account raw data:', JSON.stringify(account).slice(0, 500));

        const brokerName = account.brokerName || account.brokerTitle || 'Unknown Broker';
        const accountType = account.accountType || 'Unknown';
        const moneyDigits = typeof account.moneyDigits === 'number' ? account.moneyDigits : undefined;
        const balance = toRealMoney(account.balance, moneyDigits);
        const equity = toRealMoney(account.equity ?? account.balance, moneyDigits);
        const leverage =
          typeof account.leverage === 'number'
            ? `1:${account.leverage}`
            : typeof account.leverage === 'string'
              ? account.leverage
              : null;

        // Detect isLive: check multiple field names and fallbacks
        const rawIsLive = (account as any).isLive ?? (account as any).is_live ?? (account as any).live;
        const isLive = typeof rawIsLive === 'boolean' ? rawIsLive : null;
        console.log(`Account ${resolvedAccountId}: isLive raw=${rawIsLive}, resolved=${isLive}`);

        const upsertData: Record<string, unknown> = {
            user_id: user.id,
            platform: 'ctrader',
            account_id: resolvedAccountId,
            broker_name: brokerName,
            account_name: `${accountType}${account.traderLogin ? ` - ${account.traderLogin}` : ''}`,
            balance,
            equity,
            leverage,
            is_live: isLive,
            currency: account.currency ?? null,
            access_token: encryptedAccessToken,
            last_synced_at: new Date().toISOString(),
          };
        if (encryptedRefreshToken) {
          upsertData.refresh_token = encryptedRefreshToken;
        }

        const { error: upsertError } = await supabase
          .from('trading_accounts')
          .upsert(upsertData, {
            onConflict: 'user_id,platform,account_id',
          });

        if (upsertError) {
          console.error('Failed to upsert account:', upsertError);
        }
      }

      return new Response(JSON.stringify({ success: true, count: accounts.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'refresh_balances') {
      // Re-fetch all user accounts from Spotware API using stored tokens and update DB
      const { data: dbAccounts, error: fetchErr } = await supabase
        .from('trading_accounts')
        .select('id, account_id, access_token')
        .eq('user_id', user.id);

      if (fetchErr || !dbAccounts?.length) {
        throw new Error('No accounts found to refresh');
      }

      // Decrypt first token (all accounts share same OAuth token)
      const decryptedToken = await decryptToken(dbAccounts[0].access_token!);

      // Fetch fresh data from Spotware
      const accountsResponse = await fetchWithRetry(
        `${CTRADER_API_BASE}/connect/tradingaccounts?oauth_token=${encodeURIComponent(decryptedToken)}`,
        { method: 'GET', headers: { 'Accept': 'application/json' } }
      );

      if (!accountsResponse.ok) {
        const errorText = await accountsResponse.text();
        console.error('refresh_balances API error:', accountsResponse.status, errorText);
        throw new Error(`Failed to refresh balances (${accountsResponse.status})`);
      }

      const responseData = await accountsResponse.json();
      const accountsRaw = extractAccountsArray(responseData) as ConnectTradingAccount[];

      let updated = 0;
      for (const account of accountsRaw) {
        const resolvedId = resolveAccountId(account);
        if (!resolvedId) continue;

        const moneyDigits = typeof account.moneyDigits === 'number' ? account.moneyDigits : undefined;
        const balance = toRealMoney(account.balance, moneyDigits);
        const equity = toRealMoney(account.equity ?? account.balance, moneyDigits);

        const { error: updateErr } = await supabase
          .from('trading_accounts')
          .update({
            balance,
            equity,
            last_synced_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
          .eq('account_id', resolvedId);

        if (!updateErr) updated++;
      }

      return new Response(JSON.stringify({ success: true, updated }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_decrypted_token') {
      // Get the encrypted token from database and decrypt it
      const { data: accountData, error: fetchError } = await supabase
        .from('trading_accounts')
        .select('access_token')
        .eq('id', account_id)
        .eq('user_id', user.id)
        .single();

      if (fetchError || !accountData?.access_token) {
        throw new Error('Account not found or no token stored');
      }

      const decryptedToken = await decryptToken(accountData.access_token);
      
      return new Response(JSON.stringify({ access_token: decryptedToken }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid action');
  } catch (error: unknown) {
    console.error('cTrader accounts error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        error: errorMessage,
        hint: 'If you generated the token in a different portal than the OAuth flow, the token may not work with the Connect API endpoints used for trading.',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
