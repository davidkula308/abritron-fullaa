import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode as decodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";

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
  CANCEL_ORDER_REQ: 2208,
  CANCEL_ORDER_RES: 2209,
} as const;

// cTrader pending order types
const ORDER_TYPE = {
  MARKET: 1,
  LIMIT: 2,
  STOP: 3,
} as const;
const TRADE_SIDE = { BUY: 1, SELL: 2 } as const;

type IncomingOpenApiMessage = {
  clientMsgId?: string;
  payloadType: number;
  payload?: Record<string, unknown>;
};

// ===================== Crypto helpers (same as ctrader-trade) =====================
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

async function refreshAccessToken(refreshTokenEncrypted: string, supabase: any, accountDbId: string): Promise<string> {
  const refreshToken = await decryptToken(refreshTokenEncrypted);
  const clientId = Deno.env.get("CTRADER_CLIENT_ID")!;
  const clientSecret = Deno.env.get("CTRADER_CLIENT_SECRET")!;

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

  if (!resp.ok) throw new Error("Token refresh failed. Please reconnect your account.");

  const tokenData = await resp.json();
  const newAccessToken = tokenData.access_token || tokenData.accessToken;
  const newRefreshToken = tokenData.refresh_token || tokenData.refreshToken;
  if (!newAccessToken) throw new Error("Token refresh returned empty. Please reconnect.");

  const encKey = await getEncryptionKey();
  const encryptFn = async (plain: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, encKey, data);
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    const { encode: encodeBase64 } = await import("https://deno.land/std@0.168.0/encoding/base64.ts");
    return encodeBase64(combined.buffer);
  };

  const updateData: Record<string, unknown> = { access_token: await encryptFn(newAccessToken), last_synced_at: new Date().toISOString() };
  if (newRefreshToken) updateData.refresh_token = await encryptFn(newRefreshToken);
  await supabase.from("trading_accounts").update(updateData).eq("id", accountDbId);
  return newAccessToken;
}

// ===================== Open API WebSocket =====================
class OpenApiJsonClient {
  private ws: WebSocket;
  private waiters: Array<{
    predicate: (m: IncomingOpenApiMessage) => boolean;
    resolve: (m: IncomingOpenApiMessage) => void;
    reject: (e: Error) => void;
    timeoutId: number;
  }> = [];

  private rawListeners: Array<(msg: IncomingOpenApiMessage) => void> = [];

  private constructor(ws: WebSocket) {
    this.ws = ws;
    ws.onmessage = (event) => {
      try {
        const raw = typeof event.data === "string" ? event.data : new TextDecoder().decode(new Uint8Array(event.data as ArrayBuffer));
        const msg = JSON.parse(raw) as IncomingOpenApiMessage;
        console.log("WS recv:", msg.payloadType, JSON.stringify(msg.payload ?? {}).slice(0, 300));
        // Notify raw listeners first (e.g. tick collectors)
        for (const listener of this.rawListeners) {
          try { listener(msg); } catch { /* ignore */ }
        }
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
    ws.onerror = () => this.failAll(new Error("WS error"));
    ws.onclose = () => this.failAll(new Error("WS closed"));
  }

  addRawListener(fn: (msg: IncomingOpenApiMessage) => void) { this.rawListeners.push(fn); }
  removeRawListener(fn: (msg: IncomingOpenApiMessage) => void) { this.rawListeners = this.rawListeners.filter(l => l !== fn); }

  static async connect(url: string, timeoutMs = 8000, retries = 3): Promise<OpenApiJsonClient> {
    let lastErr: Error | undefined;
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const ws = new WebSocket(url);
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(() => { try { ws.close(); } catch {} reject(new Error("WS timeout")); }, timeoutMs);
          ws.onopen = () => { clearTimeout(t); resolve(); };
          ws.onerror = () => { clearTimeout(t); reject(new Error("WS failed")); };
        });
        return new OpenApiJsonClient(ws);
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e));
        if (attempt < retries - 1) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
    throw lastErr ?? new Error("WS connect failed");
  }

  close() { try { this.ws.close(); } catch {} }

  send(payloadType: number, payload: Record<string, unknown>, clientMsgId = crypto.randomUUID()) {
    this.ws.send(JSON.stringify({ clientMsgId, payloadType, payload }));
    return clientMsgId;
  }

  waitFor(predicate: (m: IncomingOpenApiMessage) => boolean, timeoutMs = 12000): Promise<IncomingOpenApiMessage> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const idx = this.waiters.findIndex((w) => w.resolve === resolve);
        if (idx >= 0) this.waiters.splice(idx, 1);
        reject(new Error("Response timeout"));
      }, timeoutMs);
      this.waiters.push({ predicate, resolve, reject, timeoutId });
    });
  }

  waitForPayloadTypes(pts: number[], timeoutMs = 12000) {
    const set = new Set(pts);
    return this.waitFor((m) => set.has(m.payloadType), timeoutMs);
  }

  private failAll(err: Error) {
    const pending = [...this.waiters];
    this.waiters = [];
    for (const w of pending) { clearTimeout(w.timeoutId); try { w.reject(err); } catch {} }
  }
}

