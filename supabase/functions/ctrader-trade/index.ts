import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { encode as encodeBase64, decode as decodeBase64 } from "https://deno.land/std@0.208.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPEN_API_DEMO_WS = "wss://demo.ctraderapi.com:5036";
const OPEN_API_LIVE_WS = "wss://live.ctraderapi.com:5036";

const PT = {
  APPLICATION_AUTH_REQ: 2100,
  APPLICATION_AUTH_RES: 2101,
  ACCOUNT_AUTH_REQ: 2102,
  ACCOUNT_AUTH_RES: 2103,
  NEW_ORDER_REQ: 2106,
  SUBSCRIBE_SPOTS_REQ: 2108,
  SUBSCRIBE_SPOTS_RES: 2109,
  AMEND_POSITION_SLTP_REQ: 2110,
  CLOSE_POSITION_REQ: 2111,
  SYMBOLS_LIST_REQ: 2114,
  SYMBOLS_LIST_RES: 2115,
  SYMBOL_BY_ID_REQ: 2116,
  SYMBOL_BY_ID_RES: 2117,
  RECONCILE_REQ: 2124,
  RECONCILE_RES: 2125,
  EXECUTION_EVENT: 2126,
  SPOT_EVENT: 2131,
  ORDER_ERROR_EVENT: 2132,
  ERROR_RES: 2142,
} as const;

interface SymbolDetail {
  symbolId: number;
  symbolName: string;
  lotSize?: number;   // protocol volume per 1 lot
  stepVolume?: number; // minimum volume increment
  minVolume?: number;  // minimum allowed volume
  digits?: number;    // decimal digits for price (e.g. 2 for XAUUSD, 5 for EURUSD)
}

const ORDER_TYPE = { MARKET: 1, LIMIT: 2, STOP: 3, STOP_LIMIT: 4 } as const;
const TRADE_SIDE = { BUY: 1, SELL: 2 } as const;

type TradeAction = "open_trade" | "close_trade" | "modify_trade" | "get_positions" | "validate_symbol" | "get_spot_prices";

interface TradeRequest {
  action: TradeAction;
  account_id: string;
  symbol?: string;
  volume?: number;
  side?: "BUY" | "SELL";
  order_type?: "MARKET" | "BUY_STOP" | "SELL_STOP" | "BUY_LIMIT" | "SELL_LIMIT";
  entry_price?: number; // For pending orders
  stop_loss?: number;
  take_profit?: number;
  position_id?: string;
  comment?: string;
}

type IncomingOpenApiMessage = {
  clientMsgId?: string;
  payloadType: number;
  payload?: Record<string, unknown>;
};

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

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

// ===================== Token refresh helper =====================
async function refreshAccessToken(refreshTokenEncrypted: string, supabase: any, accountDbId: string): Promise<string> {
  const refreshToken = await decryptToken(refreshTokenEncrypted);
  const clientId = Deno.env.get("CTRADER_CLIENT_ID")!;
  const clientSecret = Deno.env.get("CTRADER_CLIENT_SECRET")!;

  console.log("Attempting token refresh for account", accountDbId);

  const resp = await fetch("https://connect.spotware.com/oauth/v2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("Token refresh failed:", resp.status, errText);
    throw new Error("Token refresh failed. Please reconnect your account with fresh tokens.");
  }

  const tokenData = await resp.json();
  console.log("Token refresh response keys:", Object.keys(tokenData));
  const newAccessToken = tokenData.access_token || tokenData.accessToken;
  const newRefreshToken = tokenData.refresh_token || tokenData.refreshToken;

  if (!newAccessToken || typeof newAccessToken !== "string" || newAccessToken.trim() === "") {
    console.error("Token refresh returned empty access token. Full response:", JSON.stringify(tokenData).slice(0, 500));
    throw new Error("Token refresh returned empty access token. Please reconnect your account with fresh tokens.");
  }

  // Encrypt and update in DB
  const encKey = await getEncryptionKey();
  const encryptFn = async (plain: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, encKey, data);
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    return encodeBase64(combined.buffer);
  };

  const updateData: Record<string, unknown> = {
    access_token: await encryptFn(newAccessToken),
    last_synced_at: new Date().toISOString(),
  };
  if (newRefreshToken) {
    updateData.refresh_token = await encryptFn(newRefreshToken);
  }
  await supabase.from("trading_accounts").update(updateData).eq("id", accountDbId);

  console.log("Token refreshed successfully for account", accountDbId);
  return newAccessToken;
}

// ===================== Open API WebSocket helper =====================
class OpenApiJsonClient {
  private ws: WebSocket;
  private waiters: Array<{
    predicate: (m: IncomingOpenApiMessage) => boolean;
    resolve: (m: IncomingOpenApiMessage) => void;
    reject: (e: Error) => void;
    timeoutId: number;
  }> = [];

