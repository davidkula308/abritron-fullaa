export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      bots: {
        Row: {
          account_id: string | null
          created_at: string
          description: string | null
          file_name: string | null
          file_type: string | null
          id: string
          name: string
          open_positions: Json | null
          parameters: Json | null
          selected_pair: string | null
          selected_timeframe: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_type?: string | null
          id?: string
          name: string
          open_positions?: Json | null
          parameters?: Json | null
          selected_pair?: string | null
          selected_timeframe?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_type?: string | null
          id?: string
          name?: string
          open_positions?: Json | null
          parameters?: Json | null
          selected_pair?: string | null
          selected_timeframe?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bots_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "trading_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_trades: {
        Row: {
          account_id: string | null
          created_at: string
          id: string
          lot_size: number
          num_trades: number
          pair: string
          scheduled_time: string
          status: string | null
          stop_loss: number | null
          take_profit: number | null
          timeframe: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          id?: string
          lot_size?: number
          num_trades?: number
          pair: string
          scheduled_time: string
          status?: string | null
          stop_loss?: number | null
          take_profit?: number | null
          timeframe: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          id?: string
          lot_size?: number
          num_trades?: number
          pair?: string
          scheduled_time?: string
          status?: string | null
          stop_loss?: number | null
          take_profit?: number | null
          timeframe?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_trades_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "trading_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      strategies: {
        Row: {
          action: string | null
          advanced_type: string | null
          conditions: Json | null
          created_at: string
          id: string
          indicator_type: string | null
          is_active: boolean | null
          name: string
          notification_email: string | null
          parameters: Json | null
          selected_account_id: string | null
          selected_pair: string | null
          selected_timeframe: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action?: string | null
          advanced_type?: string | null
          conditions?: Json | null
          created_at?: string
          id?: string
          indicator_type?: string | null
          is_active?: boolean | null
          name: string
          notification_email?: string | null
          parameters?: Json | null
          selected_account_id?: string | null
          selected_pair?: string | null
          selected_timeframe?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action?: string | null
          advanced_type?: string | null
          conditions?: Json | null
          created_at?: string
          id?: string
          indicator_type?: string | null
          is_active?: boolean | null
          name?: string
          notification_email?: string | null
          parameters?: Json | null
          selected_account_id?: string | null
          selected_pair?: string | null
          selected_timeframe?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "strategies_selected_account_id_fkey"
            columns: ["selected_account_id"]
            isOneToOne: false
            referencedRelation: "trading_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      trading_accounts: {
        Row: {
          access_token: string | null
          account_id: string
          account_name: string | null
          balance: number | null
          broker_name: string | null
          created_at: string
          currency: string | null
          equity: number | null
          id: string
          is_live: boolean | null
          last_synced_at: string | null
          leverage: string | null
          platform: string
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          account_id: string
          account_name?: string | null
          balance?: number | null
          broker_name?: string | null
          created_at?: string
          currency?: string | null
          equity?: number | null
          id?: string
          is_live?: boolean | null
          last_synced_at?: string | null
          leverage?: string | null
          platform: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          account_id?: string
          account_name?: string | null
          balance?: number | null
          broker_name?: string | null
          created_at?: string
          currency?: string | null
          equity?: number | null
          id?: string
          is_live?: boolean | null
          last_synced_at?: string | null
          leverage?: string | null
          platform?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vps_configs: {
        Row: {
          created_at: string
          expires_at: string | null
          host: string | null
          id: string
          is_free_vps: boolean | null
          last_connected: string | null
          name: string
          password: string | null
          port: number | null
          region: string | null
          specs: Json | null
          status: string | null
          type: string
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          host?: string | null
          id?: string
          is_free_vps?: boolean | null
          last_connected?: string | null
          name: string
          password?: string | null
          port?: number | null
          region?: string | null
          specs?: Json | null
          status?: string | null
          type?: string
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          host?: string | null
          id?: string
          is_free_vps?: boolean | null
          last_connected?: string | null
          name?: string
          password?: string | null
          port?: number | null
          region?: string | null
          specs?: Json | null
          status?: string | null
          type?: string
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
