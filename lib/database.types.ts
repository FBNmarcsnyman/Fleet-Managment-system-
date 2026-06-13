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
      bowser_refills: {
        Row: {
          bowser_id: string
          cost_per_liter: number
          created_at: string
          date: string
          final_cost_per_liter: number
          id: string
          liters: number
          notes: string | null
          organization_id: string
          rebate_percentage: number | null
          reference_number: string
          supplier: string | null
        }
        Insert: {
          bowser_id: string
          cost_per_liter: number
          created_at?: string
          date: string
          final_cost_per_liter: number
          id?: string
          liters: number
          notes?: string | null
          organization_id: string
          rebate_percentage?: number | null
          reference_number: string
          supplier?: string | null
        }
        Update: {
          bowser_id?: string
          cost_per_liter?: number
          created_at?: string
          date?: string
          final_cost_per_liter?: number
          id?: string
          liters?: number
          notes?: string | null
          organization_id?: string
          rebate_percentage?: number | null
          reference_number?: string
          supplier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bowser_refills_bowser_id_fkey"
            columns: ["bowser_id"]
            isOneToOne: false
            referencedRelation: "bowsers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bowser_refills_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bowsers: {
        Row: {
          branch_id: string | null
          capacity_liters: number | null
          created_at: string
          current_stock_liters: number | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          capacity_liters?: number | null
          created_at?: string
          current_stock_liters?: number | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          capacity_liters?: number | null
          created_at?: string
          current_stock_liters?: number | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bowsers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bowsers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          code: string
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          amount: number
          created_at: string
          id: string
          organization_id: string
          period: string
          start_date: string
          target_id: string
          target_type: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          organization_id: string
          period?: string
          start_date: string
          target_id: string
          target_type: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          organization_id?: string
          period?: string
          start_date?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_submissions: {
        Row: {
          created_at: string
          date: string
          hours: number | null
          id: string
          odometer: number | null
          organization_id: string
          results: Json
          reviewed_at: string | null
          reviewed_by_id: string | null
          status: Database["public"]["Enums"]["checklist_submission_status"]
          template_id: string
          template_name: string
          user_id: string
          user_name: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          hours?: number | null
          id?: string
          odometer?: number | null
          organization_id: string
          results: Json
          reviewed_at?: string | null
          reviewed_by_id?: string | null
          status?: Database["public"]["Enums"]["checklist_submission_status"]
          template_id: string
          template_name: string
          user_id: string
          user_name: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          date?: string
          hours?: number | null
          id?: string
          odometer?: number | null
          organization_id?: string
          results?: Json
          reviewed_at?: string | null
          reviewed_by_id?: string | null
          status?: Database["public"]["Enums"]["checklist_submission_status"]
          template_id?: string
          template_name?: string
          user_id?: string
          user_name?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_submissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_submissions_reviewed_by_id_fkey"
            columns: ["reviewed_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_submissions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_submissions_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          items: Json
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          items?: Json
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          items?: Json
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          contacts: Json
          created_at: string
          credit_limit: number | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          payment_terms_days: number | null
          sla_level: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          contacts?: Json
          created_at?: string
          credit_limit?: number | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          payment_terms_days?: number | null
          sla_level?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          contacts?: Json
          created_at?: string
          credit_limit?: number | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          payment_terms_days?: number | null
          sla_level?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fbn_quotes: {
        Row: {
          amount: number | null
          amount_vat: number | null
          client_company: string | null
          client_email: string | null
          client_name: string | null
          client_phone: string | null
          created_at: string | null
          decline_comment: string | null
          decline_reason: string | null
          direction: string | null
          follow_up_date: string | null
          id: string
          notes: string | null
          quote_data: Json | null
          quote_type: string | null
          ref: string
          status: string | null
          status_updated_at: string | null
          token: string
          type_name: string | null
          user_id: string | null
          validity_days: number | null
        }
        Insert: {
          amount?: number | null
          amount_vat?: number | null
          client_company?: string | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string | null
          decline_comment?: string | null
          decline_reason?: string | null
          direction?: string | null
          follow_up_date?: string | null
          id?: string
          notes?: string | null
          quote_data?: Json | null
          quote_type?: string | null
          ref: string
          status?: string | null
          status_updated_at?: string | null
          token: string
          type_name?: string | null
          user_id?: string | null
          validity_days?: number | null
        }
        Update: {
          amount?: number | null
          amount_vat?: number | null
          client_company?: string | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string | null
          decline_comment?: string | null
          decline_reason?: string | null
          direction?: string | null
          follow_up_date?: string | null
          id?: string
          notes?: string | null
          quote_data?: Json | null
          quote_type?: string | null
          ref?: string
          status?: string | null
          status_updated_at?: string | null
          token?: string
          type_name?: string | null
          user_id?: string | null
          validity_days?: number | null
        }
        Relationships: []
      }
      forecasts: {
        Row: {
          created_at: string
          forecasted_costs: Json
          generated_date: string
          id: string
          insights: string | null
          organization_id: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          forecasted_costs: Json
          generated_date?: string
          id?: string
          insights?: string | null
          organization_id: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          forecasted_costs?: Json
          generated_date?: string
          id?: string
          insights?: string | null
          organization_id?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "forecasts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_entries: {
        Row: {
          cost_per_liter: number | null
          created_at: string
          date: string
          id: string
          liters: number
          notes: string | null
          odometer: number
          organization_id: string
          source_bowser_id: string | null
          total_cost: number | null
          trip_distance_km: number | null
          vehicle_id: string
        }
        Insert: {
          cost_per_liter?: number | null
          created_at?: string
          date: string
          id?: string
          liters: number
          notes?: string | null
          odometer: number
          organization_id: string
          source_bowser_id?: string | null
          total_cost?: number | null
          trip_distance_km?: number | null
          vehicle_id: string
        }
        Update: {
          cost_per_liter?: number | null
          created_at?: string
          date?: string
          id?: string
          liters?: number
          notes?: string | null
          odometer?: number
          organization_id?: string
          source_bowser_id?: string | null
          total_cost?: number | null
          trip_distance_km?: number | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuel_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_entries_source_bowser_id_fkey"
            columns: ["source_bowser_id"]
            isOneToOne: false
            referencedRelation: "bowsers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_entries_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_prices: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          price_per_liter: number
          start_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          price_per_liter: number
          start_date: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          price_per_liter?: number
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuel_prices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_cases: {
        Row: {
          cost_to_recover: number
          created_at: string
          damage_reason: string
          driver_id: string
          id: string
          incident_id: string | null
          notes: string | null
          organization_id: string
          reported_date: string
          status: Database["public"]["Enums"]["hr_case_status"]
          tire_id: string | null
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          cost_to_recover?: number
          created_at?: string
          damage_reason: string
          driver_id: string
          id?: string
          incident_id?: string | null
          notes?: string | null
          organization_id: string
          reported_date?: string
          status?: Database["public"]["Enums"]["hr_case_status"]
          tire_id?: string | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          cost_to_recover?: number
          created_at?: string
          damage_reason?: string
          driver_id?: string
          id?: string
          incident_id?: string | null
          notes?: string | null
          organization_id?: string
          reported_date?: string
          status?: Database["public"]["Enums"]["hr_case_status"]
          tire_id?: string | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_cases_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_cases_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incident_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_cases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_cases_tire_id_fkey"
            columns: ["tire_id"]
            isOneToOne: false
            referencedRelation: "tires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_cases_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_reports: {
        Row: {
          at_fault_party: Database["public"]["Enums"]["at_fault_party"] | null
          attachment_urls: string[] | null
          created_at: string
          date: string
          description: string
          final_repair_cost: number | null
          final_repairer: string | null
          fine_amount: number | null
          fine_number: string | null
          id: string
          incident_type: string
          insurance_claim_number: string | null
          notes: string | null
          organization_id: string
          quotes: Json | null
          saps_case_number: string | null
          status: Database["public"]["Enums"]["incident_status"]
          third_party_involved: boolean
          updated_at: string
          user_id: string | null
          vehicle_id: string | null
          violation_code: string | null
        }
        Insert: {
          at_fault_party?: Database["public"]["Enums"]["at_fault_party"] | null
          attachment_urls?: string[] | null
          created_at?: string
          date?: string
          description: string
          final_repair_cost?: number | null
          final_repairer?: string | null
          fine_amount?: number | null
          fine_number?: string | null
          id?: string
          incident_type: string
          insurance_claim_number?: string | null
          notes?: string | null
          organization_id: string
          quotes?: Json | null
          saps_case_number?: string | null
          status?: Database["public"]["Enums"]["incident_status"]
          third_party_involved?: boolean
          updated_at?: string
          user_id?: string | null
          vehicle_id?: string | null
          violation_code?: string | null
        }
        Update: {
          at_fault_party?: Database["public"]["Enums"]["at_fault_party"] | null
          attachment_urls?: string[] | null
          created_at?: string
          date?: string
          description?: string
          final_repair_cost?: number | null
          final_repairer?: string | null
          fine_amount?: number | null
          fine_number?: string | null
          id?: string
          incident_type?: string
          insurance_claim_number?: string | null
          notes?: string | null
          organization_id?: string
          quotes?: Json | null
          saps_case_number?: string | null
          status?: Database["public"]["Enums"]["incident_status"]
          third_party_involved?: boolean
          updated_at?: string
          user_id?: string | null
          vehicle_id?: string | null
          violation_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_reports_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_cards: {
        Row: {
          assigned_to_user_id: string | null
          checklist_item_id: string | null
          completion_date: string | null
          created_at: string
          id: string
          item_description: string
          labor_hours: number | null
          notes: Json | null
          organization_id: string
          parts_used: Json | null
          priority: Database["public"]["Enums"]["priority_level"]
          proposed_end_date: string | null
          proposed_start_date: string | null
          reported_date: string
          reporter_attachment_url: string | null
          reporter_notes: string | null
          service_interval_id: string | null
          severity: Database["public"]["Enums"]["priority_level"]
          status: Database["public"]["Enums"]["job_card_status"]
          submission_id: string | null
          type: Database["public"]["Enums"]["job_card_type"]
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          assigned_to_user_id?: string | null
          checklist_item_id?: string | null
          completion_date?: string | null
          created_at?: string
          id?: string
          item_description: string
          labor_hours?: number | null
          notes?: Json | null
          organization_id: string
          parts_used?: Json | null
          priority?: Database["public"]["Enums"]["priority_level"]
          proposed_end_date?: string | null
          proposed_start_date?: string | null
          reported_date?: string
          reporter_attachment_url?: string | null
          reporter_notes?: string | null
          service_interval_id?: string | null
          severity?: Database["public"]["Enums"]["priority_level"]
          status?: Database["public"]["Enums"]["job_card_status"]
          submission_id?: string | null
          type: Database["public"]["Enums"]["job_card_type"]
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          assigned_to_user_id?: string | null
          checklist_item_id?: string | null
          completion_date?: string | null
          created_at?: string
          id?: string
          item_description?: string
          labor_hours?: number | null
          notes?: Json | null
          organization_id?: string
          parts_used?: Json | null
          priority?: Database["public"]["Enums"]["priority_level"]
          proposed_end_date?: string | null
          proposed_start_date?: string | null
          reported_date?: string
          reporter_attachment_url?: string | null
          reporter_notes?: string | null
          service_interval_id?: string | null
          severity?: Database["public"]["Enums"]["priority_level"]
          status?: Database["public"]["Enums"]["job_card_status"]
          submission_id?: string | null
          type?: Database["public"]["Enums"]["job_card_type"]
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_cards_assigned_to_user_id_fkey"
            columns: ["assigned_to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_cards_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_cards_service_interval_id_fkey"
            columns: ["service_interval_id"]
            isOneToOne: false
            referencedRelation: "service_intervals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_cards_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "checklist_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_cards_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      load_confirmations: {
        Row: {
          arranging_branch: string | null
          cargo_photo_urls: string[] | null
          cargo_value: string | null
          cc_email: string | null
          client_contact: string | null
          client_email: string | null
          client_id: string
          client_name: string | null
          collection_branch_id: string | null
          collection_contact: string | null
          collection_date: string | null
          collection_point: string | null
          collection_telephone: string | null
          commodity: string | null
          container_no: string | null
          container_operator: string | null
          container_seal_no: string | null
          container_turn_in_address: string | null
          created_at: string
          customer_order_number: string | null
          damage_report: string | null
          date: string
          delay_reason: string | null
          delivery_area: string | null
          delivery_contact: string | null
          delivery_date: string | null
          delivery_point: string | null
          delivery_telephone: string | null
          destination_branch_id: string | null
          driver_id: string | null
          equipment_required: string[] | null
          eta: string | null
          fbn_representative: string | null
          for_attention: string | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          items: Json
          legs: Json
          load_con_number: string
          load_ref_no: string | null
          load_spec: string | null
          load_type: string | null
          loading_time: string | null
          notes: Json | null
          offloading_time: string | null
          organization_id: string
          packaging: string | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          pod_analysis: Json | null
          pod_email: string | null
          pod_photo_url: string | null
          pod_signature_url: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          quantity: string | null
          quote_id: string | null
          route: string | null
          route_id: string | null
          sent_to_supplier_date: string | null
          special_instructions: string | null
          status: Database["public"]["Enums"]["load_confirmation_status"]
          subcontractor_driver_cell: string | null
          subcontractor_driver_name: string | null
          subcontractor_email: string | null
          subcontractor_name: string | null
          subcontractor_vehicle_reg: string | null
          supplier_id: string | null
          supplier_rate: number | null
          total_amount: number
          updated_at: string
          vehicle_id: string | null
          volume: string | null
          weight_kg: string | null
        }
        Insert: {
          arranging_branch?: string | null
          cargo_photo_urls?: string[] | null
          cargo_value?: string | null
          cc_email?: string | null
          client_contact?: string | null
          client_email?: string | null
          client_id: string
          client_name?: string | null
          collection_branch_id?: string | null
          collection_contact?: string | null
          collection_date?: string | null
          collection_point?: string | null
          collection_telephone?: string | null
          commodity?: string | null
          container_no?: string | null
          container_operator?: string | null
          container_seal_no?: string | null
          container_turn_in_address?: string | null
          created_at?: string
          customer_order_number?: string | null
          damage_report?: string | null
          date?: string
          delay_reason?: string | null
          delivery_area?: string | null
          delivery_contact?: string | null
          delivery_date?: string | null
          delivery_point?: string | null
          delivery_telephone?: string | null
          destination_branch_id?: string | null
          driver_id?: string | null
          equipment_required?: string[] | null
          eta?: string | null
          fbn_representative?: string | null
          for_attention?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          items?: Json
          legs?: Json
          load_con_number: string
          load_ref_no?: string | null
          load_spec?: string | null
          load_type?: string | null
          loading_time?: string | null
          notes?: Json | null
          offloading_time?: string | null
          organization_id: string
          packaging?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          pod_analysis?: Json | null
          pod_email?: string | null
          pod_photo_url?: string | null
          pod_signature_url?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          quantity?: string | null
          quote_id?: string | null
          route?: string | null
          route_id?: string | null
          sent_to_supplier_date?: string | null
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["load_confirmation_status"]
          subcontractor_driver_cell?: string | null
          subcontractor_driver_name?: string | null
          subcontractor_email?: string | null
          subcontractor_name?: string | null
          subcontractor_vehicle_reg?: string | null
          supplier_id?: string | null
          supplier_rate?: number | null
          total_amount?: number
          updated_at?: string
          vehicle_id?: string | null
          volume?: string | null
          weight_kg?: string | null
        }
        Update: {
          arranging_branch?: string | null
          cargo_photo_urls?: string[] | null
          cargo_value?: string | null
          cc_email?: string | null
          client_contact?: string | null
          client_email?: string | null
          client_id?: string
          client_name?: string | null
          collection_branch_id?: string | null
          collection_contact?: string | null
          collection_date?: string | null
          collection_point?: string | null
          collection_telephone?: string | null
          commodity?: string | null
          container_no?: string | null
          container_operator?: string | null
          container_seal_no?: string | null
          container_turn_in_address?: string | null
          created_at?: string
          customer_order_number?: string | null
          damage_report?: string | null
          date?: string
          delay_reason?: string | null
          delivery_area?: string | null
          delivery_contact?: string | null
          delivery_date?: string | null
          delivery_point?: string | null
          delivery_telephone?: string | null
          destination_branch_id?: string | null
          driver_id?: string | null
          equipment_required?: string[] | null
          eta?: string | null
          fbn_representative?: string | null
          for_attention?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          items?: Json
          legs?: Json
          load_con_number?: string
          load_ref_no?: string | null
          load_spec?: string | null
          load_type?: string | null
          loading_time?: string | null
          notes?: Json | null
          offloading_time?: string | null
          organization_id?: string
          packaging?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          pod_analysis?: Json | null
          pod_email?: string | null
          pod_photo_url?: string | null
          pod_signature_url?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          quantity?: string | null
          quote_id?: string | null
          route?: string | null
          route_id?: string | null
          sent_to_supplier_date?: string | null
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["load_confirmation_status"]
          subcontractor_driver_cell?: string | null
          subcontractor_driver_name?: string | null
          subcontractor_email?: string | null
          subcontractor_name?: string | null
          subcontractor_vehicle_reg?: string | null
          supplier_id?: string | null
          supplier_rate?: number | null
          total_amount?: number
          updated_at?: string
          vehicle_id?: string | null
          volume?: string | null
          weight_kg?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "load_confirmations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_confirmations_collection_branch_id_fkey"
            columns: ["collection_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_confirmations_destination_branch_id_fkey"
            columns: ["destination_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_confirmations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_confirmations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_confirmations_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_confirmations_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_confirmations_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_confirmations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      manifests: {
        Row: {
          arrival_date: string | null
          created_at: string
          destination_branch_id: string
          dispatch_date: string
          driver_id: string | null
          id: string
          load_confirmation_ids: string[]
          manifest_number: string
          organization_id: string
          origin_branch_id: string
          status: Database["public"]["Enums"]["manifest_status"]
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          arrival_date?: string | null
          created_at?: string
          destination_branch_id: string
          dispatch_date?: string
          driver_id?: string | null
          id?: string
          load_confirmation_ids?: string[]
          manifest_number: string
          organization_id: string
          origin_branch_id: string
          status?: Database["public"]["Enums"]["manifest_status"]
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          arrival_date?: string | null
          created_at?: string
          destination_branch_id?: string
          dispatch_date?: string
          driver_id?: string | null
          id?: string
          load_confirmation_ids?: string[]
          manifest_number?: string
          organization_id?: string
          origin_branch_id?: string
          status?: Database["public"]["Enums"]["manifest_status"]
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manifests_destination_branch_id_fkey"
            columns: ["destination_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manifests_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manifests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manifests_origin_branch_id_fkey"
            columns: ["origin_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manifests_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          text: string
          timestamp: string
          user_id: string
          user_name: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          text: string
          timestamp?: string
          user_id: string
          user_name: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          text?: string
          timestamp?: string
          user_id?: string
          user_name?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: Json | null
          message: string
          organization_id: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: Json | null
          message: string
          organization_id: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: Json | null
          message?: string
          organization_id?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          accent_color: string | null
          address: string | null
          created_at: string
          email: string | null
          id: string
          legal_name: string | null
          logo_url: string | null
          name: string
          phone: string | null
          primary_color: string | null
          registration_no: string | null
          updated_at: string
          vat_no: string | null
        }
        Insert: {
          accent_color?: string | null
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name: string
          phone?: string | null
          primary_color?: string | null
          registration_no?: string | null
          updated_at?: string
          vat_no?: string | null
        }
        Update: {
          accent_color?: string | null
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          primary_color?: string | null
          registration_no?: string | null
          updated_at?: string
          vat_no?: string | null
        }
        Relationships: []
      }
      other_costs: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          id: string
          notes: string | null
          organization_id: string
          vehicle_id: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          organization_id: string
          vehicle_id?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          organization_id?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "other_costs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "other_costs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      parts: {
        Row: {
          branch_id: string | null
          cost: number
          created_at: string
          id: string
          min_stock_level: number
          name: string
          organization_id: string
          part_number: string | null
          quantity_in_stock: number
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          cost?: number
          created_at?: string
          id?: string
          min_stock_level?: number
          name: string
          organization_id: string
          part_number?: string | null
          quantity_in_stock?: number
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          cost?: number
          created_at?: string
          id?: string
          min_stock_level?: number
          name?: string
          organization_id?: string
          part_number?: string | null
          quantity_in_stock?: number
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      planned_services: {
        Row: {
          created_at: string
          description: string
          end_date: string
          id: string
          organization_id: string
          start_date: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          description: string
          end_date: string
          id?: string
          organization_id: string
          start_date: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          description?: string
          end_date?: string
          id?: string
          organization_id?: string
          start_date?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planned_services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_services_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          assigned_branch_ids: string[]
          assigned_vehicle_ids: string[]
          client_id: string | null
          created_at: string
          dg_cert_expiry: string | null
          email: string
          id: string
          induction_date: string | null
          is_active: boolean
          last_refresher_date: string | null
          license_expiry: string | null
          license_number: string | null
          medical_expiry: string | null
          name: string
          navigation_preferences: Json | null
          organization_id: string
          pdp_expiry: string | null
          permissions: string[]
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_branch_ids?: string[]
          assigned_vehicle_ids?: string[]
          client_id?: string | null
          created_at?: string
          dg_cert_expiry?: string | null
          email: string
          id: string
          induction_date?: string | null
          is_active?: boolean
          last_refresher_date?: string | null
          license_expiry?: string | null
          license_number?: string | null
          medical_expiry?: string | null
          name: string
          navigation_preferences?: Json | null
          organization_id: string
          pdp_expiry?: string | null
          permissions?: string[]
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_branch_ids?: string[]
          assigned_vehicle_ids?: string[]
          client_id?: string | null
          created_at?: string
          dg_cert_expiry?: string | null
          email?: string
          id?: string
          induction_date?: string | null
          is_active?: boolean
          last_refresher_date?: string | null
          license_expiry?: string | null
          license_number?: string | null
          medical_expiry?: string | null
          name?: string
          navigation_preferences?: Json | null
          organization_id?: string
          pdp_expiry?: string | null
          permissions?: string[]
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_client_fk"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_supplier_fk"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          id: string
          items: Json
          order_date: string
          organization_id: string
          po_number: string
          purchase_request_id: string | null
          status: Database["public"]["Enums"]["purchase_order_status"]
          supplier_id: string | null
          total_cost: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          items?: Json
          order_date?: string
          organization_id: string
          po_number: string
          purchase_request_id?: string | null
          status?: Database["public"]["Enums"]["purchase_order_status"]
          supplier_id?: string | null
          total_cost?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          items?: Json
          order_date?: string
          organization_id?: string
          po_number?: string
          purchase_request_id?: string | null
          status?: Database["public"]["Enums"]["purchase_order_status"]
          supplier_id?: string | null
          total_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_purchase_request_id_fkey"
            columns: ["purchase_request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requests: {
        Row: {
          created_at: string
          id: string
          is_urgent: boolean
          job_card_id: string | null
          organization_id: string
          part_id: string | null
          quantity: number
          quotes: Json | null
          requested_by_user_id: string | null
          requested_date: string
          status: Database["public"]["Enums"]["purchase_request_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_urgent?: boolean
          job_card_id?: string | null
          organization_id: string
          part_id?: string | null
          quantity: number
          quotes?: Json | null
          requested_by_user_id?: string | null
          requested_date?: string
          status?: Database["public"]["Enums"]["purchase_request_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_urgent?: boolean
          job_card_id?: string | null
          organization_id?: string
          part_id?: string | null
          quantity?: number
          quotes?: Json | null
          requested_by_user_id?: string | null
          requested_date?: string
          status?: Database["public"]["Enums"]["purchase_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_requests_job_card_id_fkey"
            columns: ["job_card_id"]
            isOneToOne: false
            referencedRelation: "job_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requests_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requests_requested_by_user_id_fkey"
            columns: ["requested_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_requests: {
        Row: {
          assigned_to: string | null
          cargo_description: string | null
          collection_area: string | null
          company: string | null
          created_at: string | null
          delivery_area: string | null
          email: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          pieces: number | null
          preferred_date: string | null
          ref: string
          responded_at: string | null
          route: string | null
          service_type: string | null
          status: string | null
          weight_kg: number | null
        }
        Insert: {
          assigned_to?: string | null
          cargo_description?: string | null
          collection_area?: string | null
          company?: string | null
          created_at?: string | null
          delivery_area?: string | null
          email: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          pieces?: number | null
          preferred_date?: string | null
          ref: string
          responded_at?: string | null
          route?: string | null
          service_type?: string | null
          status?: string | null
          weight_kg?: number | null
        }
        Update: {
          assigned_to?: string | null
          cargo_description?: string | null
          collection_area?: string | null
          company?: string | null
          created_at?: string | null
          delivery_area?: string | null
          email?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          pieces?: number | null
          preferred_date?: string | null
          ref?: string
          responded_at?: string | null
          route?: string | null
          service_type?: string | null
          status?: string | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      quotes: {
        Row: {
          client_id: string
          collection_date: string | null
          commodity: string | null
          created_at: string
          created_by_id: string | null
          customer_order_number: string | null
          date: string
          expiry_date: string | null
          id: string
          items: Json
          legs: Json
          load_spec: string | null
          notes: string | null
          organization_id: string
          packaging: string | null
          quote_number: string
          route_id: string | null
          sent_to_client: boolean
          special_requirements: string | null
          status: Database["public"]["Enums"]["quote_status"]
          subcontractor_quotes: Json
          total_amount: number
          updated_at: string
        }
        Insert: {
          client_id: string
          collection_date?: string | null
          commodity?: string | null
          created_at?: string
          created_by_id?: string | null
          customer_order_number?: string | null
          date?: string
          expiry_date?: string | null
          id?: string
          items?: Json
          legs?: Json
          load_spec?: string | null
          notes?: string | null
          organization_id: string
          packaging?: string | null
          quote_number: string
          route_id?: string | null
          sent_to_client?: boolean
          special_requirements?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          subcontractor_quotes?: Json
          total_amount?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          collection_date?: string | null
          commodity?: string | null
          created_at?: string
          created_by_id?: string | null
          customer_order_number?: string | null
          date?: string
          expiry_date?: string | null
          id?: string
          items?: Json
          legs?: Json
          load_spec?: string | null
          notes?: string | null
          organization_id?: string
          packaging?: string | null
          quote_number?: string
          route_id?: string | null
          sent_to_client?: boolean
          special_requirements?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          subcontractor_quotes?: Json
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_settings: {
        Row: {
          data: Json
          id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          data: Json
          id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          data?: Json
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      recurring_costs: {
        Row: {
          amount: number
          category: string
          created_at: string
          end_date: string | null
          frequency: Database["public"]["Enums"]["recurring_frequency"]
          id: string
          organization_id: string
          start_date: string
          vehicle_id: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          end_date?: string | null
          frequency?: Database["public"]["Enums"]["recurring_frequency"]
          id?: string
          organization_id: string
          start_date: string
          vehicle_id?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          end_date?: string | null
          frequency?: Database["public"]["Enums"]["recurring_frequency"]
          id?: string
          organization_id?: string
          start_date?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_costs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_costs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_entries: {
        Row: {
          amount: number
          created_at: string
          date: string
          description: string
          id: string
          load_confirmation_id: string | null
          organization_id: string
          vehicle_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          date: string
          description: string
          id?: string
          load_confirmation_id?: string | null
          organization_id: string
          vehicle_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          description?: string
          id?: string
          load_confirmation_id?: string | null
          organization_id?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revenue_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_entries_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_loadcon_fk"
            columns: ["load_confirmation_id"]
            isOneToOne: false
            referencedRelation: "load_confirmations"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          average_fuel_liters: number | null
          created_at: string
          destination: string
          distance_km: number | null
          estimated_hours: number | null
          id: string
          is_active: boolean
          minimum_sell_full_load: number | null
          notes: string | null
          organization_id: string
          origin: string
          premium_sell_full_load: number | null
          target_sell_full_load: number | null
          target_sell_per_cbm: number | null
          target_sell_per_deck_m: number | null
          target_sell_per_kg: number | null
          target_sell_per_pallet: number | null
          toll_cost: number | null
          updated_at: string
        }
        Insert: {
          average_fuel_liters?: number | null
          created_at?: string
          destination: string
          distance_km?: number | null
          estimated_hours?: number | null
          id?: string
          is_active?: boolean
          minimum_sell_full_load?: number | null
          notes?: string | null
          organization_id: string
          origin: string
          premium_sell_full_load?: number | null
          target_sell_full_load?: number | null
          target_sell_per_cbm?: number | null
          target_sell_per_deck_m?: number | null
          target_sell_per_kg?: number | null
          target_sell_per_pallet?: number | null
          toll_cost?: number | null
          updated_at?: string
        }
        Update: {
          average_fuel_liters?: number | null
          created_at?: string
          destination?: string
          distance_km?: number | null
          estimated_hours?: number | null
          id?: string
          is_active?: boolean
          minimum_sell_full_load?: number | null
          notes?: string | null
          organization_id?: string
          origin?: string
          premium_sell_full_load?: number | null
          target_sell_full_load?: number | null
          target_sell_per_cbm?: number | null
          target_sell_per_deck_m?: number | null
          target_sell_per_kg?: number | null
          target_sell_per_pallet?: number | null
          toll_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "routes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_entries: {
        Row: {
          attachment_name: string | null
          attachment_url: string | null
          cost: number
          created_at: string
          date: string
          description: string
          end_hours: number | null
          end_odometer: number | null
          id: string
          organization_id: string
          start_hours: number | null
          start_odometer: number | null
          vehicle_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_url?: string | null
          cost?: number
          created_at?: string
          date: string
          description: string
          end_hours?: number | null
          end_odometer?: number | null
          id?: string
          organization_id: string
          start_hours?: number | null
          start_odometer?: number | null
          vehicle_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_url?: string | null
          cost?: number
          created_at?: string
          date?: string
          description?: string
          end_hours?: number | null
          end_odometer?: number | null
          id?: string
          organization_id?: string
          start_hours?: number | null
          start_odometer?: number | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_entries_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_intervals: {
        Row: {
          created_at: string
          description: string
          distance_interval: number | null
          hours_interval: number | null
          id: string
          organization_id: string
          time_interval_days: number | null
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          description: string
          distance_interval?: number | null
          hours_interval?: number | null
          id?: string
          organization_id: string
          time_interval_days?: number | null
          vehicle_id: string
        }
        Update: {
          created_at?: string
          description?: string
          distance_interval?: number | null
          hours_interval?: number | null
          id?: string
          organization_id?: string
          time_interval_days?: number | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_intervals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_intervals_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_applications: {
        Row: {
          address: string | null
          approved_supplier_id: string | null
          bee_status: string | null
          company_name: string
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          fleet_list_url: string | null
          fleet_size: string | null
          haz_compliant: boolean | null
          id: string
          insurance_url: string | null
          organization_id: string
          rate_card_url: string | null
          routes: string | null
          specializations: string[] | null
          status: Database["public"]["Enums"]["supplier_application_status"]
          submitted_date: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          approved_supplier_id?: string | null
          bee_status?: string | null
          company_name: string
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          fleet_list_url?: string | null
          fleet_size?: string | null
          haz_compliant?: boolean | null
          id?: string
          insurance_url?: string | null
          organization_id: string
          rate_card_url?: string | null
          routes?: string | null
          specializations?: string[] | null
          status?: Database["public"]["Enums"]["supplier_application_status"]
          submitted_date?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          approved_supplier_id?: string | null
          bee_status?: string | null
          company_name?: string
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          fleet_list_url?: string | null
          fleet_size?: string | null
          haz_compliant?: boolean | null
          id?: string
          insurance_url?: string | null
          organization_id?: string
          rate_card_url?: string | null
          routes?: string | null
          specializations?: string[] | null
          status?: Database["public"]["Enums"]["supplier_application_status"]
          submitted_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_applications_approved_supplier_id_fkey"
            columns: ["approved_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_applications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_compliance_docs: {
        Row: {
          created_at: string
          expiry_date: string | null
          file_name: string | null
          file_url: string | null
          id: string
          name: string
          organization_id: string
          status: Database["public"]["Enums"]["doc_status"]
          supplier_id: string
          type: Database["public"]["Enums"]["compliance_doc_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          expiry_date?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          name: string
          organization_id: string
          status?: Database["public"]["Enums"]["doc_status"]
          supplier_id: string
          type: Database["public"]["Enums"]["compliance_doc_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          expiry_date?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          name?: string
          organization_id?: string
          status?: Database["public"]["Enums"]["doc_status"]
          supplier_id?: string
          type?: Database["public"]["Enums"]["compliance_doc_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_compliance_docs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_compliance_docs_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_rate_cards: {
        Row: {
          created_at: string
          effective_from: string | null
          file_name: string | null
          file_url: string | null
          id: string
          name: string
          organization_id: string
          supplier_id: string
        }
        Insert: {
          created_at?: string
          effective_from?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          name: string
          organization_id: string
          supplier_id: string
        }
        Update: {
          created_at?: string
          effective_from?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          name?: string
          organization_id?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_rate_cards_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_rate_cards_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          accounts_contact: string | null
          address: string | null
          average_rating: number | null
          bee_status: string | null
          compliance_status: Database["public"]["Enums"]["compliance_status"]
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          contacts: Json
          controller_contact: string | null
          created_at: string
          expiry_date: string | null
          fleet_size: string | null
          haz_compliant: boolean | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          regions: string | null
          specializations: string[] | null
          type: Database["public"]["Enums"]["supplier_type"]
          updated_at: string
        }
        Insert: {
          accounts_contact?: string | null
          address?: string | null
          average_rating?: number | null
          bee_status?: string | null
          compliance_status?: Database["public"]["Enums"]["compliance_status"]
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          contacts?: Json
          controller_contact?: string | null
          created_at?: string
          expiry_date?: string | null
          fleet_size?: string | null
          haz_compliant?: boolean | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          regions?: string | null
          specializations?: string[] | null
          type?: Database["public"]["Enums"]["supplier_type"]
          updated_at?: string
        }
        Update: {
          accounts_contact?: string | null
          address?: string | null
          average_rating?: number | null
          bee_status?: string | null
          compliance_status?: Database["public"]["Enums"]["compliance_status"]
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          contacts?: Json
          controller_contact?: string | null
          created_at?: string
          expiry_date?: string | null
          fleet_size?: string | null
          haz_compliant?: boolean | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          regions?: string | null
          specializations?: string[] | null
          type?: Database["public"]["Enums"]["supplier_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tire_inspections: {
        Row: {
          created_at: string
          date: string
          id: string
          inspected_by_id: string | null
          notes: string | null
          organization_id: string
          pressure_psi: number | null
          tire_id: string
          tread_depth_mm: number | null
          vehicle_odometer: number | null
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          inspected_by_id?: string | null
          notes?: string | null
          organization_id: string
          pressure_psi?: number | null
          tire_id: string
          tread_depth_mm?: number | null
          vehicle_odometer?: number | null
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          inspected_by_id?: string | null
          notes?: string | null
          organization_id?: string
          pressure_psi?: number | null
          tire_id?: string
          tread_depth_mm?: number | null
          vehicle_odometer?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tire_inspections_inspected_by_id_fkey"
            columns: ["inspected_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tire_inspections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tire_inspections_tire_id_fkey"
            columns: ["tire_id"]
            isOneToOne: false
            referencedRelation: "tires"
            referencedColumns: ["id"]
          },
        ]
      }
      tire_mount_history: {
        Row: {
          created_at: string
          id: string
          mounted_date: string | null
          mounted_odometer: number | null
          notes: string | null
          position: string | null
          removed_date: string | null
          removed_odometer: number | null
          tire_id: string
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          mounted_date?: string | null
          mounted_odometer?: number | null
          notes?: string | null
          position?: string | null
          removed_date?: string | null
          removed_odometer?: number | null
          tire_id: string
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          mounted_date?: string | null
          mounted_odometer?: number | null
          notes?: string | null
          position?: string | null
          removed_date?: string | null
          removed_odometer?: number | null
          tire_id?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tire_mount_history_tire_id_fkey"
            columns: ["tire_id"]
            isOneToOne: false
            referencedRelation: "tires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tire_mount_history_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      tires: {
        Row: {
          assigned_position: string | null
          assigned_vehicle_id: string | null
          brand: string | null
          created_at: string
          id: string
          organization_id: string
          purchase_date: string | null
          purchase_price: number | null
          retread_details: Json | null
          serial_number: string
          size: string | null
          status: Database["public"]["Enums"]["tire_status"]
          type: Database["public"]["Enums"]["tire_type"]
          updated_at: string
        }
        Insert: {
          assigned_position?: string | null
          assigned_vehicle_id?: string | null
          brand?: string | null
          created_at?: string
          id?: string
          organization_id: string
          purchase_date?: string | null
          purchase_price?: number | null
          retread_details?: Json | null
          serial_number: string
          size?: string | null
          status?: Database["public"]["Enums"]["tire_status"]
          type?: Database["public"]["Enums"]["tire_type"]
          updated_at?: string
        }
        Update: {
          assigned_position?: string | null
          assigned_vehicle_id?: string | null
          brand?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          purchase_date?: string | null
          purchase_price?: number | null
          retread_details?: Json | null
          serial_number?: string
          size?: string | null
          status?: Database["public"]["Enums"]["tire_status"]
          type?: Database["public"]["Enums"]["tire_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tires_assigned_vehicle_id_fkey"
            columns: ["assigned_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tires_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_sheets: {
        Row: {
          branch_id: string
          completion_date: string | null
          created_at: string
          dispatch_date: string
          driver_id: string | null
          id: string
          load_confirmation_ids: string[]
          organization_id: string
          status: Database["public"]["Enums"]["trip_sheet_status"]
          trip_sheet_number: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          branch_id: string
          completion_date?: string | null
          created_at?: string
          dispatch_date?: string
          driver_id?: string | null
          id?: string
          load_confirmation_ids?: string[]
          organization_id: string
          status?: Database["public"]["Enums"]["trip_sheet_status"]
          trip_sheet_number: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          branch_id?: string
          completion_date?: string | null
          created_at?: string
          dispatch_date?: string
          driver_id?: string | null
          id?: string
          load_confirmation_ids?: string[]
          organization_id?: string
          status?: Database["public"]["Enums"]["trip_sheet_status"]
          trip_sheet_number?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_sheets_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_sheets_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_sheets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_sheets_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          company_name: string | null
          created_at: string | null
          full_name: string | null
          id: string
          phone: string | null
          role: string | null
        }
        Insert: {
          company_name?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          role?: string | null
        }
        Update: {
          company_name?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          role?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      vehicle_compliance_docs: {
        Row: {
          created_at: string
          expiry_date: string | null
          file_name: string | null
          file_url: string | null
          id: string
          issue_date: string | null
          name: string
          notes: string | null
          organization_id: string
          status: Database["public"]["Enums"]["doc_status"]
          type: Database["public"]["Enums"]["vehicle_compliance_type"]
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          expiry_date?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          issue_date?: string | null
          name: string
          notes?: string | null
          organization_id: string
          status?: Database["public"]["Enums"]["doc_status"]
          type: Database["public"]["Enums"]["vehicle_compliance_type"]
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          expiry_date?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          issue_date?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          status?: Database["public"]["Enums"]["doc_status"]
          type?: Database["public"]["Enums"]["vehicle_compliance_type"]
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_compliance_docs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_compliance_docs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          assigned_driver_id: string | null
          branch_id: string
          cost_per_km_target: number | null
          created_at: string
          cubic_meters: number | null
          current_hours: number | null
          current_odometer: number | null
          current_value: number | null
          deck_meters: number | null
          health_score: number | null
          id: string
          linked_vehicle_id: string | null
          make: string | null
          model: string | null
          monthly_fixed_cost: number | null
          name: string
          organization_id: string
          pallet_spaces: number | null
          payload_kg: number | null
          purchase_price: number | null
          registration: string
          status: Database["public"]["Enums"]["vehicle_status"]
          updated_at: string
          vin: string | null
          weight_category: string | null
          year: number | null
        }
        Insert: {
          assigned_driver_id?: string | null
          branch_id: string
          cost_per_km_target?: number | null
          created_at?: string
          cubic_meters?: number | null
          current_hours?: number | null
          current_odometer?: number | null
          current_value?: number | null
          deck_meters?: number | null
          health_score?: number | null
          id?: string
          linked_vehicle_id?: string | null
          make?: string | null
          model?: string | null
          monthly_fixed_cost?: number | null
          name: string
          organization_id: string
          pallet_spaces?: number | null
          payload_kg?: number | null
          purchase_price?: number | null
          registration: string
          status?: Database["public"]["Enums"]["vehicle_status"]
          updated_at?: string
          vin?: string | null
          weight_category?: string | null
          year?: number | null
        }
        Update: {
          assigned_driver_id?: string | null
          branch_id?: string
          cost_per_km_target?: number | null
          created_at?: string
          cubic_meters?: number | null
          current_hours?: number | null
          current_odometer?: number | null
          current_value?: number | null
          deck_meters?: number | null
          health_score?: number | null
          id?: string
          linked_vehicle_id?: string | null
          make?: string | null
          model?: string | null
          monthly_fixed_cost?: number | null
          name?: string
          organization_id?: string
          pallet_spaces?: number | null
          payload_kg?: number | null
          purchase_price?: number | null
          registration?: string
          status?: Database["public"]["Enums"]["vehicle_status"]
          updated_at?: string
          vin?: string | null
          weight_category?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_assigned_driver_id_fkey"
            columns: ["assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_linked_vehicle_id_fkey"
            columns: ["linked_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_organization_id_fkey"
            columns: ["organization_id"]
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
      auth_can_see_branch: { Args: { target_branch: string }; Returns: boolean }
      auth_can_see_vehicle: {
        Args: { target_vehicle: string }
        Returns: boolean
      }
      auth_client_id: { Args: never; Returns: string }
      auth_has_permission: { Args: { perm: string }; Returns: boolean }
      auth_is_admin: { Args: never; Returns: boolean }
      auth_is_ops: { Args: never; Returns: boolean }
      auth_is_workshop: { Args: never; Returns: boolean }
      auth_org_id: { Args: never; Returns: string }
      auth_profile: {
        Args: never
        Returns: {
          assigned_branch_ids: string[]
          assigned_vehicle_ids: string[]
          client_id: string | null
          created_at: string
          dg_cert_expiry: string | null
          email: string
          id: string
          induction_date: string | null
          is_active: boolean
          last_refresher_date: string | null
          license_expiry: string | null
          license_number: string | null
          medical_expiry: string | null
          name: string
          navigation_preferences: Json | null
          organization_id: string
          pdp_expiry: string | null
          permissions: string[]
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          supplier_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      auth_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      auth_supplier_id: { Args: never; Returns: string }
      current_org_id: { Args: never; Returns: string }
      is_loadmaster_branch: {
        Args: { target_branch: string }
        Returns: boolean
      }
      next_quote_ref: { Args: never; Returns: string }
      storage_path_part: {
        Args: { idx: number; path: string }
        Returns: string
      }
    }
    Enums: {
      at_fault_party: "Driver" | "Third Party"
      checklist_submission_status: "Submitted" | "Reviewed"
      compliance_doc_type: "GIT" | "BEE" | "TAX" | "LOGS" | "COY_REG" | "OTH"
      compliance_status: "Compliant" | "Expired" | "Pending"
      doc_status: "Valid" | "Expired" | "Pending Review"
      hr_case_status: "Pending" | "Actioned" | "Closed"
      incident_status:
        | "Reported"
        | "Claim Submitted"
        | "Awaiting Quotes"
        | "Awaiting Repair"
        | "Repairs Complete"
        | "Closed"
      job_card_status:
        | "Reported"
        | "Awaiting Inspection"
        | "Awaiting Parts"
        | "Pending Scheduling"
        | "Scheduled"
        | "In Progress"
        | "Awaiting Sign-off"
        | "Resolved"
      job_card_type:
        | "Repair"
        | "Service"
        | "Inspection"
        | "Tyre Change"
        | "Spot Check"
      load_confirmation_status:
        | "Booked"
        | "Driver Assigned"
        | "At Collection Point"
        | "Collected"
        | "At Collection Depot"
        | "In Transit"
        | "At Destination Depot"
        | "Out for Delivery"
        | "Delivered"
        | "POD Submitted"
        | "Invoiced"
        | "Cancelled"
      manifest_status: "In Transit" | "Arrived"
      notification_type: "JOB_CARD" | "SERVICE" | "INVENTORY" | "PURCHASE"
      payment_status:
        | "Awaiting POD"
        | "Awaiting Review"
        | "Ready for Payment"
        | "Paid"
      priority_level: "Low" | "Medium" | "High" | "Critical"
      purchase_order_status: "Ordered" | "Partially Received" | "Received"
      purchase_request_status:
        | "Pending"
        | "Awaiting Quotes"
        | "Awaiting Approval"
        | "Approved"
        | "Rejected"
        | "Ordered"
        | "Completed"
      quote_status: "Draft" | "Sent" | "Accepted" | "Rejected" | "Expired"
      recurring_frequency: "monthly" | "annually"
      supplier_application_status: "Pending" | "Approved" | "Rejected"
      supplier_type: "Workshop" | "Transport" | "Other"
      tire_status: "In Storage" | "Mounted" | "Out for Retread" | "Scrapped"
      tire_type: "New" | "Retread"
      trip_sheet_status: "Out for Delivery" | "Completed"
      user_role:
        | "Super Admin"
        | "Admin"
        | "Staff"
        | "Workshop Manager"
        | "Driver"
        | "Client"
        | "Supplier"
      vehicle_compliance_type:
        | "COF"
        | "LICENSE_DISC"
        | "TRACKER_CERT"
        | "INSURANCE"
        | "PERMIT"
        | "CROSS_BORDER"
        | "DG_PERMIT"
        | "OTHER"
      vehicle_status: "On the road" | "In for service" | "Off the road" | "Sold"
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
      at_fault_party: ["Driver", "Third Party"],
      checklist_submission_status: ["Submitted", "Reviewed"],
      compliance_doc_type: ["GIT", "BEE", "TAX", "LOGS", "COY_REG", "OTH"],
      compliance_status: ["Compliant", "Expired", "Pending"],
      doc_status: ["Valid", "Expired", "Pending Review"],
      hr_case_status: ["Pending", "Actioned", "Closed"],
      incident_status: [
        "Reported",
        "Claim Submitted",
        "Awaiting Quotes",
        "Awaiting Repair",
        "Repairs Complete",
        "Closed",
      ],
      job_card_status: [
        "Reported",
        "Awaiting Inspection",
        "Awaiting Parts",
        "Pending Scheduling",
        "Scheduled",
        "In Progress",
        "Awaiting Sign-off",
        "Resolved",
      ],
      job_card_type: [
        "Repair",
        "Service",
        "Inspection",
        "Tyre Change",
        "Spot Check",
      ],
      load_confirmation_status: [
        "Booked",
        "Driver Assigned",
        "At Collection Point",
        "Collected",
        "At Collection Depot",
        "In Transit",
        "At Destination Depot",
        "Out for Delivery",
        "Delivered",
        "POD Submitted",
        "Invoiced",
        "Cancelled",
      ],
      manifest_status: ["In Transit", "Arrived"],
      notification_type: ["JOB_CARD", "SERVICE", "INVENTORY", "PURCHASE"],
      payment_status: [
        "Awaiting POD",
        "Awaiting Review",
        "Ready for Payment",
        "Paid",
      ],
      priority_level: ["Low", "Medium", "High", "Critical"],
      purchase_order_status: ["Ordered", "Partially Received", "Received"],
      purchase_request_status: [
        "Pending",
        "Awaiting Quotes",
        "Awaiting Approval",
        "Approved",
        "Rejected",
        "Ordered",
        "Completed",
      ],
      quote_status: ["Draft", "Sent", "Accepted", "Rejected", "Expired"],
      recurring_frequency: ["monthly", "annually"],
      supplier_application_status: ["Pending", "Approved", "Rejected"],
      supplier_type: ["Workshop", "Transport", "Other"],
      tire_status: ["In Storage", "Mounted", "Out for Retread", "Scrapped"],
      tire_type: ["New", "Retread"],
      trip_sheet_status: ["Out for Delivery", "Completed"],
      user_role: [
        "Super Admin",
        "Admin",
        "Staff",
        "Workshop Manager",
        "Driver",
        "Client",
        "Supplier",
      ],
      vehicle_compliance_type: [
        "COF",
        "LICENSE_DISC",
        "TRACKER_CERT",
        "INSURANCE",
        "PERMIT",
        "CROSS_BORDER",
        "DG_PERMIT",
        "OTHER",
      ],
      vehicle_status: ["On the road", "In for service", "Off the road", "Sold"],
    },
  },
} as const