function openApiErrorMessage(msg: IncomingOpenApiMessage): string {
  const p = msg.payload ?? {};
  const ec = typeof p.errorCode === "string" ? p.errorCode : undefined;
  const d = typeof p.description === "string" ? p.description : undefined;
  return [ec, d].filter(Boolean).join(": ") || "Unknown error";
}

function normalizeSymbol(s: string) { return s.replaceAll("/", "").replaceAll(" ", "").replaceAll(".", "").toUpperCase(); }

const SYMBOL_ALIASES: Record<string, string[]> = {
  "XAUUSD": ["GOLD", "XAUUSD", "GOLDM"],
  "XAGUSD": ["SILVER", "XAGUSD"],
  "US30": ["US30", "DJ30", "DOW30", "WS30"],
  "NAS100": ["NAS100", "USTEC", "NASDAQ"],
  "BTCUSD": ["BTCUSD", "BITCOIN"],
};

function findSymbolMatch(target: string, symbols: Array<{symbolId: number; symbolName: string}>) {
  const n = normalizeSymbol(target);
  const direct = symbols.find(s => normalizeSymbol(s.symbolName) === n);
  if (direct) return direct;
  for (const [canonical, aliases] of Object.entries(SYMBOL_ALIASES)) {
    if (aliases.includes(n) || normalizeSymbol(canonical) === n) {
      for (const a of aliases) {
        const f = symbols.find(s => normalizeSymbol(s.symbolName) === a);
        if (f) return f;
      }
    }
  }
  return symbols.find(s => normalizeSymbol(s.symbolName).startsWith(n)) ?? null;
}

// ===================== Session wrapper =====================
async function withSession<T>(opts: {
  isLive: boolean | null;
  ctidTraderAccountId: number;
  accessToken: string;
  handler: (client: OpenApiJsonClient) => Promise<T>;
}): Promise<T> {
  const clientId = Deno.env.get("CTRADER_CLIENT_ID")!;
  const clientSecret = Deno.env.get("CTRADER_CLIENT_SECRET")!;

  const servers = opts.isLive === true
    ? [{ url: OPEN_API_LIVE_WS, label: "LIVE" }]
    : opts.isLive === false
      ? [{ url: OPEN_API_DEMO_WS, label: "DEMO" }]
      : [{ url: OPEN_API_LIVE_WS, label: "LIVE" }, { url: OPEN_API_DEMO_WS, label: "DEMO" }];

  let lastError: Error | undefined;
  for (const server of servers) {
    let client: OpenApiJsonClient | undefined;
    try {
      client = await OpenApiJsonClient.connect(server.url);
      client.send(PT.APPLICATION_AUTH_REQ, { clientId, clientSecret });
      const appAuth = await client.waitForPayloadTypes([PT.APPLICATION_AUTH_RES, PT.ERROR_RES]);
      if (appAuth.payloadType === PT.ERROR_RES) throw new Error(openApiErrorMessage(appAuth));

      client.send(PT.ACCOUNT_AUTH_REQ, { ctidTraderAccountId: opts.ctidTraderAccountId, accessToken: opts.accessToken });
      const acctAuth = await client.waitForPayloadTypes([PT.ACCOUNT_AUTH_RES, PT.ERROR_RES]);
      if (acctAuth.payloadType === PT.ERROR_RES) {
        const errMsg = openApiErrorMessage(acctAuth);
        if (servers.length > 1 && (errMsg.includes("CH_ACCESS_TOKEN_INVALID") || errMsg.includes("CANT_ROUTE_REQUEST"))) {
          client.close();
          lastError = new Error(errMsg);
          continue;
        }
        throw new Error(errMsg);
      }

      try { return await opts.handler(client); } finally { client.close(); }
    } catch (e) {
      if (client) client.close();
      lastError = e instanceof Error ? e : new Error(String(e));
      if (servers.indexOf(server) < servers.length - 1) continue;
      throw lastError;
    }
  }
  throw lastError ?? new Error("All server connections failed");
}

