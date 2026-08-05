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
      checklist_items: {
        Row: {
          category: string
          checklist_id: string
          description: string
          id: string
          item_id: string | null
          qty: number
          sort_order: number
          unit: string
          unit_price: number
        }
        Insert: {
          category?: string
          checklist_id: string
          description: string
          id?: string
          item_id?: string | null
          qty?: number
          sort_order?: number
          unit?: string
          unit_price?: number
        }
        Update: {
          category?: string
          checklist_id?: string
          description?: string
          id?: string
          item_id?: string | null
          qty?: number
          sort_order?: number
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      checklists: {
        Row: {
          created_at: string
          id: string
          price_visible: boolean
          run_stop_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          price_visible?: boolean
          run_stop_id: string
        }
        Update: {
          created_at?: string
          id?: string
          price_visible?: boolean
          run_stop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklists_run_stop_id_fkey"
            columns: ["run_stop_id"]
            isOneToOne: true
            referencedRelation: "run_stops"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          org_id: string
          phone: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          org_id: string
          phone?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          org_id?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          description: string
          id: string
          invoice_id: string
          item_id: string | null
          line_total: number | null
          qty: number
          sort_order: number
          unit_cost: number
          unit_price: number
          vat_amount: number | null
          vat_rate: number
        }
        Insert: {
          description: string
          id?: string
          invoice_id: string
          item_id?: string | null
          line_total?: number | null
          qty?: number
          sort_order?: number
          unit_cost?: number
          unit_price?: number
          vat_amount?: number | null
          vat_rate?: number
        }
        Update: {
          description?: string
          id?: string
          invoice_id?: string
          item_id?: string | null
          line_total?: number | null
          qty?: number
          sort_order?: number
          unit_cost?: number
          unit_price?: number
          vat_amount?: number | null
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          customer_id: string
          due_date: string | null
          id: string
          issue_date: string
          notes: string | null
          number: string | null
          org_id: string
          run_id: string | null
          signature_url: string | null
          status: string
          subtotal: number
          tax: number
          template_id: string | null
          total: number
        }
        Insert: {
          created_at?: string
          customer_id: string
          due_date?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          number?: string | null
          org_id: string
          run_id?: string | null
          signature_url?: string | null
          status?: string
          subtotal?: number
          tax?: number
          template_id?: string | null
          total?: number
        }
        Update: {
          created_at?: string
          customer_id?: string
          due_date?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          number?: string | null
          org_id?: string
          run_id?: string | null
          signature_url?: string | null
          status?: string
          subtotal?: number
          tax?: number
          template_id?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "recurring_invoice_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          item_code: string | null
          name: string
          org_id: string
          sale_price: number
          stock_qty: number
          unit: string
          vat_rate: number
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          item_code?: string | null
          name: string
          org_id: string
          sale_price?: number
          stock_qty?: number
          unit?: string
          vat_rate?: number
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          item_code?: string | null
          name?: string
          org_id?: string
          sale_price?: number
          stock_qty?: number
          unit?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          id: string
          item_code_seq: number
          name: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_exempt: boolean
          subscription_plan: string | null
          subscription_status: string
          subscription_tier: string
          trial_ends_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          item_code_seq?: number
          name: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_exempt?: boolean
          subscription_plan?: string | null
          subscription_status?: string
          subscription_tier?: string
          trial_ends_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          item_code_seq?: number
          name?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_exempt?: boolean
          subscription_plan?: string | null
          subscription_status?: string
          subscription_tier?: string
          trial_ends_at?: string
        }
        Relationships: []
      }
      purchase_line_items: {
        Row: {
          description: string
          id: string
          item_id: string | null
          line_total: number | null
          purchase_id: string
          qty: number
          unit_cost: number
        }
        Insert: {
          description: string
          id?: string
          item_id?: string | null
          line_total?: number | null
          purchase_id: string
          qty?: number
          unit_cost?: number
        }
        Update: {
          description?: string
          id?: string
          item_id?: string | null
          line_total?: number | null
          purchase_id?: string
          qty?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_line_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_line_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          org_id: string
          purchase_date: string
          run_id: string | null
          status: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          org_id: string
          purchase_date?: string
          run_id?: string | null
          status?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          org_id?: string
          purchase_date?: string
          run_id?: string | null
          status?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_line_items: {
        Row: {
          description: string
          id: string
          item_id: string | null
          line_total: number | null
          qty: number
          quote_id: string
          sort_order: number
          unit_price: number
        }
        Insert: {
          description: string
          id?: string
          item_id?: string | null
          line_total?: number | null
          qty?: number
          quote_id: string
          sort_order?: number
          unit_price?: number
        }
        Update: {
          description?: string
          id?: string
          item_id?: string | null
          line_total?: number | null
          qty?: number
          quote_id?: string
          sort_order?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_line_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_line_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          created_at: string
          id: string
          issue_date: string
          notes: string | null
          org_id: string
          recipient_contact: string | null
          recipient_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          issue_date?: string
          notes?: string | null
          org_id: string
          recipient_contact?: string | null
          recipient_name: string
        }
        Update: {
          created_at?: string
          id?: string
          issue_date?: string
          notes?: string | null
          org_id?: string
          recipient_contact?: string | null
          recipient_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_scans: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          invoice_id: string | null
          org_id: string
          parsed_rows: Json | null
          purchase_id: string | null
          raw_ocr_text: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          invoice_id?: string | null
          org_id: string
          parsed_rows?: Json | null
          purchase_id?: string | null
          raw_ocr_text?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          invoice_id?: string | null
          org_id?: string
          parsed_rows?: Json | null
          purchase_id?: string | null
          raw_ocr_text?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_scans_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_scans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_scans_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_invoice_template_items: {
        Row: {
          description: string
          id: string
          item_id: string | null
          qty: number
          sort_order: number
          template_id: string
          unit_cost: number
          unit_price: number
        }
        Insert: {
          description: string
          id?: string
          item_id?: string | null
          qty?: number
          sort_order?: number
          template_id: string
          unit_cost?: number
          unit_price?: number
        }
        Update: {
          description?: string
          id?: string
          item_id?: string | null
          qty?: number
          sort_order?: number
          template_id?: string
          unit_cost?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "recurring_invoice_template_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_invoice_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "recurring_invoice_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_invoice_templates: {
        Row: {
          active: boolean
          cadence: string
          created_at: string
          customer_id: string
          id: string
          next_run_date: string
          org_id: string
        }
        Insert: {
          active?: boolean
          cadence?: string
          created_at?: string
          customer_id: string
          id?: string
          next_run_date: string
          org_id: string
        }
        Update: {
          active?: boolean
          cadence?: string
          created_at?: string
          customer_id?: string
          id?: string
          next_run_date?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_invoice_templates_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_invoice_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      run_stops: {
        Row: {
          customer_id: string | null
          id: string
          run_id: string
          sequence: number
          stop_type: string
          vendor_id: string | null
        }
        Insert: {
          customer_id?: string | null
          id?: string
          run_id: string
          sequence?: number
          stop_type: string
          vendor_id?: string | null
        }
        Update: {
          customer_id?: string | null
          id?: string
          run_id?: string
          sequence?: number
          stop_type?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "run_stops_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "run_stops_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "run_stops_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      runs: {
        Row: {
          created_at: string
          id: string
          org_id: string
          run_date: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          run_date?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          run_date?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_item_prices: {
        Row: {
          cost_price: number
          id: string
          item_id: string
          last_purchased_at: string | null
          org_id: string
          vendor_id: string
        }
        Insert: {
          cost_price?: number
          id?: string
          item_id: string
          last_purchased_at?: string | null
          org_id: string
          vendor_id: string
        }
        Update: {
          cost_price?: number
          id?: string
          item_id?: string
          last_purchased_at?: string | null
          org_id?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_item_prices_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_item_prices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_item_prices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          contact: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          org_id: string
        }
        Insert: {
          address?: string | null
          contact?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          org_id: string
        }
        Update: {
          address?: string | null
          contact?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendors_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_org_invite: { Args: never; Returns: undefined }
      create_organization: { Args: { p_name: string }; Returns: string }
      current_user_org_ids: { Args: never; Returns: string[] }
      generate_recurring_invoices: { Args: never; Returns: undefined }
      get_org_members: {
        Args: { p_org_id: string }
        Returns: {
          created_at: string
          email: string
          id: string
          role: string
          user_id: string
        }[]
      }
      is_org_admin: { Args: { p_org_id: string }; Returns: boolean }
      select_subscription_plan: { Args: { p_plan: string }; Returns: undefined }
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
