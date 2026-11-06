export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      announcements: {
        Row: {
          id: string;
          title: string;
          body: string;
          pdf_path: string | null;
          pdf_name: string | null;
          slide_paths: string[];
          slide_names: string[];
          categories: string[];
          background_path: string | null;
          background_name: string | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          body?: string;
          pdf_path?: string | null;
          pdf_name?: string | null;
          slide_paths?: string[];
          slide_names?: string[];
          categories?: string[];
          background_path?: string | null;
          background_name?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          body?: string;
          pdf_path?: string | null;
          pdf_name?: string | null;
          slide_paths?: string[];
          slide_names?: string[];
          categories?: string[];
          background_path?: string | null;
          background_name?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          title: string;
          description: string;
          event_date: string;
          end_date: string | null;
          starts_at: string;
          ends_at: string | null;
          location: string;
          registration_enabled: boolean;
          registration_fields: Json;
          registration_deadline: string | null;
          registration_capacity: number | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description: string;
          event_date: string;
          end_date?: string | null;
          starts_at: string;
          ends_at?: string | null;
          location: string;
          registration_enabled?: boolean;
          registration_fields?: Json;
          registration_deadline?: string | null;
          registration_capacity?: number | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string;
          event_date?: string;
          end_date?: string | null;
          starts_at?: string;
          ends_at?: string | null;
          location?: string;
          registration_enabled?: boolean;
          registration_fields?: Json;
          registration_deadline?: string | null;
          registration_capacity?: number | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      event_registrations: {
        Row: {
          id: string;
          event_id: string;
          answers: Json;
          form_snapshot: Json;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          answers: Json;
          form_snapshot: Json;
          submitted_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          answers?: Json;
          form_snapshot?: Json;
          submitted_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      devotional_contributors: {
        Row: {
          id: string;
          auth_user_id: string;
          full_name: string;
          username: string;
          normalized_username: string;
          email_verified_at: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auth_user_id: string;
          full_name: string;
          username: string;
          email_verified_at?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          auth_user_id?: string;
          full_name?: string;
          username?: string;
          email_verified_at?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      devotional_applications: {
        Row: {
          id: string;
          contributor_id: string;
          status: string;
          submitted_at: string;
          reviewed_by: string | null;
          reviewed_at: string | null;
          rejection_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          contributor_id: string;
          status?: string;
          submitted_at?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          rejection_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          contributor_id?: string;
          status?: string;
          submitted_at?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          rejection_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      consume_event_registration_rate_limit: {
        Args: {
          p_request_hash: string;
          p_bucket_start: string;
        };
        Returns: boolean;
      };
      submit_event_registration: {
        Args: {
          p_event_id: string;
          p_answers: Json;
          p_form_snapshot: Json;
        };
        Returns: {
          status: string;
          registration_id: string | null;
        }[];
      };
      consume_devotional_rate_limit: {
        Args: {
          p_scope: string;
          p_request_hash: string;
          p_max_attempts: number;
          p_window_seconds: number;
        };
        Returns: boolean;
      };
      issue_devotional_submission_grant: {
        Args: {
          p_grant_hash: string;
          p_contributor_id: string;
          p_expires_at: string;
        };
        Returns: boolean;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
  private: {
    Tables: {
      devotional_submission_grants: {
        Row: {
          grant_hash: string;
          contributor_id: string;
          expires_at: string;
          consumed_at: string | null;
          created_at: string;
        };
        Insert: {
          grant_hash: string;
          contributor_id: string;
          expires_at: string;
          consumed_at?: string | null;
          created_at?: string;
        };
        Update: {
          grant_hash?: string;
          contributor_id?: string;
          expires_at?: string;
          consumed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
