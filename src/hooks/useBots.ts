 import { useState, useEffect } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from './useAuth';
 import type { Bot, BotParameter } from '@/types/bot';
 import type { Json } from '@/integrations/supabase/types';
 
 export const useBots = () => {
   const { user } = useAuth();
   const [bots, setBots] = useState<Bot[]>([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
 
   const fetchBots = async () => {
     if (!user) {
       setBots([]);
       setLoading(false);
       return;
     }
 
     try {
       setLoading(true);
       const { data, error } = await supabase
         .from('bots')
         .select('*')
         .eq('user_id', user.id)
         .order('created_at', { ascending: false });
 
       if (error) throw error;
 
       // Transform database rows to Bot type
       const transformed: Bot[] = (data || []).map((row) => ({
         id: row.id,
         name: row.name,
         type: row.file_type?.includes('4') ? 'MQL4' : 'MQL5',
         status: (row.status as 'running' | 'stopped') || 'stopped',
         trades: 0,
         profit: 0,
         fileName: row.file_name || undefined,
         parameters: (row.parameters as unknown as BotParameter[]) || [],
         selectedPair: row.selected_pair || undefined,
         selectedTimeframe: row.selected_timeframe || undefined,
         accountId: row.account_id || undefined,
         openPositions: (row.open_positions as unknown as string[]) || [],
       }));
 
       setBots(transformed);
     } catch (err) {
       setError(err instanceof Error ? err.message : 'Failed to fetch bots');
     } finally {
       setLoading(false);
     }
   };
 
   useEffect(() => {
     fetchBots();
   }, [user]);
 
   const saveBot = async (bot: Bot) => {
     if (!user) return;
 
 
 
     const dbRow = {
       user_id: user.id,
       name: bot.name,
       file_name: bot.fileName || null,
       file_type: bot.type === 'MQL4' ? 'mq4' : 'mq5',
       parameters: JSON.parse(JSON.stringify(bot.parameters)) as Json,
       status: bot.status,
       selected_pair: bot.selectedPair || null,
       selected_timeframe: bot.selectedTimeframe || null,
       account_id: bot.accountId || null,
       open_positions: JSON.parse(JSON.stringify(bot.openPositions || [])) as Json,
     };
 
     // Check if this bot already exists
     const { data: existing } = await supabase
       .from('bots')
       .select('id')
       .eq('id', bot.id)
       .maybeSingle();
 
     let error;
     if (existing) {
       const result = await supabase
         .from('bots')
         .update(dbRow)
         .eq('id', bot.id)
         .eq('user_id', user.id);
       error = result.error;
     } else {
       const insertRow = {
         ...dbRow,
         id: bot.id,
       };
       const result = await supabase
         .from('bots')
         .insert(insertRow);
       error = result.error;
     }
 
     if (error) throw error;
     await fetchBots();
   };
 
   const deleteBot = async (botId: string) => {
     if (!user) return;
 
     const { error } = await supabase
       .from('bots')
       .delete()
       .eq('id', botId)
       .eq('user_id', user.id);
 
     if (error) throw error;
     await fetchBots();
   };
 
   const updateBotStatus = async (botId: string, status: 'running' | 'stopped', updates?: Partial<Bot>) => {
     if (!user) return;
 
     const updateData: Record<string, unknown> = { status };
     if (updates?.selectedPair) updateData.selected_pair = updates.selectedPair;
     if (updates?.selectedTimeframe) updateData.selected_timeframe = updates.selectedTimeframe;
     if (updates?.accountId) updateData.account_id = updates.accountId;
     if (updates?.openPositions) updateData.open_positions = updates.openPositions;
 
     const { error } = await supabase
       .from('bots')
       .update(updateData)
       .eq('id', botId)
       .eq('user_id', user.id);
 
     if (error) throw error;
     await fetchBots();
   };
 
   return { bots, loading, error, saveBot, deleteBot, updateBotStatus, refetch: fetchBots };
 };