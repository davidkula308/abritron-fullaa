import { v4 as uuidv4 } from 'uuid';
import { validateRisk } from './riskManager.js';
import { sendToMT5 } from './mt5Connector.js';
export async function executeTrade(payload) {
  validateRisk(payload);
  const tradeId = uuidv4();
  const brokerResponse = await sendToMT5({ ...payload, tradeId });
  return { tradeId, status: 'EXECUTED', brokerResponse };
}
