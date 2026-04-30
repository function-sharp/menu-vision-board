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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      menu_filter_presets: {
        Row: {
          category: string | null
          created_at: string
          id: string
          name: string
          search_query: string | null
          store_group: string | null
          store_slug: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          name: string
          search_query?: string | null
          store_group?: string | null
          store_slug?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          name?: string
          search_query?: string | null
          store_group?: string | null
          store_slug?: string | null
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          category: string | null
          created_at: string
          currency: string | null
          deep_link: string | null
          description: string | null
          id: string
          name: string
          price: number | null
          store_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          currency?: string | null
          deep_link?: string | null
          description?: string | null
          id?: string
          name: string
          price?: number | null
          store_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          currency?: string | null
          deep_link?: string | null
          description?: string | null
          id?: string
          name?: string
          price?: number | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          airtable_id: string
          audience: string | null
          created_at: string
          date_range_original: string | null
          end_date: string | null
          funding_split: string | null
          id: string
          margin_check: string | null
          marketing_approval: string | null
          mechanic: string | null
          messaging: string | null
          month: string | null
          offer_type: string | null
          operations_approval: string | null
          priority: string | null
          promo_id: string | null
          rationale: string | null
          recommended_items: string[] | null
          start_date: string | null
          status: string | null
          store_group: string | null
          synced_at: string
          theme: string[] | null
          week: string | null
        }
        Insert: {
          airtable_id: string
          audience?: string | null
          created_at?: string
          date_range_original?: string | null
          end_date?: string | null
          funding_split?: string | null
          id?: string
          margin_check?: string | null
          marketing_approval?: string | null
          mechanic?: string | null
          messaging?: string | null
          month?: string | null
          offer_type?: string | null
          operations_approval?: string | null
          priority?: string | null
          promo_id?: string | null
          rationale?: string | null
          recommended_items?: string[] | null
          start_date?: string | null
          status?: string | null
          store_group?: string | null
          synced_at?: string
          theme?: string[] | null
          week?: string | null
        }
        Update: {
          airtable_id?: string
          audience?: string | null
          created_at?: string
          date_range_original?: string | null
          end_date?: string | null
          funding_split?: string | null
          id?: string
          margin_check?: string | null
          marketing_approval?: string | null
          mechanic?: string | null
          messaging?: string | null
          month?: string | null
          offer_type?: string | null
          operations_approval?: string | null
          priority?: string | null
          promo_id?: string | null
          rationale?: string | null
          recommended_items?: string[] | null
          start_date?: string | null
          status?: string | null
          store_group?: string | null
          synced_at?: string
          theme?: string[] | null
          week?: string | null
        }
        Relationships: []
      }
      scrape_jobs: {
        Row: {
          action: string
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          provider: string
          result: Json | null
          status: string
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          provider?: string
          result?: Json | null
          status?: string
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          provider?: string
          result?: Json | null
          status?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      stores: {
        Row: {
          address: string | null
          created_at: string
          cuisine: string | null
          id: string
          item_count: number
          name: string
          price_range: string | null
          rating: number | null
          rating_count: number | null
          slug: string
          store_group: string | null
          store_url: string | null
          telephone: string | null
          uber_eats_url: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          cuisine?: string | null
          id?: string
          item_count?: number
          name: string
          price_range?: string | null
          rating?: number | null
          rating_count?: number | null
          slug: string
          store_group?: string | null
          store_url?: string | null
          telephone?: string | null
          uber_eats_url?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          cuisine?: string | null
          id?: string
          item_count?: number
          name?: string
          price_range?: string | null
          rating?: number | null
          rating_count?: number | null
          slug?: string
          store_group?: string | null
          store_url?: string | null
          telephone?: string | null
          uber_eats_url?: string | null
        }
        Relationships: []
      }
      uploads: {
        Row: {
          filename: string | null
          id: string
          item_count: number
          note: string | null
          source: string
          store_count: number
          uploaded_at: string
        }
        Insert: {
          filename?: string | null
          id?: string
          item_count?: number
          note?: string | null
          source?: string
          store_count?: number
          uploaded_at?: string
        }
        Update: {
          filename?: string | null
          id?: string
          item_count?: number
          note?: string | null
          source?: string
          store_count?: number
          uploaded_at?: string
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