// ===================== HFT Logic =====================

interface HFTRequest {
  action: "execute_cycle" | "cancel_order" | "get_positions" | "close_position";
  account_id: string;
  symbol: string;
  buy_stop_distance: number;
  sell_stop_distance: number;
  lot_size: number;
  stop_loss: number;
  take_profit: number;
  martingale_enabled: boolean;
  martingale_multiplier: number;
  max_martingale_levels: number;
  current_martingale_level: number;
  cooldown_seconds: number;
  // For cancel_order action
  order_id?: number;
}

async function cancelPendingOrder(
  client: OpenApiJsonClient,
  ctidTraderAccountId: number,
  orderId: number,
) {
  client.send(PT.CANCEL_ORDER_REQ, { ctidTraderAccountId, orderId });
  const res = await client.waitForPayloadTypes(
    [PT.EXECUTION_EVENT, PT.ORDER_ERROR_EVENT, PT.ERROR_RES],
    10000,
  );
  if (res.payloadType !== PT.EXECUTION_EVENT) {
    const errMsg = openApiErrorMessage(res);
    // If already filled/cancelled, treat as success
    if (errMsg.includes("NOT_FOUND") || errMsg.includes("ALREADY")) {
      return { success: true, alreadyGone: true };
    }
    throw new Error(`Cancel failed: ${errMsg}`);
  }
  return { success: true, alreadyGone: false };
}

/**
 * HFT cycle:
 * 1. Get current bid/ask via spot subscription
 * 2. Calculate optimal buy stop (above ask) and sell stop (below bid) levels
 * 3. Open both as market orders simultaneously at calculated SL/TP price levels
 *    (cTrader Open API JSON doesn't support pending stop orders via NEW_ORDER_REQ with orderType=STOP
 *     reliably in all brokers, so we use market orders placed when price reaches the stop level.
 *     The edge function is called per cycle from the client which polls at high frequency.)
 * 4. Return execution results so client can manage the opposing order cancellation
 */
