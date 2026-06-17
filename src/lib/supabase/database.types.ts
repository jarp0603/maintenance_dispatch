// Hand-written to match supabase/migrations exactly. `supabase gen types` in
// this CLI version demands a logged-in account even for --local/--db-url
// generation, which we don't want to require for local-only development, so
// keep this file in sync by hand when migrations change.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string;
          role: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email: string;
          role?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      properties: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          address_line1: string;
          address_line2: string | null;
          city: string | null;
          state: string | null;
          postal_code: string | null;
          property_manager_name: string | null;
          property_manager_phone: string | null;
          property_manager_email: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          address_line1: string;
          address_line2?: string | null;
          city?: string | null;
          state?: string | null;
          postal_code?: string | null;
          property_manager_name?: string | null;
          property_manager_phone?: string | null;
          property_manager_email?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["properties"]["Insert"]>;
        Relationships: [];
      };
      tenants: {
        Row: {
          id: string;
          owner_id: string;
          property_id: string | null;
          full_name: string;
          email: string | null;
          phone: string | null;
          unit: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          property_id?: string | null;
          full_name: string;
          email?: string | null;
          phone?: string | null;
          unit?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tenants"]["Insert"]>;
        Relationships: [];
      };
      work_orders: {
        Row: {
          id: string;
          owner_id: string;
          reference_number: string | null;
          tenant_id: string | null;
          property_id: string | null;
          tenant_name: string;
          tenant_email: string | null;
          tenant_phone: string | null;
          property_name: string | null;
          address: string | null;
          unit: string | null;
          property_manager: string | null;
          issue_title: string;
          issue_description: string | null;
          priority: string;
          access_instructions: string | null;
          status: string;
          scheduled_at: string | null;
          internal_notes: string | null;
          completion_notes: string | null;
          contact_attempt_count: number;
          last_contact_at: string | null;
          next_follow_up_at: string | null;
          source: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          reference_number?: string | null;
          tenant_id?: string | null;
          property_id?: string | null;
          tenant_name?: string;
          tenant_email?: string | null;
          tenant_phone?: string | null;
          property_name?: string | null;
          address?: string | null;
          unit?: string | null;
          property_manager?: string | null;
          issue_title: string;
          issue_description?: string | null;
          priority?: string;
          access_instructions?: string | null;
          status?: string;
          scheduled_at?: string | null;
          internal_notes?: string | null;
          completion_notes?: string | null;
          contact_attempt_count?: number;
          last_contact_at?: string | null;
          next_follow_up_at?: string | null;
          source?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["work_orders"]["Insert"]>;
        Relationships: [];
      };
      status_history: {
        Row: {
          id: string;
          owner_id: string;
          work_order_id: string;
          old_status: string | null;
          new_status: string;
          changed_by: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          work_order_id: string;
          old_status?: string | null;
          new_status: string;
          changed_by?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["status_history"]["Insert"]>;
        Relationships: [];
      };
      appointments: {
        Row: {
          id: string;
          owner_id: string;
          work_order_id: string;
          calendly_event_uri: string | null;
          calendly_invitee_uri: string | null;
          scheduled_start: string | null;
          scheduled_end: string | null;
          status: string;
          cancel_url: string | null;
          reschedule_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          work_order_id: string;
          calendly_event_uri?: string | null;
          calendly_invitee_uri?: string | null;
          scheduled_start?: string | null;
          scheduled_end?: string | null;
          status?: string;
          cancel_url?: string | null;
          reschedule_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["appointments"]["Insert"]>;
        Relationships: [];
      };
      communications: {
        Row: {
          id: string;
          owner_id: string;
          work_order_id: string;
          type: string;
          recipient_email: string;
          subject: string;
          rendered_body: string;
          gmail_message_id: string | null;
          status: string;
          failure_reason: string | null;
          idempotency_key: string;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          work_order_id: string;
          type: string;
          recipient_email: string;
          subject: string;
          rendered_body: string;
          gmail_message_id?: string | null;
          status?: string;
          failure_reason?: string | null;
          idempotency_key: string;
          sent_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["communications"]["Insert"]>;
        Relationships: [];
      };
      email_imports: {
        Row: {
          id: string;
          owner_id: string;
          gmail_message_id: string;
          gmail_thread_id: string | null;
          work_order_id: string | null;
          raw_subject: string | null;
          raw_from: string | null;
          raw_snippet: string | null;
          raw_body_text: string | null;
          raw_body_html_sanitized: string | null;
          parser_name: string | null;
          parser_version: string | null;
          parsed_fields: Json | null;
          missing_fields: string[];
          warnings: string[];
          confidence_score: number | null;
          import_status: string;
          error_message: string | null;
          imported_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          gmail_message_id: string;
          gmail_thread_id?: string | null;
          work_order_id?: string | null;
          raw_subject?: string | null;
          raw_from?: string | null;
          raw_snippet?: string | null;
          raw_body_text?: string | null;
          raw_body_html_sanitized?: string | null;
          parser_name?: string | null;
          parser_version?: string | null;
          parsed_fields?: Json | null;
          missing_fields?: string[];
          warnings?: string[];
          confidence_score?: number | null;
          import_status?: string;
          error_message?: string | null;
          imported_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["email_imports"]["Insert"]>;
        Relationships: [];
      };
      work_order_attachments: {
        Row: {
          id: string;
          owner_id: string;
          work_order_id: string;
          email_import_id: string | null;
          file_name: string;
          content_type: string | null;
          size_bytes: number | null;
          storage_path: string;
          gmail_attachment_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          work_order_id: string;
          email_import_id?: string | null;
          file_name: string;
          content_type?: string | null;
          size_bytes?: number | null;
          storage_path: string;
          gmail_attachment_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["work_order_attachments"]["Insert"]>;
        Relationships: [];
      };
      integration_credentials: {
        Row: {
          id: string;
          owner_id: string;
          provider: string;
          access_token: string | null;
          refresh_token: string | null;
          token_expires_at: string | null;
          scope: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          provider: string;
          access_token?: string | null;
          refresh_token?: string | null;
          token_expires_at?: string | null;
          scope?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["integration_credentials"]["Insert"]>;
        Relationships: [];
      };
      public_action_tokens: {
        Row: {
          id: string;
          owner_id: string;
          work_order_id: string;
          token_hash: string;
          purpose: string;
          expires_at: string;
          used_at: string | null;
          revoked_at: string | null;
          attempt_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          work_order_id: string;
          token_hash: string;
          purpose: string;
          expires_at: string;
          used_at?: string | null;
          revoked_at?: string | null;
          attempt_count?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["public_action_tokens"]["Insert"]>;
        Relationships: [];
      };
      ratings: {
        Row: {
          id: string;
          owner_id: string;
          work_order_id: string;
          public_action_token_id: string | null;
          rating: number | null;
          comment: string | null;
          tenant_confirmed_complete: boolean | null;
          issue_unresolved: boolean;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          work_order_id: string;
          public_action_token_id?: string | null;
          rating?: number | null;
          comment?: string | null;
          tenant_confirmed_complete?: boolean | null;
          issue_unresolved?: boolean;
          submitted_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ratings"]["Insert"]>;
        Relationships: [];
      };
      webhook_events: {
        Row: {
          id: string;
          provider: string;
          event_id: string;
          event_type: string;
          payload: Json;
          signature_verified: boolean;
          processed_at: string | null;
          processing_status: string;
          error_message: string | null;
          received_at: string;
        };
        Insert: {
          id?: string;
          provider: string;
          event_id: string;
          event_type: string;
          payload: Json;
          signature_verified?: boolean;
          processed_at?: string | null;
          processing_status?: string;
          error_message?: string | null;
          received_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["webhook_events"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