  private constructor(ws: WebSocket) {
    this.ws = ws;
    ws.onmessage = (event) => {
      try {
        const raw = typeof event.data === "string"
          ? event.data
          : event.data instanceof ArrayBuffer
            ? new TextDecoder().decode(new Uint8Array(event.data))
            : String(event.data);
        const msg = JSON.parse(raw) as IncomingOpenApiMessage;
        console.log("WS recv:", msg.payloadType, JSON.stringify(msg.payload ?? {}).slice(0, 500));
        for (let i = 0; i < this.waiters.length; i++) {
          const w = this.waiters[i];
          if (w.predicate(msg)) {
            clearTimeout(w.timeoutId);
            this.waiters.splice(i, 1);
            w.resolve(msg);
            return;
          }
        }
      } catch { /* ignore */ }
    };
    ws.onerror = () => this.failAll(new Error("Open API WebSocket error"));
    ws.onclose = () => this.failAll(new Error("Open API WebSocket closed"));
  }

  static async connect(url: string, timeoutMs = 8000, retries = 3): Promise<OpenApiJsonClient> {
    let lastErr: Error | undefined;
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const ws = new WebSocket(url);
        await new Promise<void>((resolve, reject) => {
          const timeoutId = setTimeout(() => { try { ws.close(); } catch {} reject(new Error("WS connect timeout")); }, timeoutMs);
          ws.onopen = () => { clearTimeout(timeoutId); resolve(); };
          ws.onerror = () => { clearTimeout(timeoutId); reject(new Error("WS failed to open")); };
        });
        return new OpenApiJsonClient(ws);
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e));
        console.log(`WS connect attempt ${attempt + 1}/${retries} failed: ${lastErr.message}`);
        if (attempt < retries - 1) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
    throw lastErr ?? new Error("WS failed to open after retries");
  }

  close() { try { this.ws.close(); } catch {} }

  send(payloadType: number, payload: Record<string, unknown>, clientMsgId = crypto.randomUUID()) {
    const message = { clientMsgId, payloadType, payload };
    console.log("WS send:", payloadType, JSON.stringify(payload).slice(0, 500));
    this.ws.send(JSON.stringify(message));
    return clientMsgId;
  }

  waitFor(predicate: (m: IncomingOpenApiMessage) => boolean, timeoutMs = 12000): Promise<IncomingOpenApiMessage> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const idx = this.waiters.findIndex((w) => w.resolve === resolve);
        if (idx >= 0) this.waiters.splice(idx, 1);
        reject(new Error("Open API response timeout"));
      }, timeoutMs);
      this.waiters.push({ predicate, resolve, reject, timeoutId });
    });
  }

  waitForPayloadTypes(payloadTypes: number[], timeoutMs = 12000) {
    const set = new Set(payloadTypes);
    return this.waitFor((m) => set.has(m.payloadType), timeoutMs);
  }

  private failAll(err: Error) {
    const pending = [...this.waiters];
    this.waiters = [];
    for (const w of pending) { clearTimeout(w.timeoutId); try { w.reject(err); } catch {} }
  }
}

function openApiErrorMessage(msg: IncomingOpenApiMessage): string {
  const payload = msg.payload ?? {};
  const errorCode = typeof payload.errorCode === "string" ? payload.errorCode : undefined;
  const description = typeof payload.description === "string" ? payload.description : undefined;
  if (errorCode && description) return `${errorCode}: ${description}`;
  if (errorCode) return errorCode;
  if (description) return description;
  return "Unknown trading error";
}

function normalizeSymbol(s: string) {
  return s.replaceAll("/", "").replaceAll(" ", "").replaceAll(".", "").toUpperCase();
}

// Symbol name aliases for auto-mapping
const SYMBOL_ALIASES: Record<string, string[]> = {
  "XAUUSD": ["GOLD", "XAUUSD", "GOLDM"],
  "XAGUSD": ["SILVER", "XAGUSD"],
  "US30": ["US30", "DJ30", "DOW30", "DOWJONES", "WS30"],
  "US500": ["US500", "SP500", "SPX500", "S&P500"],
  "NAS100": ["NAS100", "USTEC", "NASDAQ", "NASDAQ100", "NDX100"],
  "BTCUSD": ["BTCUSD", "BITCOIN"],
  "ETHUSD": ["ETHUSD", "ETHEREUM"],
};

function findSymbolMatch(target: string, symbols: Array<{symbolId: number; symbolName: string}>): {symbolId: number; symbolName: string} | null {
  const normalizedTarget = normalizeSymbol(target);
  
  // Direct match
  const direct = symbols.find(s => normalizeSymbol(s.symbolName) === normalizedTarget);
  if (direct) return direct;
  
  // Alias match
  for (const [canonical, aliases] of Object.entries(SYMBOL_ALIASES)) {
    if (aliases.includes(normalizedTarget) || normalizeSymbol(canonical) === normalizedTarget) {
      for (const alias of aliases) {
        const found = symbols.find(s => normalizeSymbol(s.symbolName) === alias);
        if (found) return found;
      }
    }
  }
  
  // Partial match (e.g., EURUSD matches EURUSDm, EURUSD.raw, etc.)
  const partial = symbols.find(s => normalizeSymbol(s.symbolName).startsWith(normalizedTarget));
  if (partial) return partial;
  
  return null;
}

