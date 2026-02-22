import { RSI } from 'technicalindicators';
import fs from 'fs';
import { executeTrade } from './executionEngine.js';

const MEMORY_FILE = './ai_memory.json';
function loadMemory() {
  if (!fs.existsSync(MEMORY_FILE)) {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify({ wins: 0, losses: 0, rsiPeriod: 14 }));
  }
  return JSON.parse(fs.readFileSync(MEMORY_FILE));
}

export async function runAdaptiveAI(symbol = 'XAUUSD') {
  const mem = loadMemory();
  const closes = Array.from({ length: 100 }, (_, i) => 2000 + Math.sin(i/5)*10 + Math.random());
  const rsi = RSI.calculate({ values: closes, period: mem.rsiPeriod });
  const last = rsi.at(-1);
  let signal = null;
  if (last < 30) signal = 'BUY';
  if (last > 70) signal = 'SELL';
  if (!signal) return { signal: 'NO_TRADE', memory: mem };
  const trade = await executeTrade({ symbol, side: signal, lot: 0.1 });
  return { signal, trade, memory: mem };
}
