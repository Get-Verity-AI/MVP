export type FounderInputsStreamlit = {
    email: string;
    founder_display_name?: string | null;
  
    problem_domain?: string | null;
    problems: string[];
    value_prop?: string | null;
  
    is_paid_service?: boolean;
    pricing_model?: string | null;
    pricing_model_considered?: string[];  // jsonb
    price_points?: number[];              // jsonb
    pricing_questions?: string[];         // keep for compat
  
    segment_mode?: "one" | "decide";
    target_segments?: string[];           // jsonb
  
    target_actions?: string[];            // jsonb
  
    target_audience?: string | null;      // legacy compat
    target_action?: string | null;        // legacy compat
    follow_up_action?: string | null;     // legacy compat
  
    founder_feedback?: string | null;
  };
  
  
  export type Step =
  | { type: "text"; key: string; label: string }
  | { type: "input_text"; key: string; label: string }
  | { type: "input_email"; key: string; label: string }
  | { type: "input_scale"; key: string; label: string; min: number; max: number }
  | { type: "input_choice"; key: string; label: string; options: string[] }
  | { type: "input_wallet"; key: string; label: string };  // NEW

  
  export type SessionQuestions = { session_id: string; steps: Step[] };
  