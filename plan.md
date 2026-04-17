# Clinical Routing Assistant — Development Plan

> **Status:** In progress  
> **Last updated:** 2026-04-16  
> **Reference:** See `spec.md` for full architectural and design decisions.  
> Update this file as phases are completed and decisions evolve.

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
- Update `plan.md` to mark phases complete as work is finished
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
- [ ] Initialize Next.js app with TypeScript and App Router (`npx create-next-app@latest`)
- [ ] Configure ESLint and Prettier
- [ ] Install dependencies:
  - `@anthropic-ai/sdk` — Claude API client
  - `mammoth` — .doc / .docx text extraction
  - `zod` — runtime schema validation for LLM output
  - `jest`, `@testing-library/react`, `@testing-library/jest-dom` — testing
- [ ] Set up directory structure (see below)
- [ ] Create `.env.example` with `ANTHROPIC_API_KEY=` (no value)
- [ ] Create `.env.local` locally with real API key (gitignored)
- [ ] Confirm dev server runs locally (`npm run dev`)
- [ ] Connect repo to Vercel, confirm auto-deploy from `main` works
- [ ] Confirm environment variable is set in Vercel project settings
- [ ] Open PR → review → merge to `main`

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
**Goal:** Define all TypeScript types, Zod validation schemas, and the SOP rules array before any API or UI work. This is the contract everything else is built against.

#### Tasks
- [ ] Implement TypeScript types in `/lib/types.ts`:
  - `Confidence`, `CaseType`, `ExtractedFact<T>`, `ExtractionOutput`
  - `TriggeredRule`, `UnverifiedFlag`, `RoutingOutput`
  - `SopRule` (the shape of each rule in the rules array)
- [ ] Implement Zod schemas in `/lib/schemas.ts` that mirror the TypeScript types (used to validate LLM JSON output at runtime)
- [ ] Implement SOP rules array in `/lib/sop-rules.ts` (all 8 rules from spec Section 4)
- [ ] Implement deterministic matching function in `/lib/sop-matcher.ts`:
  - Input: `ExtractionOutput`, `SopRule[]`
  - Output: `RoutingOutput`
  - Filters rules by case type, evaluates each applicable rule, handles null/uncertain values as `unverified_flags`
