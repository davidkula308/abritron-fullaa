 import { useState, useEffect } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from './useAuth';
 import type { Strategy, StrategyCondition, IndicatorType, AdvancedStrategyType } from '@/types/strategy';
 import type { Json } from '@/integrations/supabase/types';
 
 export const useStrategies = () => {
   const { user } = useAuth();
   const [strategies, setStrategies] = useState<Strategy[]>([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
 
   const fetchStrategies = async () => {
     if (!user) {
       setStrategies([]);
       setLoading(false);
       return;
     }
 
     try {
       setLoading(true);
       const { data, error } = await supabase
         .from('strategies')
         .select('*')
         .eq('user_id', user.id)
         .order('created_at', { ascending: false });
 
       if (error) throw error;
 
 
       // Transform database rows to Strategy type
        const transformed: Strategy[] = (data || []).map((row) => ({
          id: row.id,
          name: row.name,
          type: row.type as 'indicator' | 'advanced',
          indicatorType: (row.indicator_type as IndicatorType) || undefined,
          advancedType: (row.advanced_type as AdvancedStrategyType) || undefined,
          conditions: (row.conditions as unknown as StrategyCondition[]) || [],
          settings: (row.parameters as Record<string, unknown>) || {},
          // Map DB 'ALERT' back to 'BOTH' for the UI
          action: (row.action === 'ALERT' ? 'BOTH' : row.action as 'BUY' | 'SELL' | 'BOTH') || 'BOTH',
         isActive: row.is_active || false,
         selectedPair: row.selected_pair || undefined,
         selectedTimeframe: row.selected_timeframe || undefined,
         notificationEmail: row.notification_email || undefined,
         createdAt: row.created_at,
         updatedAt: row.updated_at,
       }));
 
       setStrategies(transformed);
     } catch (err) {
       setError(err instanceof Error ? err.message : 'Failed to fetch strategies');
     } finally {
       setLoading(false);
     }
   };
 
   useEffect(() => {
     fetchStrategies();
   }, [user]);
 
    const saveStrategy = async (strategy: Strategy) => {
    if (!user) throw new Error("Not authenticated");

    try {
      const dbRow = {
        user_id: user.id,
        name: strategy.name,
        type: strategy.type,
        indicator_type: strategy.indicatorType || null,
        advanced_type: strategy.advancedType || null,
        conditions: JSON.parse(JSON.stringify(strategy.conditions)) as Json,
        parameters: JSON.parse(JSON.stringify(strategy.settings)) as Json,
        selected_pair: strategy.selectedPair || null,
        selected_timeframe: strategy.selectedTimeframe || null,
        // DB constraint only allows BUY/SELL/ALERT/BOTH (BOTH added to constraint, but use ALERT as fallback)
        action: strategy.action,
        notification_email: strategy.notificationEmail || null,
        is_active: strategy.isActive,
      };

      // Try upsert approach — insert or update in one call
      const { error } = await supabase
        .from('strategies')
        .upsert({
          ...dbRow,
          id: strategy.id,
        }, { onConflict: 'id' });

      if (error) throw error;
      await fetchStrategies();
    } catch (err) {
      console.error("Strategy save error:", err);
      throw err;
    }
  };
 
   const deleteStrategy = async (strategyId: string) => {
     if (!user) return;
 
     const { error } = await supabase
       .from('strategies')
       .delete()
       .eq('id', strategyId)
       .eq('user_id', user.id);
 
     if (error) throw error;
     await fetchStrategies();
   };
 
   const toggleStrategy = async (strategyId: string, isActive: boolean) => {
     if (!user) return;
 
     const { error } = await supabase
       .from('strategies')
       .update({ is_active: isActive })
       .eq('id', strategyId)
       .eq('user_id', user.id);
 
     if (error) throw error;
     await fetchStrategies();
   };
 
   return { strategies, loading, error, saveStrategy, deleteStrategy, toggleStrategy, refetch: fetchStrategies };
 };