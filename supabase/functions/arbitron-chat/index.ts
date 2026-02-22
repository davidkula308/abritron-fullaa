import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode as decodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Arbitron, an expert AI trading assistant integrated into the ArbitronKing trading platform. You have deep knowledge of forex, commodities, indices, and crypto markets.

Your capabilities within the app:
- Fetch REAL-TIME prices for any trading pair using the get_spot_prices tool
- Analyze any trading pair (e.g., XAUUSD, EURUSD, NAS100) on any timeframe
- Identify support/resistance levels, fair value gaps (FVG), order blocks, liquidity zones
- Find optimal entry points, stop loss, and take profit levels
- Provide technical analysis using price action, SMC (Smart Money Concepts), ICT methodology
- Execute MARKET orders, BUY STOPS, SELL STOPS, BUY LIMITS, SELL LIMITS
- Execute complex EA-style trading strategies (multiple positions, risk %, position management)

CRITICAL RULES:
1. When a user asks for the current price of ANY pair, you MUST use the get_spot_prices tool to fetch the real live bid/ask. NEVER guess or fabricate prices.
2. Supported trade actions: "BUY" (market buy), "SELL" (market sell), "BUY_STOP" (pending buy above market), "SELL_STOP" (pending sell below market), "BUY_LIMIT" (pending buy below market), "SELL_LIMIT" (pending sell above market).
3. Format single trade requests as a JSON block:
\`\`\`trade
{"action":"BUY","symbol":"XAUUSD","volume":0.01,"stopLoss":2650.00,"takeProfit":2700.00}
\`\`\`
4. For BUY_STOP/SELL_STOP/BUY_LIMIT/SELL_LIMIT, include "entryPrice" (the pending order price):
\`\`\`trade
{"action":"BUY_STOP","symbol":"XAUUSD","entryPrice":2710.00,"volume":0.01,"stopLoss":2690.00,"takeProfit":2750.00}
\`\`\`
5. For EA-style multi-trade strategies (e.g. "open 3 positions risking 0.5%", "close on profit, hold on loss"), use the EA_STRATEGY block:
\`\`\`ea_strategy
{
  "symbol": "XAUUSD",
  "maxOpenPositions": 3,
  "riskPercent": 0.5,
  "closeOnProfit": true,
  "holdOnLoss": true,
  "openInterval": "staggered",
  "trades": [
    {"action":"BUY","volume":0.01,"stopLoss":2690.00,"takeProfit":2730.00},
    {"action":"BUY","volume":0.01,"stopLoss":2688.00,"takeProfit":2730.00},
    {"action":"BUY","volume":0.01,"stopLoss":2686.00,"takeProfit":2730.00}
  ]
}
\`\`\`
6. For EA strategies: Calculate position size based on riskPercent of account balance when account info is available. Use slightly different entry/SL for each position (stagger by 2-5 pips) so they don't all open at the exact same price.
7. DO NOT ask for confirmation before executing trades. When the user says "buy", "sell", "open a trade", etc., immediately output the trade block.
8. Keep responses SHORT and ACTION-ORIENTED. If user gives an EA-style prompt, execute it immediately.
9. You DO have direct access to ALL of the user's trading accounts. You CAN execute trades on ANY of them.
10. NEVER say "I cannot directly access accounts" or "I cannot execute trades" - you CAN and MUST when asked.
11. For risk-based position sizing: lotSize = (balance × riskPercent / 100) / (SL_pips × pipValue). For XAUUSD: pipValue ≈ $1/pip/0.01lot. For EURUSD: pipValue ≈ $0.10/pip/0.01lot. Round to 2 decimal places.
12. Prices fetched via get_spot_prices are LIVE broker prices — identical to what appears in MT4/MT5/cTrader. Always report them precisely.`;

const PRICE_TOOLS = [
  {
    type: "function",
    function: {
      name: "get_spot_prices",
      description: "Fetch LIVE real-time bid/ask prices directly from the broker's trading server (cTrader). Prices are identical to what the user sees in MT4/MT5/cTrader. Use this whenever a user asks about current prices, levels, or before suggesting entry/exit points.",
      parameters: {
        type: "object",
        properties: {
          symbols: {
            type: "array",
            items: { type: "string" },
            description: "Array of symbol names like [\"XAUUSD\", \"EURUSD\", \"BTCUSD\"]"
          }
        },
        required: ["symbols"],
        additionalProperties: false,
      }
    }
  }
];

