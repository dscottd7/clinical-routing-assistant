import { runSopMatcher } from "@/lib/sop-matcher";
import { SOP_RULES } from "@/lib/sop-rules";
import type { ExtractionOutput } from "@/lib/types";

// ── Test fixture helpers ─────────────────────────────────────────────────────

function fact<T>(
  value: T,
  confidence: "high" | "medium" | "low" = "high",
  evidence: string | null = "evidence quote",
) {
  return { value, confidence, evidence };
}

function nullFact(confidence: "high" | "medium" | "low" = "low") {
  return { value: null as null, confidence, evidence: null };
}

/**
 * Build a fully-populated ExtractionOutput with all values set to "clear"
 * defaults (no rules should trigger). Override individual fields as needed.
 */
function baseExtraction(
  overrides: Partial<ExtractionOutput> = {},
): ExtractionOutput {
  return {
    patient_name: fact("Test Patient"),
    case_type: fact("joint"),
    reason_for_care: fact("knee replacement"),
    facts: {
      dental_visit_within_6_months: fact(true),
      has_pending_dental_work: fact(false),
      smoking_status: fact("never"),
      has_attempted_pt_or_exercise: fact(true),
      hba1c_value: fact(6.5),
      daily_opioid_use_over_3_months: fact(false),
      has_prior_weight_loss_surgery: fact(false),
      prior_surgery_type: nullFact(),
      has_recent_endoscopy: fact(true),
      has_registered_dietician: fact(true),
    },
    additional_notes: [],
    ...overrides,
  };
}

function bariatricBase(overrides: Partial<ExtractionOutput> = {}): ExtractionOutput {
  return {
    ...baseExtraction(),
    case_type: fact("bariatric"),
    ...overrides,
  };
}

// ── Helper assertions ────────────────────────────────────────────────────────

function expectTriggered(output: ReturnType<typeof runSopMatcher>, ruleId: string) {
  const rule = output.triggered_rules.find((r) => r.rule_id === ruleId);
  expect(rule).toBeDefined();
  return rule!;
}

function expectCleared(output: ReturnType<typeof runSopMatcher>, ruleId: string) {
  expect(output.triggered_rules.find((r) => r.rule_id === ruleId)).toBeUndefined();
  expect(output.unverified_flags.find((f) => f.rule_id === ruleId)).toBeUndefined();
}

function expectUnverified(output: ReturnType<typeof runSopMatcher>, ruleId: string) {
  const flag = output.unverified_flags.find((f) => f.rule_id === ruleId);
  expect(flag).toBeDefined();
  return flag!;
}

// ── Category filtering ────────────────────────────────────────────────────────

describe("Category filtering", () => {
  it("does not fire Joint rules for a Bariatric patient", () => {
    const extraction = bariatricBase({
      facts: {
        ...baseExtraction().facts,
        smoking_status: fact("active"),
        daily_opioid_use_over_3_months: fact(true),
        has_attempted_pt_or_exercise: fact(false),
        hba1c_value: fact(8.0),
      },
    });
    const output = runSopMatcher(extraction);
    expectCleared(output, "joint_smoking");
    expectCleared(output, "joint_opioid");
    expectCleared(output, "joint_no_pt");
    expectCleared(output, "joint_hba1c");
  });

  it("does not fire Bariatric rules for a Joint patient", () => {
    const extraction = baseExtraction({
      case_type: fact("joint"),
      facts: {
        ...baseExtraction().facts,
        has_prior_weight_loss_surgery: fact(true),
        has_recent_endoscopy: fact(false),
        has_registered_dietician: fact(false),
      },
    });
    const output = runSopMatcher(extraction);
    expectCleared(output, "bariatric_revision");
    expectCleared(output, "bariatric_no_egd");
    expectCleared(output, "bariatric_no_rd");
  });

  it("fires General rules for Joint patients", () => {
    const extraction = baseExtraction({
      facts: {
        ...baseExtraction().facts,
        dental_visit_within_6_months: fact(false),
        has_pending_dental_work: fact(false),
      },
    });
    const output = runSopMatcher(extraction);
    expectTriggered(output, "general_dental");
  });

  it("fires General rules for Bariatric patients", () => {
    const extraction = bariatricBase({
      facts: {
        ...baseExtraction().facts,
        dental_visit_within_6_months: fact(false),
        has_pending_dental_work: fact(false),
      },
    });
    const output = runSopMatcher(extraction);
    expectTriggered(output, "general_dental");
  });

  it("applies all rules when case_type is null", () => {
    const extraction = baseExtraction({
      case_type: nullFact(),
      facts: {
        ...baseExtraction().facts,
        smoking_status: fact("active"),
        has_prior_weight_loss_surgery: fact(true),
      },
    });
    const output = runSopMatcher(extraction);
    expectTriggered(output, "joint_smoking");
    expectTriggered(output, "bariatric_revision");
  });

  it("applies all rules when case_type is 'unknown'", () => {
    const extraction = baseExtraction({
      case_type: fact("unknown"),
      facts: {
        ...baseExtraction().facts,
        smoking_status: fact("active"),
        has_prior_weight_loss_surgery: fact(true),
      },
    });
    const output = runSopMatcher(extraction);
    expectTriggered(output, "joint_smoking");
    expectTriggered(output, "bariatric_revision");
  });
});

