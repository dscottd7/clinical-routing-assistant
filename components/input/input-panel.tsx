"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SAMPLE_TRANSCRIPTS } from "@/lib/sample-transcripts";
import { ApiError, extractTranscript, uploadDocument } from "@/lib/client-api";
import type { ExtractionOutput } from "@/lib/types";
import { cn } from "@/lib/utils";

const PRIVACY_COPY =
  "Do not paste or upload any real patient data. This demo uses synthetic data only and does not provide the privacy or security protections required for protected health information (PHI). For demo purposes only.";

interface InputPanelProps {
  onSuccess: (transcript: string, extraction: ExtractionOutput) => void;
}

export function InputPanel({ onSuccess }: InputPanelProps) {
  const [mode, setMode] = useState<"text" | "file">("text");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "loading"; label: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loading = status.kind === "loading";
  const canSubmit =
    !loading && (mode === "text" ? text.trim().length > 0 : file !== null);

  async function handleSubmit() {
    setStatus({ kind: "loading", label: "Extracting clinical facts…" });
    try {
      let transcript = text;
      if (mode === "file" && file) {
        setStatus({ kind: "loading", label: "Parsing document…" });
        transcript = await uploadDocument(file);
        setStatus({ kind: "loading", label: "Extracting clinical facts…" });
      }
      const extraction = await extractTranscript(transcript);
      onSuccess(transcript, extraction);
      setStatus({ kind: "idle" });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unexpected error.";
      setStatus({ kind: "error", message });
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="mb-6 space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Clinical Routing Assistant
          </h1>
          <p className="text-sm text-muted-foreground">
            Paste a patient transcript or upload a .doc/.docx file to extract
            clinical facts and apply SOP rules.
          </p>
        </div>

        <div className="mb-4">
          <label
            htmlFor="sample-select"
            className="mb-1.5 block text-xs font-medium text-muted-foreground"
          >
            Try a sample transcript
          </label>
          <select
            id="sample-select"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            value=""
            onChange={(e) => {
              const sample = SAMPLE_TRANSCRIPTS.find((s) => s.label === e.target.value);
              if (sample) {
                setMode("text");
                setText(sample.body);
              }
              e.target.value = "";
            }}
          >
            <option value="">Choose a sample…</option>
            {SAMPLE_TRANSCRIPTS.map((s) => (
              <option key={s.label} value={s.label}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <Tabs
          value={mode}
          onValueChange={(v) => setMode(v as "text" | "file")}
          className="mb-4"
        >
          <TabsList>
            <TabsTrigger value="text">Paste Text</TabsTrigger>
            <TabsTrigger value="file">Upload File</TabsTrigger>
          </TabsList>

          <TabsContent value="text">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste transcript here…"
              rows={12}
              className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </TabsContent>

          <TabsContent value="file">
            <div
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input px-4 py-12 text-center",
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".doc,.docx"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose a .doc or .docx file
              </Button>
              <p className="text-sm text-muted-foreground">
                {file ? file.name : "No file selected"}
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div
          className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200"
          role="note"
        >
          <span className="font-semibold">⚠️ Privacy notice. </span>
          {PRIVACY_COPY}
        </div>

        {status.kind === "error" && (
          <div
            role="alert"
            className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {status.message}
          </div>
        )}

        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          size="lg"
          className="w-full"
        >
          {loading ? status.label : "Process Transcript"}
        </Button>
      </div>
    </div>
  );
}
