import { Server, TrendingUp, DollarSign, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccountCardProps {
  broker: string;
  accountId: string;
  balance: number;
  equity: number;
  profit: number;
  type: "MT4" | "MT5" | "CTRADER";
}

const AccountCard = ({ broker, accountId, balance, equity, profit, type }: AccountCardProps) => {
  const isProfit = profit >= 0;

  return (
    <div className="bg-card border border-border rounded-xl p-5 hover:border-primary/50 transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/20 box-glow">
            <Server className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-cyber text-sm font-semibold tracking-wider">{broker}</h3>
            <p className="text-xs text-muted-foreground">ID: {accountId}</p>
          </div>
        </div>
        <span className="px-3 py-1 text-xs font-cyber font-semibold rounded-full bg-primary/20 text-primary border border-primary/30">
          {type}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-3 rounded-lg bg-secondary/50">
          <DollarSign className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
          <p className="text-xs text-muted-foreground mb-1">Balance</p>
          <p className="font-semibold text-sm">${balance.toLocaleString()}</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-secondary/50">
          <BarChart3 className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
          <p className="text-xs text-muted-foreground mb-1">Equity</p>
          <p className="font-semibold text-sm">${equity.toLocaleString()}</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-secondary/50">
          <TrendingUp className={cn("w-4 h-4 mx-auto mb-1", isProfit ? "text-profit" : "text-loss")} />
          <p className="text-xs text-muted-foreground mb-1">P/L</p>
          <p className={cn("font-semibold text-sm", isProfit ? "text-profit" : "text-loss")}>
            {isProfit ? "+" : ""}{profit.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AccountCard;