// ── general_dental ────────────────────────────────────────────────────────────

describe("general_dental", () => {
  it("triggers when dental_visit_within_6_months is false", () => {
    const extraction = baseExtraction({
      facts: {
        ...baseExtraction().facts,
        dental_visit_within_6_months: fact(false),
        has_pending_dental_work: fact(false),
      },
    });
    expectTriggered(runSopMatcher(extraction), "general_dental");
  });

  it("triggers when has_pending_dental_work is true", () => {
    const extraction = baseExtraction({
      facts: {
        ...baseExtraction().facts,
        dental_visit_within_6_months: fact(true),
        has_pending_dental_work: fact(true),
      },
    });
    expectTriggered(runSopMatcher(extraction), "general_dental");
  });

  it("clears when dental visit is recent and no pending work", () => {
    const extraction = baseExtraction({
      facts: {
        ...baseExtraction().facts,
        dental_visit_within_6_months: fact(true),
        has_pending_dental_work: fact(false),
      },
    });
    expectCleared(runSopMatcher(extraction), "general_dental");
  });

  it("marks unverified when dental_visit_within_6_months is null", () => {
    const extraction = baseExtraction({
      facts: {
        ...baseExtraction().facts,
        dental_visit_within_6_months: nullFact(),
        has_pending_dental_work: fact(false),
      },
    });
    expectUnverified(runSopMatcher(extraction), "general_dental");
  });

  it("marks unverified when either dental field is null, even if the other would trigger", () => {
    // Per spec Section 4: any null fact field → unverified. The matcher does not
    // try to short-circuit to a trigger when the other field is satisfying.
    const extraction = baseExtraction({
      facts: {
        ...baseExtraction().facts,
        dental_visit_within_6_months: nullFact(),
        has_pending_dental_work: fact(true),
      },
    });
    expectUnverified(runSopMatcher(extraction), "general_dental");
  });
});

// ── joint_smoking ─────────────────────────────────────────────────────────────

describe("joint_smoking", () => {
  it("triggers for active smoker", () => {
    const extraction = baseExtraction({
      facts: { ...baseExtraction().facts, smoking_status: fact("active") },
    });
    expectTriggered(runSopMatcher(extraction), "joint_smoking");
  });

  it("triggers for quit_within_3_months", () => {
    const extraction = baseExtraction({
      facts: {
        ...baseExtraction().facts,
        smoking_status: fact("quit_within_3_months"),
      },
    });
    expectTriggered(runSopMatcher(extraction), "joint_smoking");
  });

  it("clears for quit_over_3_months", () => {
    const extraction = baseExtraction({
      facts: {
        ...baseExtraction().facts,
        smoking_status: fact("quit_over_3_months"),
      },
    });
    expectCleared(runSopMatcher(extraction), "joint_smoking");
  });

  it("clears for never smoker", () => {
    const extraction = baseExtraction({
      facts: { ...baseExtraction().facts, smoking_status: fact("never") },
    });
    expectCleared(runSopMatcher(extraction), "joint_smoking");
  });

  it("marks unverified when smoking_status is null", () => {
    const extraction = baseExtraction({
      facts: { ...baseExtraction().facts, smoking_status: nullFact() },
    });
    expectUnverified(runSopMatcher(extraction), "joint_smoking");
  });
});

