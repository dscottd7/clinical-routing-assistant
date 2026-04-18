"use client";

import { useMemo, useState } from "react";
import { Stepper, type Phase } from "@/components/stepper/stepper";
import { InputPanel } from "@/components/input/input-panel";
import { ExtractionReview } from "@/components/extraction-review/extraction-review";
import { Recommendations } from "@/components/recommendations/recommendations";
import { runSopMatcher } from "@/lib/sop-matcher";
import type { ExtractionOutput, RoutingOutput } from "@/lib/types";

export default function Home() {
  const [phase, setPhase] = useState<Phase>(1);
  const [reached, setReached] = useState<Phase>(1);
  const [transcript, setTranscript] = useState("");
  const [extraction, setExtraction] = useState<ExtractionOutput | null>(null);

  const routing = useMemo<RoutingOutput | null>(
    () => (extraction ? runSopMatcher(extraction) : null),
    [extraction],
  );

  function goTo(target: Phase) {
    setPhase(target);
    if (target > reached) setReached(target);
  }

  function handleExtractionSuccess(text: string, result: ExtractionOutput) {
    setTranscript(text);
    setExtraction(result);
    goTo(2);
  }

  function handleReset() {
    setTranscript("");
    setExtraction(null);
    setPhase(1);
    setReached(1);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Stepper current={phase} reached={reached} onNavigate={goTo} />

      {phase === 1 && (
        <main className="flex flex-1 items-center justify-center p-6">
          <InputPanel onSuccess={handleExtractionSuccess} />
        </main>
      )}

      {phase === 2 && extraction && (
        <main className="flex-1 overflow-hidden">
          <ExtractionReview
            transcript={transcript}
            extraction={extraction}
            onChange={setExtraction}
            onApply={() => goTo(3)}
            onBack={() => setPhase(1)}
          />
        </main>
      )}

      {phase === 3 && extraction && routing && (
        <main className="flex-1 overflow-hidden">
          <Recommendations
            transcript={transcript}
            extraction={extraction}
            routing={routing}
            onBack={() => setPhase(2)}
            onReset={handleReset}
          />
        </main>
      )}
    </div>
  );
}
