import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ForexPairCardProps {
  symbol: string;
  name: string;
  price: string;
  change: number;
  changePercent: number;
}

const ForexPairCard = ({ symbol, name, price, change, changePercent }: ForexPairCardProps) => {
  const isPositive = change >= 0;

  return (
    <div className="bg-card border border-border rounded-xl p-4 hover:border-primary/50 transition-all duration-300 hover:box-glow cursor-pointer">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-cyber text-sm font-semibold tracking-wider">{symbol}</h3>
          <p className="text-xs text-muted-foreground">{name}</p>
        </div>
        <div className={cn(
          "p-2 rounded-lg",
          isPositive ? "bg-profit/20" : "bg-loss/20"
        )}>
          {isPositive ? (
            <TrendingUp className="w-4 h-4 text-profit" />
          ) : (
            <TrendingDown className="w-4 h-4 text-loss" />
          )}
        </div>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-xl font-semibold font-cyber">{price}</span>
        <div className={cn(
          "text-right",
          isPositive ? "text-profit" : "text-loss"
        )}>
          <p className="text-sm font-medium">
            {isPositive ? "+" : ""}{change.toFixed(5)}
          </p>
          <p className="text-xs">
            {isPositive ? "+" : ""}{changePercent.toFixed(2)}%
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForexPairCard;
