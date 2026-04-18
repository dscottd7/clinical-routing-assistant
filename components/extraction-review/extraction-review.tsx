"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  CaseType,
  Confidence,
  ExtractedFact,
  ExtractionOutput,
  SmokingStatus,
} from "@/lib/types";

interface Props {
  transcript: string;
  extraction: ExtractionOutput;
  onChange: (next: ExtractionOutput) => void;
  onApply: () => void;
  onBack: () => void;
}

const SMOKING_OPTIONS: { value: SmokingStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "quit_within_3_months", label: "Quit within 3 months" },
  { value: "quit_over_3_months", label: "Quit over 3 months" },
  { value: "never", label: "Never" },
];

const CASE_TYPE_OPTIONS: { value: CaseType; label: string }[] = [
  { value: "bariatric", label: "Bariatric" },
  { value: "joint", label: "Joint" },
  { value: "general", label: "General" },
  { value: "unknown", label: "Unknown" },
];

type BoolFact = keyof {
  [K in keyof ExtractionOutput["facts"] as ExtractionOutput["facts"][K] extends ExtractedFact<boolean>
    ? K
    : never]: true;
};

const BOOL_LABELS: Record<BoolFact, string> = {
  dental_visit_within_6_months: "Dental visit within last 6 months",
  has_pending_dental_work: "Pending dental work",
  has_attempted_pt_or_exercise: "Attempted PT or structured exercise",
  daily_opioid_use_over_3_months: "Daily opioid use > 3 months",
  has_prior_weight_loss_surgery: "Prior weight-loss surgery",
  has_recent_endoscopy: "Recent endoscopy (within 3 months)",
  has_registered_dietician: "Registered dietician identified",
};

const SECTION_BOOLS: { title: string; fields: BoolFact[] }[] = [
  {
    title: "General",
    fields: ["dental_visit_within_6_months", "has_pending_dental_work"],
  },
  {
    title: "Joint",
    fields: ["has_attempted_pt_or_exercise", "daily_opioid_use_over_3_months"],
  },
  {
    title: "Bariatric",
    fields: [
      "has_prior_weight_loss_surgery",
      "has_recent_endoscopy",
      "has_registered_dietician",
    ],
  },
];

function confidenceBadge(confidence: Confidence) {
  const styles: Record<Confidence, string> = {
    high: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
    medium: "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
    low: "bg-rose-100 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200",
  };
  const labels: Record<Confidence, string> = {
    high: "HIGH",
    medium: "MED",
    low: "LOW",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide",
        styles[confidence],
      )}
    >
      {labels[confidence]}
    </span>
  );
}

function rowHighlight(confidence: Confidence) {
  if (confidence === "medium")
    return "bg-amber-50 dark:bg-amber-950/15";
  if (confidence === "low") return "bg-rose-50 dark:bg-rose-950/15";
  return "";
}

interface FactRowProps {
  label: string;
  confidence: Confidence;
  evidence: string | null;
  children: React.ReactNode;
}

function FactRow({ label, confidence, evidence, children }: FactRowProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-[1fr_auto] items-start gap-3 rounded-md border px-3 py-2",
        rowHighlight(confidence),
      )}
    >
      <div className="min-w-0">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          {confidenceBadge(confidence)}
        </div>
        {children}
        {evidence && (
          <p className="mt-1.5 truncate text-xs text-muted-foreground italic">
            “{evidence}”
          </p>
        )}
      </div>
    </div>
  );
}

interface TriStateProps {
  value: boolean | null;
  onChange: (next: boolean | null) => void;
}