// ── joint_no_pt ───────────────────────────────────────────────────────────────

describe("joint_no_pt", () => {
  it("triggers when has_attempted_pt_or_exercise is false", () => {
    const extraction = baseExtraction({
      facts: {
        ...baseExtraction().facts,
        has_attempted_pt_or_exercise: fact(false),
      },
    });
    expectTriggered(runSopMatcher(extraction), "joint_no_pt");
  });

  it("clears when has_attempted_pt_or_exercise is true", () => {
    const extraction = baseExtraction({
      facts: {
        ...baseExtraction().facts,
        has_attempted_pt_or_exercise: fact(true),
      },
    });
    expectCleared(runSopMatcher(extraction), "joint_no_pt");
  });

  it("marks unverified when has_attempted_pt_or_exercise is null", () => {
    const extraction = baseExtraction({
      facts: {
        ...baseExtraction().facts,
        has_attempted_pt_or_exercise: nullFact(),
      },
    });
    expectUnverified(runSopMatcher(extraction), "joint_no_pt");
  });
});

// ── joint_hba1c ───────────────────────────────────────────────────────────────

describe("joint_hba1c", () => {
  it("triggers when HbA1c > 7.0", () => {
    const extraction = baseExtraction({
      facts: { ...baseExtraction().facts, hba1c_value: fact(7.4) },
    });
    expectTriggered(runSopMatcher(extraction), "joint_hba1c");
  });

  it("triggers for HbA1c just above 7.0 (7.01)", () => {
    const extraction = baseExtraction({
      facts: { ...baseExtraction().facts, hba1c_value: fact(7.01) },
    });
    expectTriggered(runSopMatcher(extraction), "joint_hba1c");
  });

  it("clears when HbA1c is exactly 7.0 (strict >)", () => {
    const extraction = baseExtraction({
      facts: { ...baseExtraction().facts, hba1c_value: fact(7.0) },
    });
    expectCleared(runSopMatcher(extraction), "joint_hba1c");
  });

  it("clears when HbA1c is below 7.0", () => {
    const extraction = baseExtraction({
      facts: { ...baseExtraction().facts, hba1c_value: fact(6.5) },
    });
    expectCleared(runSopMatcher(extraction), "joint_hba1c");
  });

  it("marks unverified when hba1c_value is null", () => {
    const extraction = baseExtraction({
      facts: { ...baseExtraction().facts, hba1c_value: nullFact() },
    });
    expectUnverified(runSopMatcher(extraction), "joint_hba1c");
  });
});

// ── joint_opioid ──────────────────────────────────────────────────────────────

describe("joint_opioid", () => {
  it("triggers when daily_opioid_use_over_3_months is true", () => {
    const extraction = baseExtraction({
      facts: {
        ...baseExtraction().facts,
        daily_opioid_use_over_3_months: fact(true),
      },
    });
    expectTriggered(runSopMatcher(extraction), "joint_opioid");
  });

  it("clears when daily_opioid_use_over_3_months is false", () => {
    const extraction = baseExtraction({
      facts: {
        ...baseExtraction().facts,
        daily_opioid_use_over_3_months: fact(false),
      },
    });
    expectCleared(runSopMatcher(extraction), "joint_opioid");
  });

  it("marks unverified when daily_opioid_use_over_3_months is null", () => {
    const extraction = baseExtraction({
      facts: {
        ...baseExtraction().facts,
        daily_opioid_use_over_3_months: nullFact(),
      },
    });
    expectUnverified(runSopMatcher(extraction), "joint_opioid");
  });
});

