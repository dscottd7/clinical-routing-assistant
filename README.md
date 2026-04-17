# Clinical Routing Assistant

A web application that helps clinical care teams process raw patient transcripts (phone calls, text chats) by extracting key clinical facts, allowing a human reviewer to verify and correct them, and applying deterministic Standard Operating Procedure (SOP) rules to generate recommended next steps.

> **Status:** Prototype / demo. Not production software. Does **not** provide PHI privacy protections. Use synthetic data only.

See [`spec.md`](./spec.md) for the architectural reference and [`plan.md`](./plan.md) for the phased development plan.

---

## Tech Stack

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript (strict)
- **Styling:** Tailwind CSS 4 + shadcn/ui
- **LLM:** Anthropic Claude (`claude-sonnet-4-5`) via `tool_use` structured output
- **Document parsing:** mammoth.js (.doc / .docx)
- **Runtime validation:** Zod
- **Testing:** Jest + React Testing Library
- **Hosting:** Vercel (auto-deploys from `main`)

---

## Local Development

### Prerequisites
- Node.js 22 (use `nvm use` — a `.nvmrc` is pinned)
- An Anthropic API key — get one at https://console.anthropic.com

### Setup
```bash
nvm use
npm install
cp .env.example .env.local   # then paste your ANTHROPIC_API_KEY into .env.local
npm run dev
```

Open http://localhost:3000.

### Scripts
| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run Jest test suite |

---

## Project Structure

```
/app                       Next.js App Router routes and API handlers
/components                React UI components (grouped by phase + shared ui)
/lib                       Types, schemas, SOP rules, matcher, sample transcripts
/tests                     Unit and integration tests
```

See [`plan.md`](./plan.md) for the full directory layout and phase-by-phase task list.
