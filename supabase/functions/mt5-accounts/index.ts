import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as encodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// mtapi.io REST API base URL — override with MT5_API_BASE_URL secret if self-hosted
const MT5_API_BASE = Deno.env.get('MT5_API_BASE_URL') || 'https://mt5.mtapi.io';

// Encryption utilities (same as ctrader-accounts)
async function getEncryptionKey(): Promise<CryptoKey> {
  const keyString = Deno.env.get('TOKEN_ENCRYPTION_KEY');
  if (!keyString) throw new Error('TOKEN_ENCRYPTION_KEY not configured');
  const encoder = new TextEncoder();
  const keyData = encoder.encode(keyString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyData);
  return crypto.subtle.importKey('raw', hashBuffer, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptToken(plaintext: string): Promise<string> {
  const key = await getEncryptionKey();
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedData = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  const combined = new Uint8Array(iv.length + encryptedData.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encryptedData), iv.length);
  return encodeBase64(combined.buffer);
}

async function decryptToken(encryptedBase64: string): Promise<string> {
  const { decode: decodeBase64 } = await import("https://deno.land/std@0.168.0/encoding/base64.ts");
  const key = await getEncryptionKey();
  const combined = decodeBase64(encryptedBase64);
  const iv = combined.slice(0, 12);
  const encryptedData = combined.slice(12);
  const decryptedData = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encryptedData);
  return new TextDecoder().decode(decryptedData);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error('Invalid user token');

    const body = await req.json();
    const { action } = body;

    if (action === 'connect') {
      // Connect to MT5 account via mtapi.io
      const { mt5_login, mt5_password, broker_host, broker_port } = body;
      if (!mt5_login || !mt5_password || !broker_host) {
        throw new Error('MT5 login, password, and broker host are required');
      }

      const port = broker_port || 443;
      const connectUrl = `${MT5_API_BASE}/Connect?user=${encodeURIComponent(mt5_login)}&password=${encodeURIComponent(mt5_password)}&host=${encodeURIComponent(broker_host)}&port=${encodeURIComponent(port)}`;

      const connectRes = await fetch(connectUrl);
      if (!connectRes.ok) {
        const errText = await connectRes.text();
        throw new Error(`MT5 connection failed (${connectRes.status}): ${errText}`);
      }

      // mtapi.io returns the session token as a plain string (JSON string)
      const sessionToken = (await connectRes.text()).replace(/^"|"$/g, '');
      if (!sessionToken || sessionToken.includes('error')) {
        throw new Error(`MT5 connection failed: ${sessionToken}`);
      }

      // Get account summary
      const summaryRes = await fetch(`${MT5_API_BASE}/AccountSummary?id=${encodeURIComponent(sessionToken)}`);
      let balance = 0, equity = 0, currency = 'USD', leverage = '';
      let brokerName = broker_host;

      if (summaryRes.ok) {
        const summary = await summaryRes.json();
        balance = summary.balance ?? 0;
        equity = summary.equity ?? 0;
        currency = summary.currency ?? 'USD';
        leverage = summary.leverage ? `1:${summary.leverage}` : '';
        brokerName = summary.company || broker_host;
      }

      // Encrypt credentials for storage (store session token + connection params)
      const connectionData = JSON.stringify({ mt5_login, mt5_password, broker_host, broker_port: port });
      const encryptedCredentials = await encryptToken(connectionData);
      const encryptedSession = await encryptToken(sessionToken);

      // Upsert to trading_accounts
      const { error: upsertError } = await supabase
        .from('trading_accounts')
        .upsert({
          user_id: user.id,
          platform: 'mt5',
          account_id: String(mt5_login),
          broker_name: brokerName,
          account_name: `MT5 - ${mt5_login}`,
          balance,
          equity,
          currency,
          leverage,
          is_live: true,
          access_token: encryptedSession,
          refresh_token: encryptedCredentials, // Store encrypted credentials in refresh_token field for reconnection
          last_synced_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,platform,account_id',
        });

      if (upsertError) {
        console.error('Failed to upsert MT5 account:', upsertError);
        throw new Error('Failed to save MT5 account');
      }

      return new Response(JSON.stringify({ success: true, balance, equity, currency }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'refresh_balances') {
      // Refresh balances for all MT5 accounts
      const { data: dbAccounts, error: fetchErr } = await supabase
        .from('trading_accounts')
        .select('id, account_id, access_token, refresh_token')
        .eq('user_id', user.id)
        .eq('platform', 'mt5');

      if (fetchErr || !dbAccounts?.length) {
        return new Response(JSON.stringify({ success: true, updated: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let updated = 0;
      for (const account of dbAccounts) {
        try {
          let sessionToken: string;
          try {
            sessionToken = await decryptToken(account.access_token!);
          } catch {
            // Session expired, try reconnecting with stored credentials
            if (!account.refresh_token) continue;
            const creds = JSON.parse(await decryptToken(account.refresh_token));
            const connectUrl = `${MT5_API_BASE}/Connect?user=${encodeURIComponent(creds.mt5_login)}&password=${encodeURIComponent(creds.mt5_password)}&host=${encodeURIComponent(creds.broker_host)}&port=${encodeURIComponent(creds.broker_port)}`;
            const connectRes = await fetch(connectUrl);
            if (!connectRes.ok) continue;
            sessionToken = (await connectRes.text()).replace(/^"|"$/g, '');
            // Update session token
            const encryptedSession = await encryptToken(sessionToken);
            await supabase.from('trading_accounts').update({ access_token: encryptedSession }).eq('id', account.id);
          }

          // Try account summary with current session
          const summaryRes = await fetch(`${MT5_API_BASE}/AccountSummary?id=${encodeURIComponent(sessionToken)}`);
          
          if (!summaryRes.ok) {
            // Session might be expired, reconnect
            if (!account.refresh_token) continue;
            const creds = JSON.parse(await decryptToken(account.refresh_token));
            const connectUrl = `${MT5_API_BASE}/Connect?user=${encodeURIComponent(creds.mt5_login)}&password=${encodeURIComponent(creds.mt5_password)}&host=${encodeURIComponent(creds.broker_host)}&port=${encodeURIComponent(creds.broker_port)}`;
            const reconnectRes = await fetch(connectUrl);
            if (!reconnectRes.ok) continue;
            sessionToken = (await reconnectRes.text()).replace(/^"|"$/g, '');
            const encryptedSession = await encryptToken(sessionToken);
            await supabase.from('trading_accounts').update({ access_token: encryptedSession }).eq('id', account.id);
            
            const retrySummary = await fetch(`${MT5_API_BASE}/AccountSummary?id=${encodeURIComponent(sessionToken)}`);
            if (!retrySummary.ok) continue;
            const summary = await retrySummary.json();
            await supabase.from('trading_accounts').update({
              balance: summary.balance ?? 0,
              equity: summary.equity ?? 0,
              last_synced_at: new Date().toISOString(),
            }).eq('id', account.id);
            updated++;
            continue;
          }

          const summary = await summaryRes.json();
          await supabase.from('trading_accounts').update({
            balance: summary.balance ?? 0,
            equity: summary.equity ?? 0,
            last_synced_at: new Date().toISOString(),
          }).eq('id', account.id);
          updated++;
        } catch (err) {
          console.error(`Failed to refresh MT5 account ${account.account_id}:`, err);
        }
      }

      return new Response(JSON.stringify({ success: true, updated }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_positions') {
      const { account_db_id } = body;
      if (!account_db_id) throw new Error('account_db_id required');

      const { data: accountData, error: fetchError } = await supabase
        .from('trading_accounts')
        .select('access_token, refresh_token')
        .eq('id', account_db_id)
        .eq('user_id', user.id)
        .single();

      if (fetchError || !accountData?.access_token) throw new Error('Account not found');

      let sessionToken = await decryptToken(accountData.access_token);
      
      let posRes = await fetch(`${MT5_API_BASE}/Positions?id=${encodeURIComponent(sessionToken)}`);
      
      if (!posRes.ok && accountData.refresh_token) {
        // Reconnect
        const creds = JSON.parse(await decryptToken(accountData.refresh_token));
        const connectRes = await fetch(`${MT5_API_BASE}/Connect?user=${encodeURIComponent(creds.mt5_login)}&password=${encodeURIComponent(creds.mt5_password)}&host=${encodeURIComponent(creds.broker_host)}&port=${encodeURIComponent(creds.broker_port)}`);
        if (connectRes.ok) {
          sessionToken = (await connectRes.text()).replace(/^"|"$/g, '');
          await supabase.from('trading_accounts').update({ access_token: await encryptToken(sessionToken) }).eq('id', account_db_id);
          posRes = await fetch(`${MT5_API_BASE}/Positions?id=${encodeURIComponent(sessionToken)}`);
        }
      }

      if (!posRes.ok) throw new Error('Failed to fetch positions');
      const positions = await posRes.json();

      return new Response(JSON.stringify({ positions: Array.isArray(positions) ? positions : [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid action');
  } catch (error: unknown) {
    console.error('MT5 accounts error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
