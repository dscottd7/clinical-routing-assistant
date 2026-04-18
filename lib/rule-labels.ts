const RULE_LABELS: Record<string, string> = {
  general_dental: "Dental clearance",
  joint_smoking: "Smoking status",
  joint_no_pt: "Physical therapy trial",
  joint_hba1c: "HbA1c control",
  joint_opioid: "Opioid use",
  bariatric_revision: "Revision surgery",
  bariatric_no_egd: "Endoscopy (EGD)",
  bariatric_no_rd: "Registered dietician",
};

export function ruleLabel(ruleId: string): string {
  return RULE_LABELS[ruleId] ?? ruleId;
}
