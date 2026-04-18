import type Anthropic from "@anthropic-ai/sdk";
import { ExtractionOutputSchema } from "./schemas";
import { EXTRACTION_SYSTEM_PROMPT } from "./extraction-prompt";
import { RECORD_EXTRACTION_TOOL } from "./extraction-tool";
import type { ExtractionOutput } from "./types";

export const EXTRACTION_MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 2048;

export type ExtractionErrorCode =
  | "empty_transcript"
  | "no_tool_use"
  | "schema_validation_failed"
  | "api_error";

export class ExtractionError extends Error {
  readonly code: ExtractionErrorCode;
  readonly details?: unknown;

  constructor(code: ExtractionErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ExtractionError";
    this.code = code;
    this.details = details;
  }
}

/**
 * Calls Claude with the `record_extraction` tool and returns a schema-validated
 * ExtractionOutput. Throws ExtractionError on any failure (API, wrong stop
 * reason, schema validation). The caller (route handler) maps error codes to
 * HTTP status codes.
 *
 * The Anthropic client is injected so tests can mock `messages.create`
 * without standing up a real SDK instance.
 */
export async function extractFromTranscript(
  client: Anthropic,
  transcript: string,
): Promise<ExtractionOutput> {
  if (!transcript || transcript.trim().length === 0) {
    throw new ExtractionError(
      "empty_transcript",
      "Transcript is empty. Provide transcript text to extract.",
    );
  }

  let response;
  try {
    response = await client.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: MAX_TOKENS,
      system: EXTRACTION_SYSTEM_PROMPT,
      tools: [RECORD_EXTRACTION_TOOL],
      tool_choice: { type: "tool", name: RECORD_EXTRACTION_TOOL.name },
      messages: [
        {
          role: "user",
          content: `Here is the patient transcript. Extract the clinical facts and call the record_extraction tool.\n\n<transcript>\n${transcript}\n</transcript>`,
        },
      ],
    });
  } catch (err) {
    throw new ExtractionError(
      "api_error",
      err instanceof Error ? err.message : "Claude API request failed.",
      err,
    );
  }

  // With tool_choice forcing a specific tool, stop_reason should be "tool_use".
  // Anything else (end_turn, max_tokens, refusal) means we didn't get tool input.
  const toolUseBlock = response.content.find(
    (block): block is Extract<typeof block, { type: "tool_use" }> =>
      block.type === "tool_use" &&
      block.name === RECORD_EXTRACTION_TOOL.name,
  );

  if (!toolUseBlock) {
    throw new ExtractionError(
      "no_tool_use",
      `Model did not invoke the record_extraction tool (stop_reason: ${response.stop_reason ?? "unknown"}).`,
    );
  }

  const parsed = ExtractionOutputSchema.safeParse(toolUseBlock.input);
  if (!parsed.success) {
    throw new ExtractionError(
      "schema_validation_failed",
      "Model tool input failed schema validation.",
      parsed.error.flatten(),
    );
  }

  return parsed.data;
}
