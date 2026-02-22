import { useState } from "react";
import { 
  Zap, Play, Square, Settings, Loader2,
  TrendingUp, TrendingDown, Shield, Target, 
  Clock, DollarSign, BarChart3, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { useTradingAccounts } from "@/hooks/useTradingAccounts";
import { useHFT, defaultHFTSettings, type HFTSettings } from "@/hooks/useHFT";
import AuthDialog from "@/components/AuthDialog";
import HFTPositionsPanel from "@/components/HFTPositionsPanel";
import { FOREX_PAIRS, TIMEFRAMES } from "@/types/bot";

const HFT = () => {
  const { user } = useAuth();
  const { accounts } = useTradingAccounts();
  const { isRunning, stats, isExecuting, startBot, stopBot, positions, isLoadingPositions, fetchPositions, closePosition } = useHFT();
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [settings, setSettings] = useState<HFTSettings>(defaultHFTSettings);
  // String mirrors for numeric inputs so users can fully clear fields
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  const updateSetting = <K extends keyof HFTSettings>(key: K, value: HFTSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const getInputValue = (key: keyof HFTSettings) => {
    if (key in inputValues) return inputValues[key];
    return String(settings[key]);
  };

  const handleNumericInput = (key: keyof HFTSettings, raw: string, fallback: number, useInt = false) => {
    setInputValues(prev => ({ ...prev, [key]: raw }));
    const parsed = useInt ? parseInt(raw) : parseFloat(raw);
    if (!isNaN(parsed)) {
      updateSetting(key, parsed as HFTSettings[typeof key]);
    }
  };

  const handleNumericBlur = (key: keyof HFTSettings, fallback: number) => {
    const val = inputValues[key];
    if (val === undefined) return;
    if (val === '' || isNaN(parseFloat(val))) {
      updateSetting(key, fallback as HFTSettings[typeof key]);
    }
    setInputValues(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const handleToggleBot = () => {
    if (isRunning) {
      stopBot();
    } else {
      startBot(settings);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen pb-20 bg-background">
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20 box-glow">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-cyber text-xl font-bold tracking-wider">
                HFT <span className="text-primary">BOT</span>
              </h1>
              <p className="text-xs text-muted-foreground">High-Frequency Trading</p>
            </div>
          </div>
        </div>
        <div className="px-4 py-16 text-center">
          <Zap className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-cyber text-lg font-semibold mb-2">Sign In Required</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-6">
            Sign in to use the HFT trading bot
          </p>
          <Button onClick={() => setIsAuthDialogOpen(true)} className="font-cyber">Sign In / Sign Up</Button>
        </div>
        <AuthDialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen} />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20 box-glow">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-cyber text-xl font-bold tracking-wider">
                HFT <span className="text-primary">BOT</span>
              </h1>
              <p className="text-xs text-muted-foreground">
                {isRunning ? "Running" : "Stopped"} • {stats.tradesOpened} trades today
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isExecuting && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
            <Badge variant={isRunning ? "default" : "secondary"} className={isRunning ? "animate-pulse bg-green-600" : ""}>
              {isRunning ? "LIVE" : "OFF"}
            </Badge>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Account & Pair Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-cyber text-sm flex items-center gap-2">
              <Settings className="w-4 h-4 text-primary" />
              Trading Setup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Trading Account</Label>
              <Select value={settings.accountId} onValueChange={(v) => updateSetting("accountId", v)} disabled={isRunning}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.account_id}>
                      {acc.broker_name || "Account"} ({acc.is_live ? "Live" : "Demo"}) — {acc.currency} {acc.balance?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Pair
                </Label>
                <Select value={settings.pair} onValueChange={(v) => updateSetting("pair", v)} disabled={isRunning}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FOREX_PAIRS.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Timeframe
                </Label>
                <Select value={settings.timeframe} onValueChange={(v) => updateSetting("timeframe", v)} disabled={isRunning}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIMEFRAMES.map((tf) => (
                      <SelectItem key={tf.value} value={tf.value}>{tf.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Buy/Sell Stop Settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-cyber text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Buy & Sell Stops (pips)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-green-500" /> Buy Stop Distance
                </Label>
                <Input type="text" inputMode="decimal" value={getInputValue("buyStopDistance")}
                  onChange={(e) => handleNumericInput("buyStopDistance", e.target.value, 50)}
                  onBlur={() => handleNumericBlur("buyStopDistance", 50)}
                  className="h-9" placeholder="Pips above ask" disabled={isRunning} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <TrendingDown className="w-3 h-3 text-red-500" /> Sell Stop Distance
                </Label>
                <Input type="text" inputMode="decimal" value={getInputValue("sellStopDistance")}
                  onChange={(e) => handleNumericInput("sellStopDistance", e.target.value, 50)}
                  onBlur={() => handleNumericBlur("sellStopDistance", 50)}
                  className="h-9" placeholder="Pips below bid" disabled={isRunning} />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> Lot Size
              </Label>
              <Input type="text" inputMode="decimal" value={getInputValue("lotSize")}
                onChange={(e) => handleNumericInput("lotSize", e.target.value, 0.01)}
                onBlur={() => handleNumericBlur("lotSize", 0.01)}
                className="h-9" placeholder="0.01" disabled={isRunning} />
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Target className="w-3 h-3 text-green-500" /> Take Profit (pips)
                </Label>
                <Input type="text" inputMode="decimal" value={getInputValue("takeProfit")}
                  onChange={(e) => handleNumericInput("takeProfit", e.target.value, 50)}
                  onBlur={() => handleNumericBlur("takeProfit", 50)}
                  className="h-9" placeholder="50" disabled={isRunning} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Shield className="w-3 h-3 text-red-500" /> Stop Loss (pips)
                </Label>
                <Input type="text" inputMode="decimal" value={getInputValue("stopLoss")}
                  onChange={(e) => handleNumericInput("stopLoss", e.target.value, 30)}
                  onBlur={() => handleNumericBlur("stopLoss", 30)}
                  className="h-9" placeholder="30" disabled={isRunning} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Martingale */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-cyber text-sm flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-primary" />
              Martingale
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Enable Martingale</Label>
              <Switch checked={settings.martingaleEnabled}
                onCheckedChange={(v) => updateSetting("martingaleEnabled", v)} disabled={isRunning} />
            </div>
            {settings.martingaleEnabled && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Win Lot Multiplier</Label>
                  <Input type="text" inputMode="decimal" value={getInputValue("martingaleMultiplier")}
                    onChange={(e) => handleNumericInput("martingaleMultiplier", e.target.value, 1)}
                    onBlur={() => handleNumericBlur("martingaleMultiplier", 1)}
                    className="h-9" disabled={isRunning} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max Levels</Label>
                  <Input type="text" inputMode="numeric" value={getInputValue("maxMartingaleLevels")}
                    onChange={(e) => handleNumericInput("maxMartingaleLevels", e.target.value, 1, true)}
                    onBlur={() => handleNumericBlur("maxMartingaleLevels", 1)}
                    className="h-9" disabled={isRunning} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Safety */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-cyber text-sm flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Safety Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Cooldown (sec)
                </Label>
                <Input type="text" inputMode="numeric" value={getInputValue("cooldownSeconds")}
                  onChange={(e) => handleNumericInput("cooldownSeconds", e.target.value, 5, true)}
                  onBlur={() => handleNumericBlur("cooldownSeconds", 5)}
                  className="h-9" disabled={isRunning} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max Daily Trades</Label>
                <Input type="text" inputMode="numeric" value={getInputValue("maxDailyTrades")}
                  onChange={(e) => handleNumericInput("maxDailyTrades", e.target.value, 50, true)}
                  onBlur={() => handleNumericBlur("maxDailyTrades", 50)}
                  className="h-9" disabled={isRunning} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live Stats */}
        {isRunning && (
          <Card className="border-primary/30">
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-2xl font-bold text-primary">{stats.tradesOpened}</p>
                  <p className="text-xs text-muted-foreground">Cycles</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-500">{stats.wins}</p>
                  <p className="text-xs text-muted-foreground">Wins</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-500">{stats.losses}</p>
                  <p className="text-xs text-muted-foreground">Losses</p>
                </div>
              </div>
              {settings.martingaleEnabled && (
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Martingale Level: <span className="text-primary font-bold">{stats.currentMartingaleLevel}</span></p>
                </div>
              )}
              {stats.lastCycleResult && (
                <div className="text-center border-t border-border pt-2">
                  <p className="text-xs text-muted-foreground">Last: {stats.lastCycleResult}</p>
                </div>
              )}
              {stats.lastAnalysis && (
                <div className="border-t border-border pt-2 space-y-1">
                  <p className="text-xs font-semibold text-primary text-center">Smart Analysis</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    <span>Volatility: <span className="text-foreground font-medium">{stats.lastAnalysis.volatilityPips}p</span></span>
                    <span>Trend: <span className={`font-medium ${stats.lastAnalysis.trendPips >= 0 ? 'text-green-500' : 'text-red-500'}`}>{stats.lastAnalysis.trendPips > 0 ? '+' : ''}{stats.lastAnalysis.trendPips}p</span></span>
                    <span>Buy dist: <span className="text-foreground font-medium">{stats.lastAnalysis.dynamicBuyDist}p</span></span>
                    <span>Sell dist: <span className="text-foreground font-medium">{stats.lastAnalysis.dynamicSellDist}p</span></span>
                    <span>TP: <span className="text-green-500 font-medium">{stats.lastAnalysis.dynamicTP}p</span></span>
                    <span>SL: <span className="text-red-500 font-medium">{stats.lastAnalysis.dynamicSL}p</span></span>
                    <span>Spread: <span className="text-foreground font-medium">{stats.lastAnalysis.spreadPips}p</span></span>
                    <span>Ticks: <span className="text-foreground font-medium">{stats.lastAnalysis.ticksCollected}</span></span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Open Positions */}
        {settings.accountId && (
          <HFTPositionsPanel
            positions={positions}
            isLoading={isLoadingPositions}
            onRefresh={() => fetchPositions(settings.accountId)}
            onClose={(posId, vol) => closePosition(settings.accountId, posId, vol)}
          />
        )}


        <Button
          onClick={handleToggleBot}
          className={`w-full font-cyber gap-2 h-12 text-base ${isRunning ? "bg-red-600 hover:bg-red-700" : ""}`}
          disabled={!settings.accountId || isExecuting}
        >
          {isExecuting ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> EXECUTING...</>
          ) : isRunning ? (
            <><Square className="w-5 h-5" /> STOP HFT BOT</>
          ) : (
            <><Play className="w-5 h-5" /> START HFT BOT</>
          )}
        </Button>
      </div>

      <AuthDialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen} />
    </div>
  );
};

export default HFT;
