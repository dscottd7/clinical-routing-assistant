import type {
  Confidence,
  ExtractionOutput,
  RoutingOutput,
  SopRule,
  TriggeredRule,
  UnverifiedFlag,
  CaseType,
} from "./types";
import { SOP_RULES } from "./sop-rules";

// ── Severity sort order (critical first) ────────────────────────────────────

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  warning: 2,
  info: 3,
};

// ── Trigger evaluation ───────────────────────────────────────────────────────

/**
 * Returns true if the rule's trigger condition is satisfied given the
 * extraction output. Called only when all required fact fields are non-null.
 */
function isTriggered(rule: SopRule, extraction: ExtractionOutput): boolean {
  const f = extraction.facts;

  switch (rule.id) {
    case "general_dental":
      return (
        f.dental_visit_within_6_months.value === false ||
        f.has_pending_dental_work.value === true
      );

    case "joint_smoking":
      return (
        f.smoking_status.value === "active" ||
        f.smoking_status.value === "quit_within_3_months"
      );

    case "joint_no_pt":
      return f.has_attempted_pt_or_exercise.value === false;

    case "joint_hba1c":
      // Strict > 7.0; value is guaranteed non-null by the caller
      return (f.hba1c_value.value as number) > 7.0;

    case "joint_opioid":
      return f.daily_opioid_use_over_3_months.value === true;

    case "bariatric_revision":
      return f.has_prior_weight_loss_surgery.value === true;

    case "bariatric_no_egd":
      return f.has_recent_endoscopy.value === false;

    case "bariatric_no_rd":
      return f.has_registered_dietician.value === false;

    default:
      return false;
  }
}

// ── Fact field accessor ───────────────────────────────────────────────────────

type FactKey = keyof ExtractionOutput["facts"];

function getFactField(
  extraction: ExtractionOutput,
  field: string,
): { value: unknown; confidence: Confidence; evidence: string | null } | null {
  const key = field as FactKey;
  const fact = extraction.facts[key];
  if (!fact) return null;
  return {
    value: fact.value,
    confidence: fact.confidence,
    evidence: fact.evidence,
  };
}

// ── Human-readable unverified reason builder ─────────────────────────────────

function buildUnverifiedReason(
  rule: SopRule,
  nullFields: string[],
  extraction: ExtractionOutput,
): string {
  const fieldLabels: Record<string, string> = {
    dental_visit_within_6_months: "dental visit recency",
    has_pending_dental_work: "pending dental work",
    smoking_status: "smoking status",
    has_attempted_pt_or_exercise: "physical therapy or exercise history",
    hba1c_value: "HbA1c value",
    daily_opioid_use_over_3_months: "daily opioid use duration",
    has_prior_weight_loss_surgery: "prior weight-loss surgery history",
    prior_surgery_type: "prior surgery type",
    has_recent_endoscopy: "recent endoscopy (EGD)",
    has_registered_dietician: "registered dietician status",
  };

  // For general_dental, either null field alone is enough to be unverified
  if (rule.id === "general_dental") {
    const missing = nullFields.map((f) => fieldLabels[f] ?? f).join(" and ");
    return `Cannot evaluate dental clearance rule: ${missing} not mentioned in transcript.`;
  }

  const missing = nullFields.map((f) => fieldLabels[f] ?? f).join(", ");
  return `Cannot evaluate rule "${rule.finding}" because the following information was not clearly established: ${missing}. Clinician must verify before proceeding.`;
}

// ── Unverified extracted value formatter ─────────────────────────────────────

function formatExtractedValue(
  rule: SopRule,
  extraction: ExtractionOutput,
): string {
  const parts: string[] = [];
  for (const field of rule.fact_fields) {
    const fact = getFactField(extraction, field);
    if (!fact) continue;
    const valueStr = fact.value === null ? "not mentioned" : String(fact.value);
    parts.push(`${field}: ${valueStr}`);
  }
  return parts.join("; ");
}

// ── Main matcher ─────────────────────────────────────────────────────────────

