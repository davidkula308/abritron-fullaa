import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const CTRADER_CLIENT_ID = Deno.env.get('CTRADER_CLIENT_ID');
    const CTRADER_CLIENT_SECRET = Deno.env.get('CTRADER_CLIENT_SECRET');

    if (!CTRADER_CLIENT_ID || !CTRADER_CLIENT_SECRET) {
      throw new Error('cTrader API credentials not configured');
    }

    const { action, code, redirect_uri, refresh_token } = await req.json();

    if (action === 'get_auth_url') {
      // Generate OAuth authorization URL
      const authUrl = new URL('https://connect.spotware.com/oauth/v2/auth');
      authUrl.searchParams.set('client_id', CTRADER_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', redirect_uri);
      authUrl.searchParams.set('response_type', 'code');
      // cTrader Open API requires space-separated scopes
      authUrl.searchParams.set('scope', 'trading accounts');
      // Add access_type for refresh token
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');

      return new Response(JSON.stringify({ auth_url: authUrl.toString() }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'exchange_code') {
      // Exchange authorization code for tokens
      const tokenResponse = await fetch('https://connect.spotware.com/oauth/v2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri,
          client_id: CTRADER_CLIENT_ID,
          client_secret: CTRADER_CLIENT_SECRET,
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        throw new Error(`Token exchange failed: ${error}`);
      }

      const tokenData = await tokenResponse.json();
      return new Response(JSON.stringify(tokenData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'refresh_token') {
      // Refresh access token
      const tokenResponse = await fetch('https://connect.spotware.com/oauth/v2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token,
          client_id: CTRADER_CLIENT_ID,
          client_secret: CTRADER_CLIENT_SECRET,
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        throw new Error(`Token refresh failed: ${error}`);
      }

      const tokenData = await tokenResponse.json();
      return new Response(JSON.stringify(tokenData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid action');
  } catch (error: unknown) {
    console.error('cTrader auth error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
