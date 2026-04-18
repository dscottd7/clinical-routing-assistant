"use client";

import { Button } from "@/components/ui/button";
import type { ExtractionOutput } from "@/lib/types";

interface Props {
  transcript: string;
  extraction: ExtractionOutput;
  onApply: () => void;
  onBack: () => void;
}

export function ExtractionReviewPlaceholder({ transcript, extraction, onApply, onBack }: Props) {
  return (
    <div className="grid h-full grid-cols-1 md:grid-cols-2">
      <aside className="overflow-y-auto border-r bg-muted/30 p-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Transcript
        </h2>
        <pre className="font-mono text-xs whitespace-pre-wrap text-foreground">{transcript}</pre>
      </aside>
      <section className="flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          <h2 className="mb-2 text-lg font-semibold">Extraction (placeholder view)</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Phase 5 will replace this with an editable review UI. For now, here is the raw
            extraction output.
          </p>
          <pre className="rounded-md border bg-muted/50 p-3 font-mono text-xs whitespace-pre-wrap">
            {JSON.stringify(extraction, null, 2)}
          </pre>
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
