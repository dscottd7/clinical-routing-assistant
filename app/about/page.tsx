import Link from "next/link";

export const metadata = {
  title: "About · Clinical Routing Assistant",
  description:
    "How the Clinical Routing Assistant uses an LLM for extraction and a deterministic matcher for SOP rule evaluation.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to app
          </Link>
          <span className="text-sm font-medium">About this demo</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <article className="space-y-12 text-sm leading-relaxed">
          <section id="pitch">
            <h1 className="mb-3 text-3xl font-semibold tracking-tight">
              Clinical Routing Assistant
            </h1>
            <p className="text-lg text-muted-foreground">
              A demo that turns an unstructured patient-intake transcript into a
              traceable, reviewable set of clinical-routing recommendations — using an
              LLM only for what it&apos;s good at, and nothing more.
            </p>
          </section>

          <section id="problem">
            <h2 className="mb-3 text-xl font-semibold">The problem</h2>
            <p>
              Clinical intake calls produce long, loosely structured notes. A nurse or
              coordinator then has to read each one, decide which Standard Operating
              Procedures apply, and route the case. It&apos;s slow, inconsistent, and
              each call mixes signal with noise. The prompt for this project: can an AI
              assistant help surface the right SOP actions without pretending to
              replace clinical judgment?
            </p>
          </section>

          <section id="pipeline">
            <h2 className="mb-3 text-xl font-semibold">How it works</h2>
            <p className="mb-4">
              Three phases, visible to the user as the stepper across the top:
            </p>
            <ol className="space-y-3">
              <li className="rounded-md border bg-card p-4">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Phase 1 — Input
                </div>
                Paste or upload a transcript. The user gets a clean, centered input
                panel with sample transcripts pre-loaded for demos.
              </li>
              <li className="rounded-md border bg-card p-4">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Phase 2 — Extraction review
                </div>
                A single LLM call (Claude Sonnet 4.6) pulls a structured{" "}
                <code className="rounded bg-muted px-1">ExtractionOutput</code> from
                the transcript. Every field is editable; rows the model was less sure
                about are highlighted amber/red.
              </li>
              <li className="rounded-md border bg-card p-4">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Phase 3 — SOP matching
                </div>
                A pure, deterministic TypeScript function evaluates each SOP rule
                against the (now-verified) facts and produces a routing output —
                triggered rules, unverified flags, and additional notes.
              </li>
            </ol>
          </section>

          <section id="design">
            <h2 className="mb-3 text-xl font-semibold">
              Why only one LLM call
            </h2>
            <p className="mb-3">
              The core design choice: the LLM extracts, the rules engine decides.
              Nothing else.
            </p>
            <p className="mb-3">
              SOP rules are the kind of thing a compliance team needs to audit. If a
              rule fires, you want to be able to point at the exact line of code that
              fired it. Asking an LLM to &ldquo;recommend a routing&rdquo; would fold
              extraction, interpretation, and policy into a single opaque step. That
              might work more often than not — but &ldquo;more often than not&rdquo;
              isn&apos;t the bar for a clinical workflow.
            </p>
            <p>
              By contrast, a handwritten matcher is trivially auditable, testable, and
              deterministic — the same facts always produce the same recommendations.
              The only probabilistic surface is the extraction step, where the human
              reviewer sees every value before rules run.
            </p>
          </section>

          <section id="facts">
            <h2 className="mb-3 text-xl font-semibold">The fact model</h2>
            <p className="mb-3">
              Every extracted value carries three pieces of information, not one:
            </p>
            <pre className="overflow-x-auto rounded-md border bg-muted/50 p-3 font-mono text-xs">
{`interface ExtractedFact<T> {
  value: T | null;           // null = "not mentioned"
  confidence: "high" | "medium" | "low";
  evidence: string | null;   // direct quote from the transcript
}`}
            </pre>
            <p className="mt-3">
              Two things make this shape load-bearing. First,{" "}
              <strong>&ldquo;not mentioned&rdquo; is a first-class value</strong> — a
              missing data point is different from a false one, and the rule engine
              treats them differently (see below). Second, every value is paired with
              its source quote, so the reviewer can verify the model in one glance.
            </p>
          </section>

          <section id="rule-example">
            <h2 className="mb-3 text-xl font-semibold">A rule, end to end</h2>
            <p className="mb-3">
              SOPs are hand-coded as data. Here&apos;s the smoking rule for joint
              cases:
            </p>
            <pre className="overflow-x-auto rounded-md border bg-muted/50 p-3 font-mono text-xs">
{`{
  id: "joint_smoking",
  category: "Joint",
  applies_to: ["joint"],
  finding: "Active smoker or quit within last 3 months",
  fact_fields: ["smoking_status"],
  status: "Deferred",
  action: "Refer to Smoking Cessation education/support; pause case for 3 months.",
  severity: "critical"
}`}
            </pre>
            <p className="mt-3">
              The matcher reads <code className="rounded bg-muted px-1">fact_fields</code>,
              pulls the matching values off the extraction, and decides: trigger, clear,
              or flag as unverified. No LLM sees this rule.
            </p>
          </section>

          <section id="classification">
            <h2 className="mb-3 text-xl font-semibold">
              Triggered, Cleared, Unverified
            </h2>
            <p className="mb-3">Every rule lands in exactly one bucket:</p>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Outcome</th>
                    <th className="px-3 py-2 text-left font-semibold">Condition</th>
                    <th className="px-3 py-2 text-left font-semibold">Behavior</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="px-3 py-2 font-medium">Triggered</td>
                    <td className="px-3 py-2">
                      All referenced fact fields are non-null <em>and</em> the rule
                      condition is satisfied
                    </td>
                    <td className="px-3 py-2">Shown as a severity-colored rule card</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">Cleared</td>
                    <td className="px-3 py-2">
                      All fields non-null <em>and</em> condition not satisfied
                    </td>
                    <td className="px-3 py-2">Omitted from output (success = silent)</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">Unverified</td>
                    <td className="px-3 py-2">
                      One or more referenced field is null
                    </td>
                    <td className="px-3 py-2">
                      Shown as a &ldquo;Needs follow-up&rdquo; flag with the reason and
                      the extracted value
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3">
              Unverified is the interesting bucket — it means the transcript didn&apos;t
              contain the information the rule needs. The reviewer either fills it in
              (and re-runs matching) or escalates to the care team.
            </p>
          </section>

          <section id="review">
            <h2 className="mb-3 text-xl font-semibold">
              Confidence &amp; the review workflow
            </h2>
            <p className="mb-3">
              Medium-confidence rows are highlighted amber, low-confidence rows red.
              The reviewer can edit any value, and the moment they do, that fact&apos;s
              confidence is promoted to <code className="rounded bg-muted px-1">high</code>{" "}
              and the highlight clears. The evidence quote is preserved so the
              correction stays traceable.
            </p>
            <p>
              Clicking &ldquo;Apply SOP Rules&rdquo; runs the matcher against the edited
              extraction. Clicking &ldquo;Back to Review&rdquo; from the
              recommendations screen returns to Phase 2 with edits intact — so a user
              who discovers a misextracted fact mid-review can correct it and re-run
              without starting over.
            </p>
          </section>

          <section id="limitations">
            <h2 className="mb-3 text-xl font-semibold">Limitations &amp; privacy</h2>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>
                Demo only — synthetic transcripts. Do not paste real PHI.
              </li>
              <li>
                No audit log, no persistence, no authentication. Every session starts
                empty.
              </li>
              <li>
                The SOP rule set is a hand-picked subset, not an exhaustive policy. A
                real deployment would version and govern the rule list separately.
              </li>
              <li>
                Extraction accuracy is bounded by the underlying model. The reviewer
                is the final check.
              </li>
            </ul>
          </section>

          <section id="stack">
            <h2 className="mb-3 text-xl font-semibold">Tech stack</h2>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Next.js 16 App Router, React 19, TypeScript strict mode</li>
              <li>Claude Sonnet 4.6 via the Anthropic SDK for extraction</li>
              <li>Zod for LLM output validation</li>
              <li>mammoth.js for .doc/.docx ingest</li>
              <li>Tailwind CSS v4 + base-ui / shadcn-style primitives</li>
              <li>Jest 30 for integration and unit tests (81 passing)</li>
              <li>Deployed on Vercel</li>
            </ul>
          </section>

          <section id="back" className="pt-4">
            <Link
              href="/"
              className="inline-flex items-center rounded-md border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              ← Back to app
            </Link>
          </section>
        </article>
      </main>
    </div>
  );
}
