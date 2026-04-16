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
- **Transparency over automation:** Confidence levels are shown for all extracted data. Medium/low confidence fields are flagged for human review.
- **Conservative on ambiguity:** When a fact cannot be clearly extracted, the system surfaces it as uncertain rather than making a silent assumption.
- **Deterministic rule enforcement:** SOP rules are applied in code, not by LLM inference, so the logic is auditable, predictable, and not subject to hallucination.

---

## 2. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js (App Router) | React-based with built-in serverless API routes; API keys stay server-side; deploys directly from GitHub to Vercel |
| Frontend | React (via Next.js) | Component-based UI, TypeScript preferred |
| LLM API | Anthropic Claude API | Structured output / JSON mode support; production-proven for clinical AI use cases |
| Document Parsing | mammoth.js | Reliable .doc / .docx text extraction; server-side in API route |
| SOP Matching | Deterministic code | Rules are lookups, not reasoning problems; auditable, no hallucination risk |
| Hosting | Vercel | Free tier, deploys from GitHub, environment variables for API key management |
| Version Control | GitHub | PRs and branches for all feature development |

### LLM Orchestration
Direct Claude API calls via the Anthropic SDK — no LangChain or orchestration framework. The chain has only two sequential steps and the added abstraction is not warranted. If the pipeline grows in complexity, LangChain or a similar framework can be introduced.

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
│  STEP 1: LLM Extraction     │  Claude API call with structured JSON output
│  Unstructured → Structured  │  Extracts clinical facts + confidence levels
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│  HUMAN REVIEW GATE          │  User verifies / corrects extracted facts
│  Review & Edit Facts        │  Medium/low confidence fields are highlighted
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
    fact_fields: ["is_active_smoker", "quit_smoking_within_3_months"],
    status: "Deferred",
    action: "Refer to Smoking Cessation education/support; pause case for 3 months.",
    severity: "critical"
  },
  {
    id: "joint_no_pt",
    category: "Joint",
    applies_to: ["joint"],
    finding: "No attempt at physical therapy or exercise",
    fact_fields: ["has_attempted_formal_pt"],
    status: "Ineligible",
    action: "Refer to 6–12 week conservative physical therapy trial.",
    severity: "critical"
  },
  {
    id: "joint_hba1c",
    category: "Joint",
    applies_to: ["joint"],
    finding: "HbA1c > 7.0",
    fact_fields: ["hba1c_value", "hba1c_above_7"],
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

---

## 5. JSON Schemas

### 5a. Extraction Output Schema (Step 1 — LLM output)

Every extracted field includes a `value`, a `confidence` level, and an `evidence` string quoting the relevant text from the transcript.

```typescript
type Confidence = "high" | "medium" | "low";
type CaseType = "bariatric" | "joint" | "general" | "unknown";

interface ExtractedFact<T> {
  value: T | null;       // null = not mentioned / unknown
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
    is_active_smoker: ExtractedFact<boolean>;
    quit_smoking_within_3_months: ExtractedFact<boolean>;
    has_attempted_formal_pt: ExtractedFact<boolean>;
    hba1c_value: ExtractedFact<number>;
    hba1c_above_7: ExtractedFact<boolean>;
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

**Confidence definitions for the extraction prompt:**
- `high` — Explicitly stated in the transcript with no ambiguity
- `medium` — Implied or inferred with reasonable confidence, or stated with some ambiguity (e.g., vague timing)
- `low` — Not mentioned, weakly implied, or contradictory information present

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
Split-panel, full-height layout:
- **Left panel:** Transcript input (fixed, always visible for reference after submission)
- **Right panel:** Phase-dependent content controlled by a top stepper

### Three-Phase Stepper

```
[ 1. Input Transcript ] ──► [ 2. Review Extraction ] ──► [ 3. Recommendations ]
```

#### Phase 1 — Input
- Toggle between **Text Entry** (large textarea) and **File Upload** (.doc / .docx)
- "Process Transcript" button triggers Step 1 LLM call
- Loading state during API call: spinner with label "Extracting clinical facts…"

#### Phase 2 — Review Extraction
- Patient name and inferred case type displayed at top
- Extracted facts table: each row shows field label | extracted value | confidence badge
- **Confidence badges:**
  - `HIGH` — green, display only
  - `MED` — yellow, field is editable and highlighted
  - `LOW` — red, field is editable and highlighted (includes "not mentioned" values)
- Editable field types:
  - Boolean facts → toggle: `Yes` / `No` / `Not Mentioned`
  - Numeric facts (HbA1c) → number input
  - String facts (case type, patient name) → text input
- Additional notes section (read-only, informational)
- "Apply SOP Rules →" button triggers Step 2 deterministic matching

#### Phase 3 — Recommendations
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
  - "Process New Transcript" button → resets to Phase 1

### Copy Functionality
Both the formatted summary (Phase 3 output) and the raw JSON (modal) include a copy-to-clipboard icon button.

---

## 7. LLM Prompt Strategy

### Step 1 — Extraction Prompt Design Principles
- System prompt establishes role: clinical data extraction assistant, not a decision-maker
- Instructs the model to extract only what is explicitly or clearly implicitly stated — never infer beyond what the text supports
- Defines confidence levels explicitly with examples
- Instructs model to use `null` for any fact not mentioned in the transcript (never assume)
- Instructs model to collect non-SOP clinical observations into `additional_notes`
- Uses Claude's structured output / JSON mode to guarantee schema-compliant output
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
| LLM returns malformed JSON | Catch schema validation error; display error with retry option |
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

## 10. Out of Scope for v1

- Data persistence / session history
- Multi-user authentication
- Additional document formats beyond .doc / .docx
- Additional SOP rule sets beyond the 8 defined rules
- LLM-assisted reasoning for ambiguous SOP cases (post-human-review)
- Mobile-optimized layout
- Audit logging
