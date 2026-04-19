import { ExtractionOutputSchema, RoutingOutputSchema } from "@/lib/schemas";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fact<T>(value: T | null, confidence = "high", evidence = "quote") {
  return { value, confidence, evidence };
}

function nullFact() {
  return { value: null, confidence: "low", evidence: null };
}

function validExtraction(overrides: Record<string, unknown> = {}) {
  return {
    patient_name: fact("Jane Doe"),
    case_type: fact("joint"),
    reason_for_care: fact("knee pain"),
    facts: {
      dental_visit_within_6_months: fact(true),
      has_pending_dental_work: fact(false),
      smoking_status: fact("never"),
      has_attempted_pt_or_exercise: fact(true),
      hba1c_value: fact(6.5),
      daily_opioid_use_over_3_months: fact(false),
      has_prior_weight_loss_surgery: nullFact(),
      prior_surgery_type: nullFact(),
      has_recent_endoscopy: nullFact(),
      has_registered_dietician: nullFact(),
    },
    additional_notes: [],
    ...overrides,
  };
}

// ── ExtractionOutputSchema ───────────────────────────────────────────────────

describe("ExtractionOutputSchema", () => {
  it("accepts a valid extraction output", () => {
    const result = ExtractionOutputSchema.safeParse(validExtraction());
    expect(result.success).toBe(true);
  });

  it("accepts null values on any fact field", () => {
    const data = validExtraction({
      facts: {
        dental_visit_within_6_months: nullFact(),
        has_pending_dental_work: nullFact(),
        smoking_status: nullFact(),
        has_attempted_pt_or_exercise: nullFact(),
        hba1c_value: nullFact(),
        daily_opioid_use_over_3_months: nullFact(),
        has_prior_weight_loss_surgery: nullFact(),
        prior_surgery_type: nullFact(),
        has_recent_endoscopy: nullFact(),
        has_registered_dietician: nullFact(),
      },
    });
    const result = ExtractionOutputSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("accepts all valid case types", () => {
    for (const caseType of ["bariatric", "joint", "general", "unknown"] as const) {
      const result = ExtractionOutputSchema.safeParse(
        validExtraction({ case_type: fact(caseType) }),
      );
      expect(result.success).toBe(true);
    }
  });

  it("accepts all valid smoking_status values", () => {
    const statuses = [
      "active",
      "quit_within_3_months",
      "quit_over_3_months",
      "never",
    ] as const;
    for (const status of statuses) {
      const base = validExtraction();
      const data = {
        ...base,
        facts: { ...base.facts, smoking_status: fact(status) },
      };
      expect(ExtractionOutputSchema.safeParse(data).success).toBe(true);
    }
  });

  it("rejects an invalid smoking_status value", () => {
    const base = validExtraction();
    const data = {
      ...base,
      facts: {
        ...base.facts,
        smoking_status: fact("yes_smoker"), // invalid enum value
      },
    };
    expect(ExtractionOutputSchema.safeParse(data).success).toBe(false);
  });

  it("rejects an invalid case_type value", () => {
    const result = ExtractionOutputSchema.safeParse(
      validExtraction({ case_type: fact("surgical") }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects when a required top-level field is missing", () => {
    const { patient_name: _omit, ...rest } = validExtraction();
    expect(ExtractionOutputSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects when a required fact field is missing entirely", () => {
    const base = validExtraction();
    const { dental_visit_within_6_months: _omit, ...factsWithout } =
      base.facts;
    const data = { ...base, facts: factsWithout };
    expect(ExtractionOutputSchema.safeParse(data).success).toBe(false);
  });

  it("rejects when confidence is an invalid value", () => {
    const result = ExtractionOutputSchema.safeParse(
      validExtraction({ case_type: { value: "joint", confidence: "very_high", evidence: null } }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects when a numeric fact has a string value", () => {
    const base = validExtraction();
    const data = {
      ...base,
      facts: { ...base.facts, hba1c_value: fact("7.4") }, // string instead of number
    };
    expect(ExtractionOutputSchema.safeParse(data).success).toBe(false);
  });

  it("accepts additional_notes as empty array", () => {
    const result = ExtractionOutputSchema.safeParse(
      validExtraction({ additional_notes: [] }),
    );
    expect(result.success).toBe(true);
  });

  it("accepts additional_notes with string entries", () => {
    const result = ExtractionOutputSchema.safeParse(
      validExtraction({ additional_notes: ["Patient is anxious about surgery."] }),
    );
    expect(result.success).toBe(true);
  });
});

// ── RoutingOutputSchema ───────────────────────────────────────────────────────

describe("RoutingOutputSchema", () => {
  const validRouting = {
    patient_name: "Jane Doe",
    case_type: "joint",
    reason_for_care: "knee replacement evaluation",
    triggered_rules: [
      {
        rule_id: "joint_smoking",
        category: "Joint",
        finding: "Active smoker",
        status: "Deferred",
        action: "Refer to smoking cessation.",
        severity: "critical",
        evidence: "Patient smokes half a pack per day.",
      },
    ],
    unverified_flags: [],
    additional_notes: [],
  };

  it("accepts a valid routing output", () => {
    expect(RoutingOutputSchema.safeParse(validRouting).success).toBe(true);
  });

  it("accepts null patient_name and reason_for_care", () => {
    const data = {
      ...validRouting,
      patient_name: null,
      reason_for_care: null,
    };
    expect(RoutingOutputSchema.safeParse(data).success).toBe(true);
  });

  it("accepts all valid severity values in triggered_rules", () => {
    for (const severity of ["critical", "high", "warning", "info"] as const) {
      const data = {
        ...validRouting,
        triggered_rules: [{ ...validRouting.triggered_rules[0], severity }],
      };
      expect(RoutingOutputSchema.safeParse(data).success).toBe(true);
    }
  });

  it("rejects an invalid severity value", () => {
    const data = {
      ...validRouting,
      triggered_rules: [
        { ...validRouting.triggered_rules[0], severity: "extreme" },
      ],
    };
    expect(RoutingOutputSchema.safeParse(data).success).toBe(false);
  });

  it("accepts unverified_flags with valid entries", () => {
    const data = {
      ...validRouting,
      triggered_rules: [],
      unverified_flags: [
        {
          rule_id: "joint_no_pt",
          reason: "PT history not established.",
          extracted_value: "has_attempted_pt_or_exercise: not mentioned",
          confidence: "low",
          evidence: null,
        },
      ],
    };
    expect(RoutingOutputSchema.safeParse(data).success).toBe(true);
  });
});
