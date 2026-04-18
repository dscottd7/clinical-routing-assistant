import type { RoutingOutput } from "./types";

function caseTypeLabel(caseType: string): string {
  switch (caseType) {
    case "bariatric":
      return "Bariatric";
    case "joint":
      return "Joint";
    case "general":
      return "General";
    default:
      return "Unknown";
  }
}

export function formatSummary(routing: RoutingOutput): string {
  const lines: string[] = [];
  const name = routing.patient_name ?? "Unknown patient";
  lines.push(`Patient: ${name}`);
  lines.push(`Case type: ${caseTypeLabel(routing.case_type)}`);
  if (routing.reason_for_care) {
    lines.push(`Reason for care: ${routing.reason_for_care}`);
  }
  lines.push("");

  if (routing.triggered_rules.length === 0) {
    lines.push("Triggered rules: none");
  } else {
    lines.push("Triggered rules:");
    for (const r of routing.triggered_rules) {
      lines.push(
        `  - [${r.severity.toUpperCase()}] ${r.status} — ${r.finding}`,
      );
      lines.push(`      Action: ${r.action}`);
      if (r.evidence) lines.push(`      Evidence: "${r.evidence}"`);
    }
  }

  if (routing.unverified_flags.length > 0) {
    lines.push("");
    lines.push("Unverified flags (needs care-team follow-up):");
    for (const f of routing.unverified_flags) {
      lines.push(`  - ${f.rule_id}: ${f.reason}`);
      lines.push(`      Extracted: ${f.extracted_value} (confidence: ${f.confidence})`);
    }
  }

  if (routing.additional_notes.length > 0) {
    lines.push("");
    lines.push("Additional notes:");
    for (const n of routing.additional_notes) lines.push(`  - ${n}`);
  }

  return lines.join("\n");
}