function TriState({ value, onChange }: TriStateProps) {
  const options: { v: boolean | null; label: string }[] = [
    { v: true, label: "Yes" },
    { v: false, label: "No" },
    { v: null, label: "Not Mentioned" },
  ];
  return (
    <div
      role="radiogroup"
      className="inline-flex rounded-md border bg-muted p-0.5 text-xs"
    >
      {options.map((o) => {
        const active = value === o.v;
        return (
          <button
            key={String(o.v)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.v)}
            className={cn(
              "rounded px-2.5 py-1 font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function ExtractionReview({
  transcript,
  extraction,
  onChange,
  onApply,
  onBack,
}: Props) {
  function updateFact<K extends keyof ExtractionOutput["facts"]>(
    key: K,
    partial: Partial<ExtractionOutput["facts"][K]>,
  ) {
    onChange({
      ...extraction,
      facts: {
        ...extraction.facts,
        [key]: { ...extraction.facts[key], ...partial },
      },
    });
  }

  function updateTopLevel<K extends "patient_name" | "case_type" | "reason_for_care">(
    key: K,
    partial: Partial<ExtractionOutput[K]>,
  ) {
    onChange({
      ...extraction,
      [key]: { ...extraction[key], ...partial },
    });
  }

  // When the user edits a value, mark confidence "high" so the visual highlight clears.
  function editFactValue<K extends keyof ExtractionOutput["facts"]>(
    key: K,
    value: ExtractionOutput["facts"][K]["value"],
  ) {
    updateFact(key, { value, confidence: "high" } as Partial<
      ExtractionOutput["facts"][K]
    >);
  }

  function editTopLevelValue<
    K extends "patient_name" | "case_type" | "reason_for_care",
  >(key: K, value: ExtractionOutput[K]["value"]) {
    updateTopLevel(key, { value, confidence: "high" } as Partial<ExtractionOutput[K]>);
  }

  return (
    <div className="grid h-full grid-cols-1 md:grid-cols-[1fr_1.3fr]">
      <aside className="overflow-y-auto border-r bg-muted/30 p-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Transcript
        </h2>
        <pre className="font-mono text-xs whitespace-pre-wrap text-foreground">
          {transcript}
        </pre>
      </aside>

      <section className="flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          <header className="mb-6">
            <h1 className="text-xl font-semibold">Review extracted facts</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              All fields are editable. Rows highlighted yellow (medium) or red (low)
              flag values that the extractor was less certain about.
            </p>
          </header>

          {/* Patient summary */}
          <div className="mb-6 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Patient
            </h2>

            <FactRow
              label="Patient name"
              confidence={extraction.patient_name.confidence}
              evidence={extraction.patient_name.evidence}
            >
              <input
                type="text"
                className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={extraction.patient_name.value ?? ""}
                placeholder="Not mentioned"
                onChange={(e) =>
                  editTopLevelValue(
                    "patient_name",
                    e.target.value === "" ? null : e.target.value,
                  )
                }
              />
            </FactRow>

            <FactRow
              label="Case type"
              confidence={extraction.case_type.confidence}
              evidence={extraction.case_type.evidence}
            >
              <select
                className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={extraction.case_type.value ?? "unknown"}
                onChange={(e) =>
                  editTopLevelValue("case_type", e.target.value as CaseType)
                }
              >
                {CASE_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </FactRow>

            <FactRow
              label="Reason for care"
              confidence={extraction.reason_for_care.confidence}
              evidence={extraction.reason_for_care.evidence}
            >
              <input
                type="text"
                className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={extraction.reason_for_care.value ?? ""}
                placeholder="Not mentioned"
                onChange={(e) =>
                  editTopLevelValue(
                    "reason_for_care",
                    e.target.value === "" ? null : e.target.value,
                  )
                }
              />
            </FactRow>
          </div>

          {/* Boolean fact sections */}
          {SECTION_BOOLS.map((section) => (
            <div key={section.title} className="mb-6 space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </h2>
              {section.fields.map((field) => {
                const fact = extraction.facts[field];
                return (
                  <FactRow
                    key={field}
                    label={BOOL_LABELS[field]}
                    confidence={fact.confidence}
                    evidence={fact.evidence}
                  >
                    <TriState
                      value={fact.value}
                      onChange={(v) => editFactValue(field, v)}
                    />
                  </FactRow>
                );
              })}
            </div>
          ))}

          {/* Joint: smoking status */}
          <div className="mb-6 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Joint · enum
            </h2>
            <FactRow
              label="Smoking status"
              confidence={extraction.facts.smoking_status.confidence}
              evidence={extraction.facts.smoking_status.evidence}
            >
              <select
                className="w-full max-w-xs rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={extraction.facts.smoking_status.value ?? ""}
                onChange={(e) =>
                  editFactValue(
                    "smoking_status",
                    (e.target.value === "" ? null : e.target.value) as SmokingStatus | null,
                  )
                }
              >
                <option value="">Not Mentioned</option>
                {SMOKING_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </FactRow>
          </div>

          {/* Joint: HbA1c */}
          <div className="mb-6 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Joint · numeric
            </h2>
            <FactRow
              label="HbA1c value"
              confidence={extraction.facts.hba1c_value.confidence}
              evidence={extraction.facts.hba1c_value.evidence}
            >
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="20"
                  className="w-32 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                  value={extraction.facts.hba1c_value.value ?? ""}
                  disabled={extraction.facts.hba1c_value.value === null}
                  onChange={(e) => {
                    const n = e.target.value === "" ? null : Number(e.target.value);
                    editFactValue(
                      "hba1c_value",
                      n === null || Number.isNaN(n) ? null : n,
                    );
                  }}
                />
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={extraction.facts.hba1c_value.value === null}
                    onChange={(e) =>
                      editFactValue("hba1c_value", e.target.checked ? null : 0)
                    }
                  />
                  Not mentioned
                </label>
              </div>
            </FactRow>
          </div>

          {/* Bariatric: prior surgery type (string) */}
          <div className="mb-6 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Bariatric · detail
            </h2>
            <FactRow
              label="Prior surgery type"
              confidence={extraction.facts.prior_surgery_type.confidence}
              evidence={extraction.facts.prior_surgery_type.evidence}
            >
              <input
                type="text"
                className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={extraction.facts.prior_surgery_type.value ?? ""}
                placeholder="Not mentioned"
                onChange={(e) =>
                  editFactValue(
                    "prior_surgery_type",
                    e.target.value === "" ? null : e.target.value,
                  )
                }
              />
            </FactRow>
          </div>

          {/* Additional notes */}
          {extraction.additional_notes.length > 0 && (
            <div className="mb-6 space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Additional clinical notes
              </h2>
              <ul className="list-disc space-y-1 rounded-md border bg-muted/30 py-2 pr-3 pl-8 text-sm">
                {extraction.additional_notes.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t bg-background p-4">
          <Button variant="outline" onClick={onBack}>
            ← Back
          </Button>
          <Button onClick={onApply}>Apply SOP Rules →</Button>
        </div>
      </section>
    </div>
  );
}
