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
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
