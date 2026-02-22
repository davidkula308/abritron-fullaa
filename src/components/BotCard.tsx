import { Bot, Play, Pause, Settings, Trash2, TrendingUp, Clock, Wallet, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Bot as BotType } from "@/types/bot";

interface BotCardProps {
  bot: BotType;
  onToggle: () => void;
  onDelete: () => void;
  onOpenSettings: () => void;
  onOpenLaunch: () => void;
  isStopping?: boolean;
}

const BotCard = ({ bot, onToggle, onDelete, onOpenSettings, onOpenLaunch, isStopping }: BotCardProps) => {
  const isRunning = bot.status === "running";
  const isProfit = bot.profit >= 0;

  return (
    <div className={cn(
      "bg-card border rounded-xl p-5 transition-all duration-300",
      isRunning ? "border-primary/50 box-glow" : "border-border"
    )}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg",
            isRunning ? "bg-primary/20 animate-pulse-glow" : "bg-secondary"
          )}>
            <Bot className={cn("w-5 h-5", isRunning ? "text-primary" : "text-muted-foreground")} />
          </div>
          <div>
            <h3 className="font-cyber text-sm font-semibold tracking-wider">{bot.name}</h3>
            <p className="text-xs text-muted-foreground">{bot.type}</p>
          </div>
        </div>
        <span className={cn(
          "px-3 py-1 text-xs font-semibold rounded-full",
          isRunning 
            ? "bg-profit/20 text-profit" 
            : "bg-muted text-muted-foreground"
        )}>
          {isRunning ? "Running" : "Stopped"}
        </span>
      </div>

      {/* Trading Info when running */}
      {isRunning && bot.selectedPair && bot.selectedTimeframe && (
        <div className="flex items-center gap-4 mb-4 p-2 rounded-lg bg-secondary/50">
          <div className="flex items-center gap-1.5 text-xs">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
            <span className="font-medium">{bot.selectedPair}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span className="font-medium">{bot.selectedTimeframe}</span>
          </div>
          {bot.accountId && (
            <div className="flex items-center gap-1.5 text-xs">
              <Wallet className="w-3.5 h-3.5 text-primary" />
              <span className="font-medium text-muted-foreground">Connected</span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 rounded-lg bg-secondary/50 text-center">
          <p className="text-xs text-muted-foreground mb-1">Trades</p>
          <p className="font-semibold">{bot.trades}</p>
        </div>
        <div className="p-3 rounded-lg bg-secondary/50 text-center">
          <p className="text-xs text-muted-foreground mb-1">Profit</p>
          <p className={cn("font-semibold", isProfit ? "text-profit" : "text-loss")}>
            {isProfit ? "+" : ""}${bot.profit.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        {isRunning ? (
          <Button
            onClick={onToggle}
            variant="secondary"
            className="flex-1 font-cyber text-xs"
            disabled={isStopping}
          >
            {isStopping ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Stopping...
              </>
            ) : (
              <>
                <Pause className="w-4 h-4 mr-2" />
                Stop
              </>
            )}
          </Button>
        ) : (
          <Button
            onClick={onOpenLaunch}
            variant="default"
            className="flex-1 font-cyber text-xs"
          >
            <Play className="w-4 h-4 mr-2" />
            Start
          </Button>
        )}
        <Button 
          variant="outline" 
          size="icon" 
          className="shrink-0"
          onClick={onOpenSettings}
          disabled={isRunning}
        >
          <Settings className="w-4 h-4" />
        </Button>
        <Button 
          variant="outline" 
          size="icon" 
          className="shrink-0 hover:bg-destructive/20 hover:text-destructive" 
          onClick={onDelete}
          disabled={isRunning}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default BotCard;
