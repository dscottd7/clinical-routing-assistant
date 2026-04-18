# Clinical Routing Assistant — Development Plan

> **Status:** In progress
> **Last updated:** 2026-04-16
> **Reference:** See `spec.md` for full architectural and design decisions.
> Update this file as phases are completed and decisions evolve.

### Deployment
- **Production URL:** https://clinical-routing-assistant.vercel.app/
- **Hosting:** Vercel (auto-deploys on push to `main`)
- **Env var:** `ANTHROPIC_API_KEY` set in Vercel for Production, Preview, and Development

---

## Development Principles

### Branching Strategy
- `main` is always deployable — no direct commits to `main`
- Create a new branch for every phase or discrete unit of work
- Branch naming convention:
  - `feature/<short-description>` — new functionality
  - `fix/<short-description>` — bug fixes
  - `chore/<short-description>` — config, tooling, dependency updates
  - `refactor/<short-description>` — code restructuring without behavior change
- Example: `feature/sop-matching-engine`, `fix/docx-parse-error`

### Commit Messages
- Use imperative tense: "Add SOP rule engine" not "Added SOP rule engine"
- Be specific: "Add confidence badge component with high/med/low variants" not "update UI"
- One logical change per commit — avoid mega-commits that mix unrelated changes

### Pull Requests
- Every branch merges to `main` via a PR — no exceptions
- PR title should clearly describe what the branch does
- PR description should include:
  - What was built / changed
  - How to test it locally
  - Screenshots for any UI changes
  - Any open questions or follow-up work
- Review the diff yourself before opening the PR — catch obvious issues first
- Merge strategy: Squash and merge to keep `main` history clean

### Testing
- Write tests alongside the code, not after — each phase includes a testing step
- Pure functions (SOP matching engine, schema validators) get unit tests
- API routes get integration tests with mocked LLM responses
- UI phases get manual smoke testing against all 3 sample transcripts before merging
- All tests must pass before a PR is merged
- Test framework: Jest + React Testing Library

### Environment & Secrets
- Never commit API keys or secrets — use `.env.local` locally (gitignored)
- All secrets go in Vercel environment variables for production
- `.env.example` file documents required environment variables (no values)

### Documentation
- Update `spec.md` when any architectural or design decision changes
- **Update `plan.md` as part of every commit** — before committing any phase work, tick off the task checkboxes that shipped in that commit, update the phase-completion tracker, and note any deviations from the original plan (e.g., a chosen HTTP status code, an added sub-task). Treat it as a build step, not an afterthought: a commit that advances the work without updating `plan.md` is incomplete.
- Add inline comments for non-obvious logic, especially in the SOP matching engine and LLM prompts

### Code Quality
- TypeScript strict mode — no `any` types without explicit justification
- ESLint + Prettier enforced — run before every commit
- No dead code merged to `main`

---

## Phases

---

### Phase 0 — Project Scaffolding
**Branch:** `feature/project-scaffolding`
**Goal:** Establish a working, deployable Next.js skeleton with all dependencies installed and configuration in place before any feature work begins.

#### Tasks
- [x] Initialize Next.js app with TypeScript and App Router (`npx create-next-app@latest`)
- [x] Configure ESLint and Prettier
- [x] Install dependencies:
  - `@anthropic-ai/sdk` — Claude API client
  - `mammoth` — .doc / .docx text extraction
  - `zod` — runtime schema validation for LLM output
  - `jest`, `@testing-library/react`, `@testing-library/jest-dom` — testing
- [x] Set up directory structure (see below)
- [x] Create `.env.example` with `ANTHROPIC_API_KEY=` (no value)
- [x] Create `.env.local` locally with real API key (gitignored)
- [x] Confirm dev server runs locally (`npm run dev`)
- [x] Connect repo to Vercel, confirm auto-deploy from `main` works
- [x] Confirm environment variable is set in Vercel project settings
- [x] Open PR → review → merge to `main`

#### Directory Structure
```
/app
  /api
    /process-transcript    ← Step 1: LLM extraction API route
    /upload-document       ← Document parsing API route
  /page.tsx                ← Main application page
  /layout.tsx
/components
  /stepper                 ← Phase stepper component
  /input                   ← Phase 1: transcript input panel
  /extraction-review       ← Phase 2: fact review and edit panel
  /recommendations         ← Phase 3: SOP output panel
  /ui                      ← Shared: badges, cards, modals, copy button
/lib
  /sop-rules.ts            ← SOP rules data array
  /sop-matcher.ts          ← Deterministic matching function
  /schemas.ts              ← Zod schemas for extraction and routing output
  /types.ts                ← TypeScript type definitions
  /sample-transcripts.ts   ← Pre-loaded sample transcripts (Sarah T, Bob L, Maria V)
/tests
  /unit
    /sop-matcher.test.ts
    /schemas.test.ts
  /integration
    /process-transcript.test.ts
```

