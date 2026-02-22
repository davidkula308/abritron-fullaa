import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface HFTSettings {
  pair: string;
  timeframe: string;
  accountId: string;
  buyStopDistance: number;
  sellStopDistance: number;
  lotSize: number;
  stopLoss: number;
  takeProfit: number;
  martingaleEnabled: boolean;
  martingaleMultiplier: number;
  maxMartingaleLevels: number;
  cooldownSeconds: number;
  maxDailyTrades: number;
}

export interface HFTAnalysis {
  ticksCollected: number;
  volatilityPips: number;
  trendPips: number;
  spreadPips: number;
  dynamicBuyDist: number;
  dynamicSellDist: number;
  dynamicTP: number;
  dynamicSL: number;
}

export interface HFTPosition {
  positionId: number;
  symbol: number;
  side: string;
  volume: number;
  entryPrice: number;
  swap: number;
  commission: number;
  stopLoss: number;
  takeProfit: number;
  comment: string;
  label: string;
}

export interface HFTStats {
  tradesOpened: number;
  wins: number;
  losses: number;
  currentMartingaleLevel: number;
  lastCycleResult: string | null;
  activeBuyOrderId: string | null;
  activeSellOrderId: string | null;
  lastAnalysis: HFTAnalysis | null;
}

export const defaultHFTSettings: HFTSettings = {
  pair: "XAUUSD",
  timeframe: "M1",
  accountId: "",
  buyStopDistance: 50,
  sellStopDistance: 50,
  lotSize: 0.01,
  stopLoss: 30,
  takeProfit: 50,
  martingaleEnabled: false,
  martingaleMultiplier: 2.0,
  maxMartingaleLevels: 3,
  cooldownSeconds: 5,
  maxDailyTrades: 50,
};

export const useHFT = () => {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState<HFTStats>({
    tradesOpened: 0,
    wins: 0,
    losses: 0,
    currentMartingaleLevel: 0,
    lastCycleResult: null,
    activeBuyOrderId: null,
    activeSellOrderId: null,
    lastAnalysis: null,
  });
  const [isExecuting, setIsExecuting] = useState(false);
  const [positions, setPositions] = useState<HFTPosition[]>([]);
  const [isLoadingPositions, setIsLoadingPositions] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const settingsRef = useRef<HFTSettings>(defaultHFTSettings);
  const statsRef = useRef(stats);
  statsRef.current = stats;

  const fetchPositions = useCallback(async (accountId: string) => {
    if (!accountId) return;
    setIsLoadingPositions(true);
    try {
      const { data, error } = await supabase.functions.invoke('hft-trade', {
        body: { action: 'get_positions', account_id: accountId },
      });
      if (error) throw error;
      if (data?.success) {
        setPositions(data.positions ?? []);
      }
    } catch (err) {
      console.error('Failed to fetch HFT positions:', err);
    } finally {
      setIsLoadingPositions(false);
    }
  }, []);

  const closePosition = useCallback(async (accountId: string, positionId: number, volume: number) => {
    try {
      const { data, error } = await supabase.functions.invoke('hft-trade', {
        body: { action: 'close_position', account_id: accountId, position_id: positionId, volume },
      });
      if (error) throw error;
      if (data?.success) {
        toast({ title: "Position Closed", description: `Position #${positionId} closed` });
        setPositions(prev => prev.filter(p => p.positionId !== positionId));
      } else {
        toast({ title: "Close Failed", description: data?.error ?? "Unknown error", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  }, [toast]);

  const executeCycle = useCallback(async () => {
    const s = settingsRef.current;
    const currentStats = statsRef.current;

    if (currentStats.tradesOpened >= s.maxDailyTrades) {
      toast({ title: "Daily limit reached", description: `Stopped after ${s.maxDailyTrades} trades` });
      stopBot();
      return;
    }

    setIsExecuting(true);
    try {
      const { data, error } = await supabase.functions.invoke('hft-trade', {
        body: {
          action: 'execute_cycle',
          account_id: s.accountId,
          symbol: s.pair,
          buy_stop_distance: s.buyStopDistance,
          sell_stop_distance: s.sellStopDistance,
          lot_size: s.lotSize,
          stop_loss: s.stopLoss,
          take_profit: s.takeProfit,
          martingale_enabled: s.martingaleEnabled,
          martingale_multiplier: s.martingaleMultiplier,
          max_martingale_levels: s.maxMartingaleLevels,
          current_martingale_level: currentStats.currentMartingaleLevel,
          cooldown_seconds: s.cooldownSeconds,
        },
      });

      if (error) throw error;

      if (data?.success) {
        const triggered = data.triggeredSide;
        const resultText = triggered
          ? `${triggered.toUpperCase()} triggered @ ${triggered === 'buy' ? data.buyOrder?.entryPrice?.toFixed(2) : data.sellOrder?.entryPrice?.toFixed(2)} | Opposing cancelled`
          : `Buy @ ${data.buyOrder?.entryPrice?.toFixed(2) ?? '?'} | Sell @ ${data.sellOrder?.entryPrice?.toFixed(2) ?? '?'}`;

        setStats(prev => ({
          ...prev,
          tradesOpened: prev.tradesOpened + 1,
          wins: triggered ? prev.wins + 1 : prev.wins,
          lastCycleResult: resultText,
          activeBuyOrderId: data.buyOrder?.orderId ?? null,
          activeSellOrderId: data.sellOrder?.orderId ?? null,
          lastAnalysis: data.analysis ?? null,
        }));

        if (triggered && s.martingaleEnabled) {
          setStats(prev => ({ ...prev, currentMartingaleLevel: 0 }));
        }

        // Refresh positions after trade
        fetchPositions(s.accountId);
      } else {
        const errMsg = data?.error ?? 'Unknown error';
        console.error('HFT cycle error:', errMsg);
        setStats(prev => ({ ...prev, lastCycleResult: `Error: ${errMsg}` }));

        if (s.martingaleEnabled && currentStats.currentMartingaleLevel < s.maxMartingaleLevels) {
          setStats(prev => ({
            ...prev,
            losses: prev.losses + 1,
            currentMartingaleLevel: prev.currentMartingaleLevel + 1,
          }));
        }
      }
    } catch (err) {
      console.error('HFT execution error:', err);
      setStats(prev => ({ ...prev, lastCycleResult: `Error: ${err instanceof Error ? err.message : String(err)}` }));
    } finally {
      setIsExecuting(false);
    }
  }, [toast, fetchPositions]);

  const startBot = useCallback((settings: HFTSettings) => {
    if (!settings.accountId) {
      toast({ title: "Select Account", description: "Choose a trading account first", variant: "destructive" });
      return;
    }

    settingsRef.current = settings;
    setIsRunning(true);
    setStats({ tradesOpened: 0, wins: 0, losses: 0, currentMartingaleLevel: 0, lastCycleResult: null, activeBuyOrderId: null, activeSellOrderId: null, lastAnalysis: null });

    toast({ title: "HFT Bot Started", description: `Trading ${settings.pair} every ${settings.cooldownSeconds}s` });

    // Fetch existing positions
    fetchPositions(settings.accountId);

    // Execute first cycle immediately
    executeCycle();

    // Then repeat at cooldown interval
    const ms = Math.max(settings.cooldownSeconds * 1000, 2000);
    intervalRef.current = window.setInterval(executeCycle, ms);
  }, [executeCycle, toast, fetchPositions]);

  const stopBot = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
    toast({ title: "HFT Bot Stopped" });
  }, [toast]);

  return { isRunning, stats, isExecuting, startBot, stopBot, positions, isLoadingPositions, fetchPositions, closePosition };
};
