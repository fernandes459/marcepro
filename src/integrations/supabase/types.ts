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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ai_insights: {
        Row: {
          alerts: Json
          company_id: string | null
          created_at: string
          health_label: string | null
          id: string
          insights: Json
          metrics_snapshot: Json
          model: string | null
          recommendations: Json
          scope: string
          score: number
          summary: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          alerts?: Json
          company_id?: string | null
          created_at?: string
          health_label?: string | null
          id?: string
          insights?: Json
          metrics_snapshot?: Json
          model?: string | null
          recommendations?: Json
          scope?: string
          score?: number
          summary?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          alerts?: Json
          company_id?: string | null
          created_at?: string
          health_label?: string | null
          id?: string
          insights?: Json
          metrics_snapshot?: Json
          model?: string | null
          recommendations?: Json
          scope?: string
          score?: number
          summary?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          company_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          metadata: Json
          module: string
          new_data: Json | null
          old_data: Json | null
          summary: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json
          module: string
          new_data?: Json | null
          old_data?: Json | null
          summary?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json
          module?: string
          new_data?: Json | null
          old_data?: Json | null
          summary?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_number: string | null
          account_type: string
          agency: string | null
          bank_name: string | null
          color: string | null
          company_id: string | null
          created_at: string
          current_balance: number
          id: string
          initial_balance: number
          is_main: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_number?: string | null
          account_type?: string
          agency?: string | null
          bank_name?: string | null
          color?: string | null
          company_id?: string | null
          created_at?: string
          current_balance?: number
          id?: string
          initial_balance?: number
          is_main?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_number?: string | null
          account_type?: string
          agency?: string | null
          bank_name?: string | null
          color?: string | null
          company_id?: string | null
          created_at?: string
          current_balance?: number
          id?: string
          initial_balance?: number
          is_main?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bank_transfers: {
        Row: {
          amount: number
          company_id: string | null
          created_at: string
          date: string
          description: string | null
          from_account_id: string
          id: string
          to_account_id: string
          user_id: string
        }
        Insert: {
          amount?: number
          company_id?: string | null
          created_at?: string
          date?: string
          description?: string | null
          from_account_id: string
          id?: string
          to_account_id: string
          user_id: string
        }
        Update: {
          amount?: number
          company_id?: string | null
          created_at?: string
          date?: string
          description?: string | null
          from_account_id?: string
          id?: string
          to_account_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transfers_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transfers_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_items: {
        Row: {
          budget_id: string
          id: string
          labor_cost: number
          material_cost: number
          name: string
          quantity: number
          room_label: string | null
          unit_price: number
        }
        Insert: {
          budget_id: string
          id?: string
          labor_cost?: number
          material_cost?: number
          name: string
          quantity?: number
          room_label?: string | null
          unit_price?: number
        }
        Update: {
          budget_id?: string
          id?: string
          labor_cost?: number
          material_cost?: number
          name?: string
          quantity?: number
          room_label?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          approved_at: string | null
          budget_mode: string
          client_description: string | null
          client_id: string | null
          code: string
          company_id: string | null
          complexity_factor: number
          created_at: string
          final_price: number
          finish_type: string | null
          id: string
          material_multiplier: number
          notes: string | null
          payment_method: string | null
          profit_margin: number
          project_name: string | null
          project_type: string | null
          seller_id: string | null
          status: string
          total_cost: number
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          budget_mode?: string
          client_description?: string | null
          client_id?: string | null
          code: string
          company_id?: string | null
          complexity_factor?: number
          created_at?: string
          final_price?: number
          finish_type?: string | null
          id?: string
          material_multiplier?: number
          notes?: string | null
          payment_method?: string | null
          profit_margin?: number
          project_name?: string | null
          project_type?: string | null
          seller_id?: string | null
          status?: string
          total_cost?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          budget_mode?: string
          client_description?: string | null
          client_id?: string | null
          code?: string
          company_id?: string | null
          complexity_factor?: number
          created_at?: string
          final_price?: number
          finish_type?: string | null
          id?: string
          material_multiplier?: number
          notes?: string | null
          payment_method?: string | null
          profit_margin?: number
          project_name?: string | null
          project_type?: string | null
          seller_id?: string | null
          status?: string
          total_cost?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          address_number: string | null
          budgets_count: number | null
          cep: string | null
          city: string | null
          company_id: string | null
          complement: string | null
          cpf_cnpj: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          neighborhood: string | null
          phone: string
          state: string | null
          total_spent: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          address_number?: string | null
          budgets_count?: number | null
          cep?: string | null
          city?: string | null
          company_id?: string | null
          complement?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          neighborhood?: string | null
          phone: string
          state?: string | null
          total_spent?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          address_number?: string | null
          budgets_count?: number | null
          cep?: string | null
          city?: string | null
          company_id?: string | null
          complement?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          neighborhood?: string | null
          phone?: string
          state?: string | null
          total_spent?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      collaborator_work_logs: {
        Row: {
          budget_id: string | null
          client_id: string | null
          company_id: string | null
          created_at: string
          daily_rate: number
          days_worked: number
          description: string | null
          employee_id: string
          hourly_rate: number
          hours_worked: number
          id: string
          linked_transaction_id: string | null
          status: string
          total_amount: number
          updated_at: string
          user_id: string
          work_date: string
        }
        Insert: {
          budget_id?: string | null
          client_id?: string | null
          company_id?: string | null
          created_at?: string
          daily_rate?: number
          days_worked?: number
          description?: string | null
          employee_id: string
          hourly_rate?: number
          hours_worked?: number
          id?: string
          linked_transaction_id?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
          user_id: string
          work_date?: string
        }
        Update: {
          budget_id?: string | null
          client_id?: string | null
          company_id?: string | null
          created_at?: string
          daily_rate?: number
          days_worked?: number
          description?: string | null
          employee_id?: string
          hourly_rate?: number
          hours_worked?: number
          id?: string
          linked_transaction_id?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
          user_id?: string
          work_date?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          active: boolean
          address: string | null
          cep: string | null
          city: string | null
          cnpj: string | null
          created_at: string
          email: string | null
          id: string
          legal_name: string | null
          logo_url: string | null
          name: string
          owner_id: string
          phone: string | null
          plan: string
          settings: Json
          state: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          cep?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          owner_id: string
          phone?: string | null
          plan?: string
          settings?: Json
          state?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          cep?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          owner_id?: string
          phone?: string | null
          plan?: string
          settings?: Json
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          address: string | null
          avg_projects_per_month: number
          card_fees: Json
          cep: string | null
          city: string | null
          cnpj: string | null
          company_id: string | null
          company_name: string | null
          created_at: string
          default_commission: number
          default_margin: number | null
          email: string | null
          id: string
          logo_url: string | null
          min_margin: number
          monthly_goal: number
          phone: string | null
          state: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          avg_projects_per_month?: number
          card_fees?: Json
          cep?: string | null
          city?: string | null
          cnpj?: string | null
          company_id?: string | null
          company_name?: string | null
          created_at?: string
          default_commission?: number
          default_margin?: number | null
          email?: string | null
          id?: string
          logo_url?: string | null
          min_margin?: number
          monthly_goal?: number
          phone?: string | null
          state?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          avg_projects_per_month?: number
          card_fees?: Json
          cep?: string | null
          city?: string | null
          cnpj?: string | null
          company_id?: string | null
          company_name?: string | null
          created_at?: string
          default_commission?: number
          default_margin?: number | null
          email?: string | null
          id?: string
          logo_url?: string | null
          min_margin?: number
          monthly_goal?: number
          phone?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      edge_tapes: {
        Row: {
          active: boolean
          color: string | null
          company_id: string | null
          created_at: string
          finish: string | null
          id: string
          name: string
          notes: string | null
          price_per_m: number
          price_per_roll: number
          roll_length_m: number
          supplier: string | null
          thickness_mm: number
          updated_at: string
          user_id: string
          width_mm: number
        }
        Insert: {
          active?: boolean
          color?: string | null
          company_id?: string | null
          created_at?: string
          finish?: string | null
          id?: string
          name: string
          notes?: string | null
          price_per_m?: number
          price_per_roll?: number
          roll_length_m?: number
          supplier?: string | null
          thickness_mm?: number
          updated_at?: string
          user_id: string
          width_mm?: number
        }
        Update: {
          active?: boolean
          color?: string | null
          company_id?: string | null
          created_at?: string
          finish?: string | null
          id?: string
          name?: string
          notes?: string | null
          price_per_m?: number
          price_per_roll?: number
          roll_length_m?: number
          supplier?: string | null
          thickness_mm?: number
          updated_at?: string
          user_id?: string
          width_mm?: number
        }
        Relationships: []
      }
      employees: {
        Row: {
          company_id: string | null
          cpf: string | null
          created_at: string
          daily_rate: number
          email: string | null
          hire_date: string | null
          hourly_rate: number
          id: string
          name: string
          notes: string | null
          phone: string | null
          role: string
          salary: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          cpf?: string | null
          created_at?: string
          daily_rate?: number
          email?: string | null
          hire_date?: string | null
          hourly_rate?: number
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          role?: string
          salary?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          cpf?: string | null
          created_at?: string
          daily_rate?: number
          email?: string | null
          hire_date?: string | null
          hourly_rate?: number
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          role?: string
          salary?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_categories: {
        Row: {
          color: string | null
          company_id: string | null
          created_at: string
          id: string
          is_system: boolean
          name: string
          slug: string
          sort_order: number
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          is_system?: boolean
          name: string
          slug: string
          sort_order?: number
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          is_system?: boolean
          name?: string
          slug?: string
          sort_order?: number
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_transactions: {
        Row: {
          amount: number
          bank_account_id: string | null
          budget_id: string | null
          category: string
          client_id: string | null
          company_id: string | null
          created_at: string
          date: string
          description: string
          due_date: string | null
          id: string
          is_fixed: boolean
          notes: string | null
          order_number: string | null
          paid_date: string | null
          payment_method: string | null
          recurrence: string | null
          status: string
          subcategory: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          bank_account_id?: string | null
          budget_id?: string | null
          category: string
          client_id?: string | null
          company_id?: string | null
          created_at?: string
          date?: string
          description: string
          due_date?: string | null
          id?: string
          is_fixed?: boolean
          notes?: string | null
          order_number?: string | null
          paid_date?: string | null
          payment_method?: string | null
          recurrence?: string | null
          status?: string
          subcategory?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          budget_id?: string | null
          category?: string
          client_id?: string | null
          company_id?: string | null
          created_at?: string
          date?: string
          description?: string
          due_date?: string | null
          id?: string
          is_fixed?: boolean
          notes?: string | null
          order_number?: string | null
          paid_date?: string | null
          payment_method?: string | null
          recurrence?: string | null
          status?: string
          subcategory?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      hardware_items: {
        Row: {
          active: boolean
          brand: string | null
          category: string
          company_id: string | null
          created_at: string
          finish: string | null
          id: string
          length_mm: number | null
          name: string
          notes: string | null
          supplier: string | null
          unit: string
          unit_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          brand?: string | null
          category?: string
          company_id?: string | null
          created_at?: string
          finish?: string | null
          id?: string
          length_mm?: number | null
          name: string
          notes?: string | null
          supplier?: string | null
          unit?: string
          unit_price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          brand?: string | null
          category?: string
          company_id?: string | null
          created_at?: string
          finish?: string | null
          id?: string
          length_mm?: number | null
          name?: string
          notes?: string | null
          supplier?: string | null
          unit?: string
          unit_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lead_interactions: {
        Row: {
          company_id: string | null
          created_at: string
          description: string
          id: string
          kind: string
          lead_id: string
          occurred_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description: string
          id?: string
          kind?: string
          lead_id: string
          occurred_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string
          id?: string
          kind?: string
          lead_id?: string
          occurred_at?: string
          user_id?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          assignee: string | null
          budget_id: string | null
          client_id: string | null
          company_id: string | null
          created_at: string
          email: string | null
          estimated_value: number
          id: string
          lost_at: string | null
          lost_reason: string | null
          name: string
          next_contact_at: string | null
          notes: string | null
          phone: string | null
          probability: number
          source: string | null
          stage: string
          updated_at: string
          user_id: string
          won_at: string | null
        }
        Insert: {
          assignee?: string | null
          budget_id?: string | null
          client_id?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          estimated_value?: number
          id?: string
          lost_at?: string | null
          lost_reason?: string | null
          name: string
          next_contact_at?: string | null
          notes?: string | null
          phone?: string | null
          probability?: number
          source?: string | null
          stage?: string
          updated_at?: string
          user_id: string
          won_at?: string | null
        }
        Update: {
          assignee?: string | null
          budget_id?: string | null
          client_id?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          estimated_value?: number
          id?: string
          lost_at?: string | null
          lost_reason?: string | null
          name?: string
          next_contact_at?: string | null
          notes?: string | null
          phone?: string | null
          probability?: number
          source?: string | null
          stage?: string
          updated_at?: string
          user_id?: string
          won_at?: string | null
        }
        Relationships: []
      }
      material_catalog: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          import_batch: string | null
          last_imported_at: string | null
          name: string
          notes: string | null
          source: string
          supplier: string | null
          unit: string
          unit_cost: number
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          import_batch?: string | null
          last_imported_at?: string | null
          name: string
          notes?: string | null
          source?: string
          supplier?: string | null
          unit?: string
          unit_cost?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          import_batch?: string | null
          last_imported_at?: string | null
          name?: string
          notes?: string | null
          source?: string
          supplier?: string | null
          unit?: string
          unit_cost?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          company_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          kind: string
          link: string | null
          read_at: string | null
          severity: string
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          kind: string
          link?: string | null
          read_at?: string | null
          severity?: string
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          severity?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      operational_costs: {
        Row: {
          active: boolean
          category: string
          company_id: string | null
          created_at: string
          id: string
          monthly_amount: number
          name: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          category?: string
          company_id?: string | null
          created_at?: string
          id?: string
          monthly_amount?: number
          name: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          category?: string
          company_id?: string | null
          created_at?: string
          id?: string
          monthly_amount?: number
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_milestones: {
        Row: {
          amount: number
          budget_id: string
          company_id: string | null
          created_at: string
          due_date: string | null
          id: string
          linked_transaction_id: string | null
          notes: string | null
          paid_date: string | null
          percentage: number
          production_stage: string | null
          sort_order: number
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          budget_id: string
          company_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          linked_transaction_id?: string | null
          notes?: string | null
          paid_date?: string | null
          percentage?: number
          production_stage?: string | null
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          budget_id?: string
          company_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          linked_transaction_id?: string | null
          notes?: string | null
          paid_date?: string | null
          percentage?: number
          production_stage?: string | null
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_milestones_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      production_capacity: {
        Row: {
          company_id: string | null
          created_at: string
          hours_per_day: number
          id: string
          notes: string | null
          parallel_tasks: number
          stage: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          hours_per_day?: number
          id?: string
          notes?: string | null
          parallel_tasks?: number
          stage: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          hours_per_day?: number
          id?: string
          notes?: string | null
          parallel_tasks?: number
          stage?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      production_tasks: {
        Row: {
          assembly_checklist: Json | null
          assembly_completed_at: string | null
          assembly_completed_by: string | null
          assignee: string | null
          budget_id: string | null
          client_name: string
          company_id: string | null
          created_at: string
          due_date: string | null
          estimated_hours: number | null
          has_pending_issues: boolean
          id: string
          notes: string | null
          priority: string
          project_name: string
          stage: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assembly_checklist?: Json | null
          assembly_completed_at?: string | null
          assembly_completed_by?: string | null
          assignee?: string | null
          budget_id?: string | null
          client_name: string
          company_id?: string | null
          created_at?: string
          due_date?: string | null
          estimated_hours?: number | null
          has_pending_issues?: boolean
          id?: string
          notes?: string | null
          priority?: string
          project_name: string
          stage?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assembly_checklist?: Json | null
          assembly_completed_at?: string | null
          assembly_completed_by?: string | null
          assignee?: string | null
          budget_id?: string | null
          client_name?: string
          company_id?: string | null
          created_at?: string
          due_date?: string | null
          estimated_hours?: number | null
          has_pending_issues?: boolean
          id?: string
          notes?: string | null
          priority?: string
          project_name?: string
          stage?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_tasks_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      region_pricing: {
        Row: {
          active: boolean
          company_id: string | null
          created_at: string
          id: string
          multiplier: number
          name: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          company_id?: string | null
          created_at?: string
          id?: string
          multiplier?: number
          name: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          company_id?: string | null
          created_at?: string
          id?: string
          multiplier?: number
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sheet_materials: {
        Row: {
          active: boolean
          color: string | null
          company_id: string | null
          created_at: string
          density_kg_m3: number
          finish: string | null
          id: string
          material_type: string
          name: string
          notes: string | null
          price_per_m2: number
          price_per_sheet: number
          sheet_height_mm: number
          sheet_width_mm: number
          supplier: string | null
          thickness_mm: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          color?: string | null
          company_id?: string | null
          created_at?: string
          density_kg_m3?: number
          finish?: string | null
          id?: string
          material_type?: string
          name: string
          notes?: string | null
          price_per_m2?: number
          price_per_sheet?: number
          sheet_height_mm?: number
          sheet_width_mm?: number
          supplier?: string | null
          thickness_mm?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          color?: string | null
          company_id?: string | null
          created_at?: string
          density_kg_m3?: number
          finish?: string | null
          id?: string
          material_type?: string
          name?: string
          notes?: string | null
          price_per_m2?: number
          price_per_sheet?: number
          sheet_height_mm?: number
          sheet_width_mm?: number
          supplier?: string | null
          thickness_mm?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      technical_assistance: {
        Row: {
          activity_type: string
          address: string | null
          assignee: string | null
          budget_id: string | null
          client_name: string
          company_id: string | null
          created_at: string
          description: string
          id: string
          opened_at: string
          phone: string | null
          priority: string
          production_task_id: string | null
          project_name: string
          resolution_notes: string | null
          resolved_at: string | null
          scheduled_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_type?: string
          address?: string | null
          assignee?: string | null
          budget_id?: string | null
          client_name: string
          company_id?: string | null
          created_at?: string
          description: string
          id?: string
          opened_at?: string
          phone?: string | null
          priority?: string
          production_task_id?: string | null
          project_name: string
          resolution_notes?: string | null
          resolved_at?: string | null
          scheduled_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_type?: string
          address?: string | null
          assignee?: string | null
          budget_id?: string | null
          client_name?: string
          company_id?: string | null
          created_at?: string
          description?: string
          id?: string
          opened_at?: string
          phone?: string | null
          priority?: string
          production_task_id?: string | null
          project_name?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          scheduled_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "technical_assistance_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_assistance_production_task_id_fkey"
            columns: ["production_task_id"]
            isOneToOne: false
            referencedRelation: "production_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          owner_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          owner_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          owner_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_data: {
        Args: { _data_owner_id: string; _user_id: string }
        Returns: boolean
      }
      get_data_owner_id: { Args: { _user_id: string }; Returns: string }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      get_user_id_by_email: { Args: { _email: string }; Returns: string }
      has_company_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      log_audit: {
        Args: {
          _action: string
          _entity_id?: string
          _entity_type?: string
          _metadata?: Json
          _module: string
          _new_data?: Json
          _old_data?: Json
          _summary?: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "partner"
        | "sales"
        | "production"
        | "viewer"
        | "gerente"
        | "vendedor"
        | "producao"
        | "financeiro"
        | "instalador"
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
    Enums: {
      app_role: [
        "admin",
        "partner",
        "sales",
        "production",
        "viewer",
        "gerente",
        "vendedor",
        "producao",
        "financeiro",
        "instalador",
      ],
    },
  },
} as const