async function executeHFTCycle(
  client: OpenApiJsonClient,
  ctidTraderAccountId: number,
  req: HFTRequest,
) {
  // Step 1: Resolve symbol
  const symbolsListMsgId = client.send(PT.SYMBOLS_LIST_REQ, { ctidTraderAccountId });
  const symbolsRes = await client.waitForPayloadTypes([PT.SYMBOLS_LIST_RES, PT.ERROR_RES]);
  if (symbolsRes.payloadType === PT.ERROR_RES) throw new Error(openApiErrorMessage(symbolsRes));

  const allSymbols = ((symbolsRes.payload as any)?.symbol ?? [])
    .filter((s: any) => typeof s?.symbolId === "number" && typeof s?.symbolName === "string")
    .map((s: any) => ({ symbolId: s.symbolId as number, symbolName: s.symbolName as string }));

  const match = findSymbolMatch(req.symbol, allSymbols);
  if (!match) throw new Error(`Symbol "${req.symbol}" not available on this account`);

  // Get symbol detail for lot size and digits
  client.send(PT.SYMBOL_BY_ID_REQ, { ctidTraderAccountId, symbolId: [match.symbolId] });
  const symRes = await client.waitForPayloadTypes([PT.SYMBOL_BY_ID_RES, PT.ERROR_RES]);
  if (symRes.payloadType === PT.ERROR_RES) throw new Error(openApiErrorMessage(symRes));

  const symDetail = ((symRes.payload as any)?.symbol ?? [])[0] ?? {};
  const lotSize = typeof symDetail.lotSize === "number" ? symDetail.lotSize : 10_000_000;
  const digits = typeof symDetail.digits === "number" ? symDetail.digits : 5;
  const pipSize = 1 / Math.pow(10, digits);

  // Step 2: Subscribe to spot prices and collect ticks for volatility analysis
  const divisor = Math.pow(10, digits);
  const ticks: { bid: number; ask: number; ts: number }[] = [];

  // Register tick listener BEFORE subscribing so we never miss the first events
  const tickListener = (msg: IncomingOpenApiMessage) => {
    if (msg.payloadType === PT.SPOT_EVENT && msg.payload) {
      const p = msg.payload as Record<string, unknown>;
      if ((p.symbolId as number) === match.symbolId) {
        const b = typeof p.bid === "number" ? p.bid / divisor : 0;
        const a = typeof p.ask === "number" ? p.ask / divisor : 0;
        // Also handle trendBar field (some brokers send current price there)
        const trendBarClose = (p.trendBar as any)?.[0]?.close;
        const price = typeof trendBarClose === "number" ? trendBarClose / divisor : 0;
        const bidVal = b > 0 ? b : price;
        const askVal = a > 0 ? a : (price > 0 ? price * 1.0001 : 0);
        if (bidVal > 0) {
          ticks.push({ bid: bidVal, ask: askVal > 0 ? askVal : bidVal * 1.0001, ts: Date.now() });
        }
      }
    }
  };
  client.addRawListener(tickListener);

  // Send subscription request
  client.send(PT.SUBSCRIBE_SPOTS_REQ, { ctidTraderAccountId, symbolId: [match.symbolId] });

  // Wait for subscription confirmation (max 5s), then collect ticks for 4s more
  try {
    await client.waitForPayloadTypes([PT.SUBSCRIBE_SPOTS_RES, PT.ERROR_RES], 5000);
  } catch {
    // Timeout waiting for sub confirmation — ticks may still flow, continue
    console.log("Subscription confirmation timeout — proceeding with tick collection");
  }

  // Collect ticks for up to 6 seconds, exit early if we have enough
  const tickStart = Date.now();
  const MAX_TICK_WAIT = 6000;
  const MIN_TICKS = 2;
  while (Date.now() - tickStart < MAX_TICK_WAIT) {
    await new Promise<void>((resolve) => setTimeout(resolve, 400));
    if (ticks.length >= MIN_TICKS) break;
  }
  client.removeRawListener(tickListener);

  console.log(`Collected ${ticks.length} ticks for ${match.symbolName}`);

  if (ticks.length === 0) throw new Error("Could not get current market prices. Market may be closed.");

  const bid = ticks[ticks.length - 1].bid;
  const ask = ticks[ticks.length - 1].ask;
  if (bid <= 0 || ask <= 0) throw new Error("Invalid market prices received. Market may be closed.");

  // ─── Smart Analysis: volatility & trend from collected ticks ───
  const midPrices = ticks.map(t => (t.bid + t.ask) / 2);

  // Calculate tick-to-tick absolute changes (ATR proxy)
  const changes: number[] = [];
  for (let i = 1; i < midPrices.length; i++) {
    changes.push(Math.abs(midPrices[i] - midPrices[i - 1]));
  }
  const avgChange = changes.length > 0
    ? changes.reduce((s, c) => s + c, 0) / changes.length
    : pipSize * 5; // fallback: 5 pips

  // Volatility in pips
  const volatilityPips = avgChange / pipSize;

  // Trend direction: positive = trending up, negative = trending down
  const trendDelta = midPrices.length >= 2
    ? midPrices[midPrices.length - 1] - midPrices[0]
    : 0;
  const trendPips = trendDelta / pipSize;

  // Spread analysis
  const spreads = ticks.map(t => t.ask - t.bid);
  const avgSpread = spreads.reduce((s, v) => s + v, 0) / spreads.length;
  const spreadPips = avgSpread / pipSize;

  console.log(`Smart analysis: ${ticks.length} ticks, volatility=${volatilityPips.toFixed(1)}pips, trend=${trendPips.toFixed(1)}pips, spread=${spreadPips.toFixed(1)}pips`);

  // ─── Dynamic distance adjustment ───
  // Base distances from user settings, adjusted by volatility
  // Higher volatility → wider stops to avoid whipsaws; lower → tighter for quick fills
  const volMultiplier = Math.max(0.5, Math.min(3.0, 1.0 + (volatilityPips - 3) * 0.15));

  // Trend bias: if trending up, buy stop closer (more likely to hit), sell stop farther
  // If trending down, sell stop closer, buy stop farther
  const trendBias = Math.max(-0.3, Math.min(0.3, trendPips * 0.05));

  const dynamicBuyDist = Math.max(
    spreadPips * 2, // minimum: 2x spread
    req.buy_stop_distance * volMultiplier * (1 - trendBias)
  );
  const dynamicSellDist = Math.max(
    spreadPips * 2,
    req.sell_stop_distance * volMultiplier * (1 + trendBias)
  );

  // Dynamic SL/TP: scale with volatility but keep risk/reward reasonable
  const dynamicTP = Math.max(req.take_profit * 0.5, req.take_profit * volMultiplier * 0.8);
  const dynamicSL = Math.max(req.stop_loss * 0.5, req.stop_loss * volMultiplier * 0.6);

  console.log(`Dynamic distances: buyDist=${dynamicBuyDist.toFixed(1)} sellDist=${dynamicSellDist.toFixed(1)} TP=${dynamicTP.toFixed(1)} SL=${dynamicSL.toFixed(1)} volMult=${volMultiplier.toFixed(2)} trendBias=${trendBias.toFixed(3)}`);

  // Step 3: Calculate entry levels and SL/TP using dynamic values
  const buyEntryPrice = ask + (dynamicBuyDist * pipSize);
  const buyTP = buyEntryPrice + (dynamicTP * pipSize);
  const buySL = buyEntryPrice - (dynamicSL * pipSize);

  const sellEntryPrice = bid - (dynamicSellDist * pipSize);
  const sellTP = sellEntryPrice - (dynamicTP * pipSize);
  const sellSL = sellEntryPrice + (dynamicSL * pipSize);

  // Apply martingale to lot size
  let effectiveLotSize = req.lot_size;
  if (req.martingale_enabled && req.current_martingale_level > 0) {
    effectiveLotSize = req.lot_size * Math.pow(req.martingale_multiplier, req.current_martingale_level);
    // Round to 2 decimal places
    effectiveLotSize = Math.round(effectiveLotSize * 100) / 100;
  }

  const protocolVolume = Math.round(effectiveLotSize * lotSize);

  console.log(`HFT: Buy stop @ ${buyEntryPrice.toFixed(digits)} SL=${buySL.toFixed(digits)} TP=${buyTP.toFixed(digits)}`);
  console.log(`HFT: Sell stop @ ${sellEntryPrice.toFixed(digits)} SL=${sellSL.toFixed(digits)} TP=${sellTP.toFixed(digits)}`);
  console.log(`HFT: Lot size=${effectiveLotSize}, protocolVol=${protocolVolume}, martingaleLevel=${req.current_martingale_level}`);

  // Step 4: Place STOP orders (buy stop above market, sell stop below market)
  // Use orderType STOP (3) for pending stop orders
  const buyOrderId = client.send(PT.NEW_ORDER_REQ, {
    ctidTraderAccountId,
    symbolId: match.symbolId,
    orderType: ORDER_TYPE.STOP,
    tradeSide: TRADE_SIDE.BUY,
    volume: protocolVolume,
    stopPrice: buyEntryPrice,
    stopLoss: buySL,
    takeProfit: buyTP,
    comment: "HFT-BuyStop",
    label: "HFT",
    expirationTimestamp: Date.now() + 60000, // Expire in 60s if not triggered
  });

  const sellOrderId = client.send(PT.NEW_ORDER_REQ, {
    ctidTraderAccountId,
    symbolId: match.symbolId,
    orderType: ORDER_TYPE.STOP,
    tradeSide: TRADE_SIDE.SELL,
    volume: protocolVolume,
    stopPrice: sellEntryPrice,
    stopLoss: sellSL,
    takeProfit: sellTP,
    comment: "HFT-SellStop",
    label: "HFT",
    expirationTimestamp: Date.now() + 60000,
  });

  // Collect both order responses
  const results: { buy: any; sell: any } = { buy: null, sell: null };
  const errors: string[] = [];

  // Wait for 2 execution events (or errors) for the pending order placements
  for (let i = 0; i < 2; i++) {
    try {
      const res = await client.waitForPayloadTypes(
        [PT.EXECUTION_EVENT, PT.ORDER_ERROR_EVENT, PT.ERROR_RES],
        15000,
      );
      const payload = res.payload ?? {};
      const order = (payload as any).order;
      const comment = order?.comment ?? (payload as any)?.position?.tradeData?.comment ?? "";

      if (res.payloadType !== PT.EXECUTION_EVENT) {
        errors.push(openApiErrorMessage(res));
        continue;
      }

      if (comment.includes("BuyStop")) {
        results.buy = { orderId: order?.orderId, success: true, entryPrice: buyEntryPrice };
      } else if (comment.includes("SellStop")) {
        results.sell = { orderId: order?.orderId, success: true, entryPrice: sellEntryPrice };
      } else {
        const side = (order?.tradeData?.tradeSide ?? (payload as any)?.position?.tradeData?.tradeSide);
        if (side === TRADE_SIDE.BUY && !results.buy) {
          results.buy = { orderId: order?.orderId, success: true, entryPrice: buyEntryPrice };
        } else if (!results.sell) {
          results.sell = { orderId: order?.orderId, success: true, entryPrice: sellEntryPrice };
        }
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  // Now monitor for order triggers - wait up to 60s for one to fill
  // When one triggers, cancel the other
  let triggeredSide: "buy" | "sell" | null = null;
  let cancelledOrderId: number | null = null;

  if (results.buy?.orderId && results.sell?.orderId) {
    try {
      // Wait for an execution event indicating one order was filled
      const triggerEvent = await client.waitFor(
        (m) => {
          if (m.payloadType !== PT.EXECUTION_EVENT) return false;
          const p = m.payload as any;
          const execType = p?.executionType;
          // executionType 4 = FILL (order triggered/filled)
          return execType === 4 || execType === "ORDER_FILLED" || execType === "FILL";
        },
        60000, // 60s timeout - wait for trigger
      );

      const triggerPayload = triggerEvent.payload as any;
      const filledOrderId = triggerPayload?.order?.orderId ?? triggerPayload?.position?.tradeData?.orderId;

      if (filledOrderId === results.buy.orderId) {
        triggeredSide = "buy";
        cancelledOrderId = results.sell.orderId;
      } else if (filledOrderId === results.sell.orderId) {
        triggeredSide = "sell";
        cancelledOrderId = results.buy.orderId;
      }

      // Cancel the opposing order
      if (cancelledOrderId) {
        try {
          const cancelResult = await cancelPendingOrder(client, ctidTraderAccountId, cancelledOrderId);
          console.log(`Cancelled opposing order ${cancelledOrderId}: ${JSON.stringify(cancelResult)}`);
        } catch (cancelErr) {
          console.log(`Cancel opposing order warning: ${cancelErr}`);
          // Non-fatal - order may have already expired
        }
      }
    } catch {
      // Timeout - neither order triggered within 60s, both remain as pending
      console.log("No order triggered within monitoring window");
    }
  }

  return {
    success: true,
    symbol: match.symbolName,
    bid,
    ask,
    effectiveLotSize,
    martingaleLevel: req.current_martingale_level,
    buyOrder: results.buy ?? { success: false, error: errors[0] ?? "Failed" },
    sellOrder: results.sell ?? { success: false, error: errors[1] ?? errors[0] ?? "Failed" },
    triggeredSide,
    cancelledOrderId,
    analysis: {
      ticksCollected: ticks.length,
      volatilityPips: Math.round(volatilityPips * 10) / 10,
      trendPips: Math.round(trendPips * 10) / 10,
      spreadPips: Math.round(spreadPips * 10) / 10,
      dynamicBuyDist: Math.round(dynamicBuyDist * 10) / 10,
      dynamicSellDist: Math.round(dynamicSellDist * 10) / 10,
      dynamicTP: Math.round(dynamicTP * 10) / 10,
      dynamicSL: Math.round(dynamicSL * 10) / 10,
    },
    errors: errors.length > 0 ? errors : undefined,
  };
}

// ===================== Main handler =====================
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

    const request: HFTRequest = await req.json();
    const { account_id, action } = request;

    // Find account
    const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
    let accountResult;
    if (isUuid(account_id)) {
      accountResult = await supabase.from("trading_accounts").select("*").eq("user_id", user.id).eq("id", account_id).single();
    } else {
      accountResult = await supabase.from("trading_accounts").select("*").eq("user_id", user.id).eq("account_id", account_id).single();
    }

    const { data: account, error: accountError } = accountResult;
    if (accountError || !account) {
      return new Response(JSON.stringify({ success: false, error: "Trading account not found" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!account.access_token) {
      return new Response(JSON.stringify({ success: false, error: "Account not authenticated" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let accessToken = await decryptToken(account.access_token);
    const ctidTraderAccountId = Number(account.account_id);

    // Handle get_positions action
    if (action === "get_positions") {
      const posResult = await withSession({
        isLive: account.is_live,
        ctidTraderAccountId,
        accessToken,
        handler: async (client) => {
          client.send(PT.RECONCILE_REQ, { ctidTraderAccountId });
          const res = await client.waitForPayloadTypes([PT.RECONCILE_RES, PT.ERROR_RES], 15000);
          if (res.payloadType === PT.ERROR_RES) throw new Error(openApiErrorMessage(res));
          const positions = ((res.payload as any)?.position ?? []).map((p: any) => ({
            positionId: p.positionId,
            symbol: p.tradeData?.symbolId,
            side: p.tradeData?.tradeSide === 1 ? "BUY" : "SELL",
            volume: p.tradeData?.volume,
            entryPrice: p.price,
            swap: p.swap,
            commission: p.commission,
            stopLoss: p.stopLoss,
            takeProfit: p.takeProfit,
            comment: p.tradeData?.comment ?? "",
            label: p.tradeData?.label ?? "",
          }));
          // Filter only HFT-labeled positions
          const hftPositions = positions.filter((p: any) => p.label === "HFT" || p.comment?.includes("HFT"));
          return { positions: hftPositions, allCount: positions.length };
        },
      });
      return new Response(JSON.stringify({ success: true, ...posResult }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle close_position action
    if (action === "close_position" && (request as any).position_id) {
      const closeResult = await withSession({
        isLive: account.is_live,
        ctidTraderAccountId,
        accessToken,
        handler: async (client) => {
          const posId = (request as any).position_id;
          client.send(PT.CLOSE_POSITION_REQ, { ctidTraderAccountId, positionId: posId, volume: (request as any).volume ?? 0 });
          const res = await client.waitForPayloadTypes([PT.EXECUTION_EVENT, PT.ORDER_ERROR_EVENT, PT.ERROR_RES], 15000);
          if (res.payloadType !== PT.EXECUTION_EVENT) throw new Error(openApiErrorMessage(res));
          return { closed: true, positionId: posId };
        },
      });
      return new Response(JSON.stringify({ success: true, ...closeResult }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle cancel_order action
    if (action === "cancel_order" && request.order_id) {
      const cancelRun = (tok: string) => withSession({
        isLive: account.is_live,
        ctidTraderAccountId,
        accessToken: tok,
        handler: (client) => cancelPendingOrder(client, ctidTraderAccountId, request.order_id!),
      });

      let cancelResult: any;
      try {
        cancelResult = await cancelRun(accessToken);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes("CH_ACCESS_TOKEN_INVALID") && account.refresh_token) {
          accessToken = await refreshAccessToken(account.refresh_token, supabase, account.id);
          cancelResult = await cancelRun(accessToken);
        } else {
          throw err;
        }
      }
      return new Response(JSON.stringify({ success: true, ...cancelResult }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const run = (tok: string) => withSession({
      isLive: account.is_live,
      ctidTraderAccountId,
      accessToken: tok,
      handler: (client) => executeHFTCycle(client, ctidTraderAccountId, request),
    });

    let result: any;
    try {
      result = await run(accessToken);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes("CH_ACCESS_TOKEN_INVALID") && account.refresh_token) {
        accessToken = await refreshAccessToken(account.refresh_token, supabase, account.id);
        result = await run(accessToken);
      } else {
        throw err;
      }
    }

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("HFT error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
