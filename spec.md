# Clinical Routing Assistant — Project Specification

> **Status:** Pre-implementation
> **Last updated:** 2026-04-16
> **Purpose:** Reference document for all architectural and design decisions. Update this file when decisions change during development.

---

## 1. Project Overview

A web application that helps clinical care teams process raw patient transcripts (phone calls, text chats) by:

1. Extracting key clinical facts from unstructured text using an LLM
2. Allowing a human reviewer to verify and correct extracted facts before proceeding
3. Applying deterministic Standard Operating Procedure (SOP) rules against verified facts to generate recommended next steps
4. Displaying results in a clean, human-readable format with an exportable structured JSON output

### Design Philosophy
- **Human-in-the-loop:** The system assists clinical decision-making; it does not make final determinations autonomously. Human review of extracted facts is a required step before SOP matching runs.
- **Transparency over automation:** Confidence levels are shown for all extracted data. Every field is editable regardless of confidence — confidence is a visual cue to guide attention, not a lock on the data.
- **Conservative on ambiguity:** When a fact cannot be clearly extracted, the system surfaces it as uncertain rather than making a silent assumption. Rules that depend on uncertain facts become `unverified_flags` rather than silently firing or silently clearing.
- **Deterministic rule enforcement:** SOP rules are applied in code, not by LLM inference, so the logic is auditable, predictable, and not subject to hallucination.
- **Privacy-aware by design:** The app is a prototype and does not provide HIPAA-grade protections. The UI makes this explicit so users never confuse demo behavior with production behavior.

---

## 2. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js (App Router) | React-based with built-in serverless API routes; API keys stay server-side; deploys directly from GitHub to Vercel |
| Frontend | React (via Next.js) | Component-based UI, TypeScript preferred |
| LLM API | Anthropic Claude API | `tool_use` with `tool_choice` guarantees schema-compliant structured output; production-proven for clinical AI use cases |
| LLM Model | `claude-sonnet-4-5` | Strong extraction quality; pinned to avoid silent behavior drift during development |
| Document Parsing | mammoth.js | Reliable .doc / .docx text extraction; server-side in API route |
| SOP Matching | Deterministic code | Rules are lookups, not reasoning problems; auditable, no hallucination risk |
| Hosting | Vercel | Free tier, deploys from GitHub, environment variables for API key management |
| Version Control | GitHub | PRs and branches for all feature development |

### LLM Orchestration
Direct Claude API calls via the Anthropic SDK — no LangChain or orchestration framework. The chain has only two sequential steps and the added abstraction is not warranted. If the pipeline grows in complexity, LangChain or a similar framework can be introduced.

### Structured Output Mechanism
Claude does not expose an "OpenAI-style JSON mode." Instead, we use Claude's **`tool_use`** feature to guarantee schema-compliant output:

- Define a single tool (e.g., `record_extraction`) whose `input_schema` mirrors the `ExtractionOutput` JSON Schema
- Set `tool_choice: { type: "tool", name: "record_extraction" }` to force the model to emit tool input
- Read the tool `input` from the response as the extraction payload
- Validate the payload server-side against the Zod schema before returning to the client

This pattern is more reliable than prompt-only "return JSON" approaches because the model is constrained by the tool input schema at decode time.

### Supported Input Formats
- Plain text (typed/pasted into text area)
- `.doc` and `.docx` file upload (text extracted server-side via mammoth.js)

---

## 3. Architecture: Two-Step Pipeline

The core processing pipeline is two distinct steps, separated by a human review gate.

```
[Transcript Input]
        │
        ▼
┌─────────────────────────────┐
│  STEP 1: LLM Extraction     │  Claude API call with tool_use structured output
│  Unstructured → Structured  │  Extracts clinical facts + confidence levels
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│  HUMAN REVIEW GATE          │  User verifies / corrects extracted facts
│  Review & Edit Facts        │  All fields editable; MED/LOW visually flagged
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│  STEP 2: SOP Matching       │  Deterministic code — no LLM call
│  Facts → Recommendations    │  Each rule evaluated against verified facts
└─────────────────────────────┘
        │
        ▼
[Recommendations Output + JSON]
```

### Why Deterministic for Step 2
SOP rules are structured IF/THEN logic, not natural language reasoning. Encoding them in code rather than an LLM prompt means:
- Rules cannot be hallucinated or misapplied
- Every recommendation can be traced to the specific rule and evidence that triggered it
- Adding or modifying rules requires editing a data file, not re-engineering a prompt
- The logic is fully auditable for compliance/clinical review purposes