// ── bariatric_revision ────────────────────────────────────────────────────────

describe("bariatric_revision", () => {
  it("triggers when has_prior_weight_loss_surgery is true", () => {
    const extraction = bariatricBase({
      facts: {
        ...baseExtraction().facts,
        has_prior_weight_loss_surgery: fact(true),
      },
    });
    expectTriggered(runSopMatcher(extraction), "bariatric_revision");
  });

  it("clears when has_prior_weight_loss_surgery is false", () => {
    const extraction = bariatricBase({
      facts: {
        ...baseExtraction().facts,
        has_prior_weight_loss_surgery: fact(false),
      },
    });
    expectCleared(runSopMatcher(extraction), "bariatric_revision");
  });

  it("marks unverified when has_prior_weight_loss_surgery is null", () => {
    const extraction = bariatricBase({
      facts: {
        ...baseExtraction().facts,
        has_prior_weight_loss_surgery: nullFact(),
      },
    });
    expectUnverified(runSopMatcher(extraction), "bariatric_revision");
  });
});

// ── bariatric_no_egd ──────────────────────────────────────────────────────────

describe("bariatric_no_egd", () => {
  it("triggers when has_recent_endoscopy is false", () => {
    const extraction = bariatricBase({
      facts: { ...baseExtraction().facts, has_recent_endoscopy: fact(false) },
    });
    expectTriggered(runSopMatcher(extraction), "bariatric_no_egd");
  });

  it("clears when has_recent_endoscopy is true", () => {
    const extraction = bariatricBase({
      facts: { ...baseExtraction().facts, has_recent_endoscopy: fact(true) },
    });
    expectCleared(runSopMatcher(extraction), "bariatric_no_egd");
  });

  it("marks unverified when has_recent_endoscopy is null", () => {
    const extraction = bariatricBase({
      facts: { ...baseExtraction().facts, has_recent_endoscopy: nullFact() },
    });
    expectUnverified(runSopMatcher(extraction), "bariatric_no_egd");
  });
});

// ── bariatric_no_rd ───────────────────────────────────────────────────────────

describe("bariatric_no_rd", () => {
  it("triggers when has_registered_dietician is false", () => {
    const extraction = bariatricBase({
      facts: {
        ...baseExtraction().facts,
        has_registered_dietician: fact(false),
      },
    });
    expectTriggered(runSopMatcher(extraction), "bariatric_no_rd");
  });

  it("clears when has_registered_dietician is true", () => {
    const extraction = bariatricBase({
      facts: {
        ...baseExtraction().facts,
        has_registered_dietician: fact(true),
      },
    });
    expectCleared(runSopMatcher(extraction), "bariatric_no_rd");
  });

  it("marks unverified when has_registered_dietician is null", () => {
    const extraction = bariatricBase({
      facts: {
        ...baseExtraction().facts,
        has_registered_dietician: nullFact(),
      },
    });
    expectUnverified(runSopMatcher(extraction), "bariatric_no_rd");
  });
});

// ── Multi-rule scenarios ──────────────────────────────────────────────────────

