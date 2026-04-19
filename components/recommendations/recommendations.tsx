"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JsonModal } from "@/components/ui/json-modal";
import { formatSummary } from "@/lib/format-summary";
import { ruleLabel } from "@/lib/rule-labels";
import type { ExtractionOutput, RoutingOutput, TriggeredRule } from "@/lib/types";
import { CheckIcon, ChevronDownIcon, CopyIcon } from "lucide-react";

interface Props {
  transcript: string;
  extraction: ExtractionOutput;
  routing: RoutingOutput;
  onBack: () => void;
  onReset: () => void;
}

const BOOL_LABELS: Record<string, string> = {
  dental_visit_within_6_months: "Dental visit within last 6 months",
  has_pending_dental_work: "Pending dental work",
  has_attempted_pt_or_exercise: "Attempted PT or structured exercise",
  daily_opioid_use_over_3_months: "Daily opioid use > 3 months",
  has_prior_weight_loss_surgery: "Prior weight-loss surgery",
  has_recent_endoscopy: "Recent endoscopy (within 3 months)",
  has_registered_dietician: "Registered dietician identified",
};

const SMOKING_LABELS: Record<string, string> = {
  active: "Active",
  quit_within_3_months: "Quit within last 3 months",
  quit_over_3_months: "Quit over 3 months ago",
  never: "Never",
};

const FACT_SECTIONS: { title: string; fields: (keyof ExtractionOutput["facts"])[] }[] = [
  {
    title: "General",
    fields: ["dental_visit_within_6_months", "has_pending_dental_work"],
  },
  {
    title: "Joint",
    fields: [
      "has_attempted_pt_or_exercise",
      "smoking_status",
      "hba1c_value",
      "daily_opioid_use_over_3_months",
    ],
  },
  {
    title: "Bariatric",
    fields: [
      "has_prior_weight_loss_surgery",
      "prior_surgery_type",
      "has_recent_endoscopy",
      "has_registered_dietician",
    ],
  },
];