---

### Phase 1 — Types, Schemas, and SOP Data Layer
**Branch:** `feature/data-layer`
**Goal:** Define all TypeScript types, Zod validation schemas, the SOP rules array, and the three-way matching function before any API or UI work. This is the contract everything else is built against.

#### Tasks
- [x] Implement TypeScript types in `/lib/types.ts`:
  - `Confidence`, `CaseType`, `SmokingStatus`, `ExtractedFact<T>`, `ExtractionOutput`
  - `TriggeredRule`, `UnverifiedFlag`, `RoutingOutput`
  - `SopRule` (the shape of each rule in the rules array)
- [x] Implement Zod schemas in `/lib/schemas.ts` that mirror the TypeScript types (used to validate LLM tool input at runtime)
- [x] Implement SOP rules array in `/lib/sop-rules.ts` (all 8 rules from spec Section 4, using the simplified fact fields: `smoking_status` enum, `has_attempted_pt_or_exercise`, `hba1c_value` only — no derived boolean)
- [x] Implement deterministic matching function in `/lib/sop-matcher.ts`:
  - Input: `ExtractionOutput`, `SopRule[]`
  - Output: `RoutingOutput`
  - Filters rules by case type (`null` and `"unknown"` both apply all rules)
  - **Three-way classification per rule:**
    - Any referenced fact field is `null` → push to `unverified_flags` with a human-readable `reason`
    - All fields non-null AND trigger condition satisfied → push to `triggered_rules`
    - All fields non-null AND trigger condition NOT satisfied → omit (silent clear)
  - Derive `hba1c > 7.0` from `hba1c_value` inside the matcher (not from a separate boolean)
  - Map `smoking_status` values (`"active"`, `"quit_within_3_months"`) to trigger; other values clear the rule
  - Triggered rules sorted by severity (critical → high → warning → info)