/**
 * Pure function: takes an ExtractionOutput and the SOP rules array, returns
 * a RoutingOutput with triggered rules and unverified flags.
 *
 * Three-way classification per rule:
 *  1. Any referenced fact field is null → push to unverified_flags
 *  2. All non-null AND trigger condition satisfied → push to triggered_rules
 *  3. All non-null AND trigger condition NOT satisfied → silent clear (omit)
 *
 * Special case for general_dental: the rule fires if dental_visit_within_6_months
 * is false OR has_pending_dental_work is true. If either is null, it's unverified
 * unless the other alone is sufficient to trigger.
 */
export function runSopMatcher(
  extraction: ExtractionOutput,
  rules: SopRule[] = SOP_RULES,
): RoutingOutput {
  const caseType = extraction.case_type.value as CaseType | null;
  const triggeredRules: TriggeredRule[] = [];
  const unverifiedFlags: UnverifiedFlag[] = [];

  for (const rule of rules) {
    // Skip rules that don't apply to this case type
    if (caseType && !rule.applies_to.includes(caseType)) continue;
    // If case type is unknown, apply all rules
    // If case type is null, apply all rules (same as unknown)

    // Find which fact fields are null
    const nullFields = rule.fact_fields.filter((field) => {
      const fact = getFactField(extraction, field);
      return fact === null || fact.value === null;
    });

    // Special handling for general_dental: can trigger on partial evidence
    if (rule.id === "general_dental") {
      const dentalVisit = extraction.facts.dental_visit_within_6_months;
      const pendingWork = extraction.facts.has_pending_dental_work;

      const dentalVisitNull = dentalVisit.value === null;
      const pendingWorkNull = pendingWork.value === null;

      // If either is definitively triggering, we can fire without needing both
      if (!pendingWorkNull && pendingWork.value === true) {
        triggeredRules.push({
          rule_id: rule.id,
          category: rule.category,
          finding: rule.finding,
          status: rule.status,
          action: rule.action,
          severity: rule.severity,
          evidence: pendingWork.evidence,
        });
        continue;
      }
      if (!dentalVisitNull && dentalVisit.value === false) {
        triggeredRules.push({
          rule_id: rule.id,
          category: rule.category,
          finding: rule.finding,
          status: rule.status,
          action: rule.action,
          severity: rule.severity,
          evidence: dentalVisit.evidence,
        });
        continue;
      }
      // If both are non-null and neither triggers, it's a clear
      if (!dentalVisitNull && !pendingWorkNull) {
        continue;
      }
      // At least one is null and neither triggered definitively → unverified
      const primaryFact = dentalVisitNull ? dentalVisit : pendingWork;
      unverifiedFlags.push({
        rule_id: rule.id,
        reason: buildUnverifiedReason(rule, nullFields, extraction),
        extracted_value: formatExtractedValue(rule, extraction),
        confidence: primaryFact.confidence,
      });
      continue;
    }

    // Standard three-way classification for all other rules
    if (nullFields.length > 0) {
      // Determine which non-null fact field to use for confidence reporting
      const representativeFact = getFactField(
        extraction,
        rule.fact_fields[0],
      );
      unverifiedFlags.push({
        rule_id: rule.id,
        reason: buildUnverifiedReason(rule, nullFields, extraction),
        extracted_value: formatExtractedValue(rule, extraction),
        confidence: representativeFact?.confidence ?? "low",
      });
      continue;
    }

    if (isTriggered(rule, extraction)) {
      const primaryFact = getFactField(extraction, rule.fact_fields[0]);
      triggeredRules.push({
        rule_id: rule.id,
        category: rule.category,
        finding: rule.finding,
        status: rule.status,
        action: rule.action,
        severity: rule.severity,
        evidence: primaryFact?.evidence ?? null,
      });
    }
    // else: silent clear — omit from output
  }

  // Sort triggered rules by severity (critical first)
  triggeredRules.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );

  return {
    patient_name: extraction.patient_name.value,
    case_type: caseType ?? "unknown",
    reason_for_care: extraction.reason_for_care.value,
    triggered_rules: triggeredRules,
    unverified_flags: unverifiedFlags,
    additional_notes: extraction.additional_notes,
  };
}
