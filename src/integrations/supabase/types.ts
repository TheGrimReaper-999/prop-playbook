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
      nba_fixtures: {
        Row: {
          away_team_abbrev: string
          away_team_id: string
          away_team_logo: string | null
          away_team_name: string
          away_team_score: number | null
          created_at: string
          event_id: string
          game_date: string
          home_team_abbrev: string
          home_team_id: string
          home_team_logo: string | null
          home_team_name: string
          home_team_score: number | null
          id: string
          season: string | null
          status: string
          status_detail: string | null
          updated_at: string
          venue_city: string | null
          venue_name: string | null
          venue_state: string | null
        }
        Insert: {
          away_team_abbrev: string
          away_team_id: string
          away_team_logo?: string | null
          away_team_name: string
          away_team_score?: number | null
          created_at?: string
          event_id: string
          game_date: string
          home_team_abbrev: string
          home_team_id: string
          home_team_logo?: string | null
          home_team_name: string
          home_team_score?: number | null
          id?: string
          season?: string | null
          status?: string
          status_detail?: string | null
          updated_at?: string
          venue_city?: string | null
          venue_name?: string | null
          venue_state?: string | null
        }
        Update: {
          away_team_abbrev?: string
          away_team_id?: string
          away_team_logo?: string | null
          away_team_name?: string
          away_team_score?: number | null
          created_at?: string
          event_id?: string
          game_date?: string
          home_team_abbrev?: string
          home_team_id?: string
          home_team_logo?: string | null
          home_team_name?: string
          home_team_score?: number | null
          id?: string
          season?: string | null
          status?: string
          status_detail?: string | null
          updated_at?: string
          venue_city?: string | null
          venue_name?: string | null
          venue_state?: string | null
        }
        Relationships: []
      }
      nba_player_stats: {
        Row: {
          assists: number | null
          blocks: number | null
          created_at: string
          event_id: string
          field_goal_pct: number | null
          field_goals_attempted: number | null
          field_goals_made: number | null
          fouls: number | null
          free_throw_pct: number | null
          free_throws_attempted: number | null
          free_throws_made: number | null
          game_date: string
          id: string
          minutes: number | null
          player_id: string | null
          player_name: string
          plus_minus: number | null
          points: number | null
          rebounds: number | null
          steals: number | null
          three_pt_attempted: number | null
          three_pt_made: number | null
          three_pt_pct: number | null
          turnovers: number | null
        }
        Insert: {
          assists?: number | null
          blocks?: number | null
          created_at?: string
          event_id: string
          field_goal_pct?: number | null
          field_goals_attempted?: number | null
          field_goals_made?: number | null
          fouls?: number | null
          free_throw_pct?: number | null
          free_throws_attempted?: number | null
          free_throws_made?: number | null
          game_date: string
          id?: string
          minutes?: number | null
          player_id?: string | null
          player_name: string
          plus_minus?: number | null
          points?: number | null
          rebounds?: number | null
          steals?: number | null
          three_pt_attempted?: number | null
          three_pt_made?: number | null
          three_pt_pct?: number | null
          turnovers?: number | null
        }
        Update: {
          assists?: number | null
          blocks?: number | null
          created_at?: string
          event_id?: string
          field_goal_pct?: number | null
          field_goals_attempted?: number | null
          field_goals_made?: number | null
          fouls?: number | null
          free_throw_pct?: number | null
          free_throws_attempted?: number | null
          free_throws_made?: number | null
          game_date?: string
          id?: string
          minutes?: number | null
          player_id?: string | null
          player_name?: string
          plus_minus?: number | null
          points?: number | null
          rebounds?: number | null
          steals?: number | null
          three_pt_attempted?: number | null
          three_pt_made?: number | null
          three_pt_pct?: number | null
          turnovers?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "nba_player_stats_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "nba_players"
            referencedColumns: ["id"]
          },
        ]
      }
      nba_players: {
        Row: {
          api_player_id: string | null
          created_at: string
          full_name: string
          id: string
          image_url: string | null
          team_name: string
        }
        Insert: {
          api_player_id?: string | null
          created_at?: string
          full_name: string
          id?: string
          image_url?: string | null
          team_name: string
        }
        Update: {
          api_player_id?: string | null
          created_at?: string
          full_name?: string
          id?: string
          image_url?: string | null
          team_name?: string
        }
        Relationships: []
      }
      nba_teams: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          team_id: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          team_id?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          team_id?: number | null
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
