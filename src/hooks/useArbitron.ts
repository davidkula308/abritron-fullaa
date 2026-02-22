import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTradingAccounts } from './useTradingAccounts';
import { useBots } from './useBots';
import { useTrade } from './useTrade';
import { useToast } from './use-toast';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/arbitron-chat`;
const LS_CHAT_KEY = "arbitron_chat_history";

function loadChatFromStorage(): ChatMessage[] {
  try {
    const saved = localStorage.getItem(LS_CHAT_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return [];
}

function saveChatToStorage(messages: ChatMessage[]) {
  try {
    localStorage.setItem(LS_CHAT_KEY, JSON.stringify(messages));
  } catch {}
}

export const useArbitron = (selectedAccountId?: string) => {
  const [messages, setMessages] = useState<ChatMessage[]>(loadChatFromStorage);
  const [isLoading, setIsLoading] = useState(false);
  const { accounts } = useTradingAccounts();
  const { bots } = useBots();
  const { openTrade } = useTrade();
  const { toast } = useToast();

  // Resolve selected account — prefer selectedAccountId, fallback to first demo, then first account
  const selectedAccount = accounts.find(a => a.id === selectedAccountId) 
    || accounts.find(a => a.id === selectedAccountId || a.account_id === selectedAccountId)
    || accounts[0];

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    saveChatToStorage(messages);
  }, [messages]);

  const extractTradeBlocks = (text: string) => {
    const regex = /```trade\s*\n([\s\S]*?)```/g;
    const trades: any[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      try { trades.push(JSON.parse(match[1].trim())); } catch {}
    }
    return trades;
  };

  const extractEAStrategyBlocks = (text: string) => {
    const regex = /```ea_strategy\s*\n([\s\S]*?)```/g;
    const strategies: any[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      try { strategies.push(JSON.parse(match[1].trim())); } catch {}
    }
    return strategies;
  };

  const executeTradeFromAI = useCallback(async (trade: any) => {
    if (!selectedAccount) {
      toast({ title: "No Account", description: "Connect a trading account first", variant: "destructive" });
      return;
    }
    const action = String(trade.action || "").toUpperCase();
    // Map pending order types to the right side
    let side: "BUY" | "SELL";
    let orderType: "MARKET" | "BUY_STOP" | "SELL_STOP" | "BUY_LIMIT" | "SELL_LIMIT" = "MARKET";
    if (action === "BUY" || action === "BUY_MARKET") { side = "BUY"; orderType = "MARKET"; }
    else if (action === "SELL" || action === "SELL_MARKET") { side = "SELL"; orderType = "MARKET"; }
    else if (action === "BUY_STOP") { side = "BUY"; orderType = "BUY_STOP"; }
    else if (action === "SELL_STOP") { side = "SELL"; orderType = "SELL_STOP"; }
    else if (action === "BUY_LIMIT") { side = "BUY"; orderType = "BUY_LIMIT"; }
    else if (action === "SELL_LIMIT") { side = "SELL"; orderType = "SELL_LIMIT"; }
    else {
      toast({ title: "Invalid Action", description: `Unsupported action: ${trade.action}`, variant: "destructive" });
      return;
    }
    try {
      await openTrade({
        accountId: selectedAccount.account_id,
        symbol: trade.symbol,
        volume: trade.volume || 0.01,
        side,
        orderType,
        entryPrice: trade.entryPrice,
        stopLoss: trade.stopLoss,
        takeProfit: trade.takeProfit,
      });
      toast({ title: "Trade Executed", description: `${trade.action} ${trade.volume} ${trade.symbol}` });
    } catch (err) {
      toast({ title: "Trade Failed", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    }
  }, [selectedAccount, openTrade, toast]);

  const executeEAStrategy = useCallback(async (strategy: any) => {
    if (!selectedAccount) {
      toast({ title: "No Account", description: "Connect a trading account first", variant: "destructive" });
      return;
    }
    const trades = strategy.trades || [];
    if (trades.length === 0) return;
    toast({ title: "EA Strategy", description: `Executing ${trades.length} trades for ${strategy.symbol}...` });
    for (let i = 0; i < trades.length; i++) {
      const t = { ...trades[i], symbol: trades[i].symbol || strategy.symbol };
      await executeTradeFromAI(t);
      // Stagger trades by 500ms so they don't all fire simultaneously
      if (i < trades.length - 1) await new Promise(r => setTimeout(r, 500));
    }
  }, [selectedAccount, executeTradeFromAI, toast]);

  const sendMessage = useCallback(async (input: string) => {
    const userMsg: ChatMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    let assistantSoFar = '';

    try {
      const appContext = {
        accounts: accounts.map(a => ({
          account_id: a.account_id,
          broker_name: a.broker_name,
          is_live: a.is_live,
          balance: a.balance,
          currency: a.currency,
        })),
        selectedAccount: selectedAccount ? {
          account_id: selectedAccount.account_id,
          broker_name: selectedAccount.broker_name,
          is_live: selectedAccount.is_live,
          balance: selectedAccount.balance,
          currency: selectedAccount.currency,
        } : null,
        bots: bots.map(b => ({
          name: b.name,
          status: b.status,
          selectedPair: b.selectedPair,
          type: b.type,
        })),
      };

      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ messages: [...messages, userMsg], appContext }),
      });

      if (!resp.ok || !resp.body) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed (${resp.status})`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let streamDone = false;

      const upsertAssistant = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
          }
          return [...prev, { role: 'assistant', content: assistantSoFar }];
        });
      };

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      const trades = extractTradeBlocks(assistantSoFar);
      for (const trade of trades) {
        await executeTradeFromAI(trade);
      }
      const eaStrategies = extractEAStrategyBlocks(assistantSoFar);
      for (const strategy of eaStrategies) {
        await executeEAStrategy(strategy);
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Arbitron Error", description: e instanceof Error ? e.message : "Failed to reach AI", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [messages, accounts, bots, selectedAccount, executeTradeFromAI, executeEAStrategy, toast]);

  const clearChat = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(LS_CHAT_KEY);
  }, []);

  return { messages, isLoading, sendMessage, clearChat };
};
