import Link from "next/link";

export const metadata = {
  title: "Strategic Brief · Clinical Routing Assistant",
  description:
    "Strategic brief: why the Clinical Routing Assistant uses an LLM for extraction and a deterministic matcher for SOP rule evaluation.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to app
          </Link>
          <span className="text-sm font-medium">Strategic Brief</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <article className="space-y-10 text-sm leading-relaxed">
          <section id="pitch">
            <h1 className="mb-3 text-3xl font-semibold tracking-tight">
              Clinical Routing Assistant
            </h1>
            <p className="text-lg text-muted-foreground">
              A demo that converts an unstructured patient-intake transcript into a
              traceable, reviewable set of clinical-routing recommendations — using
              an LLM only for what LLMs are good at, and nothing more.
            </p>
          </section>

          <section id="problem">
            <h2 className="mb-3 text-xl font-semibold">The problem</h2>
            <p className="mb-3">
              Clinical navigation teams spend meaningful time turning long intake
              calls into structured routing decisions. The work is high-leverage but
              mechanical: pull a small set of clinical facts out of free text,
              cross-reference them against an SOP, and act. At current volumes it&apos;s
              tractable; at scale it&apos;s a bottleneck, and any slip (a missed HbA1c, a
              misread smoking status) has clinical consequences downstream.
            </p>
            <p>
              The question this brief answers is whether an AI assistant can compress
              that loop without replacing clinical judgment. The answer: yes, if —
              and only if — the AI is scoped narrowly enough that a human reviewer
              can meaningfully audit it.
            </p>
          </section>

          <section id="approach">
            <h2 className="mb-3 text-xl font-semibold">Approach</h2>
            <p>
              The pipeline has three phases, visible to the user as a stepper at the
              top of the app. <strong>Phase 1</strong> takes a transcript (pasted
              text or <code className="rounded bg-muted px-1">.doc</code>/<code className="rounded bg-muted px-1">.docx</code>{" "}
              upload). <strong>Phase 2</strong> calls Claude once to extract a
              structured <code className="rounded bg-muted px-1">ExtractionOutput</code> —
              every SOP-relevant fact, plus confidence and a verbatim evidence quote —
              and presents it for human review in a split panel alongside the source
              transcript. <strong>Phase 3</strong> runs a deterministic TypeScript
              matcher that evaluates each SOP rule against the verified facts and
              produces the routing: triggered rules, unverified flags, and additional
              notes, plus a combined JSON export for downstream systems.
            </p>
          </section>

          <section id="central">
            <h2 className="mb-3 text-xl font-semibold">
              Central design decision: one LLM call, deterministic rules, human in the loop
            </h2>
            <p className="mb-3">
              Every design decision in this prototype traces back to a single choice:{" "}
              <strong>
                the LLM extracts, the rules engine decides, and a human sits between
                them.
              </strong>
            </p>
            <p className="mb-3">
              The alternative — a single end-to-end prompt that takes a transcript
              and returns &ldquo;here&apos;s what the care team should do&rdquo; — is
              faster to build and demos well on cherry-picked inputs. It was rejected
              for three reasons:
            </p>
            <ol className="mb-3 list-decimal space-y-2 pl-5">
              <li>
                <strong>Auditability.</strong> SOPs are policy. A compliance or
                clinical-operations reviewer needs to point at the exact logic that
                fired a rule. A prompt is not that. Hand-coded rules are.
              </li>
              <li>
                <strong>Hallucination containment.</strong> If the LLM is only
                extracting facts that are supported by evidence quotes from the
                transcript, a reviewer can catch a fabrication in seconds. If the
                LLM is also interpreting policy, they can&apos;t — the interpretive
                step hides the extraction error.
              </li>
              <li>
                <strong>Change control.</strong> SOPs evolve. Editing a rule file,
                versioning it, and writing a unit test is a normal engineering
                workflow. Re-engineering a prompt that bundles extraction and policy
                is not.
              </li>
            </ol>
            <p>
              The tradeoff is that the matcher has to be written and maintained by
              hand, and the SOP is expressed as structured data rather than English.
              That&apos;s a small, one-time engineering effort. The benefits —
              auditability, predictability, straightforward rule evolution — compound
              with every rule, every audit, and every model upgrade.
            </p>
          </section>

          <section id="decisions">
            <h2 className="mb-3 text-xl font-semibold">
              Three design decisions worth defending
            </h2>

            <h3 className="mb-2 mt-4 text-base font-semibold">
              1. &ldquo;Not mentioned&rdquo; is a first-class value
            </h3>
            <p className="mb-3">
              Every extracted fact has a three-part shape: a value (which can be{" "}
              <code className="rounded bg-muted px-1">null</code>), a confidence
              level, and an evidence quote. <code className="rounded bg-muted px-1">null</code>{" "}
              explicitly means &ldquo;the transcript did not address this.&rdquo; The
              matcher treats <code className="rounded bg-muted px-1">null</code>{" "}
              differently from <code className="rounded bg-muted px-1">false</code> —
              it flags the rule as <strong>unverified</strong> rather than clearing or
              triggering it.
            </p>
            <p>
              It&apos;s the single most important piece of the matcher. The failure
              mode for a naive system is silently clearing a rule because the absence
              of a &ldquo;no&rdquo; was read as a &ldquo;yes, we&apos;re fine.&rdquo;
              Surfacing missing data explicitly — as a &ldquo;Needs follow-up&rdquo;
              flag the care team has to close — makes the system conservative in
              exactly the direction that matters clinically.
            </p>

            <h3 className="mb-2 mt-6 text-base font-semibold">
              2. Confidence is a visual cue, not a gate
            </h3>
            <p className="mb-3">
              Medium- and low-confidence rows are highlighted (amber / red) on the
              review screen. Every field is still fully editable regardless of
              confidence. Editing a value promotes its confidence to high so the
              highlight clears and the reviewer&apos;s attention moves on.
            </p>
            <p>
              This deliberately resists the pattern of &ldquo;block the user until
              they confirm&rdquo; workflows. Confidence directs attention; it
              doesn&apos;t create friction. The reviewer is trusted to catch things;
              the UI just helps them look in the right places first.
            </p>

            <h3 className="mb-2 mt-6 text-base font-semibold">
              3. Evidence is preserved through the entire pipeline
            </h3>
            <p>
              The LLM captures a verbatim quote for each fact. That quote rides along
              into Phase 2 (visible under the field) and into Phase 3 — under each
              triggered rule <em>and</em> under each unverified flag, so the reviewer
              can see why the LLM was uncertain, not just that it was. A reviewer
              never has to toggle back to the transcript to check the model&apos;s
              work; the receipts are attached to the claim.
            </p>
          </section>

          <section id="output">
            <h2 className="mb-3 text-xl font-semibold">What the care team receives</h2>
            <p className="mb-3">Phase 3 produces two artifacts:</p>
            <ul className="mb-3 list-disc space-y-1 pl-5">
              <li>
                A <strong>human-readable summary</strong> that can be copied straight
                into a chart note.
              </li>
              <li>
                A <strong>validated JSON export</strong> containing both the extracted
                facts (including the &ldquo;not mentioned&rdquo; ones) and the routing
                output. One payload answers both halves of the requirement —{" "}
                <em>what did the model extract, and what should happen next</em> —
                without collapsing them into a single flat shape.
              </li>
            </ul>
            <p>
              The two halves are kept schema-distinct because they have different
              owners. The extraction schema is owned by the model and the reviewer;
              the routing schema is owned by the rules engine and the care team. A
              downstream integration can consume either one independently.
            </p>
          </section>

          <section id="metrics">
            <h2 className="mb-3 text-xl font-semibold">
              How we&apos;d measure this in production
            </h2>
            <p className="mb-3">
              If this were to move towards a production application, we&apos;d want
              to measure:
            </p>
            <ul className="mb-3 list-disc space-y-2 pl-5">
              <li>
                <strong>Extraction precision/recall per fact</strong>, measured
                against reviewer edits. If{" "}
                <code className="rounded bg-muted px-1">smoking_status</code> flips
                from <code className="rounded bg-muted px-1">never</code> to{" "}
                <code className="rounded bg-muted px-1">active</code> during review
                20% of the time, the prompt or model needs work — not the rule.
              </li>
              <li>
                <strong>Reviewer time per case</strong>, baseline vs. tool-assisted.
                The entire value proposition is throughput.
              </li>
              <li>
                <strong>Unverified-flag close rate and time-to-close</strong>, because
                that bucket is the care team&apos;s real inbox.
              </li>
              <li>
                <strong>Rule-firing distribution</strong>, to catch drift. If{" "}
                <code className="rounded bg-muted px-1">joint_no_pt</code> suddenly
                fires on 60% of joint cases, something upstream changed.
              </li>
              <li>
                <strong>Post-hoc clinical agreement</strong>, sampled. Does a
                clinician reviewing a random 5% of routings agree with the tool?
                That&apos;s the ground truth the other metrics approximate.
              </li>
            </ul>
            <p>
              None of these require new infrastructure the tool doesn&apos;t already
              have — every routing decision is already a structured object with the
              evidence attached.
            </p>
          </section>

          <section id="roadmap">
            <h2 className="mb-3 text-xl font-semibold">Scope and roadmap</h2>
            <p className="mb-3">
              This is a v1 prototype. The explicit choices about what{" "}
              <em>not</em> to build:
            </p>
            <ul className="mb-3 list-disc space-y-2 pl-5">
              <li>
                <strong>No persistence, auth, or audit log.</strong> A production
                deployment needs all three; they&apos;re orthogonal to the
                extraction-and-routing thesis and would triple the scope.
              </li>
              <li>
                <strong>No PHI protections.</strong> The app displays an explicit
                disclaimer. This is a demo, not a HIPAA-ready system.
              </li>
              <li>
                <strong>Eight SOP rules, hand-coded.</strong> A real deployment would
                want a separate governance surface for rule changes, reviewed and
                versioned independently of the app.
              </li>
              <li>
                <strong>No LLM-assisted reasoning for ambiguous cases.</strong> If the
                extraction is uncertain, today&apos;s behavior is to flag and
                escalate. A future iteration could add an optional LLM reasoning step —{" "}
                <em>after</em> human review — to suggest a resolution with
                justification. Deliberately out of scope for v1 so the deterministic
                story stays clean.
              </li>
            </ul>
            <p className="mb-2">Next things to build, in order:</p>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                <strong>Reviewer-edit telemetry.</strong> Passive logging of which
                fields get edited most often — the fastest path to a better extraction
                prompt.
              </li>
              <li>
                <strong>Optional post-review LLM reasoning step</strong> for cases
                with multiple unverified flags, producing a draft escalation note for
                the care team to edit.
              </li>
            </ol>
          </section>

          <section id="stack">
            <h2 className="mb-3 text-xl font-semibold">Tech stack</h2>
            <p className="text-muted-foreground">
              Next.js 16 App Router, React 19, TypeScript strict, Claude Sonnet 4.6
              via the Anthropic SDK, Zod for LLM output validation, mammoth.js for
              document ingest, Tailwind CSS v4, Jest 30 for unit and integration
              tests. Deployed on Vercel.
            </p>
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