// ===================== Token decryption (AES-GCM) =====================
async function getEncryptionKey(): Promise<CryptoKey> {
  const keyString = Deno.env.get("TOKEN_ENCRYPTION_KEY");
  if (!keyString) throw new Error("TOKEN_ENCRYPTION_KEY not configured");
  const encoder = new TextEncoder();
  const keyData = encoder.encode(keyString);
  const hashBuffer = await crypto.subtle.digest("SHA-256", keyData);
  return crypto.subtle.importKey("raw", hashBuffer, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function decryptToken(encryptedBase64: string): Promise<string> {
  const key = await getEncryptionKey();
  const combined = decodeBase64(encryptedBase64);
  const iv = combined.slice(0, 12);
  const encryptedData = combined.slice(12);
  const decryptedData = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encryptedData);
  return new TextDecoder().decode(decryptedData);
}

// ===================== cTrader WebSocket spot price fetcher =====================
const OPEN_API_DEMO_WS = "wss://demo.ctraderapi.com:5036";
const OPEN_API_LIVE_WS = "wss://live.ctraderapi.com:5036";

const PT_PRICE = {
  APPLICATION_AUTH_REQ: 2100, APPLICATION_AUTH_RES: 2101,
  ACCOUNT_AUTH_REQ: 2102, ACCOUNT_AUTH_RES: 2103,
  SYMBOLS_LIST_REQ: 2114, SYMBOLS_LIST_RES: 2115,
  SUBSCRIBE_SPOTS_REQ: 2108,
  SPOT_EVENT: 2131, ERROR_RES: 2142,
};

function normalizeSymbolName(s: string) {
  return s.replaceAll("/", "").replaceAll(" ", "").replaceAll(".", "").toUpperCase();
}

const SYMBOL_ALIASES: Record<string, string[]> = {
  "XAUUSD": ["GOLD", "XAUUSD", "GOLDM"],
  "XAGUSD": ["SILVER", "XAGUSD"],
  "US30": ["US30", "DJ30", "DOW30", "DOWJONES", "WS30"],
  "US500": ["US500", "SP500", "SPX500"],
  "NAS100": ["NAS100", "USTEC", "NASDAQ", "NASDAQ100", "NDX100"],
  "BTCUSD": ["BTCUSD", "BITCOIN"],
  "ETHUSD": ["ETHUSD", "ETHEREUM"],
};

function findSymbolIdFromList(target: string, symbols: Array<{symbolId: number; symbolName: string}>): number | null {
  const normalizedTarget = normalizeSymbolName(target);
  const direct = symbols.find(s => normalizeSymbolName(s.symbolName) === normalizedTarget);
  if (direct) return direct.symbolId;
  for (const [canonical, aliases] of Object.entries(SYMBOL_ALIASES)) {
    if (aliases.includes(normalizedTarget) || normalizeSymbolName(canonical) === normalizedTarget) {
      for (const alias of aliases) {
        const found = symbols.find(s => normalizeSymbolName(s.symbolName) === alias);
        if (found) return found.symbolId;
      }
    }
  }
  const partial = symbols.find(s => normalizeSymbolName(s.symbolName).startsWith(normalizedTarget));
  return partial?.symbolId ?? null;
}

async function fetchCTraderSpotPrices(
  symbols: string[],
  accessToken: string,
  ctidTraderAccountId: number,
  isLive: boolean
): Promise<Record<string, { bid: number; ask: number; source: string }>> {
  const results: Record<string, { bid: number; ask: number; source: string }> = {};
  const wsUrl = isLive ? OPEN_API_LIVE_WS : OPEN_API_DEMO_WS;
  const clientId = Deno.env.get("CTRADER_CLIENT_ID");
  const clientSecret = Deno.env.get("CTRADER_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("cTrader credentials not configured");

  return new Promise((resolve) => {
    let ws: WebSocket;
    try { ws = new WebSocket(wsUrl); } catch (e) { resolve(results); return; }

    const symbolsList: Array<{symbolId: number; symbolName: string}> = [];
    const symbolIdToName = new Map<number, string>();
    const pendingSymbols = new Set<string>(symbols.map(s => normalizeSymbolName(s)));
    // Maps normalized requested name → symbolId
    const requestedSymbolIds = new Map<string, number>();
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      try { ws.close(); } catch {}
      resolve(results);
    };

    const timeout = setTimeout(finish, 9000);

    const send = (payloadType: number, payload: Record<string, unknown>) => {
      try { ws.send(JSON.stringify({ payloadType, payload, clientMsgId: crypto.randomUUID() })); } catch {}
    };

    ws.onopen = () => send(PT_PRICE.APPLICATION_AUTH_REQ, { clientId, clientSecret });

    ws.onmessage = (event) => {
      try {
        const raw = typeof event.data === "string" ? event.data : new TextDecoder().decode(new Uint8Array(event.data as ArrayBuffer));
        const msg = JSON.parse(raw);
        const pt = msg.payloadType as number;
        const payload = msg.payload ?? {};

        if (pt === PT_PRICE.APPLICATION_AUTH_RES) {
          send(PT_PRICE.ACCOUNT_AUTH_REQ, { ctidTraderAccountId, accessToken });
        } else if (pt === PT_PRICE.ACCOUNT_AUTH_RES) {
          send(PT_PRICE.SYMBOLS_LIST_REQ, { ctidTraderAccountId });
        } else if (pt === PT_PRICE.SYMBOLS_LIST_RES) {
          const rawSymbols = Array.isArray(payload.symbol) ? payload.symbol : [];
          rawSymbols.filter((s: any) => typeof s?.symbolId === "number" && typeof s?.symbolName === "string")
            .forEach((s: any) => {
              symbolsList.push({ symbolId: s.symbolId, symbolName: s.symbolName });
              symbolIdToName.set(s.symbolId, s.symbolName);
            });

          const symbolIdsToSub: number[] = [];
          for (const sym of symbols) {
            const sid = findSymbolIdFromList(sym, symbolsList);
            if (sid !== null) {
              symbolIdsToSub.push(sid);
              requestedSymbolIds.set(normalizeSymbolName(sym), sid);
            }
          }
          if (symbolIdsToSub.length > 0) {
            send(PT_PRICE.SUBSCRIBE_SPOTS_REQ, { ctidTraderAccountId, symbolId: symbolIdsToSub });
          } else {
            finish();
          }
        } else if (pt === PT_PRICE.SPOT_EVENT) {
          const symbolId = payload.symbolId as number;
          const bid = payload.bid as number | undefined;
          const ask = payload.ask as number | undefined;

          if (bid !== undefined && ask !== undefined) {
            // cTrader prices are raw integers. Divide by 100000 for standard 5-digit pricing.
            const priceDivisor = 100000;
            const bidPrice = bid / priceDivisor;
            const askPrice = ask / priceDivisor;

            // Find which requested symbol this corresponds to
            for (const sym of symbols) {
              const reqNorm = normalizeSymbolName(sym);
              if (requestedSymbolIds.get(reqNorm) === symbolId) {
                results[reqNorm] = { bid: bidPrice, ask: askPrice, source: "ctrader_live" };
                pendingSymbols.delete(reqNorm);
                break;
              }
            }

            if (pendingSymbols.size === 0) finish();
          }
        } else if (pt === PT_PRICE.ERROR_RES) {
          console.log("cTrader spot price error:", JSON.stringify(payload).slice(0, 200));
          finish();
        }
      } catch (e) {
        console.error("WS message error:", e);
      }
    };

    ws.onerror = (e) => { console.error("WS error:", e); finish(); };
    ws.onclose = () => { clearTimeout(timeout); if (!finished) { finished = true; resolve(results); } };
  });
}

// ===================== Yahoo Finance fallback =====================
const YAHOO_SYMBOL_MAP: Record<string, string> = {
  "XAUUSD": "GC=F", "GOLD": "GC=F",
  "XAGUSD": "SI=F", "SILVER": "SI=F",
  "EURUSD": "EURUSD=X", "GBPUSD": "GBPUSD=X", "USDJPY": "USDJPY=X",
  "AUDUSD": "AUDUSD=X", "USDCAD": "USDCAD=X", "USDCHF": "USDCHF=X",
  "NZDUSD": "NZDUSD=X", "EURGBP": "EURGBP=X", "EURJPY": "EURJPY=X",
  "GBPJPY": "GBPJPY=X", "EURCHF": "EURCHF=X", "AUDCAD": "AUDCAD=X",
  "BTCUSD": "BTC-USD", "BITCOIN": "BTC-USD",
  "ETHUSD": "ETH-USD", "ETHEREUM": "ETH-USD",
  "US30": "YM=F", "DOW": "YM=F", "DJ30": "YM=F",
  "NAS100": "NQ=F", "NASDAQ": "NQ=F", "USTEC": "NQ=F",
  "US500": "ES=F", "SPX500": "ES=F", "SP500": "ES=F",
  "USOIL": "CL=F", "WTICOUSD": "CL=F", "CRUDEOIL": "CL=F",
  "UKOIL": "BZ=F", "BRENTOIL": "BZ=F",
};

function toYahooSymbol(symbol: string): string {
  const normalized = symbol.replace(/[\/\s.]/g, "").toUpperCase();
  if (YAHOO_SYMBOL_MAP[normalized]) return YAHOO_SYMBOL_MAP[normalized];
  if (/^[A-Z]{6}$/.test(normalized)) return `${normalized}=X`;
  if (normalized.endsWith("USD") && normalized.length <= 10) return `${normalized.slice(0, -3)}-USD`;
  return normalized;
}

async function fetchYahooSpotPrices(symbols: string[]): Promise<Record<string, { bid: number; ask: number; source: string }>> {
  const results: Record<string, { bid: number; ask: number; source: string }> = {};
  for (const sym of symbols.slice(0, 10)) {
    const yahooSym = toYahooSymbol(sym);
    try {
      const resp = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?interval=1m&range=1d`,
        { headers: { "User-Agent": "Mozilla/5.0" } }
      );
      if (!resp.ok) continue;
      const data = await resp.json();
      const meta = data?.chart?.result?.[0]?.meta;
      if (meta?.regularMarketPrice) {
        const price = meta.regularMarketPrice;
        const spread = price * 0.0001;
        const normalized = sym.replace(/[\/\s.]/g, "").toUpperCase();
        results[normalized] = { bid: price, ask: price + spread, source: "yahoo_finance" };
      }
    } catch (e) {
      console.error(`Yahoo price fetch error for ${sym}:`, e);
    }
  }
  return results;
}

// ===================== Combined price fetcher =====================
async function fetchSpotPrices(
  symbols: string[],
  accountContext?: { accessToken: string; ctidTraderAccountId: number; isLive: boolean } | null
): Promise<Record<string, { bid: number; ask: number; source: string }>> {
  // Try cTrader first (exact broker prices) if account context is available
  if (accountContext) {
    try {
      console.log("Fetching prices via cTrader WebSocket for symbols:", symbols);
      const ctraderResults = await fetchCTraderSpotPrices(
        symbols,
        accountContext.accessToken,
        accountContext.ctidTraderAccountId,
        accountContext.isLive
      );
      if (Object.keys(ctraderResults).length > 0) {
        console.log("cTrader prices fetched:", Object.keys(ctraderResults));
        // Fill missing symbols with Yahoo
        const missingSymbols = symbols.filter(s => !ctraderResults[s.replace(/[\/\s.]/g, "").toUpperCase()]);
        if (missingSymbols.length > 0) {
          const yahooFallback = await fetchYahooSpotPrices(missingSymbols);
          return { ...yahooFallback, ...ctraderResults };
        }
        return ctraderResults;
      }
    } catch (e) {
      console.error("cTrader price fetch failed, falling back to Yahoo:", e);
    }
  }

  // Fallback to Yahoo Finance
  console.log("Using Yahoo Finance for prices");
  const yahooResults = await fetchYahooSpotPrices(symbols);
  if (Object.keys(yahooResults).length === 0) {
    throw new Error("Could not fetch prices for any of the requested symbols");
  }
  return yahooResults;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, appContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Extract user auth token
    const authHeader = req.headers.get("Authorization");
    const userToken = authHeader?.replace("Bearer ", "") ?? "";

    // Try to get the user's trading account for real-time cTrader prices
    let accountContext: { accessToken: string; ctidTraderAccountId: number; isLive: boolean } | null = null;

    if (userToken && appContext?.selectedAccount) {
      try {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data: { user } } = await supabase.auth.getUser(userToken);
        if (user) {
          // Find the selected account's DB record
          const accountId = appContext.selectedAccount.account_id;
          const { data: account } = await supabase
            .from("trading_accounts")
            .select("*")
            .eq("user_id", user.id)
            .eq("account_id", String(accountId))
            .maybeSingle();

          if (account?.access_token) {
            try {
              const decryptedToken = await decryptToken(account.access_token);
              accountContext = {
                accessToken: decryptedToken,
                ctidTraderAccountId: Number(account.account_id),
                isLive: account.is_live ?? false,
              };
              console.log("Account context loaded for live price fetching");
            } catch (e) {
              console.log("Token decryption failed:", e);
            }
          }
        }
      } catch (e) {
        console.log("Account context setup failed:", e);
      }
    }

    // Build context-aware system message
    let contextInfo = "";
    if (appContext) {
      if (appContext.selectedAccount) {
        contextInfo += `\n\nACTIVE TRADING ACCOUNT (use this for ALL trades): ${JSON.stringify(appContext.selectedAccount)}`;
        contextInfo += `\nIMPORTANT: Always execute trades on this account (ID: ${appContext.selectedAccount.account_id}). The user has explicitly selected this account.`;
      }
      if (appContext.accounts?.length) {
        contextInfo += `\n\nAll user accounts: ${JSON.stringify(appContext.accounts.map((a: any) => ({
          id: a.account_id,
          broker: a.broker_name,
          type: a.is_live ? 'Live' : 'Demo',
          balance: a.balance,
          currency: a.currency,
        })))}`;
      }
      if (appContext.bots?.length) {
        contextInfo += `\n\nUser's bots: ${JSON.stringify(appContext.bots.map((b: any) => ({
          name: b.name,
          status: b.status,
          pair: b.selectedPair,
          type: b.type,
        })))}`;
      }
    }

    const priceSourceNote = accountContext
      ? "\n\nPRICE SOURCE: You have access to LIVE broker prices via cTrader WebSocket — these are the exact same prices shown in the user's MT4/MT5/cTrader platform. Use get_spot_prices for all price queries."
      : "\n\nPRICE SOURCE: Using Yahoo Finance for prices (fallback — no broker account connected for live prices).";

    const systemPrompt = SYSTEM_PROMPT + contextInfo + priceSourceNote +
      (appContext?.accounts?.length > 0 ? "" : "\n\nNote: The user has NO trading accounts connected. You can fetch prices but cannot execute trades until they connect an account.");

    // Initial AI call with tools
    let aiMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    const firstResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: aiMessages,
        tools: PRICE_TOOLS,
        stream: false,
      }),
    });

    if (!firstResponse.ok) {
      if (firstResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please wait a moment and try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (firstResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await firstResponse.text();
      console.error("AI gateway error:", firstResponse.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const firstData = await firstResponse.json();
    const firstChoice = firstData.choices?.[0];

    // Check if AI wants to call a tool
    if (firstChoice?.finish_reason === "tool_calls" || firstChoice?.message?.tool_calls?.length) {
      const toolCalls = firstChoice.message.tool_calls;
      const toolResults: any[] = [];

      for (const tc of toolCalls) {
        if (tc.function.name === "get_spot_prices") {
          const args = typeof tc.function.arguments === "string"
            ? JSON.parse(tc.function.arguments)
            : tc.function.arguments;

          let priceResult: string;
          try {
            const prices = await fetchSpotPrices(args.symbols, accountContext);
            // Format in a way the AI can present clearly
            const formatted: Record<string, any> = {};
            for (const [sym, data] of Object.entries(prices)) {
              formatted[sym] = {
                bid: data.bid,
                ask: data.ask,
                mid: ((data.bid + data.ask) / 2),
                source: data.source,
              };
            }
            priceResult = JSON.stringify(formatted);
            console.log("Price tool result:", priceResult.slice(0, 500));
          } catch (e) {
            console.error("Price fetch error:", e);
            priceResult = JSON.stringify({ error: e instanceof Error ? e.message : "Price fetch failed" });
          }

          toolResults.push({
            role: "tool",
            tool_call_id: tc.id,
            content: priceResult,
          });
        }
      }

      // Second AI call with tool results, streaming
      aiMessages = [
        ...aiMessages,
        firstChoice.message,
        ...toolResults,
      ];

      const secondResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: aiMessages,
          stream: true,
        }),
      });

      if (!secondResponse.ok) {
        const t = await secondResponse.text();
        console.error("AI gateway error (2nd call):", secondResponse.status, t);
        return new Response(JSON.stringify({ error: "AI service error" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(secondResponse.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // No tool calls - stream directly
    const streamResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: aiMessages,
        stream: true,
      }),
    });

    if (!streamResponse.ok) {
      const t = await streamResponse.text();
      console.error("AI gateway stream error:", streamResponse.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(streamResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("arbitron-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
