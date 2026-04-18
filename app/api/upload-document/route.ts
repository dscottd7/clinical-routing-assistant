import { NextResponse } from "next/server";
import mammoth from "mammoth";

export const runtime = "nodejs";

type UploadErrorCode =
  | "missing_file"
  | "unsupported_type"
  | "empty_file"
  | "parse_failed";

const ERROR_STATUS: Record<UploadErrorCode, number> = {
  missing_file: 400,
  unsupported_type: 415,
  empty_file: 400,
  parse_failed: 422,
};

function errorResponse(code: UploadErrorCode, message: string, details?: unknown) {
  return NextResponse.json(
    { error: { code, message, ...(details !== undefined ? { details } : {}) } },
    { status: ERROR_STATUS[code] },
  );
}

function hasSupportedExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith(".doc") || lower.endsWith(".docx");
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return errorResponse(
      "missing_file",
      "Request must be multipart/form-data with a 'file' field.",
    );
  }

  const entry = form.get("file");
  if (!entry || typeof entry === "string") {
    return errorResponse("missing_file", "No file uploaded under the 'file' field.");
  }

  const file = entry as File;

  if (!hasSupportedExtension(file.name)) {
    return errorResponse(
      "unsupported_type",
      "Unsupported file type. Upload a .doc or .docx file.",
    );
  }

  if (file.size === 0) {
    return errorResponse("empty_file", "Uploaded file is empty.");
  }

  let text: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await mammoth.extractRawText({ buffer });
    text = result.value.trim();
  } catch (err) {
    return errorResponse(
      "parse_failed",
      err instanceof Error
        ? `Could not parse document: ${err.message}`
        : "Could not parse document.",
    );
  }

  if (text.length === 0) {
    return errorResponse("empty_file", "Document contains no extractable text.");
  }

  return NextResponse.json({ text });
}
