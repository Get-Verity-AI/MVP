export type FounderInputsStreamlit = {
    email: string;
    problem_domain?: string;
    problems: string[];
    value_prop?: string;
    target_action?: string;
    follow_up_action?: string;
    is_paid_service: boolean;
    pricing_model?: string;
    price_points: number[];
    pricing_questions: string[];
  };
  
  export type Step =
    | { type: "text"; key: string; label: string }
    | { type: "input_text"; key: string; label: string }
    | { type: "input_scale"; key: string; label: string; min: number; max: number }
    | { type: "input_email"; key: string; label: string };
  
  export type SessionQuestions = { session_id: string; steps: Step[] };
  