function toLotsFromProtocolVolume(protocolVolume: number, lotSize: number): number {
  return protocolVolume / lotSize;
}

function toProtocolVolumeFromLots(lots: number, lotSize: number): number {
  // lotSize is the protocol volume for 1 lot (varies per symbol)
  // e.g. EURUSD lotSize=10,000,000 (100k units * 100), XAUUSD lotSize=10,000 (100 oz * 100)
  return Math.round(lots * lotSize);
}

function toRealMoney(value: unknown, moneyDigits?: number): number {
  if (typeof value !== "number") return 0;
  const digits = typeof moneyDigits === "number" && Number.isFinite(moneyDigits) ? moneyDigits : 0;
  return value / Math.pow(10, digits);
}

async function withOpenApiSession<T>(opts: {
  isLive: boolean | null;
  ctidTraderAccountId: number;
  accessToken: string;
  handler: (client: OpenApiJsonClient) => Promise<T>;
}): Promise<T> {
  const { isLive, ctidTraderAccountId, accessToken, handler } = opts;
  const clientId = Deno.env.get("CTRADER_CLIENT_ID");
  const clientSecret = Deno.env.get("CTRADER_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("cTrader API credentials not configured");

  // If isLive is null/unknown, try both servers (live first since most real accounts are live)
  const serversToTry: Array<{ url: string; label: string }> = [];
  if (isLive === true) {
    serversToTry.push({ url: OPEN_API_LIVE_WS, label: "LIVE" });
  } else if (isLive === false) {
    serversToTry.push({ url: OPEN_API_DEMO_WS, label: "DEMO" });
  } else {
    // Unknown: try live first, then demo
    serversToTry.push({ url: OPEN_API_LIVE_WS, label: "LIVE" });
    serversToTry.push({ url: OPEN_API_DEMO_WS, label: "DEMO" });
  }

  let lastError: Error | undefined;
  for (const server of serversToTry) {
    console.log(`Connecting to ${server.label} server for account ${ctidTraderAccountId}`);
    let client: OpenApiJsonClient | undefined;
    try {
      client = await OpenApiJsonClient.connect(server.url);

      client.send(PT.APPLICATION_AUTH_REQ, { clientId, clientSecret });
      const appAuthRes = await client.waitForPayloadTypes([PT.APPLICATION_AUTH_RES, PT.ERROR_RES], 12000);
      if (appAuthRes.payloadType === PT.ERROR_RES) throw new Error(openApiErrorMessage(appAuthRes));

      client.send(PT.ACCOUNT_AUTH_REQ, { ctidTraderAccountId, accessToken });
      const acctAuthRes = await client.waitForPayloadTypes([PT.ACCOUNT_AUTH_RES, PT.ERROR_RES], 12000);
      if (acctAuthRes.payloadType === PT.ERROR_RES) {
        const errMsg = openApiErrorMessage(acctAuthRes);
        // If token invalid on this server and we have another to try, continue
        if (serversToTry.length > 1 && (errMsg.includes("CH_ACCESS_TOKEN_INVALID") || errMsg.includes("CANT_ROUTE_REQUEST"))) {
          console.log(`${server.label} server rejected token (${errMsg}), trying next server...`);
          client.close();
          lastError = new Error(errMsg);
          continue;
        }
        throw new Error(errMsg);
      }

      console.log(`Successfully authenticated on ${server.label} server`);
      try {
        return await handler(client);
      } finally {
        client.close();
      }
    } catch (e) {
      if (client) client.close();
      lastError = e instanceof Error ? e : new Error(String(e));
      const errMsg = lastError.message;
      // If this is a server mismatch error and we have more servers, try next
      if (serversToTry.indexOf(server) < serversToTry.length - 1 && 
          (errMsg.includes("CH_ACCESS_TOKEN_INVALID") || errMsg.includes("CANT_ROUTE_REQUEST"))) {
        console.log(`${server.label} failed: ${errMsg}, trying next server...`);
        continue;
      }
      throw lastError;
    }
  }
  throw lastError ?? new Error("All server connections failed");
}

async function fetchSymbolsList(client: OpenApiJsonClient, ctidTraderAccountId: number): Promise<Array<{symbolId: number; symbolName: string}>> {
  client.send(PT.SYMBOLS_LIST_REQ, { ctidTraderAccountId });
  const res = await client.waitForPayloadTypes([PT.SYMBOLS_LIST_RES, PT.ERROR_RES], 12000);
  if (res.payloadType === PT.ERROR_RES) throw new Error(openApiErrorMessage(res));
  const payload = res.payload ?? {};
  const symbols = Array.isArray((payload as any).symbol) ? (payload as any).symbol : [];
  return symbols
    .filter((s: any) => typeof s?.symbolId === "number" && typeof s?.symbolName === "string")
    .map((s: any) => ({ symbolId: s.symbolId as number, symbolName: s.symbolName as string }));
}

async function fetchSymbolDetail(client: OpenApiJsonClient, ctidTraderAccountId: number, symbolId: number): Promise<SymbolDetail> {
  client.send(PT.SYMBOL_BY_ID_REQ, { ctidTraderAccountId, symbolId: [symbolId] });
  const res = await client.waitForPayloadTypes([PT.SYMBOL_BY_ID_RES, PT.ERROR_RES], 12000);
  if (res.payloadType === PT.ERROR_RES) throw new Error(openApiErrorMessage(res));
  const payload = res.payload ?? {};
  const symbols = Array.isArray((payload as any).symbol) ? (payload as any).symbol : [];
  const sym = symbols[0];
  // digits: number of decimal places in the price (e.g. 2 for XAUUSD=3100.00, 5 for EURUSD=1.23456)
  const digits = typeof sym?.digits === "number" ? sym.digits : undefined;
  console.log(`Symbol ${symbolId} (${sym?.symbolName}): lotSize=${sym?.lotSize}, digits=${digits}`);
  return {
    symbolId,
    symbolName: String(sym?.symbolName ?? symbolId),
    lotSize: typeof sym?.lotSize === "number" ? sym.lotSize : 10_000_000,
    stepVolume: typeof sym?.stepVolume === "number" ? sym.stepVolume : undefined,
    minVolume: typeof sym?.minVolume === "number" ? sym.minVolume : undefined,
    digits,
  };
}

async function fetchSymbolId(client: OpenApiJsonClient, ctidTraderAccountId: number, symbol: string): Promise<SymbolDetail> {
  const symbols = await fetchSymbolsList(client, ctidTraderAccountId);
  const match = findSymbolMatch(symbol, symbols);
  if (!match) {
    const normalized = normalizeSymbol(symbol);
    const similar = symbols
      .filter(s => normalizeSymbol(s.symbolName).includes(normalized.slice(0, 3)))
      .slice(0, 5)
      .map(s => s.symbolName);
    const hint = similar.length > 0 ? ` Did you mean: ${similar.join(", ")}?` : "";
    throw new Error(`Symbol "${symbol}" not available on this account.${hint}`);
  }
  // Fetch full symbol details to get lotSize
  return fetchSymbolDetail(client, ctidTraderAccountId, match.symbolId);
}

async function reconcilePositions(client: OpenApiJsonClient, ctidTraderAccountId: number) {
  client.send(PT.RECONCILE_REQ, { ctidTraderAccountId, returnProtectionOrders: false });
  const res = await client.waitForPayloadTypes([PT.RECONCILE_RES, PT.ERROR_RES], 12000);
  if (res.payloadType === PT.ERROR_RES) throw new Error(openApiErrorMessage(res));
  return res;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const request: TradeRequest = await req.json();
    const { action, account_id: accountRef, symbol, volume, side, stop_loss, take_profit, position_id, comment } = request;
    const orderTypeStr = (request as any).order_type as string | undefined;
    const entryPrice = (request as any).entry_price as number | undefined;

    const accountQuery = supabase.from("trading_accounts").select("*").eq("user_id", user.id).limit(1);
    let accountResult: any;
    if (!accountRef || accountRef === "__first__") {
      accountResult = await accountQuery.order("created_at", { ascending: true }).maybeSingle();
    } else if (isUuid(accountRef)) {
      accountResult = await supabase.from("trading_accounts").select("*").eq("user_id", user.id).eq("id", accountRef).single();
    } else {
      accountResult = await supabase.from("trading_accounts").select("*").eq("user_id", user.id).eq("account_id", accountRef).single();
    }
    const { data: account, error: accountError } = accountResult;

    if (accountError || !account) {
      return new Response(JSON.stringify({ success: false, error: "Trading account not found" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!account.access_token) {
      return new Response(JSON.stringify({ success: false, error: "Account not authenticated - please reconnect" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let decryptedAccessToken = await decryptToken(account.access_token);
    console.log(`Decrypted token preview: "${decryptedAccessToken.slice(0, 10)}...${decryptedAccessToken.slice(-5)}" (len=${decryptedAccessToken.length})`);
    
    // Validate token against REST API first
    try {
      const testResp = await fetch(`https://api.spotware.com/connect/tradingaccounts?oauth_token=${encodeURIComponent(decryptedAccessToken)}`, {
        headers: { Accept: "application/json" },
      });
      console.log(`REST API token validation: status=${testResp.status}`);
      if (!testResp.ok) {
        const errText = await testResp.text();
        console.log(`REST API rejection: ${errText}`);
      }
    } catch (e) {
      console.log(`REST API test error: ${e}`);
    }
    
    const ctidTraderAccountId = Number(account.account_id);
    if (!Number.isFinite(ctidTraderAccountId)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid trading account id" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pass is_live as-is (null means unknown → try both servers)
    const isLive = account.is_live;

    console.log(`Action: ${action}, Account: ${ctidTraderAccountId}, isLive: ${isLive}, symbol: ${symbol}, volume: ${volume}, side: ${side}`);

    const runSession = (token: string) => withOpenApiSession({
      isLive,
      ctidTraderAccountId,
      accessToken: token,
      handler: async (client) => {
        switch (action) {
          case "validate_symbol": {
            if (!symbol) return { success: false, error: "Missing symbol" };
            const symbols = await fetchSymbolsList(client, ctidTraderAccountId);
            const match = findSymbolMatch(symbol, symbols);
            if (!match) {
              const normalized = normalizeSymbol(symbol);
              const similar = symbols
                .filter(s => normalizeSymbol(s.symbolName).includes(normalized.slice(0, 3)))
                .slice(0, 10)
                .map(s => s.symbolName);
              return { success: false, error: `Symbol "${symbol}" not available`, suggestions: similar };
            }
            return { success: true, symbolId: match.symbolId, symbolName: match.symbolName };
          }

          case "get_positions": {
            const rec = await reconcilePositions(client, ctidTraderAccountId);
            const payload = rec.payload ?? {};
            const positionsRaw = Array.isArray((payload as any).position) ? (payload as any).position : [];

            let symbolById = new Map<number, string>();
            const symbolLotSizes = new Map<number, number>();
            const symbolDigits = new Map<number, number>();
            let allSymbolsList: Array<{symbolId: number; symbolName: string}> = [];
            const posSymbolIds = [...new Set(positionsRaw.map((p: any) => p?.tradeData?.symbolId).filter((id: any) => typeof id === "number"))] as number[];
            try {
              allSymbolsList = await fetchSymbolsList(client, ctidTraderAccountId);
              symbolById = new Map(allSymbolsList.map(s => [s.symbolId, s.symbolName]));
              for (const sid of posSymbolIds) {
                try {
                  const detail = await fetchSymbolDetail(client, ctidTraderAccountId, sid);
                  if (detail.lotSize) symbolLotSizes.set(sid, detail.lotSize);
                  // digits is critical for correct price scaling of spot events
                  if (typeof detail.digits === "number") symbolDigits.set(sid, detail.digits);
                } catch { /* use default */ }
              }
            } catch { /* fallback */ }

            // Subscribe to spot prices for all unique symbols in positions to get live current price
            const liveSpotPrices = new Map<number, { bid: number; ask: number }>();
            if (posSymbolIds.length > 0) {
              try {
                const spotPendingIds = new Set<number>(posSymbolIds);
                const spotCollected = new Promise<void>((resolveSpot) => {
                  const t = setTimeout(() => resolveSpot(), 7000);
                  // Use addEventListener to avoid conflicting with the existing onmessage handler
                  (client as any).ws.addEventListener("message", (event: MessageEvent) => {
                    try {
                      const raw = typeof event.data === "string" ? event.data : new TextDecoder().decode(new Uint8Array(event.data as ArrayBuffer));
                      const msg = JSON.parse(raw);
                      if (msg.payloadType === PT.SPOT_EVENT && msg.payload) {
                        const sid = msg.payload.symbolId as number;
                        if (spotPendingIds.has(sid)) {
                          // Use symbol-specific digits; default to 5 only for forex, 2 for metals
                          const digits = symbolDigits.get(sid) ?? 5;
                          const divisor = Math.pow(10, digits);
                          const bid = typeof msg.payload.bid === "number" ? msg.payload.bid / divisor : 0;
                          const ask = typeof msg.payload.ask === "number" ? msg.payload.ask / divisor : 0;
                          console.log(`SPOT_EVENT sid=${sid} digits=${digits} divisor=${divisor} raw_bid=${msg.payload.bid} bid=${bid} ask=${ask}`);
                          if (bid > 0) {
                            liveSpotPrices.set(sid, { bid, ask });
                            spotPendingIds.delete(sid);
                            if (spotPendingIds.size === 0) { clearTimeout(t); resolveSpot(); }
                          }
                        }
                      }
                    } catch {}
                  });
                });
                // Subscribe to all position symbols at once
                client.send(PT.SUBSCRIBE_SPOTS_REQ, { ctidTraderAccountId, symbolId: posSymbolIds });
                await spotCollected;
                console.log(`Collected ${liveSpotPrices.size}/${posSymbolIds.length} spot prices`);
              } catch (e) {
                console.log("Spot price subscription for positions failed:", e);
              }
            }

            const positions = positionsRaw.map((p: any) => {
              const td = p?.tradeData ?? {};
              const symbolId = typeof td.symbolId === "number" ? td.symbolId : undefined;
              const symbolName = symbolId !== undefined ? (symbolById.get(symbolId) ?? String(symbolId)) : "UNKNOWN";
              const protocolVol = typeof td.volume === "number" ? td.volume : 0;
              const lotSize = symbolId !== undefined ? (symbolLotSizes.get(symbolId) ?? 10_000_000) : 10_000_000;
              const moneyDigits = typeof p?.moneyDigits === "number" ? p.moneyDigits : 2;
              const moneyDivisor = Math.pow(10, moneyDigits);

              // Get entry price — cTrader sends it already in real price format (not scaled)
              const entryPrice = typeof p?.price === "number" ? p.price : 0;

              // Get live current price from spot subscription
              const spotPrice = symbolId !== undefined ? liveSpotPrices.get(symbolId) : undefined;
              const isSell = td.tradeSide === TRADE_SIDE.SELL;
              // For BUY: profit = (currentBid - entryPrice) * volume * lotSize / moneyDivisor
              // For SELL: profit = (entryPrice - currentAsk) * volume * lotSize / moneyDivisor
              const currentPrice = spotPrice
                ? (isSell ? spotPrice.ask : spotPrice.bid)
                : entryPrice;

              // Try unrealizedNetProfit field first (raw cTrader field), then profit
              // cTrader returns unrealizedNetProfit scaled by moneyDigits
              let floatingProfit = 0;
              if (typeof p?.unrealizedNetProfit === "number") {
                floatingProfit = p.unrealizedNetProfit / moneyDivisor;
              } else if (typeof p?.profit === "number" && p.profit !== 0) {
                floatingProfit = p.profit / moneyDivisor;
              } else if (spotPrice) {
                // Calculate manually from current price
                const lotsVol = toLotsFromProtocolVolume(protocolVol, lotSize);
                const priceDiff = isSell ? (entryPrice - spotPrice.ask) : (spotPrice.bid - entryPrice);
                floatingProfit = priceDiff * lotsVol * 100; // approximation
              }

              // SL/TP — cTrader sends as scaled integers for some responses, raw for others
              // Check if values look like scaled integers (very large)
              const rawSL = p?.stopLoss;
              const rawTP = p?.takeProfit;
              const digits = symbolId !== undefined ? (symbolDigits.get(symbolId) ?? 5) : 5;
              const priceDivisor = Math.pow(10, digits);

              // If SL/TP > 10000 they are likely raw integer scaled prices
              const stopLoss = typeof rawSL === "number" && rawSL !== 0
                ? (rawSL > 10000 ? rawSL / priceDivisor : rawSL)
                : null;
              const takeProfit = typeof rawTP === "number" && rawTP !== 0
                ? (rawTP > 10000 ? rawTP / priceDivisor : rawTP)
                : null;

              return {
                positionId: String(p?.positionId ?? ""),
                symbol: symbolName,
                volume: toLotsFromProtocolVolume(protocolVol, lotSize),
                side: isSell ? "SELL" : "BUY",
                entryPrice,
                currentPrice,
                profit: Math.round(floatingProfit * 100) / 100,
                swap: toRealMoney(p?.swap, moneyDigits),
                commission: toRealMoney(p?.commission, moneyDigits),
                stopLoss,
                takeProfit,
              };
            });

            return { success: true, positions };
          }

          case "open_trade": {
            if (!symbol || typeof volume !== "number" || !side) {
              return { success: false, error: "Missing required parameters: symbol, volume, side" };
            }

            const match = await fetchSymbolId(client, ctidTraderAccountId, symbol);
            const lotSize = match.lotSize ?? 10_000_000;
            const protocolVolume = toProtocolVolumeFromLots(volume, lotSize);
            
            // Determine order type
            let ctraderOrderType = ORDER_TYPE.MARKET;
            let isPending = false;
            if (orderTypeStr === "BUY_STOP" || orderTypeStr === "SELL_STOP") {
              ctraderOrderType = ORDER_TYPE.STOP;
              isPending = true;
            } else if (orderTypeStr === "BUY_LIMIT" || orderTypeStr === "SELL_LIMIT") {
              ctraderOrderType = ORDER_TYPE.LIMIT;
              isPending = true;
            }
            
            console.log(`Opening trade: symbolId=${match.symbolId} (${match.symbolName}), lotSize=${lotSize}, protocolVolume=${protocolVolume}, lots=${volume}, side=${side}, orderType=${orderTypeStr ?? "MARKET"}`);

            const orderPayload: Record<string, unknown> = {
              ctidTraderAccountId,
              symbolId: match.symbolId,
              orderType: ctraderOrderType,
              tradeSide: side === "SELL" ? TRADE_SIDE.SELL : TRADE_SIDE.BUY,
              volume: protocolVolume,
              comment: comment || "ArbitronAI",
              label: "ArbitronAI",
            };
            
            // For pending orders, set stop/limit price and optional SL/TP
            if (isPending && entryPrice !== undefined) {
              if (ctraderOrderType === ORDER_TYPE.STOP) {
                orderPayload.stopPrice = entryPrice;
              } else {
                orderPayload.limitPrice = entryPrice;
              }
              // Pending orders can have SL/TP set at creation
              if (stop_loss !== undefined) orderPayload.stopLoss = stop_loss;
              if (take_profit !== undefined) orderPayload.takeProfit = take_profit;
              // Expiry: 24 hours from now
              orderPayload.expirationTimestamp = Date.now() + 86400000;
            }

            client.send(PT.NEW_ORDER_REQ, orderPayload);

            const res = await client.waitForPayloadTypes(
              [PT.EXECUTION_EVENT, PT.ORDER_ERROR_EVENT, PT.ERROR_RES], 20000,
            );

            if (res.payloadType !== PT.EXECUTION_EVENT) {
              const errMsg = openApiErrorMessage(res);
              console.error(`Order error: ${errMsg}`, JSON.stringify(res.payload));
              return { success: false, error: errMsg };
            }

            const executionPayload = res.payload ?? {};
            const position = (executionPayload as any).position;
            const positionId = position?.positionId;

            // For market orders: Apply SL/TP via amend if not already set
            if (!isPending && (stop_loss !== undefined || take_profit !== undefined) && typeof positionId === "number") {
              const amendPayload: Record<string, unknown> = { ctidTraderAccountId, positionId };
              if (stop_loss !== undefined) amendPayload.stopLoss = stop_loss;
              if (take_profit !== undefined) amendPayload.takeProfit = take_profit;

              client.send(PT.AMEND_POSITION_SLTP_REQ, amendPayload);
              const amendRes = await client.waitForPayloadTypes(
                [PT.EXECUTION_EVENT, PT.ORDER_ERROR_EVENT, PT.ERROR_RES], 20000,
              );
              if (amendRes.payloadType !== PT.EXECUTION_EVENT) {
                return { success: true, execution: executionPayload, warning: `Trade opened but SL/TP failed: ${openApiErrorMessage(amendRes)}` };
              }
            }

            return {
              success: true,
              execution: executionPayload,
              matchedSymbol: match.symbolName,
              isPending,
              message: isPending 
                ? `${orderTypeStr} order placed for ${volume} lot(s) of ${match.symbolName} at ${entryPrice}`
                : `${side} ${volume} lot(s) of ${match.symbolName} executed`,
            };
          }

          case "close_trade": {
            if (!position_id) return { success: false, error: "Missing position_id to close" };

            const rec = await reconcilePositions(client, ctidTraderAccountId);
            const payload = rec.payload ?? {};
            const positions = Array.isArray((payload as any).position) ? (payload as any).position : [];
            const pid = Number(position_id);
            const pos = positions.find((p: any) => p?.positionId === pid);
            const protocolVolume = typeof pos?.tradeData?.volume === "number" ? pos.tradeData.volume : undefined;
            if (!protocolVolume || !Number.isFinite(protocolVolume)) {
              return { success: false, error: "Position not found (or missing volume)" };
            }

            client.send(PT.CLOSE_POSITION_REQ, { ctidTraderAccountId, positionId: pid, volume: protocolVolume });
            const res = await client.waitForPayloadTypes(
              [PT.EXECUTION_EVENT, PT.ORDER_ERROR_EVENT, PT.ERROR_RES], 20000,
            );
            if (res.payloadType !== PT.EXECUTION_EVENT) return { success: false, error: openApiErrorMessage(res) };
            return { success: true, message: `Position ${position_id} closed` };
          }

          case "modify_trade": {
            if (!position_id) return { success: false, error: "Missing position_id" };
            const pid = Number(position_id);
            const amendPayload: Record<string, unknown> = { ctidTraderAccountId, positionId: pid };
            // SL/TP must be absolute price levels (not pips)
            // Convert to protocol format: multiply by 10^digits if needed
            if (stop_loss !== undefined && stop_loss !== null && stop_loss !== 0) {
              amendPayload.stopLoss = stop_loss;
            }
            if (take_profit !== undefined && take_profit !== null && take_profit !== 0) {
              amendPayload.takeProfit = take_profit;
            }

            console.log(`Modifying position ${pid}: SL=${stop_loss}, TP=${take_profit}`);
            client.send(PT.AMEND_POSITION_SLTP_REQ, amendPayload);
            const res = await client.waitForPayloadTypes(
              [PT.EXECUTION_EVENT, PT.ORDER_ERROR_EVENT, PT.ERROR_RES], 20000,
            );
            if (res.payloadType !== PT.EXECUTION_EVENT) return { success: false, error: openApiErrorMessage(res) };
            return { success: true, message: `Position ${position_id} SL/TP updated` };
          }

          case "get_spot_prices": {
            // Fetch current bid/ask for one or more symbols
            const symbols_input = (request as any).symbols as string[] | undefined;
            if (!symbols_input?.length) return { success: false, error: "Missing symbols array" };

            // Resolve all symbol IDs first
            const allSymbols = await fetchSymbolsList(client, ctidTraderAccountId);
            const resolved: Array<{ symbolId: number; symbolName: string; digits: number }> = [];
            for (const sym of symbols_input.slice(0, 10)) { // max 10
              const match = findSymbolMatch(sym, allSymbols);
              if (match) {
                const detail = await fetchSymbolDetail(client, ctidTraderAccountId, match.symbolId);
                resolved.push({ symbolId: match.symbolId, symbolName: match.symbolName, digits: detail.digits ?? 5 });
              }
            }
            if (!resolved.length) return { success: false, error: "No matching symbols found" };

            // Build digits map for all resolved symbols (already fetched above)
            const resolvedDigits = new Map<number, number>();
            for (const r of resolved) {
              resolvedDigits.set(r.symbolId, r.digits ?? 5);
            }

            // Subscribe to spots for all resolved symbols
            const spotResults: Record<string, { bid: number; ask: number }> = {};
            const pendingSymbolIds = new Set(resolved.map(r => r.symbolId));

            // Set up a spot event collector using addEventListener
            const spotPromise = new Promise<void>((resolveAll) => {
              const timeout = setTimeout(() => resolveAll(), 7000);
              (client as any).ws.addEventListener("message", (event: MessageEvent) => {
                try {
                  const raw = typeof event.data === "string" ? event.data : new TextDecoder().decode(new Uint8Array(event.data as ArrayBuffer));
                  const msg = JSON.parse(raw) as IncomingOpenApiMessage;
                  if (msg.payloadType === PT.SPOT_EVENT && msg.payload) {
                    const p = msg.payload as any;
                    const symId = p.symbolId as number;
                    if (pendingSymbolIds.has(symId)) {
                      const digits = resolvedDigits.get(symId) ?? 5;
                      const divisor = Math.pow(10, digits);
                      const name = resolved.find(r => r.symbolId === symId)?.symbolName ?? String(symId);
                      const bid = typeof p.bid === "number" ? p.bid / divisor : 0;
                      const ask = typeof p.ask === "number" ? p.ask / divisor : 0;
                      console.log(`get_spot_prices SPOT_EVENT sid=${symId} digits=${digits} bid=${bid} ask=${ask}`);
                      if (bid > 0) {
                        spotResults[name] = { bid, ask };
                        pendingSymbolIds.delete(symId);
                        if (pendingSymbolIds.size === 0) { clearTimeout(timeout); resolveAll(); }
                      }
                    }
                  }
                } catch {}
              });
            });

            // Subscribe to all symbols at once
            client.send(PT.SUBSCRIBE_SPOTS_REQ, { ctidTraderAccountId, symbolId: resolved.map(r => r.symbolId) });
            await spotPromise;

            return { success: true, prices: spotResults };
          }

          default:
            return { success: false, error: `Unknown action: ${action}` };
        }
      },
    });

    // Try with current token first, with smart retry logic
    let result: any;
    const MAX_RETRIES = 2;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        result = await runSession(decryptedAccessToken);
        break; // success
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        lastError = err instanceof Error ? err : new Error(errMsg);
        console.log(`Session attempt ${attempt + 1} failed: ${errMsg}`);

        const isTokenInvalid = errMsg.includes("CH_ACCESS_TOKEN_INVALID") || errMsg.includes("Invalid access token");
        const isRouteError = errMsg.includes("CANT_ROUTE_REQUEST");
        const isWsError = errMsg.includes("WS failed") || errMsg.includes("WS connect timeout") || errMsg.includes("WebSocket closed") || errMsg.includes("WebSocket error");

        if (isTokenInvalid && account.refresh_token && attempt === 0) {
          // Token invalid → try refresh once
          console.log("Access token invalid, attempting refresh...");
          try {
            decryptedAccessToken = await refreshAccessToken(account.refresh_token, supabase, account.id);
            continue; // retry with new token
          } catch (refreshErr) {
            console.error("Token refresh failed:", refreshErr);
            throw new Error("Access token invalid and refresh failed. Please go to Accounts tab, delete this account, and reconnect with fresh tokens from cTrader.");
          }
        } else if (isTokenInvalid) {
          throw new Error("Access token invalid. Please go to Accounts tab and reconnect with fresh tokens.");
        } else if (isRouteError && attempt < MAX_RETRIES) {
          // CANT_ROUTE is often a transient server issue - wait and retry same token
          console.log("CANT_ROUTE_REQUEST - waiting before retry...");
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        } else if (isWsError && attempt < MAX_RETRIES) {
          // WebSocket connection issues - retry
          console.log("WebSocket error - retrying...");
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        } else {
          throw lastError;
        }
      }
    }

    if (!result && lastError) throw lastError;

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("cTrader trade error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
