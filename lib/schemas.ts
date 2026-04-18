import { z } from "zod";

// ── Primitive enums ──────────────────────────────────────────────────────────

export const ConfidenceSchema = z.enum(["high", "medium", "low"]);

export const CaseTypeSchema = z.enum([
  "bariatric",
  "joint",
  "general",
  "unknown",
]);

export const SmokingStatusSchema = z.enum([
  "active",
  "quit_within_3_months",
  "quit_over_3_months",
  "never",
]);

// ── ExtractedFact<T> generic helper ─────────────────────────────────────────

function extractedFact<T extends z.ZodTypeAny>(valueSchema: T) {
  return z.object({
    value: valueSchema.nullable(),
    confidence: ConfidenceSchema,
    evidence: z.string().nullable(),
  });
}

// ── ExtractionOutput ─────────────────────────────────────────────────────────

export const ExtractionOutputSchema = z.object({
  patient_name: extractedFact(z.string()),
  case_type: extractedFact(CaseTypeSchema),
  reason_for_care: extractedFact(z.string()),

  facts: z.object({
    // General
    dental_visit_within_6_months: extractedFact(z.boolean()),
    has_pending_dental_work: extractedFact(z.boolean()),

    // Joint
    smoking_status: extractedFact(SmokingStatusSchema),
    has_attempted_pt_or_exercise: extractedFact(z.boolean()),
    hba1c_value: extractedFact(z.number()),
    daily_opioid_use_over_3_months: extractedFact(z.boolean()),

    // Bariatric
    has_prior_weight_loss_surgery: extractedFact(z.boolean()),
    prior_surgery_type: extractedFact(z.string()),
    has_recent_endoscopy: extractedFact(z.boolean()),
    has_registered_dietician: extractedFact(z.boolean()),
  }),

  additional_notes: z.array(z.string()),
});

export type ExtractionOutputFromSchema = z.infer<typeof ExtractionOutputSchema>;

// ── RoutingOutput ─────────────────────────────────────────────────────────────

export const SeveritySchema = z.enum(["critical", "high", "warning", "info"]);

export const TriggeredRuleSchema = z.object({
  rule_id: z.string(),
  category: z.string(),
  finding: z.string(),
  status: z.string(),
  action: z.string(),
  severity: SeveritySchema,
  evidence: z.string().nullable(),
});

export const UnverifiedFlagSchema = z.object({
  rule_id: z.string(),
  reason: z.string(),
  extracted_value: z.string(),
  confidence: ConfidenceSchema,
});

export const RoutingOutputSchema = z.object({
  patient_name: z.string().nullable(),
  case_type: z.string(),
  reason_for_care: z.string().nullable(),
  triggered_rules: z.array(TriggeredRuleSchema),
  unverified_flags: z.array(UnverifiedFlagSchema),
  additional_notes: z.array(z.string()),
});

export type RoutingOutputFromSchema = z.infer<typeof RoutingOutputSchema>;
