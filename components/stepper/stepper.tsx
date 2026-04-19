"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export type Phase = 1 | 2 | 3;

const STEPS: { phase: Phase; label: string }[] = [
  { phase: 1, label: "Input Transcript" },
  { phase: 2, label: "Review Extraction" },
  { phase: 3, label: "Recommendations" },
];

interface StepperProps {
  current: Phase;
  reached: Phase;
  onNavigate: (phase: Phase) => void;
}

export function Stepper({ current, reached, onNavigate }: StepperProps) {
  return (
    <nav aria-label="Progress" className="relative border-b bg-background px-6 py-4">
      <Link
        href="/about"
        className="absolute right-6 top-1/2 hidden -translate-y-1/2 text-sm text-muted-foreground hover:text-foreground sm:block"
      >
        Strategic Brief
      </Link>
      <ol className="mx-auto flex max-w-5xl items-center justify-center gap-2 sm:gap-4">
        {STEPS.map((step, idx) => {
          const isActive = step.phase === current;
          const isComplete = step.phase < current;
          const isClickable = step.phase < current || (step.phase <= reached && step.phase !== current);
          return (
            <li key={step.phase} className="flex items-center gap-2 sm:gap-4">
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && onNavigate(step.phase)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors",
                  isClickable && "cursor-pointer hover:bg-muted",
                  !isClickable && "cursor-default",
                )}
              >
                <span
                  className={cn(
                    "inline-flex size-6 items-center justify-center rounded-full border text-xs font-medium",
                    isActive && "border-primary bg-primary text-primary-foreground",
                    isComplete && "border-primary bg-primary/10 text-primary",
                    !isActive && !isComplete && "border-muted-foreground/30 text-muted-foreground",
                  )}
                  aria-current={isActive ? "step" : undefined}
                >
                  {step.phase}
                </span>
                <span
                  className={cn(
                    "font-medium",
                    isActive && "text-foreground",
                    !isActive && "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
              </button>
              {idx < STEPS.length - 1 && (
                <span aria-hidden className="h-px w-6 bg-border sm:w-12" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
