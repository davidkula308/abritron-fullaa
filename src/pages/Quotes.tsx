import { useState } from "react";
import { ChevronLeft, TrendingUp } from "lucide-react";
import TradingViewMarketOverview from "@/components/TradingViewMarketOverview";
import TradingViewAdvancedChart from "@/components/TradingViewAdvancedChart";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const forexPairs = [
  { symbol: "OANDA:XAUUSD", name: "Gold / USD", tv: "OANDA:XAUUSD" },
  { symbol: "FX_IDC:EURUSD", name: "EUR / USD", tv: "FX_IDC:EURUSD" },
  { symbol: "FX_IDC:GBPUSD", name: "GBP / USD", tv: "FX_IDC:GBPUSD" },
  { symbol: "FX_IDC:USDJPY", name: "USD / JPY", tv: "FX_IDC:USDJPY" },
  { symbol: "OANDA:XAGUSD", name: "Silver / USD", tv: "OANDA:XAGUSD" },
  { symbol: "BITSTAMP:BTCUSD", name: "BTC / USD", tv: "BITSTAMP:BTCUSD" },
  { symbol: "BITSTAMP:ETHUSD", name: "ETH / USD", tv: "BITSTAMP:ETHUSD" },
  { symbol: "FX_IDC:USDCHF", name: "USD / CHF", tv: "FX_IDC:USDCHF" },
  { symbol: "FX_IDC:AUDUSD", name: "AUD / USD", tv: "FX_IDC:AUDUSD" },
  { symbol: "FX_IDC:USDCAD", name: "USD / CAD", tv: "FX_IDC:USDCAD" },
  { symbol: "FX_IDC:NZDUSD", name: "NZD / USD", tv: "FX_IDC:NZDUSD" },
  { symbol: "FX_IDC:EURGBP", name: "EUR / GBP", tv: "FX_IDC:EURGBP" },
  { symbol: "FX_IDC:EURJPY", name: "EUR / JPY", tv: "FX_IDC:EURJPY" },
  { symbol: "FX_IDC:GBPJPY", name: "GBP / JPY", tv: "FX_IDC:GBPJPY" },
  { symbol: "TVC:USOIL", name: "Crude Oil", tv: "TVC:USOIL" },
  { symbol: "TVC:DXY", name: "US Dollar Index", tv: "TVC:DXY" },
  { symbol: "CAPITALCOM:US30", name: "US30 / Dow Jones", tv: "CAPITALCOM:US30" },
  { symbol: "CAPITALCOM:US500", name: "US500 / S&P 500", tv: "CAPITALCOM:US500" },
  { symbol: "CAPITALCOM:US100", name: "NAS100 / Nasdaq", tv: "CAPITALCOM:US100" },
];

const timeframes = [
  { value: "1", label: "1m" },
  { value: "5", label: "5m" },
  { value: "15", label: "15m" },
  { value: "30", label: "30m" },
  { value: "60", label: "1H" },
  { value: "240", label: "4H" },
  { value: "D", label: "1D" },
  { value: "W", label: "1W" },
  { value: "M", label: "1M" },
];

const chartStyles = [
  { value: "1", label: "Candles" },
  { value: "2", label: "Line" },
  { value: "3", label: "Area" },
  { value: "8", label: "Heikin Ashi" },
  { value: "9", label: "Hollow" },
];

const Quotes = () => {
  const [selectedPair, setSelectedPair] = useState<typeof forexPairs[0] | null>(null);
  const [interval, setInterval] = useState("15");
  const [chartStyle, setChartStyle] = useState("1");

  if (selectedPair) {
    return (
      <div className="min-h-screen pb-20 bg-background flex flex-col">
        {/* Chart Header */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <Button variant="ghost" size="icon" onClick={() => setSelectedPair(null)}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-cyber text-lg font-bold tracking-wider">{selectedPair.name}</h1>
          </div>
          <div className="flex gap-2">
            <Select value={interval} onValueChange={setInterval}>
              <SelectTrigger className="w-[80px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeframes.map(tf => (
                  <SelectItem key={tf.value} value={tf.value}>{tf.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={chartStyle} onValueChange={setChartStyle}>
              <SelectTrigger className="w-[110px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {chartStyles.map(cs => (
                  <SelectItem key={cs.value} value={cs.value}>{cs.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {/* Chart */}
        <div className="flex-1" style={{ minHeight: "calc(100vh - 200px)" }}>
          <TradingViewAdvancedChart
            symbol={selectedPair.tv}
            interval={interval}
            style={chartStyle}
            colorTheme="dark"
            height={600}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/20 box-glow">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-cyber text-xl font-bold tracking-wider">
              LIVE <span className="text-primary">QUOTES</span>
            </h1>
            <p className="text-xs text-muted-foreground">
              Real-time market data powered by TradingView
            </p>
          </div>
        </div>
      </div>

      {/* Market Overview */}
      <div className="px-4 py-4">
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <TradingViewMarketOverview colorTheme="dark" height={450} width="100%" />
        </div>
      </div>

      {/* Pair List */}
      <div className="px-4 py-2">
        <h2 className="font-cyber text-sm font-semibold tracking-wider mb-3 text-muted-foreground">
          TAP TO OPEN CHART
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {forexPairs.map((pair) => (
            <button
              key={pair.symbol}
              onClick={() => setSelectedPair(pair)}
              className="bg-card border border-border rounded-xl p-3 text-left hover:border-primary/50 transition-colors"
            >
              <span className="font-cyber text-xs font-semibold">{pair.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Quotes;
