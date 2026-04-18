/**
 * JSON Schema for Claude's `tool_use` feature. Mirrors the `ExtractionOutput`
 * TypeScript type in `./types.ts` and the Zod schema in `./schemas.ts`.
 *
 * The model is forced to call this tool (via `tool_choice: { type: "tool",
 * name: "record_extraction" }`), so its input is constrained at decode time.
 * After the call returns we still run the tool input through Zod — the model
 * can violate the schema in subtle ways (e.g., wrong enum, wrong type) even
 * when forced to a specific tool.
 */

import type Anthropic from "@anthropic-ai/sdk";

const confidenceEnum = ["high", "medium", "low"];

function extractedFact(valueSchema: Record<string, unknown>, description: string) {
  return {
    type: "object",
    description,
    properties: {
      value: valueSchema,
      confidence: { type: "string", enum: confidenceEnum },
      evidence: {
        type: ["string", "null"],
        description:
          "Direct quote or close paraphrase from the transcript supporting this value. null if value is null.",
      },
    },
    required: ["value", "confidence", "evidence"],
    additionalProperties: false,
  };
}

export const RECORD_EXTRACTION_TOOL: Anthropic.Tool = {
  name: "record_extraction",
  description:
    "Record the structured clinical facts extracted from a patient transcript. Call this tool exactly once.",
  input_schema: {
    type: "object",
    properties: {
      patient_name: extractedFact(
        { type: ["string", "null"] },
        "The patient's full name as stated in the transcript.",
      ),
      case_type: extractedFact(
        {
          type: ["string", "null"],
          enum: ["bariatric", "joint", "general", "unknown", null],
        },
        "The clinical area the transcript is about.",
      ),
      reason_for_care: extractedFact(
        { type: ["string", "null"] },
        "Short phrase describing why the patient is seeking care (e.g., 'knee replacement evaluation').",
      ),
      facts: {
        type: "object",
        properties: {
          dental_visit_within_6_months: extractedFact(
            { type: ["boolean", "null"] },
            "Has the patient had a dental cleaning or exam within the last 6 months?",
          ),
          has_pending_dental_work: extractedFact(
            { type: ["boolean", "null"] },
            "Does the patient have any outstanding/pending dental work (e.g., unresolved cavities, planned extractions)?",
          ),
          smoking_status: extractedFact(
            {
              type: ["string", "null"],
              enum: [
                "active",
                "quit_within_3_months",
                "quit_over_3_months",
                "never",
                null,
              ],
            },
            "The patient's current smoking status. Pick exactly one enum value; null if smoking was not discussed.",
          ),
          has_attempted_pt_or_exercise: extractedFact(
            { type: ["boolean", "null"] },
            "Has the patient attempted formal physical therapy or a structured exercise/conservative management program? Casual gym mentions without a program should be null so a reviewer can judge.",
          ),
          hba1c_value: extractedFact(
            { type: ["number", "null"] },
            "The patient's most recent HbA1c value as a number (e.g., 7.4). Do not derive a boolean; downstream code handles the threshold.",
          ),
          daily_opioid_use_over_3_months: extractedFact(
            { type: ["boolean", "null"] },
            "Has the patient been using opioids daily for more than 3 months?",
          ),
          has_prior_weight_loss_surgery: extractedFact(
            { type: ["boolean", "null"] },
            "Has the patient had a prior bariatric/weight-loss procedure (lap band, sleeve, bypass, etc.)?",
          ),
          prior_surgery_type: extractedFact(
            { type: ["string", "null"] },
            "The specific prior bariatric procedure if mentioned (e.g., 'lap band', 'sleeve gastrectomy', 'Roux-en-Y bypass').",
          ),
          has_recent_endoscopy: extractedFact(
            { type: ["boolean", "null"] },
            "Has the patient had an upper endoscopy (EGD) within the last 3 months?",
          ),
          has_registered_dietician: extractedFact(
            { type: ["boolean", "null"] },
            "Has the patient identified or been working with a registered dietician?",
          ),
        },
        required: [
          "dental_visit_within_6_months",
          "has_pending_dental_work",
          "smoking_status",
          "has_attempted_pt_or_exercise",
          "hba1c_value",
          "daily_opioid_use_over_3_months",
          "has_prior_weight_loss_surgery",
          "prior_surgery_type",
          "has_recent_endoscopy",
          "has_registered_dietician",
        ],
        additionalProperties: false,
      },
      additional_notes: {
        type: "array",
        description:
          "Clinically relevant observations that do not map to any structured fact field. Empty array if none.",
        items: { type: "string" },
      },
    },
    required: [
      "patient_name",
      "case_type",
      "reason_for_care",
      "facts",
      "additional_notes",
    ],
    additionalProperties: false,
  },
};
