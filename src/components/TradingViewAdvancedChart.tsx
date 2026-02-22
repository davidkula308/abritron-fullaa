import { useEffect, useRef, memo } from "react";

interface TradingViewAdvancedChartProps {
  symbol: string;
  interval?: string;
  colorTheme?: "dark" | "light";
  height?: number;
  style?: string; // "1"=candles, "2"=line, "3"=area, "8"=HeikinAshi, "9"=HollowCandles
}

const TradingViewAdvancedChart = memo(({
  symbol,
  interval = "15",
  colorTheme = "dark",
  height = 500,
  style = "1",
}: TradingViewAdvancedChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval,
      timezone: "Etc/UTC",
      theme: colorTheme,
      style,
      locale: "en",
      allow_symbol_change: false,
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      calendar: false,
      hide_volume: false,
      support_host: "https://www.tradingview.com",
      height,
      width: "100%",
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [symbol, interval, colorTheme, height, style]);

  return (
    <div className="tradingview-widget-container" ref={containerRef} style={{ height }}>
      <div className="tradingview-widget-container__widget" style={{ height: "100%", width: "100%" }} />
    </div>
  );
});

TradingViewAdvancedChart.displayName = "TradingViewAdvancedChart";
export default TradingViewAdvancedChart;
