import type { ExtractionOutput } from "./types";

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message);
    this.code = payload.code;
    this.status = status;
    this.details = payload.details;
  }
}

async function parseErrorOrThrow(res: Response): Promise<never> {
  let payload: ApiErrorPayload;
  try {
    const body = (await res.json()) as { error?: ApiErrorPayload };
    payload = body.error ?? { code: "unknown_error", message: res.statusText };
  } catch {
    payload = { code: "unknown_error", message: `HTTP ${res.status}` };
  }
  throw new ApiError(res.status, payload);
}

export async function extractTranscript(transcript: string): Promise<ExtractionOutput> {
  const res = await fetch("/api/process-transcript", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript }),
  });
  if (!res.ok) await parseErrorOrThrow(res);
  return (await res.json()) as ExtractionOutput;
}

export async function uploadDocument(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload-document", { method: "POST", body: form });
  if (!res.ok) await parseErrorOrThrow(res);
  const body = (await res.json()) as { text: string };
  return body.text;
}
