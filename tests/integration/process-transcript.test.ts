/**
 * @jest-environment node
 */

// Mock the Anthropic SDK before importing anything that imports it.
// A single module-level mock lets each test swap in its own `create` behavior.
const mockCreate = jest.fn();

jest.mock("@anthropic-ai/sdk", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
  };
});

import { POST } from "@/app/api/process-transcript/route";

// ── Fixtures ─────────────────────────────────────────────────────────────────

function fact<T>(value: T | null, confidence = "high", evidence: string | null = "quote") {
  return { value, confidence, evidence };
}

function validToolInput() {
  return {
    patient_name: fact("Jane Doe"),
    case_type: fact("joint"),
    reason_for_care: fact("knee pain"),
    facts: {
      dental_visit_within_6_months: fact(true),
      has_pending_dental_work: fact(false),
      smoking_status: fact("never"),
      has_attempted_pt_or_exercise: fact(true),
      hba1c_value: fact(6.5),
      daily_opioid_use_over_3_months: fact(false),
      has_prior_weight_loss_surgery: fact(false),
      prior_surgery_type: { value: null, confidence: "low", evidence: null },
      has_recent_endoscopy: { value: null, confidence: "low", evidence: null },
      has_registered_dietician: { value: null, confidence: "low", evidence: null },
    },
    additional_notes: [],
  };
}

function toolUseResponse(input: unknown) {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-4-5",
    stop_reason: "tool_use",
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
    content: [{ type: "tool_use", id: "t1", name: "record_extraction", input }],
  };
}

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/process-transcript", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/process-transcript", () => {
  const ORIGINAL_API_KEY = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    mockCreate.mockReset();
    process.env.ANTHROPIC_API_KEY = "test-key";
  });

  afterAll(() => {
    if (ORIGINAL_API_KEY === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = ORIGINAL_API_KEY;
    }
  });

  it("returns 200 with validated ExtractionOutput on a successful tool call", async () => {
    mockCreate.mockResolvedValueOnce(toolUseResponse(validToolInput()));

    const res = await POST(makeRequest({ transcript: "Patient Jane Doe, knee pain." }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.patient_name.value).toBe("Jane Doe");
    expect(body.case_type.value).toBe("joint");
    expect(body.facts.smoking_status.value).toBe("never");
  });

  it("returns 500 when ANTHROPIC_API_KEY is not set", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const res = await POST(makeRequest({ transcript: "any transcript" }));
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.error.code).toBe("missing_api_key");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns 400 when the request body is not valid JSON", async () => {
    const res = await POST(makeRequest("not-json-at-all"));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error.code).toBe("invalid_json");
  });

  it("returns 400 when the transcript field is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error.code).toBe("invalid_request");
  });

  it("returns 400 when the transcript is an empty string", async () => {
    const res = await POST(makeRequest({ transcript: "" }));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error.code).toBe("invalid_request");
  });

  it("returns 422 when the model's tool input fails schema validation", async () => {
    const bad = validToolInput();
    // Wrong type: smoking_status enum with an invalid value
    bad.facts.smoking_status = fact("sometimes_smokes") as never;

    mockCreate.mockResolvedValueOnce(toolUseResponse(bad));

    const res = await POST(makeRequest({ transcript: "transcript" }));
    expect(res.status).toBe(422);

    const body = await res.json();
    expect(body.error.code).toBe("schema_validation_failed");
    expect(body.error.details).toBeDefined();
  });

  it("returns 502 when the model fails to invoke the tool (wrong stop_reason)", async () => {
    mockCreate.mockResolvedValueOnce({
      id: "msg_test",
      type: "message",
      role: "assistant",
      model: "claude-sonnet-4-5",
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 10 },
      content: [{ type: "text", text: "I cannot help with that." }],
    });

    const res = await POST(makeRequest({ transcript: "transcript" }));
    expect(res.status).toBe(502);

    const body = await res.json();
    expect(body.error.code).toBe("no_tool_use");
  });

  it("returns 502 when the Claude API throws (network/timeout/etc.)", async () => {
    mockCreate.mockRejectedValueOnce(new Error("connection refused"));

    const res = await POST(makeRequest({ transcript: "transcript" }));
    expect(res.status).toBe(502);

    const body = await res.json();
    expect(body.error.code).toBe("api_error");
    expect(body.error.message).toContain("connection refused");
  });

  it("forwards the transcript verbatim inside the user message", async () => {
    mockCreate.mockResolvedValueOnce(toolUseResponse(validToolInput()));

    const transcript = "Patient: Jane Doe. Chief complaint: left knee pain for 8 months.";
    await POST(makeRequest({ transcript }));

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const args = mockCreate.mock.calls[0][0];
    expect(args.model).toBe("claude-sonnet-4-5");
    expect(args.tool_choice).toEqual({ type: "tool", name: "record_extraction" });
    const userContent = args.messages[0].content as string;
    expect(userContent).toContain(transcript);
  });
});