> **Future iteration:** For cases where facts are ambiguous after human review, an optional LLM reasoning step could be introduced to provide a recommendation with justification. This is out of scope for v1.

---

## 4. SOP Rules Data Structure

SOPs are hardcoded as a structured array of rule objects. Each rule has a defined category, the fact fields it depends on, trigger logic, resulting status, required action, and display severity.

### Categories
- `General` — applies to all patients regardless of case type
- `Joint` — applies to joint replacement cases (hip, knee, etc.)
- `Bariatric` — applies to weight-loss surgery cases

### Status Values and Operational Meaning

| Status | Meaning |
|---|---|
| `Action Required` | Patient can proceed but must complete a specific prerequisite task |
| `Hold` | Case paused until patient completes an action |
| `Deferred` | Case paused for a fixed time period (e.g., 3 months for smoking) |
| `Ineligible` | Patient does not meet criteria; must complete a prerequisite program first |
| `Review` | A clinical expert must review this specific flag before case advances |
| `High Complexity` | Specialist involvement required; case may still proceed with consult |
| `Revision` | Patient requires a different care pathway (follow-up surgery, not new case) |

### Severity Levels (for UI color coding)

| Severity | Color | Statuses |
|---|---|---|
| `critical` | Red | `Ineligible`, `Deferred` |
| `high` | Orange | `High Complexity` |
| `warning` | Yellow | `Action Required`, `Hold`, `Review` |
| `info` | Blue | `Revision` |
| `clear` | Green | No rules triggered |

### Rule Set (v1 — 8 rules)

```typescript
const SOP_RULES = [
  {
    id: "general_dental",
    category: "General",
    applies_to: ["bariatric", "joint", "general"],
    finding: "Dental visit > 6 months ago OR pending dental work",
    fact_fields: ["dental_visit_within_6_months", "has_pending_dental_work"],
    status: "Action Required",
    action: "Instruct patient to complete dental clearance before Consultation.",
    severity: "warning"
  },
  {
    id: "joint_smoking",
    category: "Joint",
    applies_to: ["joint"],
    finding: "Active smoker or quit within last 3 months",
    fact_fields: ["smoking_status"],
    status: "Deferred",
    action: "Refer to Smoking Cessation education/support; pause case for 3 months.",
    severity: "critical"
  },
  {
    id: "joint_no_pt",
    category: "Joint",
    applies_to: ["joint"],
    finding: "No attempt at physical therapy or structured exercise",
    fact_fields: ["has_attempted_pt_or_exercise"],
    status: "Ineligible",
    action: "Refer to 6–12 week conservative physical therapy trial.",
    severity: "critical"
  },
  {
    id: "joint_hba1c",
    category: "Joint",
    applies_to: ["joint"],
    finding: "HbA1c > 7.0",
    fact_fields: ["hba1c_value"],
    status: "Review",
    action: "Flag for Clinical MD Review for glucose optimization.",
    severity: "warning"
  },
  {
    id: "joint_opioid",
    category: "Joint",
    applies_to: ["joint"],
    finding: "Daily opioid use for more than 3 months",
    fact_fields: ["daily_opioid_use_over_3_months"],
    status: "High Complexity",
    action: "Flag for Anesthesia \"High Risk\" Consult.",
    severity: "high"
  },
  {
    id: "bariatric_revision",
    category: "Bariatric",
    applies_to: ["bariatric"],
    finding: "History of prior weight-loss surgery",
    fact_fields: ["has_prior_weight_loss_surgery"],
    status: "Revision",
    action: "Flag as Revision Case; requires specialized surgical review.",
    severity: "info"
  },
  {
    id: "bariatric_no_egd",
    category: "Bariatric",
    applies_to: ["bariatric"],
    finding: "No endoscopy (EGD) in the last 3 months",
    fact_fields: ["has_recent_endoscopy"],
    status: "Action Required",
    action: "Instruct patient to schedule EGD after Consultation.",
    severity: "warning"
  },
  {
    id: "bariatric_no_rd",
    category: "Bariatric",
    applies_to: ["bariatric"],
    finding: "No Registered Dietician identified",
    fact_fields: ["has_registered_dietician"],
    status: "Hold",
    action: "Provide in-network RD list; patient must confirm RD before referral.",
    severity: "warning"
  }
]
```

### SOP Matching Logic (Step 2)

The matcher evaluates each rule that applies to the patient's case type and classifies the result into one of three buckets:

