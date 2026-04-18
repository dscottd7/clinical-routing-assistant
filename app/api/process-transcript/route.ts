import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ExtractionError,
  extractFromTranscript,
  type ExtractionErrorCode,
} from "@/lib/extraction";

export const runtime = "nodejs";

const RequestBodySchema = z.object({
  transcript: z.string().min(1, "transcript is required"),
});

const ERROR_STATUS: Record<ExtractionErrorCode, number> = {
  empty_transcript: 400,
  no_tool_use: 502,
  schema_validation_failed: 422,
  api_error: 502,
};

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: {
          code: "missing_api_key",
          message:
            "ANTHROPIC_API_KEY is not set. Add it to .env.local (or Vercel project settings) and retry.",
        },
      },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: "invalid_json", message: "Request body must be JSON." } },
      { status: 400 },
    );
  }

  const parsed = RequestBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_request",
          message: "Request body failed validation.",
          details: parsed.error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  const client = new Anthropic({ apiKey });

  try {
    const extraction = await extractFromTranscript(client, parsed.data.transcript);
    return NextResponse.json(extraction);
  } catch (err) {
    if (err instanceof ExtractionError) {
      return NextResponse.json(
        {
          error: {
            code: err.code,
            message: err.message,
            details: err.details,
          },
        },
        { status: ERROR_STATUS[err.code] },
      );
    }
    return NextResponse.json(
      {
        error: {
          code: "internal_error",
          message: err instanceof Error ? err.message : "Unknown error.",
        },
      },
      { status: 500 },
    );
  }
}
