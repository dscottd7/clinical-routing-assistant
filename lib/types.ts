export type Confidence = "high" | "medium" | "low";
export type CaseType = "bariatric" | "joint" | "general" | "unknown";
export type SmokingStatus =
  | "active"
  | "quit_within_3_months"
  | "quit_over_3_months"
  | "never";

export interface ExtractedFact<T> {
  value: T | null; // null = not mentioned / unknown
  confidence: Confidence;
  evidence: string | null; // direct quote or paraphrase; null if not mentioned
}

export interface ExtractionOutput {
  patient_name: ExtractedFact<string>;
  case_type: ExtractedFact<CaseType>;
  reason_for_care: ExtractedFact<string>;

  facts: {
    // General
    dental_visit_within_6_months: ExtractedFact<boolean>;
    has_pending_dental_work: ExtractedFact<boolean>;

    // Joint
    smoking_status: ExtractedFact<SmokingStatus>;
    has_attempted_pt_or_exercise: ExtractedFact<boolean>;
    hba1c_value: ExtractedFact<number>;
    daily_opioid_use_over_3_months: ExtractedFact<boolean>;

    // Bariatric
    has_prior_weight_loss_surgery: ExtractedFact<boolean>;
    prior_surgery_type: ExtractedFact<string>;
    has_recent_endoscopy: ExtractedFact<boolean>;
    has_registered_dietician: ExtractedFact<boolean>;
  };

  additional_notes: string[];
}

export interface TriggeredRule {
  rule_id: string;
  category: string;
  finding: string;
  status: string;
  action: string;
  severity: "critical" | "high" | "warning" | "info";
  evidence: string | null;
}

export interface UnverifiedFlag {
  rule_id: string;
  reason: string;
  extracted_value: string;
  confidence: Confidence;
}

export interface RoutingOutput {
  patient_name: string | null;
  case_type: string;
  reason_for_care: string | null;
  triggered_rules: TriggeredRule[];
  unverified_flags: UnverifiedFlag[];
  additional_notes: string[];
}

export interface SopRule {
  id: string;
  category: string;
  applies_to: CaseType[];
  finding: string;
  fact_fields: string[];
  status: string;
  action: string;
  severity: "critical" | "high" | "warning" | "info";
}