| Outcome | Condition | Behavior |
|---|---|---|
| **Triggered** | All fact fields cited by the rule have non-null values that satisfy the trigger condition | Rule appears in `triggered_rules` with severity, status, action, and evidence |
| **Cleared** | All fact fields have non-null values and the trigger condition is not met | Rule is omitted from output entirely (success = silent) |
| **Unverified** | One or more fact fields referenced by the rule is `null` (i.e., "not mentioned" or unknown) | Rule appears in `unverified_flags` with an explanation and the current value(s) and confidence |

**Trigger condition reference:**

| Rule | Trigger |
|---|---|
| `general_dental` | `dental_visit_within_6_months === false` OR `has_pending_dental_work === true` |
| `joint_smoking` | `smoking_status === "active"` OR `smoking_status === "quit_within_3_months"` |
| `joint_no_pt` | `has_attempted_pt_or_exercise === false` |
| `joint_hba1c` | `hba1c_value > 7.0` (numeric; derived in matcher, not in extraction) |
| `joint_opioid` | `daily_opioid_use_over_3_months === true` |
| `bariatric_revision` | `has_prior_weight_loss_surgery === true` |
| `bariatric_no_egd` | `has_recent_endoscopy === false` |
| `bariatric_no_rd` | `has_registered_dietician === false` |

**Example:**
- Rule `joint_no_pt` with `has_attempted_pt_or_exercise === null` → goes to `unverified_flags` (reason: "Patient mentioned two gym sessions, but no formal PT program was discussed — clinician must verify whether this qualifies.")
- Rule `joint_hba1c` with `hba1c_value === 7.4` → triggers (derived: `7.4 > 7.0`)
- Rule `joint_hba1c` with `hba1c_value === null` → goes to `unverified_flags`
- Rule `bariatric_no_rd` with `has_registered_dietician === false` → triggers
- Rule `bariatric_no_rd` with `has_registered_dietician === true` → cleared (omitted from output)

This three-way classification is the single most important piece of the matcher. It ensures that missing data is never treated as "good news" and is never treated as "bad news" — it is always surfaced for human follow-up.

---

## 5. JSON Schemas

### 5a. Extraction Output Schema (Step 1 — LLM output)

Every extracted field includes a `value`, a `confidence` level, and an `evidence` string quoting the relevant text from the transcript.

```typescript
type Confidence = "high" | "medium" | "low";
type CaseType = "bariatric" | "joint" | "general" | "unknown";
type SmokingStatus = "active" | "quit_within_3_months" | "quit_over_3_months" | "never";

interface ExtractedFact<T> {
  value: T | null;         // null = not mentioned / unknown
  confidence: Confidence;
  evidence: string | null; // direct quote or paraphrase from transcript; null if not mentioned
}

interface ExtractionOutput {
  patient_name: ExtractedFact<string>;
  case_type: ExtractedFact<CaseType>;
  reason_for_care: ExtractedFact<string>;

  facts: {
    // General
    dental_visit_within_6_months: ExtractedFact<boolean>;
    has_pending_dental_work: ExtractedFact<boolean>;

    // Joint
    smoking_status: ExtractedFact<SmokingStatus>;
    has_attempted_pt_or_exercise: ExtractedFact<boolean>;
    hba1c_value: ExtractedFact<number>;
    daily_opioid_use_over_3_months: ExtractedFact<boolean>;

    // Bariatric
    has_prior_weight_loss_surgery: ExtractedFact<boolean>;
    prior_surgery_type: ExtractedFact<string>;
    has_recent_endoscopy: ExtractedFact<boolean>;
    has_registered_dietician: ExtractedFact<boolean>;
  };

  additional_notes: string[]; // Clinically relevant findings not covered by any SOP rule
}
```

**Schema simplifications from prior drafts:**
- `hba1c_above_7` removed — the matcher derives `> 7.0` from `hba1c_value`. Asking the LLM to both report a number and a boolean derived from that number creates redundancy and contradiction risk.
- `is_active_smoker` + `quit_smoking_within_3_months` collapsed into a single `smoking_status` enum. The LLM picks one value; the matcher maps `"active"` and `"quit_within_3_months"` to a trigger.
- `has_attempted_formal_pt` → `has_attempted_pt_or_exercise`. The SOP text is "attempt at PT or exercise," and the rule is cleared by any reasonable conservative-management effort. The field name now matches the rule semantics.

**Confidence definitions for the extraction prompt:**
- `high` — Explicitly stated in the transcript with no ambiguity
- `medium` — Implied or inferred with reasonable confidence, or stated with some ambiguity (e.g., vague timing such as "last spring," "a while ago," "earlier this year," or a month mentioned without a year)
- `low` — Not mentioned, weakly implied, or contradictory information present

