import { useEffect, useRef, memo } from "react";

interface TradingViewSingleTickerProps {
  symbol: string;
  colorTheme?: "dark" | "light";
  width?: string | number;
  isTransparent?: boolean;
}

const TradingViewSingleTicker = memo(({ 
  symbol, 
  colorTheme = "dark",
  width = "100%",
  isTransparent = true 
}: TradingViewSingleTickerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget
    containerRef.current.innerHTML = '';

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-single-quote.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol,
      width: typeof width === 'number' ? width : '100%',
      isTransparent,
      colorTheme,
      locale: "en"
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [symbol, colorTheme, width, isTransparent]);

  return (
    <div className="tradingview-widget-container" ref={containerRef}>
      <div className="tradingview-widget-container__widget"></div>
    </div>
  );
});

TradingViewSingleTicker.displayName = "TradingViewSingleTicker";

export default TradingViewSingleTicker;
