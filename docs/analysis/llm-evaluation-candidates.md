# LLM Evaluation Candidates

**Purpose:** This document is an input to a future evaluation task, not the
evaluation itself. Choosing Magpie Weaver's production LLM is a genuinely
critical decision, but it's independent of every other item in
`tech-stack.md` — nothing else in the stack depends on which model is
chosen, only on the fact that *a* model sits behind the OpenAI-compatible
provider abstraction (HLD §12.8). Proper evaluation (real prompts against
Weaver's actual generation pipeline, continuity-lint behaviour, side-by-side
prose comparison) is beyond the scope of project initialisation. What
belongs at this stage is narrowing the field to a short list worth actually
testing.

**Selection criteria:** best narrative/chat quality obtainable for the
lowest token cost and the highest speed — in that order of importance, since
this is a creative-writing product first. All five candidates are available
through **AWS Bedrock**, matching the confirmed production LLM provider
(Architecture doc, `tech-stack.md` §4).

**A note on pricing volatility:** this market moves fast — several of these
models had meaningful price or version changes within the last few months
alone. Every figure below should be re-verified against the live Bedrock
pricing page immediately before running the actual evaluation, not trusted
as durable.

---

## Candidates

### 1. Claude Haiku 4.5 (Anthropic)
- **Pricing:** ~$0.80–$1.00 / $4.00–$5.00 per million input/output tokens
  (sources vary slightly at the time of writing — confirm exact current
  rate before evaluating).
- **Capability summary:** Anthropic's fast/cheap tier, but still carries
  much of the Claude family's prose quality — Claude models consistently
  lead independent creative-writing benchmarks (EQ-Bench Creative) at every
  price point they compete in. Native Bedrock support, prompt caching
  available (up to ~90% cost reduction on repeated context — relevant to
  Weaver's context-assembly pattern, HLD §3).
- **Why shortlisted:** the strongest "premium quality, still cheap" anchor
  point — useful as the upper-quality reference the cheaper candidates below
  get measured against.

### 2. Amazon Nova Lite (Amazon)
- **Pricing:** ~$0.06 / $0.24 per million input/output tokens — among the
  cheapest models on Bedrock at any real capability tier.
- **Capability summary:** Bedrock-exclusive, built for cost-conscious
  high-volume use; general benchmarks put it roughly 10–12 points behind
  Claude/GPT-class models on broad measures like MMLU. Its specific
  narrative/creative-writing quality is **not well-documented publicly** —
  this is itself a reason to include it in the actual evaluation rather than
  rule it out on general-benchmark reputation alone, since general
  benchmarks are a poor proxy for prose quality (see note below).
- **Why shortlisted:** the cost/speed floor — worth confirming empirically
  whether it clears the narrative-quality bar at all, since if it does, it's
  a very cheap default.

### 3. DeepSeek V3.2 (DeepSeek, via Bedrock)
- **Pricing:** figures seen ranging ~$0.27–$0.62 input / ~$1.85 output per
  million tokens depending on source and exact variant — confirm the
  specific Bedrock-hosted SKU and its current rate.
- **Capability summary:** one independent writing-focused evaluation put it
  at roughly 92% of Claude's prose quality at under 4% of the cost. Broader
  industry commentary consistently describes it as the best-value pick for
  general narrative/reasoning work among non-Western frontier models
  available on Bedrock (added to Bedrock February 2026).
- **Why shortlisted:** the strongest cost/quality tradeoff candidate — if
  its prose quality holds up against Weaver's actual continuity-linting and
  scene-generation prompts, this is the likely production default.

### 4. Meta Llama 4 Scout (Meta, via Bedrock)
- **Pricing:** ~$0.17 per million tokens (blended) — MoE architecture, 17B
  active / 109B total parameters.
- **Capability summary:** the largest context window on Bedrock (10M
  tokens) — of particular relevance to MagpieEngine's context-assembly
  stage (HLD §3), which marshals character state, lore, and scene history
  per generation call. Open-weight, cheap, fast due to MoE's smaller active
  parameter count relative to total capacity. Creative-writing-specific
  reputation is more mixed than DeepSeek/Qwen in the sources reviewed —
  general-purpose strength, not a specialist pick for prose.
- **Why shortlisted:** the context-window angle is genuinely relevant to
  this specific application (long-running narrative continuity), separate
  from pure prose-quality ranking — worth testing whether that advantage
  offsets its more middling creative-writing reputation.

### 5. Qwen3 (235B-A22B variant, via Bedrock Marketplace)
- **Pricing:** not confirmed for the Bedrock-hosted route at time of
  writing — Qwen is listed among Bedrock Marketplace publishers, but the
  specific SKU/pricing needs verification directly against the Bedrock
  console before evaluation (Alibaba's own direct-API pricing for
  comparable Qwen tiers is in a similar cheap-frontier range to DeepSeek,
  but Marketplace routing may differ).
- **Capability summary:** repeatedly cited across independent sources as a
  top pick specifically for creative writing and narrative alignment among
  open-weight models — "superior creative alignment across all metrics" in
  one comparison, ahead of DeepSeek-V3 on that specific dimension. MoE
  architecture (22B active / 235B total).
- **Why shortlisted:** the strongest narrative-quality reputation of the
  open-weight candidates specifically — included despite the pricing
  uncertainty because quality is the top-weighted criterion here, and this
  is the candidate most worth confirming Bedrock availability/pricing for
  before the list is finalized.

---

## A note on benchmark choice

General-purpose benchmarks (MMLU, SWE-bench, etc.) correlate poorly with
prose/narrative quality — several sources reviewed for this document made
this point explicitly, and it matters here since Magpie Weaver's core loop
(HLD §3–4) is narrative generation, not code or structured-data tasks. The
actual evaluation task should weight creative-writing-specific signals
(EQ-Bench Creative or equivalent, and — most importantly — direct output
comparison against Weaver's real prompts and continuity-lint pass rate) far
more heavily than general leaderboard position.

## Non-goals of this document

This is not a recommendation, not a decision, and not a benchmark run. It's
a starting shortlist so the evaluation task doesn't begin from zero. The
evaluation task itself should confirm current pricing for all five, run
representative Weaver-style prompts through each, and score them against
the criteria above before any model is selected — including for the Local
Dev/testing tier's separate, smaller-model needs (HLD §12.8), which this
document does not cover.