**Temporal ambiguity guidance (in the extraction prompt):**
When a fact depends on a time window (e.g., "within the last 6 months," "within the last 3 months"), if the transcript states a month or season without a year, or uses vague relative language ("a while back," "recently"), the model should:
1. Still make its best inference about the value
2. Set confidence to `medium` (not `high`)
3. Include the ambiguous phrase verbatim in `evidence`

The downstream UI highlights `medium` confidence for human verification — this is exactly the failure mode that temporal ambiguity creates, and it's the reviewer's job to resolve it.

### 5b. Final Output Schema (Step 2 — deterministic matching output)

```typescript
interface TriggeredRule {
  rule_id: string;
  category: string;
  finding: string;
  status: string;
  action: string;
  severity: "critical" | "high" | "warning" | "info";
  evidence: string | null; // from the extraction evidence field
}

interface UnverifiedFlag {
  rule_id: string;
  reason: string;        // why this rule could not be definitively evaluated
  extracted_value: string;
  confidence: Confidence;
}

interface RoutingOutput {
  patient_name: string | null;
  case_type: string;
  reason_for_care: string | null;
  triggered_rules: TriggeredRule[];
  unverified_flags: UnverifiedFlag[];  // rules that could not be evaluated due to missing/uncertain data
  additional_notes: string[];
}
```

---

## 6. UI Design

### Layout

Layout evolves across phases:

- **Phase 1 (Input):** Single **centered panel** occupying the middle of the viewport. Clean, focused, "one job" feel. No split panel yet.
- **Phase 2 (Review) and Phase 3 (Recommendations):** **Split panel**, full-height:
  - **Left panel:** Transcript (read-only, always visible for reference)
  - **Right panel:** Phase-dependent content (review or recommendations)

This avoids a confusing two-column empty shell at the start and makes the transition from "submit" to "work with the output" feel deliberate.

### Three-Phase Stepper

```
[ 1. Input Transcript ] ──► [ 2. Review Extraction ] ──► [ 3. Recommendations ]
```

The stepper is visible across all phases. Steps behind the current step are clickable for **backward navigation** (e.g., from Phase 3 → Phase 2 to correct a fact and re-run matching). Steps ahead of the current step are not clickable.

#### Phase 1 — Input (centered layout)
- Toggle between **Text Entry** (large textarea) and **File Upload** (.doc / .docx)
- **"Try a sample transcript" dropdown** above the input area, offering three pre-loaded sample transcripts (Sarah T — Bariatric, Bob L — Joint/Hip, Maria V — Joint/Knee). Selecting one populates the textarea. Makes the demo self-contained for reviewers who don't have sample data on hand.
- **Privacy disclaimer** rendered directly below the input area (textarea or file upload zone), visibly styled as an informational notice:
  > ⚠️ **Do not paste or upload any real patient data.** This demo uses synthetic data only and does not provide the privacy or security protections required for protected health information (PHI). For demo purposes only.
- "Process Transcript" button triggers Step 1 LLM call
- Loading state during API call: spinner with label "Extracting clinical facts…"

#### Phase 2 — Review Extraction (split panel)
- Left: transcript (read-only)
- Right:
  - Patient name and inferred case type displayed at top
  - Extracted facts table: each row shows field label | extracted value (editable) | confidence badge
  - **All fields are always editable** — confidence badges are a visual cue to direct the reviewer's attention, not a permission gate.
  - **Confidence badges (visual highlighting only):**
    - `HIGH` — green badge; row has no highlight
    - `MED` — yellow badge; row has a soft yellow background to draw attention
    - `LOW` — red badge; row has a soft red background to draw attention
  - Editable field types:
    - Boolean facts → segmented control: `Yes` / `No` / `Not Mentioned`
    - Enum facts (smoking_status) → dropdown: `Active` / `Quit within 3 months` / `Quit over 3 months` / `Never` / `Not Mentioned`
    - Numeric facts (HbA1c) → number input with "Not Mentioned" checkbox
    - String facts (case type, patient name) → text input
  - Additional notes section (read-only, informational)
  - "Apply SOP Rules →" button triggers Step 2 deterministic matching

#### Phase 3 — Recommendations (split panel)
- Left: transcript (read-only)
- Right:
  - Patient header: name, case type, reason for care
  - **Triggered rules** displayed as cards, sorted by severity (critical first):
    - Severity color bar on left edge of card
    - Status badge (e.g., "DEFERRED", "HIGH COMPLEXITY")
    - Finding label and required action
    - Evidence quote from transcript (collapsible)
  - **Unverified flags** section: rules that could not be evaluated due to missing data, prompting care team to follow up
  - **Additional clinical notes** section
  - **"No flags triggered"** green state if clean
  - Action bar at bottom:
    - "View JSON" button → modal overlay with formatted JSON + copy button
    - "Copy Summary" button → copies human-readable output to clipboard
    - "← Back to Review" button → returns to Phase 2 (preserves edits; user can correct a fact and re-run matching)
    - "Process New Transcript" button → resets to Phase 1

