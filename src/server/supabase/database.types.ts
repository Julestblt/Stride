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
      athlete_goals: {
        Row: {
          created_at: string;
          focus: string;
          revision: number;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          focus: string;
          revision?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          focus?: string;
          revision?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      athlete_profiles: {
        Row: {
          available_weekdays: number[] | null;
          birth_date: string | null;
          created_at: string;
          first_name: string | null;
          height_cm: number | null;
          long_run_day: string | null;
          primary_terrain: string | null;
          revision: number;
          sex: string | null;
          training_access: string[] | null;
          updated_at: string;
          user_id: string;
          value_sources: NonNullable<Json>;
          weekday_session_minutes: number | null;
          weight_kg: number | null;
        };
        ComputedFields: never;
        Insert: {
          available_weekdays?: number[] | null;
          birth_date?: string | null;
          created_at?: string;
          first_name?: string | null;
          height_cm?: number | null;
          long_run_day?: string | null;
          primary_terrain?: string | null;
          revision?: number;
          sex?: string | null;
          training_access?: string[] | null;
          updated_at?: string;
          user_id: string;
          value_sources?: NonNullable<Json>;
          weekday_session_minutes?: number | null;
          weight_kg?: number | null;
        };
        Update: {
          available_weekdays?: number[] | null;
          birth_date?: string | null;
          created_at?: string;
          first_name?: string | null;
          height_cm?: number | null;
          long_run_day?: string | null;
          primary_terrain?: string | null;
          revision?: number;
          sex?: string | null;
          training_access?: string[] | null;
          updated_at?: string;
          user_id?: string;
          value_sources?: NonNullable<Json>;
          weekday_session_minutes?: number | null;
          weight_kg?: number | null;
        };
        Relationships: [];
      };
      athlete_races: {
        Row: {
          created_at: string;
          distance_km: number | null;
          elevation_gain_m: number | null;
          id: string;
          name: string | null;
          priority: string;
          race_date: string | null;
          revision: number;
          target_duration_seconds: number | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          distance_km?: number | null;
          elevation_gain_m?: number | null;
          id?: string;
          name?: string | null;
          priority?: string;
          race_date?: string | null;
          revision?: number;
          target_duration_seconds?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          distance_km?: number | null;
          elevation_gain_m?: number | null;
          id?: string;
          name?: string | null;
          priority?: string;
          race_date?: string | null;
          revision?: number;
          target_duration_seconds?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      auth_attempts: {
        Row: {
          attempts: number;
          user_id: string;
          window_number: number;
        };
        ComputedFields: never;
        Insert: {
          attempts: number;
          user_id: string;
          window_number: number;
        };
        Update: {
          attempts?: number;
          user_id?: string;
          window_number?: number;
        };
        Relationships: [];
      };
      auth_challenges: {
        Row: {
          created_at: string;
          encrypted_state: string;
          expires_at: string;
          id: string;
          provider: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          encrypted_state: string;
          expires_at: string;
          id: string;
          provider: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          encrypted_state?: string;
          expires_at?: string;
          id?: string;
          provider?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      onboarding_progress: {
        Row: {
          about_completed_at: string | null;
          completed_at: string | null;
          created_at: string;
          current_step: string;
          garmin_completed_at: string | null;
          goals_completed_at: string | null;
          history_completed_at: string | null;
          profile_completed_at: string | null;
          revision: number;
          updated_at: string;
          user_id: string;
          welcome_completed_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          about_completed_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          current_step?: string;
          garmin_completed_at?: string | null;
          goals_completed_at?: string | null;
          history_completed_at?: string | null;
          profile_completed_at?: string | null;
          revision?: number;
          updated_at?: string;
          user_id: string;
          welcome_completed_at?: string | null;
        };
        Update: {
          about_completed_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          current_step?: string;
          garmin_completed_at?: string | null;
          goals_completed_at?: string | null;
          history_completed_at?: string | null;
          profile_completed_at?: string | null;
          revision?: number;
          updated_at?: string;
          user_id?: string;
          welcome_completed_at?: string | null;
        };
        Relationships: [];
      };
      provider_activities: {
        Row: {
          activity_type: string | null;
          aerobic_training_effect: number | null;
          anaerobic_training_effect: number | null;
          average_cadence: number | null;
          average_heart_rate: number | null;
          average_power_watts: number | null;
          connection_id: string;
          detail_imported_at: string | null;
          distance_meters: number | null;
          duration_seconds: number | null;
          elevation_gain_meters: number | null;
          elevation_loss_meters: number | null;
          has_route: boolean | null;
          id: string;
          imported_at: string;
          local_started_at: string | null;
          max_heart_rate: number | null;
          max_power_watts: number | null;
          provider: string;
          provider_activity_id: string;
          route_name: string | null;
          source_updated_at: string | null;
          started_at: string | null;
          time_zone_id: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          activity_type?: string | null;
          aerobic_training_effect?: number | null;
          anaerobic_training_effect?: number | null;
          average_cadence?: number | null;
          average_heart_rate?: number | null;
          average_power_watts?: number | null;
          connection_id: string;
          detail_imported_at?: string | null;
          distance_meters?: number | null;
          duration_seconds?: number | null;
          elevation_gain_meters?: number | null;
          elevation_loss_meters?: number | null;
          has_route?: boolean | null;
          id?: string;
          imported_at?: string;
          local_started_at?: string | null;
          max_heart_rate?: number | null;
          max_power_watts?: number | null;
          provider: string;
          provider_activity_id: string;
          route_name?: string | null;
          source_updated_at?: string | null;
          started_at?: string | null;
          time_zone_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          activity_type?: string | null;
          aerobic_training_effect?: number | null;
          anaerobic_training_effect?: number | null;
          average_cadence?: number | null;
          average_heart_rate?: number | null;
          average_power_watts?: number | null;
          connection_id?: string;
          detail_imported_at?: string | null;
          distance_meters?: number | null;
          duration_seconds?: number | null;
          elevation_gain_meters?: number | null;
          elevation_loss_meters?: number | null;
          has_route?: boolean | null;
          id?: string;
          imported_at?: string;
          local_started_at?: string | null;
          max_heart_rate?: number | null;
          max_power_watts?: number | null;
          provider?: string;
          provider_activity_id?: string;
          route_name?: string | null;
          source_updated_at?: string | null;
          started_at?: string | null;
          time_zone_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "provider_activities_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "provider_connections";
            referencedColumns: ["id"];
          },
        ];
      };
      provider_activity_segments: {
        Row: {
          activity_id: string;
          average_cadence: number | null;
          average_heart_rate: number | null;
          average_power_watts: number | null;
          distance_meters: number | null;
          duration_seconds: number | null;
          elevation_gain_meters: number | null;
          elevation_loss_meters: number | null;
          id: string;
          imported_at: string;
          provider: string;
          segment_index: number;
          segment_type: string;
          started_at: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          activity_id: string;
          average_cadence?: number | null;
          average_heart_rate?: number | null;
          average_power_watts?: number | null;
          distance_meters?: number | null;
          duration_seconds?: number | null;
          elevation_gain_meters?: number | null;
          elevation_loss_meters?: number | null;
          id?: string;
          imported_at?: string;
          provider: string;
          segment_index: number;
          segment_type: string;
          started_at?: string | null;
          user_id: string;
        };
        Update: {
          activity_id?: string;
          average_cadence?: number | null;
          average_heart_rate?: number | null;
          average_power_watts?: number | null;
          distance_meters?: number | null;
          duration_seconds?: number | null;
          elevation_gain_meters?: number | null;
          elevation_loss_meters?: number | null;
          id?: string;
          imported_at?: string;
          provider?: string;
          segment_index?: number;
          segment_type?: string;
          started_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "provider_activity_segments_activity_id_fkey";
            columns: ["activity_id"];
            isOneToOne: false;
            referencedRelation: "provider_activities";
            referencedColumns: ["id"];
          },
        ];
      };
      provider_connections: {
        Row: {
          connected_at: string | null;
          created_at: string;
          id: string;
          last_authenticated_at: string | null;
          last_error_code: string | null;
          last_sync_at: string | null;
          lease_expires_at: string | null;
          lease_owner: string | null;
          provider: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          connected_at?: string | null;
          created_at?: string;
          id?: string;
          last_authenticated_at?: string | null;
          last_error_code?: string | null;
          last_sync_at?: string | null;
          lease_expires_at?: string | null;
          lease_owner?: string | null;
          provider: string;
          status: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          connected_at?: string | null;
          created_at?: string;
          id?: string;
          last_authenticated_at?: string | null;
          last_error_code?: string | null;
          last_sync_at?: string | null;
          lease_expires_at?: string | null;
          lease_owner?: string | null;
          provider?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      provider_observations: {
        Row: {
          availability: string;
          connection_id: string;
          domain: string;
          id: string;
          imported_at: string;
          metric: string;
          observed_at: string | null;
          observed_on: string;
          provider: string;
          source_updated_at: string | null;
          unit: string | null;
          user_id: string;
          value_numeric: number | null;
          value_text: string | null;
        };
        ComputedFields: never;
        Insert: {
          availability: string;
          connection_id: string;
          domain: string;
          id?: string;
          imported_at?: string;
          metric: string;
          observed_at?: string | null;
          observed_on: string;
          provider: string;
          source_updated_at?: string | null;
          unit?: string | null;
          user_id: string;
          value_numeric?: number | null;
          value_text?: string | null;
        };
        Update: {
          availability?: string;
          connection_id?: string;
          domain?: string;
          id?: string;
          imported_at?: string;
          metric?: string;
          observed_at?: string | null;
          observed_on?: string;
          provider?: string;
          source_updated_at?: string | null;
          unit?: string | null;
          user_id?: string;
          value_numeric?: number | null;
          value_text?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "provider_observations_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "provider_connections";
            referencedColumns: ["id"];
          },
        ];
      };
      provider_secrets: {
        Row: {
          ciphertext: string;
          connection_id: string;
          provider: string;
          updated_at: string;
          user_id: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          ciphertext: string;
          connection_id: string;
          provider: string;
          updated_at?: string;
          user_id: string;
          version?: number;
        };
        Update: {
          ciphertext?: string;
          connection_id?: string;
          provider?: string;
          updated_at?: string;
          user_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "provider_secrets_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "provider_connections";
            referencedColumns: ["id"];
          },
        ];
      };
      sync_jobs: {
        Row: {
          activity_count: number;
          attempts: number;
          connection_id: string;
          created_at: string;
          cursor_date: string | null;
          failure_count: number;
          id: string;
          last_error_code: string | null;
          last_success_at: string | null;
          lease_expires_at: string | null;
          mode: string;
          next_attempt_at: string;
          oldest_date: string;
          oldest_synchronized_date: string | null;
          phase: string;
          provider: string;
          state: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          activity_count?: number;
          attempts?: number;
          connection_id: string;
          created_at?: string;
          cursor_date?: string | null;
          failure_count?: number;
          id?: string;
          last_error_code?: string | null;
          last_success_at?: string | null;
          lease_expires_at?: string | null;
          mode: string;
          next_attempt_at?: string;
          oldest_date?: string;
          oldest_synchronized_date?: string | null;
          phase: string;
          provider: string;
          state: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          activity_count?: number;
          attempts?: number;
          connection_id?: string;
          created_at?: string;
          cursor_date?: string | null;
          failure_count?: number;
          id?: string;
          last_error_code?: string | null;
          last_success_at?: string | null;
          lease_expires_at?: string | null;
          mode?: string;
          next_attempt_at?: string;
          oldest_date?: string;
          oldest_synchronized_date?: string | null;
          phase?: string;
          provider?: string;
          state?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sync_jobs_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "provider_connections";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      provider_training_weeks: {
        Row: {
          activity_count: number | null;
          distance_meters: number | null;
          duration_seconds: number | null;
          latest_imported_at: string | null;
          latest_source_updated_at: string | null;
          provider: string | null;
          run_count: number | null;
          user_id: string | null;
          week_start: string | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
    };
    Functions: {
      acquire_provider_lease: {
        Args: { p_connection_id: string; p_owner: string };
        Returns: boolean;
      };
      activate_garmin_connection: {
        Args: {
          p_ciphertext: string;
          p_expected_connection_id: string;
          p_oldest_date: string;
          p_user_id: string;
        };
        Returns: string;
      };
      allow_auth_attempt: { Args: { p_user_id: string }; Returns: boolean };
      claim_sync_job: {
        Args: Record<PropertyKey, never>;
        Returns: {
          activity_count: number;
          attempts: number;
          connection_id: string;
          created_at: string;
          cursor_date: string | null;
          failure_count: number;
          id: string;
          last_error_code: string | null;
          last_success_at: string | null;
          lease_expires_at: string | null;
          mode: string;
          next_attempt_at: string;
          oldest_date: string;
          oldest_synchronized_date: string | null;
          phase: string;
          provider: string;
          state: string;
          updated_at: string;
          user_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "sync_jobs";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      complete_onboarding_step: {
        Args: { p_expected_revision: number; p_step: string };
        Returns: {
          about_completed_at: string | null;
          completed_at: string | null;
          created_at: string;
          current_step: string;
          garmin_completed_at: string | null;
          goals_completed_at: string | null;
          history_completed_at: string | null;
          profile_completed_at: string | null;
          revision: number;
          updated_at: string;
          user_id: string;
          welcome_completed_at: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "onboarding_progress";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      consume_auth_challenge: {
        Args: { p_challenge_id: string; p_user_id: string };
        Returns: {
          encrypted_state: string;
        }[];
      };
      count_provider_activities: {
        Args: { p_connection_id: string };
        Returns: number;
      };
      delete_garmin_data: { Args: { p_user_id: string }; Returns: undefined };
      disconnect_garmin_connection: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
      persist_provider_secret: {
        Args: {
          p_ciphertext: string;
          p_connection_id: string;
          p_owner: string;
          p_user_id: string;
          p_version: number;
        };
        Returns: number;
      };
      release_provider_lease: {
        Args: { p_connection_id: string; p_owner: string };
        Returns: undefined;
      };
      renew_provider_lease: {
        Args: { p_connection_id: string; p_owner: string };
        Returns: boolean;
      };
      schedule_incremental_sync: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      store_provider_secret: {
        Args: {
          p_ciphertext: string;
          p_connection_id: string;
          p_provider: string;
          p_user_id: string;
        };
        Returns: boolean;
      };
      upsert_garmin_activity: {
        Args: {
          p_activity: Json;
          p_attempts: number;
          p_connection_id: string;
          p_job_id: string;
          p_segments: Json;
          p_user_id: string;
        };
        Returns: boolean;
      };
      upsert_provider_observations: {
        Args: {
          p_attempts: number;
          p_connection_id: string;
          p_job_id: string;
          p_observations: Json;
          p_user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
