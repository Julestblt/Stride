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
      activity_shoe_decisions: {
        Row: {
          created_at: string;
          decision: string;
          provider_activity_id: string;
          shoe_id: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          decision: string;
          provider_activity_id: string;
          shoe_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          decision?: string;
          provider_activity_id?: string;
          shoe_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activity_shoe_decisions_shoe_id_user_id_fkey";
            columns: ["shoe_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "athlete_shoes";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      athlete_condition_reports: {
        Row: {
          body_area: string | null;
          created_at: string;
          id: string;
          kind: string;
          note: string | null;
          red_flag: boolean;
          resolved_on: string | null;
          revision: number;
          severity: number;
          source: string;
          started_on: string;
          status: string;
          systemic_symptoms: boolean;
          updated_at: string;
          user_id: string;
          worsening: boolean;
        };
        ComputedFields: never;
        Insert: {
          body_area?: string | null;
          created_at?: string;
          id?: string;
          kind: string;
          note?: string | null;
          red_flag?: boolean;
          resolved_on?: string | null;
          revision?: number;
          severity: number;
          source?: string;
          started_on: string;
          status?: string;
          systemic_symptoms?: boolean;
          updated_at?: string;
          user_id: string;
          worsening?: boolean;
        };
        Update: {
          body_area?: string | null;
          created_at?: string;
          id?: string;
          kind?: string;
          note?: string | null;
          red_flag?: boolean;
          resolved_on?: string | null;
          revision?: number;
          severity?: number;
          source?: string;
          started_on?: string;
          status?: string;
          systemic_symptoms?: boolean;
          updated_at?: string;
          user_id?: string;
          worsening?: boolean;
        };
        Relationships: [];
      };
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
          coach_face: string;
          created_at: string;
          director_face: string;
          first_name: string | null;
          height_cm: number | null;
          long_run_day: string | null;
          max_weekly_minutes: number | null;
          medical_face: string;
          nutritionist_face: string;
          primary_terrain: string | null;
          profile_photo_path: string | null;
          revision: number;
          running_max_heart_rate_override: number | null;
          sex: string | null;
          strategist_face: string;
          threshold_heart_rate_override: number | null;
          threshold_heart_rate_source: string | null;
          time_zone: string;
          training_access: string[] | null;
          updated_at: string;
          user_id: string;
          value_sources: NonNullable<Json>;
          watch_workouts_enabled: boolean;
          watch_workouts_synced_at: string | null;
          watch_workouts_synced_key: string | null;
          weekday_session_minutes: number | null;
          weight_kg: number | null;
        };
        ComputedFields: never;
        Insert: {
          available_weekdays?: number[] | null;
          birth_date?: string | null;
          coach_face?: string;
          created_at?: string;
          director_face?: string;
          first_name?: string | null;
          height_cm?: number | null;
          long_run_day?: string | null;
          max_weekly_minutes?: number | null;
          medical_face?: string;
          nutritionist_face?: string;
          primary_terrain?: string | null;
          profile_photo_path?: string | null;
          revision?: number;
          running_max_heart_rate_override?: number | null;
          sex?: string | null;
          strategist_face?: string;
          threshold_heart_rate_override?: number | null;
          threshold_heart_rate_source?: string | null;
          time_zone?: string;
          training_access?: string[] | null;
          updated_at?: string;
          user_id: string;
          value_sources?: NonNullable<Json>;
          watch_workouts_enabled?: boolean;
          watch_workouts_synced_at?: string | null;
          watch_workouts_synced_key?: string | null;
          weekday_session_minutes?: number | null;
          weight_kg?: number | null;
        };
        Update: {
          available_weekdays?: number[] | null;
          birth_date?: string | null;
          coach_face?: string;
          created_at?: string;
          director_face?: string;
          first_name?: string | null;
          height_cm?: number | null;
          long_run_day?: string | null;
          max_weekly_minutes?: number | null;
          medical_face?: string;
          nutritionist_face?: string;
          primary_terrain?: string | null;
          profile_photo_path?: string | null;
          revision?: number;
          running_max_heart_rate_override?: number | null;
          sex?: string | null;
          strategist_face?: string;
          threshold_heart_rate_override?: number | null;
          threshold_heart_rate_source?: string | null;
          time_zone?: string;
          training_access?: string[] | null;
          updated_at?: string;
          user_id?: string;
          value_sources?: NonNullable<Json>;
          watch_workouts_enabled?: boolean;
          watch_workouts_synced_at?: string | null;
          watch_workouts_synced_key?: string | null;
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
          race_kind: string;
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
          race_kind?: string;
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
          race_kind?: string;
          revision?: number;
          target_duration_seconds?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      athlete_shoes: {
        Row: {
          brand: string;
          category: string;
          created_at: string;
          description: string | null;
          first_use_date: string;
          garmin_gear_uuid: string | null;
          id: string;
          lifespan_km: number;
          model: string;
          retired_on: string | null;
          revision: number;
          size_eu: number | null;
          starting_distance_m: number;
          suggested_fields: string[];
          terrain: string;
          updated_at: string;
          user_id: string;
          version: string | null;
        };
        ComputedFields: never;
        Insert: {
          brand: string;
          category: string;
          created_at?: string;
          description?: string | null;
          first_use_date: string;
          garmin_gear_uuid?: string | null;
          id?: string;
          lifespan_km: number;
          model: string;
          retired_on?: string | null;
          revision?: number;
          size_eu?: number | null;
          starting_distance_m?: number;
          suggested_fields?: string[];
          terrain: string;
          updated_at?: string;
          user_id: string;
          version?: string | null;
        };
        Update: {
          brand?: string;
          category?: string;
          created_at?: string;
          description?: string | null;
          first_use_date?: string;
          garmin_gear_uuid?: string | null;
          id?: string;
          lifespan_km?: number;
          model?: string;
          retired_on?: string | null;
          revision?: number;
          size_eu?: number | null;
          starting_distance_m?: number;
          suggested_fields?: string[];
          terrain?: string;
          updated_at?: string;
          user_id?: string;
          version?: string | null;
        };
        Relationships: [];
      };
      athlete_unavailability: {
        Row: {
          created_at: string;
          ends_on: string;
          id: string;
          kind: string;
          reason: string | null;
          revision: number;
          starts_on: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          ends_on: string;
          id?: string;
          kind?: string;
          reason?: string | null;
          revision?: number;
          starts_on: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          ends_on?: string;
          id?: string;
          kind?: string;
          reason?: string | null;
          revision?: number;
          starts_on?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      athlete_wellness_checkins: {
        Row: {
          checkin_date: string;
          created_at: string;
          id: string;
          legs: string | null;
          revision: number;
          soreness: string | null;
          stress: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          checkin_date: string;
          created_at?: string;
          id?: string;
          legs?: string | null;
          revision?: number;
          soreness?: string | null;
          stress?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          checkin_date?: string;
          created_at?: string;
          id?: string;
          legs?: string | null;
          revision?: number;
          soreness?: string | null;
          stress?: string | null;
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
      coach_sessions: {
        Row: {
          budget_cents: number;
          composing_since: string | null;
          created_at: string;
          id: string;
          last_activity_at: string;
          last_turn_at: string | null;
          list_cost_cents: number;
          managed_session_id: string;
          mode: string;
          pending_tool_use_id: string | null;
          read_at: string | null;
          status: string;
          title: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          budget_cents: number;
          composing_since?: string | null;
          created_at?: string;
          id?: string;
          last_activity_at?: string;
          last_turn_at?: string | null;
          list_cost_cents?: number;
          managed_session_id: string;
          mode: string;
          pending_tool_use_id?: string | null;
          read_at?: string | null;
          status?: string;
          title?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          budget_cents?: number;
          composing_since?: string | null;
          created_at?: string;
          id?: string;
          last_activity_at?: string;
          last_turn_at?: string | null;
          list_cost_cents?: number;
          managed_session_id?: string;
          mode?: string;
          pending_tool_use_id?: string | null;
          read_at?: string | null;
          status?: string;
          title?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      coach_thread_items: {
        Row: {
          body: NonNullable<Json>;
          coach_session_id: string;
          created_at: string;
          id: number;
          kind: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          body: NonNullable<Json>;
          coach_session_id: string;
          created_at?: string;
          id?: never;
          kind: string;
          user_id: string;
        };
        Update: {
          body?: NonNullable<Json>;
          coach_session_id?: string;
          created_at?: string;
          id?: never;
          kind?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "coach_thread_items_coach_session_id_fkey";
            columns: ["coach_session_id"];
            isOneToOne: false;
            referencedRelation: "coach_sessions";
            referencedColumns: ["id"];
          },
        ];
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
      plan_blocks: {
        Row: {
          block_key: string;
          ends_on: string;
          id: string;
          kind: string;
          name: string;
          objective: string;
          plan_id: string;
          race_id: string | null;
          starts_on: string;
          user_id: string;
          valid_from_version: number;
          valid_to_version: number | null;
        };
        ComputedFields: never;
        Insert: {
          block_key: string;
          ends_on: string;
          id?: string;
          kind: string;
          name: string;
          objective: string;
          plan_id: string;
          race_id?: string | null;
          starts_on: string;
          user_id: string;
          valid_from_version: number;
          valid_to_version?: number | null;
        };
        Update: {
          block_key?: string;
          ends_on?: string;
          id?: string;
          kind?: string;
          name?: string;
          objective?: string;
          plan_id?: string;
          race_id?: string | null;
          starts_on?: string;
          user_id?: string;
          valid_from_version?: number;
          valid_to_version?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "plan_blocks_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "training_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      plan_decisions: {
        Row: {
          actor: string;
          created_at: string;
          decision: string;
          id: string;
          note: string | null;
          proposal_id: string;
          resulting_version: number | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          actor: string;
          created_at?: string;
          decision: string;
          id?: string;
          note?: string | null;
          proposal_id: string;
          resulting_version?: number | null;
          user_id: string;
        };
        Update: {
          actor?: string;
          created_at?: string;
          decision?: string;
          id?: string;
          note?: string | null;
          proposal_id?: string;
          resulting_version?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plan_decisions_proposal_id_fkey";
            columns: ["proposal_id"];
            isOneToOne: false;
            referencedRelation: "plan_proposals";
            referencedColumns: ["id"];
          },
        ];
      };
      plan_proposals: {
        Row: {
          agent_run_id: string | null;
          applied_version: number | null;
          assumptions: NonNullable<Json>;
          base_version: number | null;
          coach_session_id: string | null;
          created_at: string;
          evidence: NonNullable<Json>;
          expires_at: string | null;
          id: string;
          operations: NonNullable<Json>;
          origin: string;
          plan_id: string | null;
          preview: Json | null;
          rationale: string | null;
          requested_by: string;
          scope: string;
          specialist_opinions: NonNullable<Json>;
          status: string;
          summary: string | null;
          superseded_by: string | null;
          target_keys: string[];
          title: string;
          uncertainty: Json | null;
          updated_at: string;
          user_id: string;
          validation: Json | null;
        };
        ComputedFields: never;
        Insert: {
          agent_run_id?: string | null;
          applied_version?: number | null;
          assumptions?: NonNullable<Json>;
          base_version?: number | null;
          coach_session_id?: string | null;
          created_at?: string;
          evidence?: NonNullable<Json>;
          expires_at?: string | null;
          id?: string;
          operations: NonNullable<Json>;
          origin: string;
          plan_id?: string | null;
          preview?: Json | null;
          rationale?: string | null;
          requested_by: string;
          scope: string;
          specialist_opinions?: NonNullable<Json>;
          status?: string;
          summary?: string | null;
          superseded_by?: string | null;
          target_keys?: string[];
          title: string;
          uncertainty?: Json | null;
          updated_at?: string;
          user_id: string;
          validation?: Json | null;
        };
        Update: {
          agent_run_id?: string | null;
          applied_version?: number | null;
          assumptions?: NonNullable<Json>;
          base_version?: number | null;
          coach_session_id?: string | null;
          created_at?: string;
          evidence?: NonNullable<Json>;
          expires_at?: string | null;
          id?: string;
          operations?: NonNullable<Json>;
          origin?: string;
          plan_id?: string | null;
          preview?: Json | null;
          rationale?: string | null;
          requested_by?: string;
          scope?: string;
          specialist_opinions?: NonNullable<Json>;
          status?: string;
          summary?: string | null;
          superseded_by?: string | null;
          target_keys?: string[];
          title?: string;
          uncertainty?: Json | null;
          updated_at?: string;
          user_id?: string;
          validation?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "plan_proposals_coach_session_id_fkey";
            columns: ["coach_session_id"];
            isOneToOne: false;
            referencedRelation: "coach_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plan_proposals_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "training_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plan_proposals_superseded_by_fkey";
            columns: ["superseded_by"];
            isOneToOne: false;
            referencedRelation: "plan_proposals";
            referencedColumns: ["id"];
          },
        ];
      };
      plan_session_shoe_choices: {
        Row: {
          created_at: string;
          session_key: string;
          shoe_id: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          session_key: string;
          shoe_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          session_key?: string;
          shoe_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plan_session_shoe_choices_shoe_id_user_id_fkey";
            columns: ["shoe_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "athlete_shoes";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      plan_sessions: {
        Row: {
          contingencies: NonNullable<Json>;
          id: string;
          is_key: boolean;
          kind: string;
          origin: string;
          plan_id: string;
          priority: string;
          purpose: string;
          scheduled_on: string;
          session_key: string;
          sport: string;
          structure: NonNullable<Json>;
          targets: NonNullable<Json>;
          terrain: string | null;
          title: string;
          user_id: string;
          valid_from_version: number;
          valid_to_version: number | null;
        };
        ComputedFields: never;
        Insert: {
          contingencies?: NonNullable<Json>;
          id?: string;
          is_key: boolean;
          kind: string;
          origin: string;
          plan_id: string;
          priority: string;
          purpose: string;
          scheduled_on: string;
          session_key: string;
          sport: string;
          structure: NonNullable<Json>;
          targets: NonNullable<Json>;
          terrain?: string | null;
          title: string;
          user_id: string;
          valid_from_version: number;
          valid_to_version?: number | null;
        };
        Update: {
          contingencies?: NonNullable<Json>;
          id?: string;
          is_key?: boolean;
          kind?: string;
          origin?: string;
          plan_id?: string;
          priority?: string;
          purpose?: string;
          scheduled_on?: string;
          session_key?: string;
          sport?: string;
          structure?: NonNullable<Json>;
          targets?: NonNullable<Json>;
          terrain?: string | null;
          title?: string;
          user_id?: string;
          valid_from_version?: number;
          valid_to_version?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "plan_sessions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "training_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      plan_versions: {
        Row: {
          confidence: NonNullable<Json>;
          content_hash: string;
          created_at: string;
          created_by: string;
          effective_from: string;
          parent_version: number | null;
          plan_id: string;
          race_roles: NonNullable<Json>;
          source_proposal_id: string | null;
          summary: string | null;
          user_id: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          confidence: NonNullable<Json>;
          content_hash: string;
          created_at?: string;
          created_by: string;
          effective_from: string;
          parent_version?: number | null;
          plan_id: string;
          race_roles?: NonNullable<Json>;
          source_proposal_id?: string | null;
          summary?: string | null;
          user_id: string;
          version: number;
        };
        Update: {
          confidence?: NonNullable<Json>;
          content_hash?: string;
          created_at?: string;
          created_by?: string;
          effective_from?: string;
          parent_version?: number | null;
          plan_id?: string;
          race_roles?: NonNullable<Json>;
          source_proposal_id?: string | null;
          summary?: string | null;
          user_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "plan_versions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "training_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plan_versions_source_proposal_id_fkey";
            columns: ["source_proposal_id"];
            isOneToOne: false;
            referencedRelation: "plan_proposals";
            referencedColumns: ["id"];
          },
        ];
      };
      plan_weeks: {
        Row: {
          block_key: string;
          id: string;
          intensity_split: NonNullable<Json>;
          long_run_target_s: number | null;
          notes: string | null;
          plan_id: string;
          quality_sessions: number;
          target_distance_m: number | null;
          target_duration_s: number;
          target_elevation_m: number | null;
          user_id: string;
          valid_from_version: number;
          valid_to_version: number | null;
          week_key: string;
          week_start: string;
          week_type: string;
        };
        ComputedFields: never;
        Insert: {
          block_key: string;
          id?: string;
          intensity_split: NonNullable<Json>;
          long_run_target_s?: number | null;
          notes?: string | null;
          plan_id: string;
          quality_sessions: number;
          target_distance_m?: number | null;
          target_duration_s: number;
          target_elevation_m?: number | null;
          user_id: string;
          valid_from_version: number;
          valid_to_version?: number | null;
          week_key: string;
          week_start: string;
          week_type: string;
        };
        Update: {
          block_key?: string;
          id?: string;
          intensity_split?: NonNullable<Json>;
          long_run_target_s?: number | null;
          notes?: string | null;
          plan_id?: string;
          quality_sessions?: number;
          target_distance_m?: number | null;
          target_duration_s?: number;
          target_elevation_m?: number | null;
          user_id?: string;
          valid_from_version?: number;
          valid_to_version?: number | null;
          week_key?: string;
          week_start?: string;
          week_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plan_weeks_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "training_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      provider_activities: {
        Row: {
          activity_name: string | null;
          activity_type: string | null;
          aerobic_training_effect: number | null;
          anaerobic_training_effect: number | null;
          average_cadence: number | null;
          average_heart_rate: number | null;
          average_power_watts: number | null;
          calories: number | null;
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
          workout_feel: number | null;
          workout_rpe: number | null;
        };
        ComputedFields: never;
        Insert: {
          activity_name?: string | null;
          activity_type?: string | null;
          aerobic_training_effect?: number | null;
          anaerobic_training_effect?: number | null;
          average_cadence?: number | null;
          average_heart_rate?: number | null;
          average_power_watts?: number | null;
          calories?: number | null;
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
          workout_feel?: number | null;
          workout_rpe?: number | null;
        };
        Update: {
          activity_name?: string | null;
          activity_type?: string | null;
          aerobic_training_effect?: number | null;
          anaerobic_training_effect?: number | null;
          average_cadence?: number | null;
          average_heart_rate?: number | null;
          average_power_watts?: number | null;
          calories?: number | null;
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
          workout_feel?: number | null;
          workout_rpe?: number | null;
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
      provider_activity_gear: {
        Row: {
          connection_id: string;
          gear_uuid: string;
          provider: string;
          provider_activity_id: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          connection_id: string;
          gear_uuid: string;
          provider?: string;
          provider_activity_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          connection_id?: string;
          gear_uuid?: string;
          provider?: string;
          provider_activity_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "provider_activity_gear_connection_id_fkey";
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
      provider_activity_tracks: {
        Row: {
          activity_id: string;
          bounds: Json | null;
          heart_rate_histogram: Json | null;
          imported_at: string;
          provider: string;
          route: Json | null;
          route_point_count: number;
          series: Json | null;
          series_point_count: number;
          source_point_count: number;
          source_updated_at: string | null;
          status: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          activity_id: string;
          bounds?: Json | null;
          heart_rate_histogram?: Json | null;
          imported_at?: string;
          provider: string;
          route?: Json | null;
          route_point_count?: number;
          series?: Json | null;
          series_point_count?: number;
          source_point_count?: number;
          source_updated_at?: string | null;
          status: string;
          user_id: string;
        };
        Update: {
          activity_id?: string;
          bounds?: Json | null;
          heart_rate_histogram?: Json | null;
          imported_at?: string;
          provider?: string;
          route?: Json | null;
          route_point_count?: number;
          series?: Json | null;
          series_point_count?: number;
          source_point_count?: number;
          source_updated_at?: string | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "provider_activity_tracks_activity_id_fkey";
            columns: ["activity_id"];
            isOneToOne: true;
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
          manual_sync_available_at: string | null;
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
          manual_sync_available_at?: string | null;
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
          manual_sync_available_at?: string | null;
          provider?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      provider_gear: {
        Row: {
          brand: string | null;
          connection_id: string;
          display_name: string | null;
          first_use_date: string | null;
          gear_type: string;
          gear_uuid: string;
          maximum_meters: number | null;
          model: string | null;
          provider: string;
          retired_on: string | null;
          status: string;
          total_activities: number;
          total_distance_meters: number;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          brand?: string | null;
          connection_id: string;
          display_name?: string | null;
          first_use_date?: string | null;
          gear_type: string;
          gear_uuid: string;
          maximum_meters?: number | null;
          model?: string | null;
          provider?: string;
          retired_on?: string | null;
          status: string;
          total_activities?: number;
          total_distance_meters?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          brand?: string | null;
          connection_id?: string;
          display_name?: string | null;
          first_use_date?: string | null;
          gear_type?: string;
          gear_uuid?: string;
          maximum_meters?: number | null;
          model?: string | null;
          provider?: string;
          retired_on?: string | null;
          status?: string;
          total_activities?: number;
          total_distance_meters?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "provider_gear_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "provider_connections";
            referencedColumns: ["id"];
          },
        ];
      };
      provider_heart_rate_zones: {
        Row: {
          connection_id: string;
          imported_at: string;
          lactate_threshold_heart_rate_bpm: number | null;
          max_heart_rate_bpm: number | null;
          provider: string;
          resting_heart_rate_auto_update: boolean | null;
          resting_heart_rate_bpm: number | null;
          sport: string;
          training_method: string | null;
          user_id: string;
          zone1_floor_bpm: number | null;
          zone2_floor_bpm: number | null;
          zone3_floor_bpm: number | null;
          zone4_floor_bpm: number | null;
          zone5_floor_bpm: number | null;
        };
        ComputedFields: never;
        Insert: {
          connection_id: string;
          imported_at?: string;
          lactate_threshold_heart_rate_bpm?: number | null;
          max_heart_rate_bpm?: number | null;
          provider: string;
          resting_heart_rate_auto_update?: boolean | null;
          resting_heart_rate_bpm?: number | null;
          sport: string;
          training_method?: string | null;
          user_id: string;
          zone1_floor_bpm?: number | null;
          zone2_floor_bpm?: number | null;
          zone3_floor_bpm?: number | null;
          zone4_floor_bpm?: number | null;
          zone5_floor_bpm?: number | null;
        };
        Update: {
          connection_id?: string;
          imported_at?: string;
          lactate_threshold_heart_rate_bpm?: number | null;
          max_heart_rate_bpm?: number | null;
          provider?: string;
          resting_heart_rate_auto_update?: boolean | null;
          resting_heart_rate_bpm?: number | null;
          sport?: string;
          training_method?: string | null;
          user_id?: string;
          zone1_floor_bpm?: number | null;
          zone2_floor_bpm?: number | null;
          zone3_floor_bpm?: number | null;
          zone4_floor_bpm?: number | null;
          zone5_floor_bpm?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "provider_heart_rate_zones_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "provider_connections";
            referencedColumns: ["id"];
          },
        ];
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
      provider_workouts: {
        Row: {
          connection_id: string;
          content_hash: string;
          error_code: string | null;
          external_key: string;
          provider: string;
          provider_workout_id: number | null;
          scheduled_on: string;
          sent_at: string | null;
          simplifications: string[];
          status: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          connection_id: string;
          content_hash: string;
          error_code?: string | null;
          external_key: string;
          provider?: string;
          provider_workout_id?: number | null;
          scheduled_on: string;
          sent_at?: string | null;
          simplifications?: string[];
          status: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          connection_id?: string;
          content_hash?: string;
          error_code?: string | null;
          external_key?: string;
          provider?: string;
          provider_workout_id?: number | null;
          scheduled_on?: string;
          sent_at?: string | null;
          simplifications?: string[];
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "provider_workouts_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "provider_connections";
            referencedColumns: ["id"];
          },
        ];
      };
      race_checklist_items: {
        Row: {
          checked: boolean;
          created_at: string;
          detail: string | null;
          end_date: string | null;
          id: string;
          label: string;
          list: string;
          position: number;
          race_id: string;
          revision: number;
          start_date: string | null;
          status: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          checked?: boolean;
          created_at?: string;
          detail?: string | null;
          end_date?: string | null;
          id?: string;
          label: string;
          list: string;
          position?: number;
          race_id: string;
          revision?: number;
          start_date?: string | null;
          status?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          checked?: boolean;
          created_at?: string;
          detail?: string | null;
          end_date?: string | null;
          id?: string;
          label?: string;
          list?: string;
          position?: number;
          race_id?: string;
          revision?: number;
          start_date?: string | null;
          status?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "race_checklist_items_race_id_fkey";
            columns: ["race_id"];
            isOneToOne: false;
            referencedRelation: "athlete_races";
            referencedColumns: ["id"];
          },
        ];
      };
      race_courses: {
        Row: {
          created_at: string;
          distance_m: number;
          elevation_gain_m: number | null;
          elevation_loss_m: number | null;
          file_name: string | null;
          imported_at: string;
          points: NonNullable<Json>;
          race_id: string;
          revision: number;
          source: string;
          source_activity_id: string | null;
          step_m: number;
          time_zone: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          distance_m: number;
          elevation_gain_m?: number | null;
          elevation_loss_m?: number | null;
          file_name?: string | null;
          imported_at?: string;
          points: NonNullable<Json>;
          race_id: string;
          revision?: number;
          source: string;
          source_activity_id?: string | null;
          step_m: number;
          time_zone?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          distance_m?: number;
          elevation_gain_m?: number | null;
          elevation_loss_m?: number | null;
          file_name?: string | null;
          imported_at?: string;
          points?: NonNullable<Json>;
          race_id?: string;
          revision?: number;
          source?: string;
          source_activity_id?: string | null;
          step_m?: number;
          time_zone?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "race_courses_race_id_fkey";
            columns: ["race_id"];
            isOneToOne: true;
            referencedRelation: "athlete_races";
            referencedColumns: ["id"];
          },
        ];
      };
      race_plans: {
        Row: {
          aid_stop_seconds: number;
          ambitious_duration_seconds: number | null;
          carbs_per_hour_g: number;
          cautious_duration_seconds: number | null;
          created_at: string;
          cutoff_duration_seconds: number | null;
          labels: string[];
          night_caffeine: boolean;
          nutrition_alarm_minutes: number;
          race_id: string;
          revision: number;
          roadbook_import: Json | null;
          sodium_mg_per_hour: number;
          start_time: string | null;
          start_time_confirmed: boolean;
          updated_at: string;
          user_id: string;
          walk_grade_percent: number;
          walk_pace_seconds_per_km: number;
          water_ml_per_hour: number;
          water_stop_seconds: number;
        };
        ComputedFields: never;
        Insert: {
          aid_stop_seconds?: number;
          ambitious_duration_seconds?: number | null;
          carbs_per_hour_g?: number;
          cautious_duration_seconds?: number | null;
          created_at?: string;
          cutoff_duration_seconds?: number | null;
          labels?: string[];
          night_caffeine?: boolean;
          nutrition_alarm_minutes?: number;
          race_id: string;
          revision?: number;
          roadbook_import?: Json | null;
          sodium_mg_per_hour?: number;
          start_time?: string | null;
          start_time_confirmed?: boolean;
          updated_at?: string;
          user_id: string;
          walk_grade_percent?: number;
          walk_pace_seconds_per_km?: number;
          water_ml_per_hour?: number;
          water_stop_seconds?: number;
        };
        Update: {
          aid_stop_seconds?: number;
          ambitious_duration_seconds?: number | null;
          carbs_per_hour_g?: number;
          cautious_duration_seconds?: number | null;
          created_at?: string;
          cutoff_duration_seconds?: number | null;
          labels?: string[];
          night_caffeine?: boolean;
          nutrition_alarm_minutes?: number;
          race_id?: string;
          revision?: number;
          roadbook_import?: Json | null;
          sodium_mg_per_hour?: number;
          start_time?: string | null;
          start_time_confirmed?: boolean;
          updated_at?: string;
          user_id?: string;
          walk_grade_percent?: number;
          walk_pace_seconds_per_km?: number;
          water_ml_per_hour?: number;
          water_stop_seconds?: number;
        };
        Relationships: [
          {
            foreignKeyName: "race_plans_race_id_fkey";
            columns: ["race_id"];
            isOneToOne: true;
            referencedRelation: "athlete_races";
            referencedColumns: ["id"];
          },
        ];
      };
      race_waypoints: {
        Row: {
          alert_distance_m: number;
          created_at: string;
          cutoff_time: string | null;
          distance_m: number;
          id: string;
          kind: string;
          name: string;
          needs_review: boolean;
          nutrition_note: string | null;
          race_id: string;
          revision: number;
          services: string[];
          source: string;
          todo: string | null;
          updated_at: string;
          user_id: string;
          voice_note: string | null;
          watch_label: string | null;
        };
        ComputedFields: never;
        Insert: {
          alert_distance_m?: number;
          created_at?: string;
          cutoff_time?: string | null;
          distance_m: number;
          id?: string;
          kind: string;
          name: string;
          needs_review?: boolean;
          nutrition_note?: string | null;
          race_id: string;
          revision?: number;
          services?: string[];
          source?: string;
          todo?: string | null;
          updated_at?: string;
          user_id: string;
          voice_note?: string | null;
          watch_label?: string | null;
        };
        Update: {
          alert_distance_m?: number;
          created_at?: string;
          cutoff_time?: string | null;
          distance_m?: number;
          id?: string;
          kind?: string;
          name?: string;
          needs_review?: boolean;
          nutrition_note?: string | null;
          race_id?: string;
          revision?: number;
          services?: string[];
          source?: string;
          todo?: string | null;
          updated_at?: string;
          user_id?: string;
          voice_note?: string | null;
          watch_label?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "race_waypoints_race_id_fkey";
            columns: ["race_id"];
            isOneToOne: false;
            referencedRelation: "athlete_races";
            referencedColumns: ["id"];
          },
        ];
      };
      session_activity_matches: {
        Row: {
          activity_id: string | null;
          algorithm_version: string | null;
          compliance: NonNullable<Json>;
          computed_at: string;
          confidence: number;
          id: string;
          method: string;
          plan_id: string;
          session_key: string;
          session_revision_id: string;
          status: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          activity_id?: string | null;
          algorithm_version?: string | null;
          compliance?: NonNullable<Json>;
          computed_at?: string;
          confidence: number;
          id?: string;
          method: string;
          plan_id: string;
          session_key: string;
          session_revision_id: string;
          status: string;
          user_id: string;
        };
        Update: {
          activity_id?: string | null;
          algorithm_version?: string | null;
          compliance?: NonNullable<Json>;
          computed_at?: string;
          confidence?: number;
          id?: string;
          method?: string;
          plan_id?: string;
          session_key?: string;
          session_revision_id?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "session_activity_matches_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "training_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "session_activity_matches_session_revision_id_fkey";
            columns: ["session_revision_id"];
            isOneToOne: false;
            referencedRelation: "plan_sessions";
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
      training_plans: {
        Row: {
          active_version: number;
          created_at: string;
          ends_on: string;
          id: string;
          matches_activities_through: string | null;
          matches_computed_at: string | null;
          matches_version: number | null;
          primary_race_id: string | null;
          starts_on: string;
          status: string;
          time_zone: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          active_version: number;
          created_at?: string;
          ends_on: string;
          id?: string;
          matches_activities_through?: string | null;
          matches_computed_at?: string | null;
          matches_version?: number | null;
          primary_race_id?: string | null;
          starts_on: string;
          status?: string;
          time_zone: string;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          active_version?: number;
          created_at?: string;
          ends_on?: string;
          id?: string;
          matches_activities_through?: string | null;
          matches_computed_at?: string | null;
          matches_version?: number | null;
          primary_race_id?: string | null;
          starts_on?: string;
          status?: string;
          time_zone?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "training_plans_primary_race_id_fkey";
            columns: ["primary_race_id"];
            isOneToOne: false;
            referencedRelation: "athlete_races";
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
      accept_plan_proposal: {
        Args: { p_note?: string; p_proposal_id: string };
        Returns: {
          agent_run_id: string | null;
          applied_version: number | null;
          assumptions: NonNullable<Json>;
          base_version: number | null;
          coach_session_id: string | null;
          created_at: string;
          evidence: NonNullable<Json>;
          expires_at: string | null;
          id: string;
          operations: NonNullable<Json>;
          origin: string;
          plan_id: string | null;
          preview: Json | null;
          rationale: string | null;
          requested_by: string;
          scope: string;
          specialist_opinions: NonNullable<Json>;
          status: string;
          summary: string | null;
          superseded_by: string | null;
          target_keys: string[];
          title: string;
          uncertainty: Json | null;
          updated_at: string;
          user_id: string;
          validation: Json | null;
        };
        SetofOptions: {
          from: "*";
          to: "plan_proposals";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
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
      apply_accepted_plan_proposal: {
        Args: { p_changeset: Json; p_proposal_id: string };
        Returns: number;
      };
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
      clear_session_match: {
        Args: { p_plan_id: string; p_session_key: string };
        Returns: number;
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
      complete_onboarding_step_server: {
        Args: {
          p_expected_revision: number;
          p_step: string;
          p_user_id: string;
        };
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
      list_activities_missing_tracks: {
        Args: { p_connection_id: string; p_limit: number; p_since: string };
        Returns: {
          id: string;
          provider_activity_id: string;
          source_updated_at: string;
        }[];
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
      race_owned: { Args: { p_race_id: string }; Returns: boolean };
      record_plan_proposal_outcome: {
        Args: { p_note?: string; p_outcome: string; p_proposal_id: string };
        Returns: undefined;
      };
      refresh_session_matches: {
        Args: {
          p_activities_through?: string;
          p_algorithm_version: string;
          p_matches: Json;
          p_plan_id: string;
          p_version: number;
        };
        Returns: number;
      };
      reject_plan_proposal: {
        Args: { p_note?: string; p_proposal_id: string };
        Returns: {
          agent_run_id: string | null;
          applied_version: number | null;
          assumptions: NonNullable<Json>;
          base_version: number | null;
          coach_session_id: string | null;
          created_at: string;
          evidence: NonNullable<Json>;
          expires_at: string | null;
          id: string;
          operations: NonNullable<Json>;
          origin: string;
          plan_id: string | null;
          preview: Json | null;
          rationale: string | null;
          requested_by: string;
          scope: string;
          specialist_opinions: NonNullable<Json>;
          status: string;
          summary: string | null;
          superseded_by: string | null;
          target_keys: string[];
          title: string;
          uncertainty: Json | null;
          updated_at: string;
          user_id: string;
          validation: Json | null;
        };
        SetofOptions: {
          from: "*";
          to: "plan_proposals";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      release_provider_lease: {
        Args: { p_connection_id: string; p_owner: string };
        Returns: undefined;
      };
      renew_provider_lease: {
        Args: { p_connection_id: string; p_owner: string };
        Returns: boolean;
      };
      replace_heart_rate_zones: {
        Args: {
          p_attempts: number;
          p_connection_id: string;
          p_job_id: string;
          p_user_id: string;
          p_zones: Json;
        };
        Returns: boolean;
      };
      replace_race_course: {
        Args: {
          p_distance_m: number;
          p_elevation_gain_m?: number;
          p_elevation_loss_m?: number;
          p_file_name: string;
          p_points: Json;
          p_race_id: string;
          p_source: string;
          p_source_activity_id?: string;
          p_step_m: number;
          p_time_zone: string;
          p_waypoints: Json;
        };
        Returns: number;
      };
      replace_race_roadbook: {
        Args: { p_points: Json; p_race_id: string; p_summary: Json };
        Returns: undefined;
      };
      request_manual_sync: { Args: { p_user_id: string }; Returns: Json };
      reset_own_plan: { Args: { p_plan_id?: string }; Returns: undefined };
      schedule_incremental_sync: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      set_onboarding_current_step: {
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
      set_session_match: {
        Args: {
          p_activity_ids: string[];
          p_plan_id: string;
          p_session_key: string;
          p_status?: string;
        };
        Returns: {
          activity_id: string | null;
          algorithm_version: string | null;
          compliance: NonNullable<Json>;
          computed_at: string;
          confidence: number;
          id: string;
          method: string;
          plan_id: string;
          session_key: string;
          session_revision_id: string;
          status: string;
          user_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "session_activity_matches";
          isOneToOne: false;
          isSetofReturn: true;
        };
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
      submit_plan_proposal: {
        Args: {
          p_base_version?: number;
          p_coach_session_id?: string;
          p_operations: Json;
          p_origin: string;
          p_plan_id?: string;
          p_preview: Json;
          p_rationale: string;
          p_scope: string;
          p_specialist_opinions?: Json;
          p_summary: string;
          p_target_keys?: string[];
          p_title: string;
        };
        Returns: {
          agent_run_id: string | null;
          applied_version: number | null;
          assumptions: NonNullable<Json>;
          base_version: number | null;
          coach_session_id: string | null;
          created_at: string;
          evidence: NonNullable<Json>;
          expires_at: string | null;
          id: string;
          operations: NonNullable<Json>;
          origin: string;
          plan_id: string | null;
          preview: Json | null;
          rationale: string | null;
          requested_by: string;
          scope: string;
          specialist_opinions: NonNullable<Json>;
          status: string;
          summary: string | null;
          superseded_by: string | null;
          target_keys: string[];
          title: string;
          uncertainty: Json | null;
          updated_at: string;
          user_id: string;
          validation: Json | null;
        };
        SetofOptions: {
          from: "*";
          to: "plan_proposals";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      upsert_activity_track: {
        Args: {
          p_activity_id: string;
          p_attempts: number;
          p_connection_id: string;
          p_job_id: string;
          p_track: Json;
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
