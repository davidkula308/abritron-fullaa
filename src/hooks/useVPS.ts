import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface VPSRecord {
  id: string;
  name: string;
  type: string;
  host?: string;
  port?: number;
  username?: string;
  region?: string;
  status: string;
  last_connected?: string;
  is_free_vps: boolean;
  specs?: Record<string, string>;
  expires_at?: string;
}

export const useVPS = () => {
  const { user } = useAuth();
  const [vpsConfigs, setVpsConfigs] = useState<VPSRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    if (!user) { setVpsConfigs([]); setLoading(false); return; }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('vps_configs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setVpsConfigs((data || []).map(r => ({
        id: r.id,
        name: r.name,
        type: r.type,
        host: r.host || undefined,
        port: r.port || undefined,
        username: r.username || undefined,
        region: r.region || undefined,
        status: r.status || 'disconnected',
        last_connected: r.last_connected || undefined,
        is_free_vps: r.is_free_vps || false,
        specs: (r.specs as Record<string, string>) || {},
        expires_at: r.expires_at || undefined,
      })));
    } catch (err) {
      console.error('Failed to load VPS configs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, [user]);

  const saveVPS = async (vps: Omit<VPSRecord, 'id'>) => {
    if (!user) return;
    const { error } = await supabase.from('vps_configs').insert({
      user_id: user.id,
      ...vps,
      specs: vps.specs || {},
    });
    if (error) throw error;
    await fetch();
  };

  const updateVPS = async (id: string, updates: Partial<VPSRecord>) => {
    if (!user) return;
    const { error } = await supabase
      .from('vps_configs')
      .update({ ...updates, specs: updates.specs || undefined })
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) throw error;
    await fetch();
  };

  const deleteVPS = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from('vps_configs').delete().eq('id', id).eq('user_id', user.id);
    if (error) throw error;
    await fetch();
  };

  return { vpsConfigs, loading, saveVPS, updateVPS, deleteVPS, refetch: fetch };
};