describe("Multi-rule scenarios", () => {
  it("triggers multiple Joint rules simultaneously (Maria V scenario)", () => {
    // Active smoker + HbA1c 7.4 + has PT (clears joint_no_pt)
    const extraction = baseExtraction({
      case_type: fact("joint"),
      facts: {
        ...baseExtraction().facts,
        smoking_status: fact("active"),
        hba1c_value: fact(7.4),
        has_attempted_pt_or_exercise: fact(true),
      },
    });
    const output = runSopMatcher(extraction);
    expectTriggered(output, "joint_smoking");
    expectTriggered(output, "joint_hba1c");
    expectCleared(output, "joint_no_pt");
  });

  it("triggers multiple Bariatric rules simultaneously (Sarah T scenario)", () => {
    // Revision + no RD + no EGD; dental is medium confidence
    const extraction = bariatricBase({
      facts: {
        ...baseExtraction().facts,
        has_prior_weight_loss_surgery: fact(true),
        has_registered_dietician: fact(false),
        has_recent_endoscopy: fact(false),
        dental_visit_within_6_months: fact(true, "medium", "cleaning in May"),
        has_pending_dental_work: fact(false),
      },
    });
    const output = runSopMatcher(extraction);
    expectTriggered(output, "bariatric_revision");
    expectTriggered(output, "bariatric_no_rd");
    expectTriggered(output, "bariatric_no_egd");
    expectCleared(output, "general_dental");
  });

  it("produces only an unverified flag for joint_no_pt when ambiguous (Bob L scenario)", () => {
    const extraction = baseExtraction({
      case_type: fact("joint"),
      facts: {
        ...baseExtraction().facts,
        daily_opioid_use_over_3_months: fact(true),
        has_attempted_pt_or_exercise: nullFact("medium"),
      },
    });
    const output = runSopMatcher(extraction);
    expectTriggered(output, "joint_opioid");
    expectUnverified(output, "joint_no_pt");
  });

  it("returns empty triggered_rules and unverified_flags for a clean patient", () => {
    const extraction = baseExtraction();
    const output = runSopMatcher(extraction);
    // Only general_dental applies and patient has recent visit + no pending work
    expect(output.triggered_rules).toHaveLength(0);
    expect(output.unverified_flags).toHaveLength(0);
  });
});

// ── Severity sort order ───────────────────────────────────────────────────────

describe("Severity sort order", () => {
  it("sorts triggered rules critical first", () => {
    const extraction = baseExtraction({
      case_type: fact("joint"),
      facts: {
        ...baseExtraction().facts,
        smoking_status: fact("active"),     // critical
        hba1c_value: fact(7.4),             // warning
        daily_opioid_use_over_3_months: fact(true), // high
      },
    });
    const output = runSopMatcher(extraction);
    expect(output.triggered_rules[0].severity).toBe("critical");
    expect(output.triggered_rules[1].severity).toBe("high");
    expect(output.triggered_rules[2].severity).toBe("warning");
  });
});

// ── Output structure ──────────────────────────────────────────────────────────

describe("Output structure", () => {
  it("passes patient_name and reason_for_care through to output", () => {
    const extraction = baseExtraction({
      patient_name: fact("Jane Smith"),
      reason_for_care: fact("hip pain"),
    });
    const output = runSopMatcher(extraction);
    expect(output.patient_name).toBe("Jane Smith");
    expect(output.reason_for_care).toBe("hip pain");
  });

  it("passes additional_notes through to output", () => {
    const extraction = baseExtraction({
      additional_notes: ["Patient is anxious about anesthesia."],
    });
    const output = runSopMatcher(extraction);
    expect(output.additional_notes).toEqual(["Patient is anxious about anesthesia."]);
  });

  it("sets case_type to 'unknown' when null", () => {
    const extraction = baseExtraction({ case_type: nullFact() });
    const output = runSopMatcher(extraction);
    expect(output.case_type).toBe("unknown");
  });

  it("triggered rule includes evidence from the extraction", () => {
    const extraction = baseExtraction({
      facts: {
        ...baseExtraction().facts,
        smoking_status: fact("active", "high", "Patient smokes daily."),
      },
    });
    const output = runSopMatcher(extraction);
    const rule = expectTriggered(output, "joint_smoking");
    expect(rule.evidence).toBe("Patient smokes daily.");
  });
});

// ── Using custom rules array ──────────────────────────────────────────────────

describe("Custom rules array", () => {
  it("uses only the provided rules when a custom array is passed", () => {
    const smokingOnlyRules = SOP_RULES.filter((r) => r.id === "joint_smoking");
    const extraction = baseExtraction({
      facts: {
        ...baseExtraction().facts,
        smoking_status: fact("active"),
        hba1c_value: fact(8.0),
        daily_opioid_use_over_3_months: fact(true),
      },
    });
    const output = runSopMatcher(extraction, smokingOnlyRules);
    expect(output.triggered_rules).toHaveLength(1);
    expect(output.triggered_rules[0].rule_id).toBe("joint_smoking");
  });
});