- [x] Populate `/lib/sample-transcripts.ts` with 3 pre-loaded sample transcripts (Sarah T, Bob L, Maria V), each exported with a display label and body text
- [x] Write unit tests in `/tests/unit/sop-matcher.test.ts`:
  - Test each of the 8 rules individually with triggered / cleared / unverified cases (24 scenarios minimum)
  - Test that category filtering works (Joint rules don't fire for Bariatric cases and vice versa)
  - Test multi-rule scenarios (patient triggers 2+ rules simultaneously)
  - Test `null` values produce `unverified_flags` not false negatives
  - Test `smoking_status` enum mapping: `active` triggers, `quit_within_3_months` triggers, `quit_over_3_months` clears, `never` clears, `null` → unverified
  - Test HbA1c edge cases: `7.0` does not trigger (strict `>`), `7.01` triggers, `null` → unverified
  - Test clean patient (no rules triggered) produces empty `triggered_rules` and empty `unverified_flags`
  - Test `case_type` of `null` and `"unknown"` apply all rules
- [x] Write unit tests in `/tests/unit/schemas.test.ts`:
  - Valid extraction output passes schema validation
  - Missing required fields are caught
  - Wrong types are caught (e.g., string where enum expected)
  - `smoking_status` rejects values not in the enum
- [x] All tests pass (65 tests across 3 suites)
- [x] Set up Jest config (`jest.config.ts`, `jest.setup.js`) with `next/jest`, jsdom, and `@/*` path alias; requires Node 22 (see `.nvmrc`)
- [ ] Open PR → review → merge to `main`

---

### Phase 2 — LLM Extraction API Route (Step 1)
**Branch:** `feature/extraction-api`
**Goal:** Build the server-side API route that takes a transcript string, calls the Claude API with `tool_use` structured output, validates the response, and returns an `ExtractionOutput` object.

#### Tasks
- [x] Create `/app/api/process-transcript/route.ts`
- [x] Set up Anthropic client using `ANTHROPIC_API_KEY` from environment
- [x] Pin model to `claude-sonnet-4-5`
- [x] Design extraction system prompt (see spec Section 7):
  - Role: clinical data extraction assistant only — not a decision-maker
  - Instructions: extract only what is stated, use `null` for anything not mentioned, never assume
  - Confidence level definitions with examples
  - **Temporal ambiguity guidance:** vague dates/timing → still infer but drop confidence to `medium` and include the vague phrase in `evidence`
  - **Bare-month convention:** a past month name with no year is assumed to be the most recent occurrence (within the prior 12 months), at `medium` confidence
  - Additional notes instructions for non-SOP clinical findings
- [x] Define `record_extraction` tool whose `input_schema` mirrors the `ExtractionOutput` JSON structure
- [x] Call Claude with `tool_choice: { type: "tool", name: "record_extraction" }` to force structured output
- [x] Parse tool input from the response
- [x] Validate response against Zod schema — reject malformed output
- [x] Return validated `ExtractionOutput` JSON (or error with appropriate HTTP status)
- [x] Implement error handling (typed `ExtractionError` codes mapped to HTTP status: 400 / 422 / 500 / 502):
  - API key missing / invalid → 500 `missing_api_key`
  - Claude API timeout or failure → 502 `api_error`
  - Model returned a non-tool-use stop reason → 502 `no_tool_use`
  - Schema validation failure → 422 `schema_validation_failed`
- [x] Write integration tests in `/tests/integration/process-transcript.test.ts`:
  - Mock Claude API tool_use responses (module-mock `@anthropic-ai/sdk`)
  - Test successful extraction returns valid schema
  - Test schema validation failure returns 422
  - Test API failure returns a clear error (502 in practice; spec plan said 500 — 502 is semantically correct for upstream failures)
- [x] Manual test: ran all 3 sample transcripts (Sarah T, Bob L, Maria V) against the live dev server; outputs match expected results below
- [x] All tests pass (74 tests across 4 suites)
- [x] Open PR → review → merge to `main` (PR [#4](https://github.com/dscottd7/clinical-routing-assistant/pull/4), merged 2026-04-18)

---

### Phase 3 — Document Upload API Route
**Branch:** `feature/document-upload`
**Goal:** Build the server-side API route that accepts a .doc or .docx file upload, extracts the plain text using mammoth.js, and returns the text string for use by the extraction route.

#### Tasks
- [ ] Create `/app/api/upload-document/route.ts`
- [ ] Handle multipart form data file upload in Next.js App Router
- [ ] Use mammoth.js to extract plain text from .doc / .docx
- [ ] Return extracted text string (or error)
- [ ] Implement error handling:
  - Unsupported file type
  - Empty or corrupted file
  - Parsing failure
- [ ] Manual test: upload a .docx version of each sample transcript, verify clean text extraction
- [ ] Open PR → review → merge to `main`

---

### Phase 4 — Frontend Shell and Phase 1 (Input, centered layout)
**Branch:** `feature/ui-shell-and-input`
**Goal:** Build the overall application shell, the stepper, and the Phase 1 centered input panel with text entry, file upload, pre-loaded sample transcripts, and the privacy disclaimer.

#### Tasks
- [ ] Build application shell in `/app/page.tsx`:
  - Persistent top-of-page `<Stepper>` across all phases
  - Layout switches based on phase:
    - Phase 1 → single centered panel (max-width container, vertically + horizontally centered)
    - Phase 2 and Phase 3 → split panel (left: transcript read-only, right: phase content)
- [ ] Build `<Stepper>` component with 3 phases: Input → Review → Recommendations
  - Active, complete, and pending visual states
  - Backward navigation: completed steps are clickable (future-step clicks are ignored)
- [ ] Build Phase 1 input panel (`/components/input/`):
  - **"Try a sample transcript" dropdown** above the input area, sourced from `/lib/sample-transcripts.ts`; selection populates the textarea
  - Tab toggle: "Paste Text" / "Upload File"
  - Large textarea for text entry
  - File upload input (accept `.doc`, `.docx` only)
  - **Privacy disclaimer** rendered directly below the input area with the exact copy from spec Section 6 (⚠️ do not use real patient data; synthetic data only; demo does not ensure PHI privacy)
  - "Process Transcript" primary button
  - Loading state: spinner with "Extracting clinical facts…" label
  - Error state: clear inline error message with retry
- [ ] Wire up text submission to `/api/process-transcript`
- [ ] Wire up file upload to `/api/upload-document` → then to `/api/process-transcript`
- [ ] On success: advance stepper to Phase 2, pass `ExtractionOutput` to review panel; the original transcript text is stored in shared state so the left panel can display it in Phase 2/3
- [ ] Manual smoke test: load each of the 3 pre-loaded samples, submit via both text and (for at least one) file upload
- [ ] Open PR (include screenshots of centered Phase 1 + sample dropdown + disclaimer) → review → merge to `main`

---

### Phase 5 — Frontend Phase 2 (Extraction Review)
**Branch:** `feature/ui-extraction-review`
**Goal:** Build the human review panel where extracted facts are displayed with confidence indicators and always-editable fields, before SOP matching runs.

#### Tasks
- [ ] Build Phase 2 review panel (`/components/extraction-review/`):
  - Left panel: transcript (read-only)
  - Right panel:
    - Patient header: name + inferred case type
    - Extracted facts table:
      - Each row: field label | editable value control | confidence badge
      - **All fields are always editable** — confidence governs visual highlighting only, not edit permission
      - Boolean fields: `Yes` / `No` / `Not Mentioned` segmented control
      - `smoking_status` enum: dropdown with `Active` / `Quit within 3 months` / `Quit over 3 months` / `Never` / `Not Mentioned`
      - Numeric fields (HbA1c): number input with a "Not Mentioned" checkbox (checking it sets value to `null`)
      - String fields (name, case type): text input (case type is a dropdown: bariatric / joint / general / unknown)
    - Confidence badge component (`HIGH` green / `MED` yellow / `LOW` red)
    - `MED` and `LOW` rows get a soft background highlight (yellow / red) to direct attention
    - Additional clinical notes section (read-only)
- [ ] "Apply SOP Rules →" button triggers deterministic matching client-side (no API call — matching logic runs in the browser using the data layer from Phase 1)
- [ ] On click: run `sop-matcher` against current (possibly edited) extraction output, advance to Phase 3
- [ ] Shared state model keeps the (possibly edited) `ExtractionOutput` persistent so backward navigation from Phase 3 preserves the user's edits
- [ ] Manual smoke test: verify all 3 sample patients display correct extracted facts, verify editing every field type works, verify MED/LOW rows are visually highlighted
- [ ] Open PR (include screenshots) → review → merge to `main`

---

### Phase 6 — Frontend Phase 3 (Recommendations)
**Branch:** `feature/ui-recommendations`
**Goal:** Build the recommendations output panel with triggered rule cards, unverified flags, JSON modal, backward navigation, and copy functionality.

#### Tasks
- [ ] Build Phase 3 recommendations panel (`/components/recommendations/`):
  - Left panel: transcript (read-only)
  - Right panel:
    - Patient summary header: name, case type, reason for care
    - Triggered rules cards, sorted by severity (critical first):
      - Left severity color bar (red / orange / yellow / blue)
      - Status badge (e.g., "DEFERRED", "HIGH COMPLEXITY")
      - Finding label + required action text
      - Collapsible evidence quote from transcript
    - Unverified flags section (rules that couldn't be evaluated — prompts care team follow-up, with reason and extracted value)
    - Additional clinical notes section
    - "No flags triggered" green empty state
- [ ] Action bar:
  - "View JSON" button → modal overlay with formatted JSON + copy icon
  - "Copy Summary" button → copies human-readable output to clipboard
  - **"← Back to Review" button** → returns to Phase 2 with edits preserved, allowing the user to correct a fact and re-run matching
  - "Process New Transcript" button → resets all state to Phase 1
- [ ] Build JSON modal (`/components/ui/json-modal.tsx`):
  - Full `RoutingOutput` JSON, syntax-highlighted
  - Copy to clipboard button
  - Close button / click-outside dismissal
- [ ] Copy-to-clipboard utility (summary text format + raw JSON)
- [ ] Manual smoke test against all 3 sample transcripts — verify correct rules triggered, correct severity display, JSON modal contents match expected schema, backward nav preserves edits
- [ ] Open PR (include screenshots) → review → merge to `main`

---

### Phase 7 — QA, Edge Cases, and Polish
**Branch:** `feature/qa-and-polish`
**Goal:** End-to-end testing, edge case hardening, and final UI polish before the demo.

#### Tasks
- [ ] End-to-end test all 3 sample transcripts — verify the full pipeline produces correct outputs:
  - Sarah T: Revision + Hold + Action Required (bariatric); dental "May" should be `medium` confidence
  - Bob L: High Complexity (opioids) + PT unverified flag ("two sessions at the gym" is ambiguous)
  - Maria V: Deferred (smoking) + Review (HbA1c 7.4); formal PT clears `joint_no_pt`
- [ ] Test edge cases:
  - Empty textarea submission
  - Very short / irrelevant transcript
  - Transcript with no SOP-triggerable findings (expect clean green state)
  - File upload of wrong type (expect clear error)
  - Corrupted / empty .docx (expect clear error)
  - Edit a fact in Phase 2, go to Phase 3, click "Back to Review," confirm edits persist
  - Edit HbA1c from 7.4 → 6.9 in Phase 2, apply rules, confirm `joint_hba1c` no longer triggers
- [ ] Test error recovery: LLM API call failure should allow retry without losing transcript
- [ ] Verify loading states appear and disappear correctly
- [ ] Verify stepper accurately reflects current phase and backward navigation works
- [ ] Verify JSON modal opens/closes, copy works for both summary and JSON
- [ ] Verify "Process New Transcript" fully resets state
- [ ] Verify privacy disclaimer is visible on Phase 1 across all layouts/viewports
- [ ] Cross-browser check (Chrome, Firefox, Safari)
- [ ] Fix any issues found
- [ ] Open PR → review → merge to `main`

---

### Phase 8 — Production Deployment Verification
**Branch:** `chore/production-verification`
**Goal:** Confirm the production Vercel deployment works end-to-end, environment variables are set correctly, and the app is ready to share.

#### Tasks
- [ ] Confirm `ANTHROPIC_API_KEY` is set in Vercel project settings
- [ ] Trigger a fresh deploy from `main`
- [ ] Test all 3 sample transcripts against the production URL
- [ ] Confirm file upload works in production (not just local)
- [ ] Confirm JSON modal and copy functionality work in production
- [ ] Confirm backward nav (Phase 3 → Phase 2) works in production
- [ ] Note the production URL for sharing
- [ ] Open PR → merge → done

---

## Phase Completion Tracker

| Phase | Description | Status |
|---|---|---|
| 0 | Project scaffolding | ✅ Complete |
| 1 | Types, schemas, SOP data layer | ✅ Complete |
| 2 | LLM extraction API route | ✅ Complete |
| 3 | Document upload API route | ⬜ Not started |
| 4 | Frontend shell + Phase 1 input (centered + samples + disclaimer) | ⬜ Not started |
| 5 | Frontend Phase 2 extraction review | ⬜ Not started |
| 6 | Frontend Phase 3 recommendations | ⬜ Not started |
| 7 | QA and edge cases | ⬜ Not started |
| 8 | Production deployment verification | ⬜ Not started |

---

## Planned Enhancements (Post-v1)

- **Surface LLM evidence in `UnverifiedFlag`.** Today the matcher builds a deterministic `reason` string from field labels but discards the LLM `evidence` quote when a fact's `value` is `null`. Carrying that quote through (appended to `reason`, or as a new optional `evidence` field) would let reviewers see *why* the LLM was uncertain — e.g., "I went to the gym a couple of times" alongside the `joint_no_pt` flag. See spec Section 9b.

---

## Sample Transcript Expected Outputs (Reference)

> ⚠️ **The sample transcripts in `/lib/sample-transcripts.ts` must not be modified.** They are the fixed evaluation set. If a sample appears to defeat a planned test case, update the expected output below — never edit the transcript. See spec Section 9a.

Use these to validate correctness throughout development. The same three samples are pre-loaded into the Phase 1 dropdown.

### Sarah T — Bariatric
| Rule | Finding | Outcome |
|---|---|---|
| `bariatric_revision` | Lap band surgery 2017 | Triggered — Revision |
| `bariatric_no_rd` | No confirmed RD | Triggered — Hold |
| `bariatric_no_egd` | No EGD mentioned | Triggered — Action Required |
| `general_dental` | Cleaning done "in May" — ambiguous timing | Medium confidence in extraction; reviewer confirms |

### Bob L — Joint (Hip)
| Rule | Finding | Outcome |
|---|---|---|
| `joint_opioid` | Oxycodone daily for 2 years | Triggered — High Complexity |
| `joint_no_pt` | "Two sessions at the gym" — ambiguous | `null` at extraction → Unverified Flag |

### Maria V — Joint (Knee)
| Rule | Finding | Outcome |
|---|---|---|
| `joint_smoking` | Active smoker, ~half pack/day (`smoking_status: "active"`) | Triggered — Deferred |
| `joint_hba1c` | HbA1c 7.4 | Triggered — Review |
| `joint_no_pt` | 12 weeks formal PT at ABC Physical Therapy | Cleared (omitted from output) |
