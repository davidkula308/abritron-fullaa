import { useEffect, useRef, memo } from "react";

interface TradingViewMarketOverviewProps {
  colorTheme?: "dark" | "light";
  height?: number;
  width?: string;
}

const TradingViewMarketOverview = memo(({ 
  colorTheme = "dark",
  height = 500,
  width = "100%"
}: TradingViewMarketOverviewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget
    containerRef.current.innerHTML = '';

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      colorTheme,
      dateRange: "12M",
      showChart: true,
      locale: "en",
      largeChartUrl: "",
      isTransparent: true,
      showSymbolLogo: true,
      showFloatingTooltip: true,
      width,
      height,
      plotLineColorGrowing: "rgba(220, 38, 38, 1)",
      plotLineColorFalling: "rgba(220, 38, 38, 0.5)",
      gridLineColor: "rgba(240, 243, 250, 0.1)",
      scaleFontColor: "rgba(255, 255, 255, 0.6)",
      belowLineFillColorGrowing: "rgba(220, 38, 38, 0.12)",
      belowLineFillColorFalling: "rgba(220, 38, 38, 0.12)",
      belowLineFillColorGrowingBottom: "rgba(220, 38, 38, 0)",
      belowLineFillColorFallingBottom: "rgba(220, 38, 38, 0)",
      symbolActiveColor: "rgba(220, 38, 38, 0.12)",
      tabs: [
        {
          title: "Forex",
          symbols: [
            { s: "OANDA:XAUUSD", d: "Gold / USD" },
            { s: "FX_IDC:EURUSD", d: "EUR / USD" },
            { s: "FX_IDC:GBPUSD", d: "GBP / USD" },
            { s: "FX_IDC:USDJPY", d: "USD / JPY" },
            { s: "FX_IDC:USDCHF", d: "USD / CHF" },
            { s: "FX_IDC:AUDUSD", d: "AUD / USD" }
          ],
          originalTitle: "Forex"
        },
        {
          title: "Commodities",
          symbols: [
            { s: "OANDA:XAUUSD", d: "Gold" },
            { s: "OANDA:XAGUSD", d: "Silver" },
            { s: "TVC:USOIL", d: "Crude Oil" },
            { s: "TVC:UKOIL", d: "Brent Oil" },
            { s: "NYMEX:NG1!", d: "Natural Gas" },
            { s: "COMEX:HG1!", d: "Copper" }
          ],
          originalTitle: "Commodities"
        },
        {
          title: "Crosses",
          symbols: [
            { s: "FX_IDC:EURGBP", d: "EUR / GBP" },
            { s: "FX_IDC:EURJPY", d: "EUR / JPY" },
            { s: "FX_IDC:GBPJPY", d: "GBP / JPY" },
            { s: "FX_IDC:USDCAD", d: "USD / CAD" },
            { s: "FX_IDC:NZDUSD", d: "NZD / USD" },
            { s: "FX_IDC:CADJPY", d: "CAD / JPY" }
          ],
          originalTitle: "Crosses"
        },
        {
          title: "Crypto",
          symbols: [
            { s: "BITSTAMP:BTCUSD", d: "Bitcoin / USD" },
            { s: "BITSTAMP:ETHUSD", d: "Ethereum / USD" },
            { s: "BINANCE:SOLUSDT", d: "Solana / USDT" },
            { s: "BINANCE:XRPUSDT", d: "XRP / USDT" },
            { s: "BINANCE:DOGEUSDT", d: "Doge / USDT" },
            { s: "BINANCE:ADAUSDT", d: "Cardano / USDT" }
          ],
          originalTitle: "Crypto"
        },
        {
          title: "Indices",
          symbols: [
            { s: "CAPITALCOM:US30", d: "US30 / Dow Jones" },
            { s: "CAPITALCOM:US500", d: "S&P 500" },
            { s: "CAPITALCOM:US100", d: "Nasdaq 100" },
            { s: "TVC:DEU40", d: "DAX 40" },
            { s: "TVC:UKX", d: "FTSE 100" },
            { s: "TVC:NI225", d: "Nikkei 225" }
          ],
          originalTitle: "Indices"
        }
      ]
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [colorTheme, height, width]);

  return (
    <div className="tradingview-widget-container" ref={containerRef}>
      <div className="tradingview-widget-container__widget"></div>
    </div>
  );
});

TradingViewMarketOverview.displayName = "TradingViewMarketOverview";

export default TradingViewMarketOverview;
