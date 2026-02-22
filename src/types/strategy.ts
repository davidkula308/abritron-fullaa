export type IndicatorType = 
  | "MACD" 
  | "RSI" 
  | "BOLLINGER" 
  | "CCI" 
  | "STOCHASTIC" 
  | "ATR" 
  | "EMA" 
  | "SMA" 
  | "VWAP"
  | "ICHIMOKU";

export type AdvancedStrategyType = 
  | "FVG" 
  | "LIQUIDITY_SWEEP" 
  | "CANDLE_RANGE_THEORY" 
  | "ORDER_BLOCK"
  | "BREAK_OF_STRUCTURE"
  | "CHANGE_OF_CHARACTER";

export interface IndicatorConfig {
  type: IndicatorType;
  name: string;
  description: string;
  parameters: IndicatorParameter[];
  conditions: ConditionType[];
}

export interface IndicatorParameter {
  name: string;
  key: string;
  type: "number" | "boolean" | "select";
  defaultValue: number | boolean | string;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
}

export type ConditionType = 
  | "CROSSES_ABOVE"
  | "CROSSES_BELOW"
  | "GREATER_THAN"
  | "LESS_THAN"
  | "EQUALS"
  | "OVERBOUGHT"
  | "OVERSOLD"
  | "BULLISH_DIVERGENCE"
  | "BEARISH_DIVERGENCE"
  | "HISTOGRAM_POSITIVE"
  | "HISTOGRAM_NEGATIVE"
  | "PRICE_ABOVE"
  | "PRICE_BELOW"
  | "BAND_TOUCH_UPPER"
  | "BAND_TOUCH_LOWER"
  | "SQUEEZE"
  | "EXPANSION";

export interface ConditionConfig {
  type: ConditionType;
  label: string;
  description: string;
  applicableIndicators: IndicatorType[];
}

export interface StrategyCondition {
  id: string;
  indicator: IndicatorType;
  condition: ConditionType;
  value?: number;
  compareIndicator?: IndicatorType;
  compareValue?: number;
  logicalOperator?: "AND" | "OR";
}