- [ ] Write unit tests in `/tests/unit/sop-matcher.test.ts`:
  - Test each of the 8 rules individually
  - Test that category filtering works (Joint rules don't fire for Bariatric cases)
  - Test multi-rule scenarios (patient triggers 2+ rules simultaneously)
  - Test null/missing values produce `unverified_flags` not false negatives
  - Test clean patient (no rules triggered) produces empty `triggered_rules`
- [ ] Write unit tests in `/tests/unit/schemas.test.ts`:
  - Valid extraction output passes schema validation
  - Missing required fields are caught
  - Wrong types are caught
- [ ] All tests pass
- [ ] Open PR → review → merge to `main`

---

### Phase 2 — LLM Extraction API Route (Step 1)
**Branch:** `feature/extraction-api`  
**Goal:** Build the server-side API route that takes a transcript string, calls the Claude API with structured output, validates the response, and returns an `ExtractionOutput` object.

#### Tasks
- [ ] Create `/app/api/process-transcript/route.ts`
- [ ] Set up Anthropic client using `ANTHROPIC_API_KEY` from environment
- [ ] Design extraction system prompt (see spec Section 7):
  - Role: clinical data extraction assistant only — not a decision-maker
  - Instructions: extract only what is stated, use `null` for anything not mentioned, never assume
  - Confidence level definitions with examples
  - Additional notes instructions for non-SOP clinical findings
- [ ] Implement Claude API call with JSON output mode / structured output
- [ ] Validate response against Zod schema — reject malformed output
- [ ] Return validated `ExtractionOutput` JSON (or error with appropriate HTTP status)
- [ ] Implement error handling:
  - API key missing / invalid
  - Claude API timeout or failure
  - Schema validation failure
- [ ] Write integration tests in `/tests/integration/process-transcript.test.ts`:
  - Mock Claude API responses
  - Test successful extraction returns valid schema
  - Test schema validation failure returns 422
  - Test API failure returns 500 with error message
- [ ] Manual test: run all 3 sample transcripts through the route, verify extracted output is correct
- [ ] All tests pass
- [ ] Open PR → review → merge to `main`

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

### Phase 4 — Frontend Shell and Phase 1 (Input)
**Branch:** `feature/ui-shell-and-input`  
**Goal:** Build the overall application layout (split panel + stepper) and the Phase 1 input panel with text entry and file upload.

#### Tasks
- [ ] Build split-panel layout in `/app/page.tsx`:
  - Left panel: always-visible transcript area (becomes read-only after submission)
  - Right panel: phase-controlled content area
- [ ] Build `<Stepper>` component with 3 phases: Input → Review → Recommendations
  - Active, complete, and pending visual states
- [ ] Build Phase 1 input panel (`/components/input/`):
  - Tab toggle: "Paste Text" / "Upload File"
  - Large textarea for text entry
  - File upload input (accept .doc, .docx only)
  - "Process Transcript" primary button
  - Loading state: spinner with "Extracting clinical facts…" label
  - Error state: clear inline error message with retry
- [ ] Wire up text submission to `/api/process-transcript`
- [ ] Wire up file upload to `/api/upload-document` → then to `/api/process-transcript`
- [ ] On success: advance stepper to Phase 2, pass `ExtractionOutput` to review panel
- [ ] Manual smoke test: submit each sample transcript via both text and file upload
- [ ] Open PR (include screenshots) → review → merge to `main`

---

### Phase 5 — Frontend Phase 2 (Extraction Review)
**Branch:** `feature/ui-extraction-review`  
**Goal:** Build the human review panel where extracted facts are displayed with confidence indicators and editable fields, before SOP matching runs.

#### Tasks
- [ ] Build Phase 2 review panel (`/components/extraction-review/`):
  - Patient header: name + inferred case type
  - Extracted facts table:
    - Each row: field label | value | confidence badge | edit control
    - Boolean fields: `Yes` / `No` / `Not Mentioned` toggle
    - Numeric fields (HbA1c): number input
    - String fields (name, case type): text input
  - Confidence badge component (`HIGH` green / `MED` yellow / `LOW` red)
  - Medium and low confidence rows are visually highlighted as needing attention
  - Additional clinical notes section (read-only)
- [ ] "Apply SOP Rules →" button triggers deterministic matching client-side (no API call — matching logic runs in the browser using the data layer from Phase 1)
- [ ] On click: run `sop-matcher` against current (possibly edited) extraction output, advance to Phase 3
- [ ] Manual smoke test: verify all 3 sample patients display correct extracted facts, verify editing fields works
- [ ] Open PR (include screenshots) → review → merge to `main`

---

### Phase 6 — Frontend Phase 3 (Recommendations)
**Branch:** `feature/ui-recommendations`  
**Goal:** Build the recommendations output panel with triggered rule cards, unverified flags, JSON modal, and copy functionality.

#### Tasks
- [ ] Build Phase 3 recommendations panel (`/components/recommendations/`):
  - Patient summary header: name, case type, reason for care
  - Triggered rules cards, sorted by severity (critical first):
    - Left severity color bar (red / orange / yellow / blue)
    - Status badge (e.g., "DEFERRED", "HIGH COMPLEXITY")
    - Finding label + required action text
    - Collapsible evidence quote from transcript
  - Unverified flags section (rules that couldn't be evaluated — prompts care team follow-up)
  - Additional clinical notes section
  - "No flags triggered" green empty state
- [ ] Action bar:
  - "View JSON" button → modal overlay with formatted JSON + copy icon
  - "Copy Summary" button → copies human-readable output to clipboard
  - "Process New Transcript" button → resets all state to Phase 1
- [ ] Build JSON modal (`/components/ui/json-modal.tsx`):
  - Full `RoutingOutput` JSON, syntax-highlighted
  - Copy to clipboard button
  - Close button / click-outside dismissal
- [ ] Copy-to-clipboard utility (summary text format + raw JSON)
- [ ] Manual smoke test against all 3 sample transcripts — verify correct rules triggered, correct severity display, JSON modal contents match expected schema
- [ ] Open PR (include screenshots) → review → merge to `main`

---

### Phase 7 — QA, Edge Cases, and Polish
**Branch:** `feature/qa-and-polish`  
**Goal:** End-to-end testing, edge case hardening, and final UI polish before the demo.

#### Tasks
- [ ] End-to-end test all 3 sample transcripts — verify the full pipeline produces correct outputs:
  - Sarah T: Revision + Hold + Action Required (bariatric)
  - Bob L: High Complexity (opioids) + ambiguous PT flag
  - Maria V: Deferred (smoking) + Review (HbA1c 7.4)
- [ ] Test edge cases:
  - Empty textarea submission
  - Very short / irrelevant transcript
  - Transcript with no SOP-triggerable findings (expect clean green state)
  - File upload of wrong type (expect clear error)
  - Corrupted / empty .docx (expect clear error)
- [ ] Test error recovery: LLM API call failure should allow retry without losing transcript
- [ ] Verify loading states appear and disappear correctly
- [ ] Verify stepper accurately reflects current phase
- [ ] Verify JSON modal opens/closes, copy works for both summary and JSON
- [ ] Verify "Process New Transcript" fully resets state
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
- [ ] Note the production URL for sharing
- [ ] Open PR → merge → done

---

## Phase Completion Tracker

| Phase | Description | Status |
|---|---|---|
| 0 | Project scaffolding | ⬜ Not started |
| 1 | Types, schemas, SOP data layer | ⬜ Not started |
| 2 | LLM extraction API route | ⬜ Not started |
| 3 | Document upload API route | ⬜ Not started |
| 4 | Frontend shell + Phase 1 input | ⬜ Not started |
| 5 | Frontend Phase 2 extraction review | ⬜ Not started |
| 6 | Frontend Phase 3 recommendations | ⬜ Not started |
| 7 | QA and edge cases | ⬜ Not started |
| 8 | Production deployment verification | ⬜ Not started |

---

## Sample Transcript Expected Outputs (Reference)

Use these to validate correctness throughout development.

### Sarah T — Bariatric
| Rule | Finding | Status |
|---|---|---|
| `bariatric_revision` | Lap band surgery 2017 | Revision |
| `bariatric_no_rd` | No confirmed RD | Hold |
| `bariatric_no_egd` | No EGD mentioned | Action Required |
| `general_dental` | Cleaning done in May — confirm < 6 months | Verify timing |

### Bob L — Joint (Hip)
| Rule | Finding | Status |
|---|---|---|
| `joint_opioid` | Oxycodone daily for 2 years | High Complexity |
| `joint_no_pt` | "Two sessions at the gym" — ambiguous | Unverified Flag |

### Maria V — Joint (Knee)
| Rule | Finding | Status |
|---|---|---|
| `joint_smoking` | Active smoker, ~half pack/day | Deferred |
| `joint_hba1c` | HbA1c 7.4 | Review |
| `joint_no_pt` | 12 weeks formal PT at ABC Physical Therapy | ✓ Clears rule |
