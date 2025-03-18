export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          is_admin: boolean
          created_at: string
          updated_at: string
          email: string | null
          full_name: string | null
        }
        Insert: {
          id: string
          is_admin?: boolean
          created_at?: string
          updated_at?: string
          email?: string | null
          full_name?: string | null
        }
        Update: {
          id?: string
          is_admin?: boolean
          created_at?: string
          updated_at?: string
          email?: string | null
          full_name?: string | null
        }
      },
      admin_actions: {
        Row: {
          id: string
          user_id: string | null
          action_type: string
          action_details: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          action_type: string
          action_details?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          action_type?: string
          action_details?: Json | null
          created_at?: string
        }
      }
      // Dodaj tutaj inne tabele z Twojej bazy danych
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
  }
} 