export interface Strategy {
  id: string;
  name: string;
  type: "indicator" | "advanced";
  indicatorType?: IndicatorType;
  advancedType?: AdvancedStrategyType;
  conditions: StrategyCondition[];
  settings: Record<string, unknown>;
  action: "BUY" | "SELL" | "BOTH";
  isActive: boolean;
  selectedPair?: string;
  selectedTimeframe?: string;
  accountId?: string;
  notificationEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdvancedStrategyConfig {
  type: AdvancedStrategyType;
  name: string;
  description: string;
  settings: AdvancedStrategySetting[];
}

export interface AdvancedStrategySetting {
  name: string;
  key: string;
  type: "number" | "boolean" | "select" | "color" | "timeframe";
  defaultValue: number | boolean | string;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  description?: string;
}

// Indicator configurations
export const INDICATORS: IndicatorConfig[] = [
  {
    type: "MACD",
    name: "MACD",
    description: "Moving Average Convergence Divergence",
    parameters: [
      { name: "Fast Period", key: "fastPeriod", type: "number", defaultValue: 12, min: 2, max: 50 },
      { name: "Slow Period", key: "slowPeriod", type: "number", defaultValue: 26, min: 2, max: 100 },
      { name: "Signal Period", key: "signalPeriod", type: "number", defaultValue: 9, min: 2, max: 50 },
    ],
    conditions: ["CROSSES_ABOVE", "CROSSES_BELOW", "HISTOGRAM_POSITIVE", "HISTOGRAM_NEGATIVE", "BULLISH_DIVERGENCE", "BEARISH_DIVERGENCE"],
  },
  {
    type: "RSI",
    name: "RSI",
    description: "Relative Strength Index",
    parameters: [
      { name: "Period", key: "period", type: "number", defaultValue: 14, min: 2, max: 100 },
      { name: "Overbought Level", key: "overbought", type: "number", defaultValue: 70, min: 50, max: 100 },
      { name: "Oversold Level", key: "oversold", type: "number", defaultValue: 30, min: 0, max: 50 },
    ],
    conditions: ["OVERBOUGHT", "OVERSOLD", "CROSSES_ABOVE", "CROSSES_BELOW", "BULLISH_DIVERGENCE", "BEARISH_DIVERGENCE"],
  },
  {
    type: "BOLLINGER",
    name: "Bollinger Bands",
    description: "Bollinger Bands volatility indicator",
    parameters: [
      { name: "Period", key: "period", type: "number", defaultValue: 20, min: 5, max: 100 },
      { name: "Standard Deviation", key: "stdDev", type: "number", defaultValue: 2, min: 0.5, max: 5, step: 0.5 },
    ],
    conditions: ["BAND_TOUCH_UPPER", "BAND_TOUCH_LOWER", "PRICE_ABOVE", "PRICE_BELOW", "SQUEEZE", "EXPANSION"],
  },
  {
    type: "CCI",
    name: "CCI",
    description: "Commodity Channel Index",
    parameters: [
      { name: "Period", key: "period", type: "number", defaultValue: 20, min: 5, max: 100 },
      { name: "Overbought Level", key: "overbought", type: "number", defaultValue: 100, min: 50, max: 300 },
      { name: "Oversold Level", key: "oversold", type: "number", defaultValue: -100, min: -300, max: -50 },
    ],
    conditions: ["OVERBOUGHT", "OVERSOLD", "CROSSES_ABOVE", "CROSSES_BELOW"],
  },
  {
    type: "STOCHASTIC",
    name: "Stochastic",
    description: "Stochastic Oscillator",
    parameters: [
      { name: "K Period", key: "kPeriod", type: "number", defaultValue: 14, min: 2, max: 50 },
      { name: "D Period", key: "dPeriod", type: "number", defaultValue: 3, min: 1, max: 20 },
      { name: "Slowing", key: "slowing", type: "number", defaultValue: 3, min: 1, max: 10 },
      { name: "Overbought", key: "overbought", type: "number", defaultValue: 80, min: 50, max: 100 },
      { name: "Oversold", key: "oversold", type: "number", defaultValue: 20, min: 0, max: 50 },
    ],
    conditions: ["OVERBOUGHT", "OVERSOLD", "CROSSES_ABOVE", "CROSSES_BELOW"],
  },
  {
    type: "ATR",
    name: "ATR",
    description: "Average True Range",
    parameters: [
      { name: "Period", key: "period", type: "number", defaultValue: 14, min: 2, max: 100 },
    ],
    conditions: ["GREATER_THAN", "LESS_THAN"],
  },
  {
    type: "EMA",
    name: "EMA",
    description: "Exponential Moving Average",
    parameters: [
      { name: "Period", key: "period", type: "number", defaultValue: 20, min: 2, max: 500 },
    ],
    conditions: ["PRICE_ABOVE", "PRICE_BELOW", "CROSSES_ABOVE", "CROSSES_BELOW"],
  },
  {
    type: "SMA",
    name: "SMA",
    description: "Simple Moving Average",
    parameters: [
      { name: "Period", key: "period", type: "number", defaultValue: 20, min: 2, max: 500 },
    ],
    conditions: ["PRICE_ABOVE", "PRICE_BELOW", "CROSSES_ABOVE", "CROSSES_BELOW"],
  },
  {
    type: "VWAP",
    name: "VWAP",
    description: "Volume Weighted Average Price",
    parameters: [],
    conditions: ["PRICE_ABOVE", "PRICE_BELOW", "CROSSES_ABOVE", "CROSSES_BELOW"],
  },
  {
    type: "ICHIMOKU",
    name: "Ichimoku Cloud",
    description: "Ichimoku Kinko Hyo",
    parameters: [
      { name: "Tenkan Period", key: "tenkanPeriod", type: "number", defaultValue: 9, min: 2, max: 50 },
      { name: "Kijun Period", key: "kijunPeriod", type: "number", defaultValue: 26, min: 2, max: 100 },
      { name: "Senkou Span B", key: "senkouSpanB", type: "number", defaultValue: 52, min: 2, max: 200 },
    ],
    conditions: ["PRICE_ABOVE", "PRICE_BELOW", "CROSSES_ABOVE", "CROSSES_BELOW"],
  },
];

// Condition configurations
export const CONDITIONS: ConditionConfig[] = [
  { type: "CROSSES_ABOVE", label: "Crosses Above", description: "Signal line crosses above trigger", applicableIndicators: ["MACD", "RSI", "CCI", "STOCHASTIC", "EMA", "SMA", "VWAP", "ICHIMOKU"] },
  { type: "CROSSES_BELOW", label: "Crosses Below", description: "Signal line crosses below trigger", applicableIndicators: ["MACD", "RSI", "CCI", "STOCHASTIC", "EMA", "SMA", "VWAP", "ICHIMOKU"] },
  { type: "GREATER_THAN", label: "Greater Than", description: "Value is greater than specified level", applicableIndicators: ["ATR", "RSI", "CCI"] },
  { type: "LESS_THAN", label: "Less Than", description: "Value is less than specified level", applicableIndicators: ["ATR", "RSI", "CCI"] },
  { type: "OVERBOUGHT", label: "Overbought", description: "Indicator in overbought territory", applicableIndicators: ["RSI", "CCI", "STOCHASTIC"] },
  { type: "OVERSOLD", label: "Oversold", description: "Indicator in oversold territory", applicableIndicators: ["RSI", "CCI", "STOCHASTIC"] },
  { type: "BULLISH_DIVERGENCE", label: "Bullish Divergence", description: "Price makes lower low, indicator makes higher low", applicableIndicators: ["MACD", "RSI"] },
  { type: "BEARISH_DIVERGENCE", label: "Bearish Divergence", description: "Price makes higher high, indicator makes lower high", applicableIndicators: ["MACD", "RSI"] },
  { type: "HISTOGRAM_POSITIVE", label: "Histogram Positive", description: "MACD histogram is positive", applicableIndicators: ["MACD"] },
  { type: "HISTOGRAM_NEGATIVE", label: "Histogram Negative", description: "MACD histogram is negative", applicableIndicators: ["MACD"] },
  { type: "PRICE_ABOVE", label: "Price Above", description: "Price is above the indicator", applicableIndicators: ["BOLLINGER", "EMA", "SMA", "VWAP", "ICHIMOKU"] },
  { type: "PRICE_BELOW", label: "Price Below", description: "Price is below the indicator", applicableIndicators: ["BOLLINGER", "EMA", "SMA", "VWAP", "ICHIMOKU"] },
  { type: "BAND_TOUCH_UPPER", label: "Touch Upper Band", description: "Price touches upper Bollinger Band", applicableIndicators: ["BOLLINGER"] },
  { type: "BAND_TOUCH_LOWER", label: "Touch Lower Band", description: "Price touches lower Bollinger Band", applicableIndicators: ["BOLLINGER"] },
  { type: "SQUEEZE", label: "Squeeze", description: "Bands are squeezing (low volatility)", applicableIndicators: ["BOLLINGER"] },
  { type: "EXPANSION", label: "Expansion", description: "Bands are expanding (high volatility)", applicableIndicators: ["BOLLINGER"] },
];

// Advanced strategy configurations
export const ADVANCED_STRATEGIES: AdvancedStrategyConfig[] = [
  {
    type: "FVG",
    name: "Fair Value Gap",
    description: "Identify and trade Fair Value Gaps (imbalances)",
    settings: [
      { name: "Timeframe", key: "timeframe", type: "timeframe", defaultValue: "H1" },
      { name: "Max Lookback Bars", key: "lookbackBars", type: "number", defaultValue: 100, min: 10, max: 500 },
      { name: "Min Gap Size (pips)", key: "minGapSize", type: "number", defaultValue: 5, min: 1, max: 100 },
      { name: "Bullish FVG Color", key: "bullishColor", type: "color", defaultValue: "#22c55e" },
      { name: "Bearish FVG Color", key: "bearishColor", type: "color", defaultValue: "#ef4444" },
      { name: "Trades per FVG", key: "tradesPerFvg", type: "number", defaultValue: 1, min: 1, max: 5 },
      { name: "Only Unmitigated", key: "onlyUnmitigated", type: "boolean", defaultValue: true },
    ],
  },
  {
    type: "LIQUIDITY_SWEEP",
    name: "Liquidity Sweep",
    description: "Detect liquidity sweeps of previous highs/lows",
    settings: [
      { name: "Timeframe", key: "timeframe", type: "timeframe", defaultValue: "H4" },
      { name: "Lookback Period", key: "lookbackPeriod", type: "number", defaultValue: 20, min: 5, max: 100 },
      { name: "Sweep Threshold (pips)", key: "sweepThreshold", type: "number", defaultValue: 3, min: 1, max: 50 },
      { name: "Wait for Confirmation", key: "waitConfirmation", type: "boolean", defaultValue: true },
      { name: "Sweep Line Color", key: "sweepColor", type: "color", defaultValue: "#f59e0b" },
    ],
  },
  {
    type: "CANDLE_RANGE_THEORY",
    name: "Candle Range Theory",
    description: "Trade based on ICT Candle Range Theory concepts",
    settings: [
      { name: "Timeframe", key: "timeframe", type: "timeframe", defaultValue: "D1" },
      { name: "Asian Range Start (UTC)", key: "asianStart", type: "number", defaultValue: 0, min: 0, max: 23 },
      { name: "Asian Range End (UTC)", key: "asianEnd", type: "number", defaultValue: 8, min: 0, max: 23 },
      { name: "Trade London Open", key: "tradeLondon", type: "boolean", defaultValue: true },
      { name: "Trade NY Open", key: "tradeNY", type: "boolean", defaultValue: true },
      { name: "Range Box Color", key: "rangeColor", type: "color", defaultValue: "#6366f1" },
    ],
  },
  {
    type: "ORDER_BLOCK",
    name: "Order Block",
    description: "Identify and trade institutional order blocks",
    settings: [
      { name: "Timeframe", key: "timeframe", type: "timeframe", defaultValue: "H1" },
      { name: "Lookback Bars", key: "lookbackBars", type: "number", defaultValue: 50, min: 10, max: 200 },
      { name: "Min Block Size (pips)", key: "minBlockSize", type: "number", defaultValue: 10, min: 1, max: 100 },
      { name: "Bullish OB Color", key: "bullishColor", type: "color", defaultValue: "#22c55e" },
      { name: "Bearish OB Color", key: "bearishColor", type: "color", defaultValue: "#ef4444" },
      { name: "Only Fresh Blocks", key: "onlyFresh", type: "boolean", defaultValue: true },
    ],
  },
  {
    type: "BREAK_OF_STRUCTURE",
    name: "Break of Structure",
    description: "Trade market structure breaks (BOS)",
    settings: [
      { name: "Timeframe", key: "timeframe", type: "timeframe", defaultValue: "H4" },
      { name: "Swing Lookback", key: "swingLookback", type: "number", defaultValue: 5, min: 2, max: 20 },
      { name: "Require Retest", key: "requireRetest", type: "boolean", defaultValue: true },
      { name: "BOS Line Color", key: "bosColor", type: "color", defaultValue: "#3b82f6" },
    ],
  },
  {
    type: "CHANGE_OF_CHARACTER",
    name: "Change of Character",
    description: "Detect and trade change of character (CHoCH)",
    settings: [
      { name: "Timeframe", key: "timeframe", type: "timeframe", defaultValue: "H1" },
      { name: "Swing Lookback", key: "swingLookback", type: "number", defaultValue: 5, min: 2, max: 20 },
      { name: "Wait for Pullback", key: "waitPullback", type: "boolean", defaultValue: true },
      { name: "CHoCH Line Color", key: "chochColor", type: "color", defaultValue: "#a855f7" },
    ],
  },
];

export const TIMEFRAMES_OPTIONS = [
  { value: "M1", label: "1 Minute" },
  { value: "M5", label: "5 Minutes" },
  { value: "M15", label: "15 Minutes" },
  { value: "M30", label: "30 Minutes" },
  { value: "H1", label: "1 Hour" },
  { value: "H4", label: "4 Hours" },
  { value: "D1", label: "Daily" },
  { value: "W1", label: "Weekly" },
];
