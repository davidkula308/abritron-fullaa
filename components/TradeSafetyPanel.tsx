import { Shield, AlertTriangle, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useTradeSafety } from "@/hooks/useTradeSafety";

const TradeSafetyPanel = () => {
  const {
    config, setConfig, dailyTrades, consecutiveErrors,
    resetKillSwitch, resetDailyCount,
  } = useTradeSafety();

  return (
    <Card className="border-destructive/30">
      <CardHeader className="pb-3">
        <CardTitle className="font-cyber text-sm flex items-center gap-2">
          <Shield className="w-4 h-4 text-destructive" />
          Safety Controls
          {config.killSwitchEnabled && (
            <span className="text-xs bg-destructive/20 text-destructive px-2 py-0.5 rounded-full animate-pulse">
              KILL SWITCH ACTIVE
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Kill Switch */}
        <div className="flex items-center justify-between">
          <Label className="text-xs flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-destructive" />
            Kill Switch (disable all trading)
          </Label>
          <Switch
            checked={config.killSwitchEnabled}
            onCheckedChange={(v) => setConfig({ killSwitchEnabled: v })}
          />
        </div>

        {config.killSwitchEnabled && (
          <Button size="sm" variant="outline" className="w-full text-xs" onClick={resetKillSwitch}>
            <RotateCcw className="w-3 h-3 mr-1" /> Reset Kill Switch & Errors
          </Button>
        )}

        {/* Max Daily Trades */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Max Daily Trades</Label>
            <Input
              type="number"
              value={config.maxDailyTrades}
              onChange={(e) => setConfig({ maxDailyTrades: parseInt(e.target.value) || 50 })}
              className="h-8 text-xs"
              min={1}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Max Lot Size</Label>
            <Input
              type="number"
              value={config.maxLotSize}
              onChange={(e) => setConfig({ maxLotSize: parseFloat(e.target.value) || 1 })}
              className="h-8 text-xs"
              min={0.01}
              step={0.01}
            />
          </div>
        </div>

        {/* Auto kill-switch threshold */}
        <div className="space-y-1">
          <Label className="text-xs">Auto kill-switch after N consecutive errors</Label>
          <Input
            type="number"
            value={config.maxConsecutiveErrors}
            onChange={(e) => setConfig({ maxConsecutiveErrors: parseInt(e.target.value) || 5 })}
            className="h-8 text-xs"
            min={1}
          />
        </div>

        {/* Status */}
        <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t border-border">
          <span>Today: {dailyTrades}/{config.maxDailyTrades} trades</span>
          <span>Errors: {consecutiveErrors}/{config.maxConsecutiveErrors}</span>
        </div>
        {dailyTrades > 0 && (
          <Button size="sm" variant="ghost" className="w-full text-xs h-7" onClick={resetDailyCount}>
            Reset Daily Count
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default TradeSafetyPanel;
