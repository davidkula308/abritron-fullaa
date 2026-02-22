import { supabase } from '@/integrations/supabase/client';

export interface TradeParams {
  accountId: string;
  symbol: string;
  volume: number;
  side: 'BUY' | 'SELL';
  orderType?: 'MARKET' | 'BUY_STOP' | 'SELL_STOP' | 'BUY_LIMIT' | 'SELL_LIMIT';
  entryPrice?: number; // For pending orders
  stopLoss?: number;
  takeProfit?: number;
  comment?: string;
}

export interface Position {
  positionId: string;
  symbol: string;
  volume: number;
  side: string;
  entryPrice: number;
  currentPrice: number;
  profit: number;
  swap: number;
  commission: number;
  stopLoss: number | null;
  takeProfit: number | null;
}

export const useTrade = () => {
  const unwrap = (data: any) => {
    if (!data) return data;
    if (data.success === false) {
      throw new Error(data.error || data.message || 'Trade failed');
    }
    if (typeof data.error === 'string' && data.error.length > 0) {
      throw new Error(data.error);
    }
    return data;
  };

  const openTrade = async (params: TradeParams) => {
    const { data, error } = await supabase.functions.invoke('ctrader-trade', {
      body: {
        action: 'open_trade',
        account_id: params.accountId,
        symbol: params.symbol,
        volume: params.volume,
        side: params.side,
        order_type: params.orderType || 'MARKET',
        entry_price: params.entryPrice,
        stop_loss: params.stopLoss,
        take_profit: params.takeProfit,
        comment: params.comment,
      },
    });

    if (error) throw error;
    return unwrap(data);
  };

  const closeTrade = async (accountId: string, positionId: string) => {
    const { data, error } = await supabase.functions.invoke('ctrader-trade', {
      body: {
        action: 'close_trade',
        account_id: accountId,
        position_id: positionId,
      },
    });

    if (error) throw error;
    return unwrap(data);
  };

  const modifyTrade = async (
    accountId: string,
    positionId: string,
    stopLoss?: number,
    takeProfit?: number,
  ) => {
    const { data, error } = await supabase.functions.invoke('ctrader-trade', {
      body: {
        action: 'modify_trade',
        account_id: accountId,
        position_id: positionId,
        stop_loss: stopLoss,
        take_profit: takeProfit,
      },
    });

    if (error) throw error;
    return unwrap(data);
  };

  const getPositions = async (accountId: string): Promise<Position[]> => {
    const { data, error } = await supabase.functions.invoke('ctrader-trade', {
      body: {
        action: 'get_positions',
        account_id: accountId,
      },
    });

    if (error) throw error;
    const unwrapped = unwrap(data);
    return unwrapped.positions || [];
  };

  return { openTrade, closeTrade, modifyTrade, getPositions };
};
