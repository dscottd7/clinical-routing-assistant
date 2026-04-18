"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JsonModal } from "@/components/ui/json-modal";
import { formatSummary } from "@/lib/format-summary";
import { ruleLabel } from "@/lib/rule-labels";
import type { RoutingOutput, TriggeredRule } from "@/lib/types";
import { CheckIcon, ChevronDownIcon, CopyIcon } from "lucide-react";

interface Props {
  transcript: string;
  routing: RoutingOutput;
  onBack: () => void;
  onReset: () => void;
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

export function Recommendations({ transcript, routing, onBack, onReset }: Props) {
  const [jsonOpen, setJsonOpen] = useState(false);
  const [copied, setCopied] = useState(false);

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

      <JsonModal open={jsonOpen} onOpenChange={setJsonOpen} data={routing} />
    </div>
  );
}