### Copy Functionality
Both the formatted summary (Phase 3 output) and the raw JSON (modal) include a copy-to-clipboard icon button.

---

## 7. LLM Prompt Strategy

### Step 1 — Extraction Prompt Design Principles
- System prompt establishes role: clinical data extraction assistant, not a decision-maker
- Instructs the model to extract only what is explicitly or clearly implicitly stated — never infer beyond what the text supports
- Defines confidence levels explicitly with examples
- **Temporal ambiguity guidance:** when dates/timing are vague (no year, relative phrases), the model should infer but drop confidence to `medium` and include the vague phrase in `evidence`
- Instructs model to use `null` for any fact not mentioned in the transcript (never assume)
- Instructs model to collect non-SOP clinical observations into `additional_notes`
- **Structured output via Claude `tool_use`:** the model is forced to call a single tool (`record_extraction`) whose `input_schema` is the JSON Schema equivalent of `ExtractionOutput`. `tool_choice` is set to that tool by name. Server-side, the tool `input` is validated against the Zod schema before returning to the client.
- No SOP rules are included in the extraction prompt — extraction and rule application are kept strictly separate

### Step 2 — No LLM Prompt
Step 2 is deterministic code. SOP matching logic is implemented as a pure function:
```
(ExtractionOutput, SOP_RULES[]) → RoutingOutput
```

---

## 8. Error Handling

| Scenario | Handling |
|---|---|
| LLM API call fails / times out | Display error message in right panel; offer retry; do not advance stepper |
| Document parsing fails (.doc/.docx) | Display specific error: "Could not parse document — try pasting text directly" |
| LLM returns malformed tool input | Zod schema validation fails; display error with retry option |
| Transcript too short / irrelevant | LLM extraction returns low confidence on all fields; human review catches this |
| No SOP rules triggered | Display clean "No flags" green state — this is a valid, expected outcome |

---

## 9. Deployment

- **Platform:** Vercel (free tier)
- **Source:** GitHub repository, main branch auto-deploys
- **Environment variables:** `ANTHROPIC_API_KEY` stored in Vercel project settings (never in code)
- **No database:** No data persistence between sessions. Transcripts and outputs exist only in browser memory for the duration of the session.
- **Branches:** Feature work done on branches, merged to `main` via PRs

---

## 9a. Sample Transcripts — Immutable

The three pre-loaded sample transcripts in `/lib/sample-transcripts.ts` (Sarah T, Bob L, Maria V) **must not be modified** under any circumstances. They are the fixed evaluation set used to validate the end-to-end pipeline against the expected outputs documented in `plan.md` ("Sample Transcript Expected Outputs").

If a sample appears to "defeat" a planned test case (for example, the Bob L transcript currently states "He has not undergone any formal physical therapy program," which would cause the LLM to extract `has_attempted_pt_or_exercise: false` rather than `null` — clearing `joint_no_pt` instead of producing the intended unverified flag), the resolution is to update the expected output in `plan.md` and document the behavior, **never** to edit the transcript text.

---

## 9b. Planned Enhancement — LLM Evidence in Unverified Flags

`UnverifiedFlag` currently surfaces a deterministic `reason` string built from field labels (e.g., "physical therapy or exercise history not mentioned in transcript"). The richer **`evidence`** quote captured by the LLM during extraction (e.g., "I went to the gym a couple of times") is dropped on the floor when the field's `value` is `null`.

**Enhancement (post-v1):** Carry the LLM `evidence` quote through to `UnverifiedFlag` — either appended to `reason` or as a new optional `evidence: string | null` field — so the reviewer sees *why* the LLM was uncertain, not just *that* it was uncertain. This materially improves the human-review loop for ambiguous facts (which is the entire purpose of the unverified bucket) without changing the deterministic matching behavior.

Tracked here so it's not lost; not in scope for the current phase.

---

## 10. Out of Scope for v1

- Data persistence / session history
- Multi-user authentication
- Additional document formats beyond .doc / .docx
- Additional SOP rule sets beyond the 8 defined rules
- LLM-assisted reasoning for ambiguous SOP cases (post-human-review)
- Mobile-optimized layout
- Audit logging
- HIPAA-grade PHI protection (this is a prototype; the in-app disclaimer makes the limitation explicit to users)
