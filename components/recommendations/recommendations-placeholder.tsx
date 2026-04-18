"use client";

import { Button } from "@/components/ui/button";
import type { RoutingOutput } from "@/lib/types";

interface Props {
  transcript: string;
  routing: RoutingOutput;
  onBack: () => void;
  onReset: () => void;
}

export function RecommendationsPlaceholder({ transcript, routing, onBack, onReset }: Props) {
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
          <h2 className="mb-2 text-lg font-semibold">Recommendations (placeholder view)</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Phase 6 will replace this with styled rule cards. For now, here is the raw routing
            output.
          </p>
          <pre className="rounded-md border bg-muted/50 p-3 font-mono text-xs whitespace-pre-wrap">
            {JSON.stringify(routing, null, 2)}
          </pre>
        </div>
        <div className="flex items-center justify-between gap-2 border-t bg-background p-4">
          <Button variant="outline" onClick={onBack}>
            ← Back to Review
          </Button>
          <Button onClick={onReset}>Process New Transcript</Button>
        </div>
      </section>
    </div>
  );
}
