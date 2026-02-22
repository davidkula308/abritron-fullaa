export interface BotParameter {
  name: string;
  type: "number" | "boolean" | "string" | "enum";
  value: number | boolean | string;
  defaultValue: number | boolean | string;
  description?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: string[]; // For enum type
}

export interface Bot {
  id: string;
  name: string;
  type: "MQL4" | "MQL5";
  status: "running" | "stopped";
  trades: number;
  profit: number;
  fileName?: string;
  parameters: BotParameter[];
  selectedPair?: string;
  selectedTimeframe?: string;
  accountId?: string;
  openPositions?: string[]; // Track position IDs opened by this bot
}

export const FOREX_PAIRS = [
  "EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD",
  "EURGBP", "EURJPY", "GBPJPY", "AUDNZD", "AUDJPY", "CADJPY", "CHFJPY",
  "EURAUD", "EURCAD", "EURCHF", "EURNZD", "GBPAUD", "GBPCAD", "GBPCHF",
  "XAUUSD", "XAGUSD", "US30", "US500", "NAS100", "BTCUSD", "ETHUSD"
] as const;

export const TIMEFRAMES = [
  { value: "M1", label: "1 Minute" },
  { value: "M5", label: "5 Minutes" },
  { value: "M15", label: "15 Minutes" },
  { value: "M30", label: "30 Minutes" },
  { value: "H1", label: "1 Hour" },
  { value: "H4", label: "4 Hours" },
  { value: "D1", label: "Daily" },
  { value: "W1", label: "Weekly" },
  { value: "MN1", label: "Monthly" },
] as const;

export const VALID_EXTENSIONS = [".mq4", ".mq5", ".ex4", ".ex5"];

export const validateBotFile = (file: File): { valid: boolean; error?: string } => {
  const fileName = file.name.toLowerCase();
  const extension = fileName.substring(fileName.lastIndexOf("."));
  
  if (!VALID_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: `Invalid file format. Only ${VALID_EXTENSIONS.join(", ")} files are accepted.`
    };
  }
  
  return { valid: true };
};

// Parse MQL source code to extract 'input' / 'extern' parameters
export const parseMQLParameters = (source: string): BotParameter[] => {
  const params: BotParameter[] = [];
  // Match patterns like: input double LotSize = 0.01; // description
  //                       extern int StopLoss = 50;
  //                       input bool UseTrailing = true;
  const regex = /(?:input|extern)\s+(double|int|bool|string|ENUM_\w+)\s+(\w+)\s*=\s*([^;]+);(?:\s*\/\/\s*(.*))?/gi;
  let match;
  while ((match = regex.exec(source)) !== null) {
    const [, rawType, name, rawValue, description] = match;
    const type = rawType.toLowerCase();
    const trimmedValue = rawValue.trim();

    if (type === 'bool') {
      const val = trimmedValue.toLowerCase() === 'true';
      params.push({ name, type: 'boolean', value: val, defaultValue: val, description: description?.trim() });
    } else if (type === 'double') {
      const val = parseFloat(trimmedValue) || 0;
      params.push({ name, type: 'number', value: val, defaultValue: val, description: description?.trim(), step: 0.01 });
    } else if (type === 'int') {
      const val = parseInt(trimmedValue) || 0;
      params.push({ name, type: 'number', value: val, defaultValue: val, description: description?.trim(), step: 1 });
    } else if (type === 'string') {
      const val = trimmedValue.replace(/^"|"$/g, '');
      params.push({ name, type: 'string', value: val, defaultValue: val, description: description?.trim() });
    } else if (type.startsWith('enum_')) {
      params.push({ name, type: 'string', value: trimmedValue, defaultValue: trimmedValue, description: description?.trim() });
    }
  }
  return params;
};

// Extract parameters - reads file content for .mq4/.mq5, falls back to defaults for compiled .ex4/.ex5
export const extractBotParameters = async (file: File, type: "MQL4" | "MQL5"): Promise<BotParameter[]> => {
  const ext = file.name.toLowerCase().substring(file.name.lastIndexOf("."));
  
  // Only source files can be parsed
  if (ext === '.mq4' || ext === '.mq5') {
    try {
      const content = await file.text();
      const parsed = parseMQLParameters(content);
      if (parsed.length > 0) return parsed;
    } catch {
      // Fall through to defaults
    }
  }

  // Default parameters for compiled files or files with no parseable inputs
  return [
    { name: "LotSize", type: "number", value: 0.01, defaultValue: 0.01, description: "Trading lot size", min: 0.01, max: 100, step: 0.01 },
    { name: "StopLoss", type: "number", value: 50, defaultValue: 50, description: "Stop loss in pips", min: 0, max: 1000, step: 1 },
    { name: "TakeProfit", type: "number", value: 100, defaultValue: 100, description: "Take profit in pips", min: 0, max: 2000, step: 1 },
    { name: "MaxTrades", type: "number", value: 5, defaultValue: 5, description: "Maximum concurrent trades", min: 1, max: 50, step: 1 },
    { name: "UseTrailingStop", type: "boolean", value: false, defaultValue: false, description: "Enable trailing stop" },
    { name: "MagicNumber", type: "number", value: 123456, defaultValue: 123456, description: "Unique identifier for bot trades", min: 1, max: 999999999, step: 1 },
  ];
};
