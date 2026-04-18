/**
 * @jest-environment node
 */

const mockExtractRawText = jest.fn();

jest.mock("mammoth", () => ({
  __esModule: true,
  default: {
    extractRawText: (...args: unknown[]) => mockExtractRawText(...args),
  },
}));

import { POST } from "@/app/api/upload-document/route";

function makeFile(
  name: string,
  contents: string | Uint8Array = "fake binary contents",
): File {
  const data = typeof contents === "string" ? new TextEncoder().encode(contents) : contents;
  return new File([data], name, {
    type: name.endsWith(".docx")
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/msword",
  });
}

function makeRequest(form: FormData): Request {
  return new Request("http://localhost/api/upload-document", {
    method: "POST",
    body: form,
  });
}

describe("POST /api/upload-document", () => {
  beforeEach(() => {
    mockExtractRawText.mockReset();
  });

  it("returns 200 with extracted text for a valid .docx", async () => {
    mockExtractRawText.mockResolvedValueOnce({
      value: "Patient Jane Doe, knee pain for 8 months.",
      messages: [],
    });

    const form = new FormData();
    form.append("file", makeFile("transcript.docx"));

    const res = await POST(makeRequest(form));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.text).toBe("Patient Jane Doe, knee pain for 8 months.");
    expect(mockExtractRawText).toHaveBeenCalledTimes(1);
  });

  it("accepts .doc files as well as .docx", async () => {
    mockExtractRawText.mockResolvedValueOnce({ value: "legacy content", messages: [] });

    const form = new FormData();
    form.append("file", makeFile("legacy.doc"));

    const res = await POST(makeRequest(form));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBe("legacy content");
  });

  it("returns 400 when no file field is present", async () => {
    const form = new FormData();
    form.append("not-a-file", "hello");

    const res = await POST(makeRequest(form));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("missing_file");
    expect(mockExtractRawText).not.toHaveBeenCalled();
  });

  it("returns 415 for unsupported file extensions", async () => {
    const form = new FormData();
    form.append("file", makeFile("notes.txt"));

    const res = await POST(makeRequest(form));
    expect(res.status).toBe(415);
    const body = await res.json();
    expect(body.error.code).toBe("unsupported_type");
    expect(mockExtractRawText).not.toHaveBeenCalled();
  });

  it("returns 400 for an empty file", async () => {
    const form = new FormData();
    form.append("file", new File([], "empty.docx"));

    const res = await POST(makeRequest(form));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("empty_file");
    expect(mockExtractRawText).not.toHaveBeenCalled();
  });

  it("returns 422 when mammoth fails to parse the document", async () => {
    mockExtractRawText.mockRejectedValueOnce(new Error("not a valid docx"));

    const form = new FormData();
    form.append("file", makeFile("corrupted.docx"));

    const res = await POST(makeRequest(form));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("parse_failed");
    expect(body.error.message).toContain("not a valid docx");
  });

  it("returns 400 when the document parses to empty/whitespace text", async () => {
    mockExtractRawText.mockResolvedValueOnce({ value: "   \n\t  ", messages: [] });

    const form = new FormData();
    form.append("file", makeFile("blank.docx"));

    const res = await POST(makeRequest(form));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("empty_file");
  });
});
