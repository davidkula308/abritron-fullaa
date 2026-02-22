import { useState, useCallback } from "react";

export interface SafetyConfig {
  maxDailyTrades: number;
  maxLotSize: number;
  killSwitchEnabled: boolean;
  maxConsecutiveErrors: number;
}

const DEFAULT_SAFETY: SafetyConfig = {
  maxDailyTrades: 50,
  maxLotSize: 1.0,
  killSwitchEnabled: false,
  maxConsecutiveErrors: 5,
};

const STORAGE_KEY = "cybertrade_safety_config";
const DAILY_TRADES_KEY = "cybertrade_daily_trades";
const ERRORS_KEY = "cybertrade_consecutive_errors";

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function loadConfig(): SafetyConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_SAFETY, ...JSON.parse(raw) } : DEFAULT_SAFETY;
  } catch {
    return DEFAULT_SAFETY;
  }
}

function getDailyTradeCount(): { date: string; count: number } {
  try {
    const raw = localStorage.getItem(DAILY_TRADES_KEY);
    const data = raw ? JSON.parse(raw) : { date: getToday(), count: 0 };
    if (data.date !== getToday()) return { date: getToday(), count: 0 };
    return data;
  } catch {
    return { date: getToday(), count: 0 };
  }
}

function getConsecutiveErrors(): number {
  try {
    return parseInt(localStorage.getItem(ERRORS_KEY) || "0", 10);
  } catch {
    return 0;
  }
}

export const useTradeSafety = () => {
  const [config, setConfigState] = useState<SafetyConfig>(loadConfig);
  const [dailyTrades, setDailyTrades] = useState(getDailyTradeCount().count);
  const [consecutiveErrors, setConsecutiveErrors] = useState(getConsecutiveErrors());

  const setConfig = useCallback((newConfig: Partial<SafetyConfig>) => {
    setConfigState(prev => {
      const updated = { ...prev, ...newConfig };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const checkSafety = useCallback((lotSize: number): { allowed: boolean; reason?: string } => {
    if (config.killSwitchEnabled) {
      return { allowed: false, reason: "Kill switch is active — trading disabled" };
    }

    const errors = getConsecutiveErrors();
    if (errors >= config.maxConsecutiveErrors) {
      return { allowed: false, reason: `Kill switch auto-triggered after ${errors} consecutive errors. Reset to continue.` };
    }

    const daily = getDailyTradeCount();
    if (daily.count >= config.maxDailyTrades) {
      return { allowed: false, reason: `Daily trade limit reached (${config.maxDailyTrades})` };
    }

    if (lotSize > config.maxLotSize) {
      return { allowed: false, reason: `Lot size ${lotSize} exceeds max (${config.maxLotSize})` };
    }

    return { allowed: true };
  }, [config]);

  const recordTrade = useCallback(() => {
    const daily = getDailyTradeCount();
    const updated = { date: getToday(), count: daily.count + 1 };
    localStorage.setItem(DAILY_TRADES_KEY, JSON.stringify(updated));
    setDailyTrades(updated.count);
    // Reset consecutive errors on success
    localStorage.setItem(ERRORS_KEY, "0");
    setConsecutiveErrors(0);
  }, []);

  const recordError = useCallback(() => {
    const errors = getConsecutiveErrors() + 1;
    localStorage.setItem(ERRORS_KEY, String(errors));
    setConsecutiveErrors(errors);
    if (errors >= config.maxConsecutiveErrors) {
      setConfigState(prev => {
        const updated = { ...prev, killSwitchEnabled: true };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
    }
  }, [config.maxConsecutiveErrors]);

  const resetKillSwitch = useCallback(() => {
    localStorage.setItem(ERRORS_KEY, "0");
    setConsecutiveErrors(0);
    setConfig({ killSwitchEnabled: false });
  }, [setConfig]);

  const resetDailyCount = useCallback(() => {
    localStorage.setItem(DAILY_TRADES_KEY, JSON.stringify({ date: getToday(), count: 0 }));
    setDailyTrades(0);
  }, []);

  return {
    config,
    setConfig,
    dailyTrades,
    consecutiveErrors,
    checkSafety,
    recordTrade,
    recordError,
    resetKillSwitch,
    resetDailyCount,
  };
};