function formatFactValue(field: keyof ExtractionOutput["facts"], value: unknown): string {
  if (value === null || value === undefined) return "Not mentioned";
  if (field === "smoking_status" && typeof value === "string") {
    return SMOKING_LABELS[value] ?? value;
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function factLabel(field: keyof ExtractionOutput["facts"]): string {
  if (field === "smoking_status") return "Smoking status";
  if (field === "hba1c_value") return "HbA1c value";
  if (field === "prior_surgery_type") return "Prior surgery type";
  return BOOL_LABELS[field] ?? field;
}

const SEVERITY_STYLES: Record<
  TriggeredRule["severity"],
  { bar: string; badge: string; label: string }
> = {
  critical: {
    bar: "bg-red-500",
    badge: "bg-red-100 text-red-800 border-red-200",
    label: "Critical",
  },
  high: {
    bar: "bg-orange-500",
    badge: "bg-orange-100 text-orange-800 border-orange-200",
    label: "High",
  },
  warning: {
    bar: "bg-amber-400",
    badge: "bg-amber-100 text-amber-800 border-amber-200",
    label: "Warning",
  },
  info: {
    bar: "bg-blue-500",
    badge: "bg-blue-100 text-blue-800 border-blue-200",
    label: "Info",
  },
};

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

function RuleCard({ rule }: { rule: TriggeredRule }) {
  const [open, setOpen] = useState(false);
  const s = SEVERITY_STYLES[rule.severity];
  return (
    <div className="flex overflow-hidden rounded-md border bg-card">
      <div className={`w-1.5 shrink-0 ${s.bar}`} aria-hidden />
      <div className="flex-1 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={`uppercase ${s.badge}`}>
            {rule.status}
          </Badge>
          <span className="text-xs text-muted-foreground">{rule.category}</span>
          <span className="ml-auto text-xs text-muted-foreground">{ruleLabel(rule.rule_id)}</span>
        </div>
        <p className="mt-2 text-sm font-medium">{rule.finding}</p>
        <p className="mt-1 text-sm text-muted-foreground">{rule.action}</p>
        {rule.evidence && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronDownIcon
              className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
            />
            {open ? "Hide evidence" : "Show evidence"}
          </button>
        )}
        {open && rule.evidence && (
          <blockquote className="mt-2 border-l-2 border-muted-foreground/30 pl-3 text-xs italic text-muted-foreground">
            &ldquo;{rule.evidence}&rdquo;
          </blockquote>
        )}
      </div>
    </div>
  );
}

export function Recommendations({ transcript, extraction, routing, onBack, onReset }: Props) {
  const [jsonOpen, setJsonOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [factsOpen, setFactsOpen] = useState(false);

  async function handleCopySummary() {
    try {
      await navigator.clipboard.writeText(formatSummary(routing));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable; swallow
    }
  }

  const hasTriggered = routing.triggered_rules.length > 0;
  const hasUnverified = routing.unverified_flags.length > 0;
  const hasNotes = routing.additional_notes.length > 0;

  return (
    <div className="grid h-full grid-cols-1 md:grid-cols-2">
      <aside className="overflow-y-auto border-r bg-muted/30 p-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Transcript
        </h2>
        <pre className="font-mono text-xs whitespace-pre-wrap text-foreground">{transcript}</pre>
      </aside>

      <section className="flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <header>
            <h2 className="text-lg font-semibold">
              {routing.patient_name ?? "Unknown patient"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {caseTypeLabel(routing.case_type)}
              {routing.reason_for_care ? ` · ${routing.reason_for_care}` : ""}
            </p>
          </header>

          <div>
            <button
              type="button"
              onClick={() => setFactsOpen((o) => !o)}
              className="flex w-full items-center justify-between rounded-md border bg-card px-3 py-2 text-left text-sm hover:bg-muted/50"
              aria-expanded={factsOpen}
            >
              <span className="font-semibold uppercase tracking-wide text-muted-foreground text-xs">
                Extracted facts
              </span>
              <ChevronDownIcon
                className={`h-4 w-4 transition-transform ${factsOpen ? "rotate-180" : ""}`}
              />
            </button>
            {factsOpen && (
              <div className="mt-3 space-y-4">
                {FACT_SECTIONS.map((section) => (
                  <div key={section.title}>
                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {section.title}
                    </h4>
                    <dl className="divide-y rounded-md border bg-card text-sm">
                      {section.fields.map((field) => {
                        const fact = extraction.facts[field];
                        return (
                          <div
                            key={field}
                            className="flex items-baseline justify-between gap-3 px-3 py-1.5"
                          >
                            <dt className="text-muted-foreground">{factLabel(field)}</dt>
                            <dd className="font-medium">
                              {formatFactValue(field, fact.value)}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Triggered Rules
            </h3>
            {hasTriggered ? (
              <div className="space-y-3">
                {routing.triggered_rules.map((r) => (
                  <RuleCard key={r.rule_id} rule={r} />
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                No flags triggered — case appears eligible for standard routing.
              </div>
            )}
          </div>

          {hasUnverified && (
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Unverified Flags
              </h3>
              <p className="mb-2 text-xs text-muted-foreground">
                These rules could not be evaluated because required facts were missing or
                ambiguous. Care team should confirm with the patient.
              </p>
              <div className="space-y-2">
                {routing.unverified_flags.map((f) => (
                  <div
                    key={f.rule_id}
                    className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200 uppercase">
                        Needs follow-up
                      </Badge>
                      <span className="text-xs text-muted-foreground">{ruleLabel(f.rule_id)}</span>
                    </div>
                    <p className="mt-2 text-sm">{f.reason}</p>
                    {f.evidence && (
                      <blockquote className="mt-2 border-l-2 border-amber-300 pl-3 text-xs italic text-muted-foreground">
                        &ldquo;{f.evidence}&rdquo;
                      </blockquote>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Extracted: <span className="font-mono">{f.extracted_value}</span>
                      {" · "}confidence: {f.confidence}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasNotes && (
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Additional Clinical Notes
              </h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {routing.additional_notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t bg-background p-4">
          <Button variant="outline" onClick={onBack}>
            ← Back to Review
          </Button>
          <Button variant="outline" onClick={() => setJsonOpen(true)}>
            View JSON
          </Button>
          <Button variant="outline" onClick={handleCopySummary}>
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? "Copied" : "Copy Summary"}
          </Button>
          <Button className="ml-auto" onClick={onReset}>
            Process New Transcript
          </Button>
        </div>
      </section>

      <JsonModal open={jsonOpen} onOpenChange={setJsonOpen} data={{ extraction, routing }} />
    </div>
  );
}
