// miniapp/src/types.ts
export type Step =
  | { type: "text"; key: string; label: string }
  | { type: "input_text"; key: string; label: string }
  | { type: "input_email"; key: string; label: string }
  | { type: "input_scale"; key: string; label: string; min: number; max: number }
  | { type: "input_choice"; key: string; label: string; options: string[] }
  | { type: "input_wallet"; key: string; label: string }
  // composite pages:
  | {
      type: "problem_block";
      key: string;
      problem: string;
      min: number;
      max: number;
      labels?: { scale?: string; reason?: string; attempts?: string };
    }
  | {
      type: "scale_with_preamble";
      key: string;
      preamble: string;
      label?: string;
      min: number;
      max: number;
    };

export type FounderInputsStreamlit = {
  email: string;
  founder_display_name?: string | null;
  problem_domain?: string | null;
  problems: string[];
  value_prop?: string | null;
  is_paid_service: boolean;
  pricing_model?: string | null;
  pricing_model_considered: string[];
  price_points: number[];
  pricing_questions: string[];
  segment_mode?: string | null;
  target_segments: string[];
  target_actions: string[];
  founder_feedback?: string | null;
  // legacy/compat
  target_audience?: string | null;
  target_action?: string | null;
  follow_up_action?: string | null;
};
