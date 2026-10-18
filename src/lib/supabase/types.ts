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
      bank_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string
          external_id: string | null
          fingerprint: string
          id: string
          matched_id: string | null
          matched_type: string | null
          note: string | null
          org_id: string
          source: string
          status: string
          txn_date: string
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          external_id?: string | null
          fingerprint: string
          id?: string
          matched_id?: string | null
          matched_type?: string | null
          note?: string | null
          org_id: string
          source?: string
          status?: string
          txn_date: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          external_id?: string | null
          fingerprint?: string
          id?: string
          matched_id?: string | null
          matched_type?: string | null
          note?: string | null
          org_id?: string
          source?: string
          status?: string
          txn_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_ups: {
        Row: {
          banked_bank_transaction_id: string | null
          card_sales: number
          cash_banked: number | null
          cashup_date: string
          closing_float: number
          counted_cash: number
          created_at: string
          created_by: string | null
          denominations: Json
          expected_cash_sales: number
          id: string
          notes: string | null
          opening_float: number
          org_id: string
          other_sales: number
          paid_outs: number
          till: string
          variance: number | null
        }
        Insert: {
          banked_bank_transaction_id?: string | null
          card_sales?: number
          cash_banked?: number | null
          cashup_date: string
          closing_float?: number
          counted_cash?: number
          created_at?: string
          created_by?: string | null
          denominations?: Json
          expected_cash_sales?: number
          id?: string
          notes?: string | null
          opening_float?: number
          org_id: string
          other_sales?: number
          paid_outs?: number
          till?: string
          variance?: number | null
        }
        Update: {
          banked_bank_transaction_id?: string | null
          card_sales?: number
          cash_banked?: number | null
          cashup_date?: string
          closing_float?: number
          counted_cash?: number
          created_at?: string
          created_by?: string | null
          denominations?: Json
          expected_cash_sales?: number
          id?: string
          notes?: string | null
          opening_float?: number
          org_id?: string
          other_sales?: number
          paid_outs?: number
          till?: string
          variance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_ups_banked_bank_transaction_id_fkey"
            columns: ["banked_bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_ups_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
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
          label: string | null
          price_visible: boolean
          run_stop_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          price_visible?: boolean
          run_stop_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
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
      customer_members: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_members_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
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
      expenses: {
        Row: {
          bank_transaction_id: string | null
          category: string
          created_at: string
          description: string | null
          expense_date: string
          id: string
          net_amount: number
          org_id: string
          payee: string
          payment_method: string
          receipt_url: string | null
          total_amount: number | null
          vat_amount: number
        }
        Insert: {
          bank_transaction_id?: string | null
          category: string
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          net_amount: number
          org_id: string
          payee: string
          payment_method?: string
          receipt_url?: string | null
          total_amount?: number | null
          vat_amount?: number
        }
        Update: {
          bank_transaction_id?: string | null
          category?: string
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          net_amount?: number
          org_id?: string
          payee?: string
          payment_method?: string
          receipt_url?: string | null
          total_amount?: number | null
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "expenses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      external_refs: {
        Row: {
          entity_id: string
          entity_type: string
          external_id: string
          external_number: string | null
          id: string
          org_id: string
          provider: string
          synced_at: string
        }
        Insert: {
          entity_id: string
          entity_type: string
          external_id: string
          external_number?: string | null
          id?: string
          org_id: string
          provider: string
          synced_at?: string
        }
        Update: {
          entity_id?: string
          entity_type?: string
          external_id?: string
          external_number?: string | null
          id?: string
          org_id?: string
          provider?: string
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_refs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_connections: {
        Row: {
          account_id: string | null
          account_name: string | null
          connected_by: string | null
          created_at: string
          expires_at: string | null
          id: string
          last_error: string | null
          last_synced_at: string | null
          org_id: string
          provider: string
          scopes: string | null
          settings: Json
          status: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          account_name?: string | null
          connected_by?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          org_id: string
          provider: string
          scopes?: string | null
          settings?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          account_name?: string | null
          connected_by?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          org_id?: string
          provider?: string
          scopes?: string | null
          settings?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_connections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_secrets: {
        Row: {
          access_token: string
          connection_id: string
          refresh_token: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          connection_id: string
          refresh_token?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          connection_id?: string
          refresh_token?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_secrets_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: true
            referencedRelation: "integration_connections"
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
      invoice_payments: {
        Row: {
          amount: number
          bank_transaction_id: string | null
          created_at: string
          id: string
          invoice_id: string
          method: string
          org_id: string
          paid_on: string
          reference: string | null
        }
        Insert: {
          amount: number
          bank_transaction_id?: string | null
          created_at?: string
          id?: string
          invoice_id: string
          method?: string
          org_id: string
          paid_on?: string
          reference?: string | null
        }
        Update: {
          amount?: number
          bank_transaction_id?: string | null
          created_at?: string
          id?: string
          invoice_id?: string
          method?: string
          org_id?: string
          paid_on?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          vat_on_top: boolean
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
          vat_on_top?: boolean
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
          vat_on_top?: boolean
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
          add_vat_to_total: boolean
          auto_save_scans: boolean
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
          vat_number: string | null
        }
        Insert: {
          add_vat_to_total?: boolean
          auto_save_scans?: boolean
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
          vat_number?: string | null
        }
        Update: {
          add_vat_to_total?: boolean
          auto_save_scans?: boolean
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
          vat_number?: string | null
        }
        Relationships: []
      }
      pay_runs: {
        Row: {
          created_at: string
          employee_ni: number
          employee_pension: number
          employees: number
          employer_ni: number
          employer_pension: number
          gross_pay: number
          hmrc_bank_transaction_id: string | null
          hmrc_due_date: string
          hmrc_liability: number | null
          hmrc_paid_on: string | null
          id: string
          net_pay: number | null
          net_pay_bank_transaction_id: string | null
          notes: string | null
          org_id: string
          other_deductions: number
          pay_date: string
          paye: number
          period_end: string
          period_start: string
          source: string
          student_loan: number
        }
        Insert: {
          created_at?: string
          employee_ni?: number
          employee_pension?: number
          employees?: number
          employer_ni?: number
          employer_pension?: number
          gross_pay?: number
          hmrc_bank_transaction_id?: string | null
          hmrc_due_date: string
          hmrc_liability?: number | null
          hmrc_paid_on?: string | null
          id?: string
          net_pay?: number | null
          net_pay_bank_transaction_id?: string | null
          notes?: string | null
          org_id: string
          other_deductions?: number
          pay_date: string
          paye?: number
          period_end: string
          period_start: string
          source?: string
          student_loan?: number
        }
        Update: {
          created_at?: string
          employee_ni?: number
          employee_pension?: number
          employees?: number
          employer_ni?: number
          employer_pension?: number
          gross_pay?: number
          hmrc_bank_transaction_id?: string | null
          hmrc_due_date?: string
          hmrc_liability?: number | null
          hmrc_paid_on?: string | null
          id?: string
          net_pay?: number | null
          net_pay_bank_transaction_id?: string | null
          notes?: string | null
          org_id?: string
          other_deductions?: number
          pay_date?: string
          paye?: number
          period_end?: string
          period_start?: string
          source?: string
          student_loan?: number
        }
        Relationships: [
          {
            foreignKeyName: "pay_runs_hmrc_bank_transaction_id_fkey"
            columns: ["hmrc_bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_runs_net_pay_bank_transaction_id_fkey"
            columns: ["net_pay_bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_daily_sales: {
        Row: {
          card_total: number
          cash_total: number
          categories: Json
          created_at: string
          discounts: number
          gross_sales: number
          id: string
          location: string
          net_sales: number
          org_id: string
          other_total: number
          refunds: number
          sales_date: string
          service_charge: number
          source: string
          tips: number
          transactions: number
          updated_at: string
          vat_amount: number
        }
        Insert: {
          card_total?: number
          cash_total?: number
          categories?: Json
          created_at?: string
          discounts?: number
          gross_sales?: number
          id?: string
          location?: string
          net_sales?: number
          org_id: string
          other_total?: number
          refunds?: number
          sales_date: string
          service_charge?: number
          source: string
          tips?: number
          transactions?: number
          updated_at?: string
          vat_amount?: number
        }
        Update: {
          card_total?: number
          cash_total?: number
          categories?: Json
          created_at?: string
          discounts?: number
          gross_sales?: number
          id?: string
          location?: string
          net_sales?: number
          org_id?: string
          other_total?: number
          refunds?: number
          sales_date?: string
          service_charge?: number
          source?: string
          tips?: number
          transactions?: number
          updated_at?: string
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_daily_sales_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          vat_amount: number | null
          vat_rate: number
        }
        Insert: {
          description: string
          id?: string
          item_id?: string | null
          line_total?: number | null
          purchase_id: string
          qty?: number
          unit_cost?: number
          vat_amount?: number | null
          vat_rate?: number
        }
        Update: {
          description?: string
          id?: string
          item_id?: string | null
          line_total?: number | null
          purchase_id?: string
          qty?: number
          unit_cost?: number
          vat_amount?: number | null
          vat_rate?: number
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
          due_date: string | null
          id: string
          notes: string | null
          org_id: string
          paid_on: string | null
          purchase_date: string
          run_id: string | null
          status: string
          supplier_ref: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          org_id: string
          paid_on?: string | null
          purchase_date?: string
          run_id?: string | null
          status?: string
          supplier_ref?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          paid_on?: string | null
          purchase_date?: string
          run_id?: string | null
          status?: string
          supplier_ref?: string | null
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
      stock_count_lines: {
        Row: {
          count_id: string
          counted_qty: number
          id: string
          item_id: string | null
          item_name: string
          system_qty: number
          unit: string
          unit_cost: number
          variance_qty: number | null
          variance_value: number | null
        }
        Insert: {
          count_id: string
          counted_qty?: number
          id?: string
          item_id?: string | null
          item_name: string
          system_qty?: number
          unit?: string
          unit_cost?: number
          variance_qty?: number | null
          variance_value?: number | null
        }
        Update: {
          count_id?: string
          counted_qty?: number
          id?: string
          item_id?: string | null
          item_name?: string
          system_qty?: number
          unit?: string
          unit_cost?: number
          variance_qty?: number | null
          variance_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_count_lines_count_id_fkey"
            columns: ["count_id"]
            isOneToOne: false
            referencedRelation: "stock_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_count_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_counts: {
        Row: {
          applied: boolean
          counted_on: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          org_id: string
        }
        Insert: {
          applied?: boolean
          counted_on?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          org_id: string
        }
        Update: {
          applied?: boolean
          counted_on?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_counts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_logs: {
        Row: {
          created_at: string
          id: string
          item_count: number
          kind: string
          message: string | null
          org_id: string
          provider: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_count?: number
          kind: string
          message?: string | null
          org_id: string
          provider: string
          status: string
        }
        Update: {
          created_at?: string
          id?: string
          item_count?: number
          kind?: string
          message?: string | null
          org_id?: string
          provider?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vat_submissions: {
        Row: {
          boxes: Json
          environment: string
          id: string
          org_id: string
          period_end: string
          period_key: string
          period_start: string
          receipt: Json | null
          submitted_at: string
          submitted_by: string | null
        }
        Insert: {
          boxes: Json
          environment?: string
          id?: string
          org_id: string
          period_end: string
          period_key: string
          period_start: string
          receipt?: Json | null
          submitted_at?: string
          submitted_by?: string | null
        }
        Update: {
          boxes?: Json
          environment?: string
          id?: string
          org_id?: string
          period_end?: string
          period_key?: string
          period_start?: string
          receipt?: Json | null
          submitted_at?: string
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vat_submissions_org_id_fkey"
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
      vendor_members: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          user_id: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_members_vendor_id_fkey"
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
      wastage_logs: {
        Row: {
          cost: number | null
          created_at: string
          id: string
          item_id: string | null
          item_name: string
          logged_by: string | null
          logged_on: string
          notes: string | null
          org_id: string
          qty: number
          reason: string
          unit: string
          unit_cost: number
        }
        Insert: {
          cost?: number | null
          created_at?: string
          id?: string
          item_id?: string | null
          item_name: string
          logged_by?: string | null
          logged_on?: string
          notes?: string | null
          org_id: string
          qty: number
          reason?: string
          unit?: string
          unit_cost?: number
        }
        Update: {
          cost?: number | null
          created_at?: string
          id?: string
          item_id?: string | null
          item_name?: string
          logged_by?: string | null
          logged_on?: string
          notes?: string | null
          org_id?: string
          qty?: number
          reason?: string
          unit?: string
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "wastage_logs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wastage_logs_org_id_fkey"
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
      current_user_customer_ids: { Args: never; Returns: string[] }
      current_user_customer_run_ids: { Args: never; Returns: string[] }
      current_user_org_ids: { Args: never; Returns: string[] }
      current_user_vendor_ids: { Args: never; Returns: string[] }
      current_user_vendor_run_ids: { Args: never; Returns: string[] }
      generate_recurring_invoices: { Args: never; Returns: undefined }
      get_customer_members: {
        Args: { p_customer_id: string }
        Returns: {
          created_at: string
          email: string
          id: string
          role: string
          user_id: string
        }[]
      }
      get_invoicing_org_name: {
        Args: { p_customer_id: string }
        Returns: string
      }
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
      get_purchasing_org_name: {
        Args: { p_vendor_id: string }
        Returns: string
      }
      get_vendor_members: {
        Args: { p_vendor_id: string }
        Returns: {
          created_at: string
          email: string
          id: string
          role: string
          user_id: string
        }[]
      }
      is_customer_admin: { Args: { p_customer_id: string }; Returns: boolean }
      is_org_admin: { Args: { p_org_id: string }; Returns: boolean }
      is_org_bookkeeping: { Args: { p_org_id: string }; Returns: boolean }
      is_vendor_admin: { Args: { p_vendor_id: string }; Returns: boolean }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
