# Research: Running and training LLMs cheaply (for development and the agent)

> **Status:** agreed research (statement of fact once merged via `RES-2`).
> **Captured:** 2026-06-29.
> **Source:** an AI-assisted research conversation (Google AI Mode share link,
> consent-walled; content provided by the author as pasted text across five
> sections). Topic: running and training one's own LLM as cheaply as possible
> for an AI agent app, with a focus on character dialogue / scene generation.

This document is a **faithful summary of what the source says**. It records the
source's recommendations and reasoning; it does **not** record our decisions.
Our own commentary and the open questions are collected at the end under
[Our stance](#our-stance-not-part-of-the-research) and are explicitly *not* part
of the research. Inferences/interpretations are flagged.

Related research: [Magpie Weaver architecture](magpieweaver-architecture.md)
(`RES-1`) — its LLM-hosting question (self-hosted vs. commercial-API proxy) is
the decision this research feeds into.

---

## 1. Goal and overall strategy

The author's goal: run and (optionally) train their own LLM **as cheaply as
possible** for the agent, specifically to **generate text and dialogue for
characters in a scene**, ideally developing **free of charge** on a local
MacBook and only using cloud for scale/fine-tuning.

The source's overarching strategy:

- **Do not train from scratch.** Use **Parameter-Efficient Fine-Tuning (PEFT)** —
  **LoRA / QLoRA** — on a small, high-quality open-weights base model.
- **Use small models:** Llama-3-8B / Mistral-7B class.
- **Quantize** (4-bit) to shrink the GPU memory footprint.
- **Serve via vLLM / TGI** for high-throughput inference.

## 2. Cheap training on AWS (SageMaker)

- **Managed Spot Training** in Amazon SageMaker — up to **~90% savings** vs.
  On-Demand; SageMaker auto-handles checkpoints if a spot instance is reclaimed.
- **Fine-tuning instance:** `ml.g5.2xlarge` (single NVIDIA A10G, ~24GB VRAM),
  or `ml.g5.12xlarge` for larger jobs.
- **Estimator config:** the HuggingFace estimator with `use_spot_instances=True`,
  `max_wait` / `max_run` timeouts.
- **Dialogue-tuning hyperparameters (LoRA), as given:** `lora_r=16`,
  `lora_alpha=32`, `per_device_train_batch_size=2`,
  `gradient_accumulation_steps=4` (simulate a larger batch cheaply),
  `learning_rate=2e-4`, `epochs=3` (dialogue adaptation usually peaks at 2–3),
  `fp16=True`.

## 3. Training data for character dialogue

LLMs learn by pattern-matching, so structure the dataset to inject persona,
scene context, and clear dialogue boundaries:

- Format training JSON as **structured script blocks** with consistent markers:
  `### Context:`, `### Character:`, `### Personality:`, `### Dialogue:`.
- **Use the exact same markers** during training *and* production inference.
- **Filter out noise** — remove parentheticals like `(coughing)` /
  `(walks away)` unless you specifically want generated stage directions.

## 4. Multi-turn agent inference flow

```
[Agent Engine] -> [Scene Context + Last 3 Lines] -> [Fine-Tuned Model] -> [Next Character Line]
```

- **Dialogue state management:** do not resend the whole script each turn. Keep a
  **rolling window of the last 4–6 lines** in app memory to keep token cost low.
- **Enforce stop tokens** (e.g. `### Character:`, `BATMAN:`) so the model emits a
  single next line rather than generating the entire scene / talking to itself.

## 5. Cheap deployment / inference options

Given that cold starts can be handled in app code, the source ranks three
options by cost:

1. **SageMaker Serverless Inference** — pure pay-per-use; **$0 when idle**. AWS
   provisions a container on request, loads the model from S3, runs, spins down.
   **Cold start ~1–3 min.** Maximise container memory and use compressed 4-bit
   **AWQ/GPTQ** weights to minimise image download time.
2. **SageMaker Asynchronous Inference** — requests go to an **SQS queue**;
   autoscaling scales the GPU instance **down to 0** when the queue is empty and
   back to 1 on a new request. **Cold start ~3–5 min** (boot `ml.g5.xlarge` +
   load into VRAM). Scale-to-zero achieved via a target-tracking policy on the
   SQS `ApproximateNumberOfMessagesVisible` metric with min capacity 0.
3. **EC2 Spot + vLLM** — lowest cost for **bursty** use. Spin up a spot
   `g5.xlarge`, auto-launch vLLM on boot. The **app manages the lifecycle**:
   `ec2.start_instances()` → poll vLLM `/health` until `200 OK` → send prompt →
   `ec2.stop_instances()` when done.

**Cold-start handling pattern (app side):** decouple the request — return an
immediate **`202 Accepted` + job ID**, show a themed loading state ("Character is
thinking…"), then **poll/stream** status and deliver the dialogue once warm.

## 6. Cost considerations not to miss

- **Same Availability Zone:** keep the training job, the S3 dataset bucket, and
  the container registry in the **same AZ** to avoid cross-AZ transfer fees.
- **Region pricing:** us-east-1 (N. Virginia) / us-west-2 (Oregon) are usually
  significantly cheaper than EU/Asia regions.
- **Cold-start tradeoff:** scaling to zero saves the most, but waking a GPU to
  load an 8B model takes **2–5 min**; for instant real-time responses keep at
  least one `ml.g5.xlarge` warm.

## 7. Recommended open-source base models

Target models that fit a single GPU (under ~16–24GB VRAM) with strong creative
writing / roleplay / formatting:

- **Llama-3.1-8B-Instruct (Meta)** — current 8B gold standard; **128k context**
  (long script history + lore); highly steering-compliant (strict JSON / script
  formatting). 4-bit runs on ~8–10GB VRAM.
- **Mistral-7B-Instruct-v0.3 (Mistral AI)** — punches above its size for creative
  writing; **native function calling** (trigger app events: change weather, sound
  effects, pick next speaker); more natural prose. 32k context.
- **Hermes-3-Llama-3.1-8B (Nous Research)** — uncensored, highly creative
  Llama-3.1 fine-tune for agentic workflows, long-form writing, immersive
  roleplay; strong distinct character voices/emotion. 128k context.
- **ArliAI-Llama-3-8B-Formax** *(the source initially wrote "Forma", later
  clarified as "Formax")* — community tune **optimised for multi-turn roleplay /
  script generation**; engineered to **strictly follow response-format
  instructions without conversational filler**; resists repetition penalty in
  long conversations.

| Model | Primary strength | Context | Best for |
|-------|------------------|---------|----------|
| Llama-3.1-8B-Instruct | Structure & long context | 128k | Massive scenes, world-building, strict JSON |
| Mistral-7B-v0.3 | Logic & tool use | 32k | Multi-agent orchestration, app events via dialogue |
| Hermes-3-8B | Deep persona adherence | 128k | Distinct voices, emotional scenes, complex roleplay |
| ArliAI-Llama-3-8B-Formax | Format adherence, roleplay | (Llama-3/3.1) | Structured script dialogue, JSON agent schemas |

**Free testing before any download/AWS spend:** Hugging Face Chat (live), or
**LM Studio / Ollama** to pull 4-bit **GGUF** quants and prototype prompt design.

## 8. Free local development on a MacBook

The source confirms the agent can be **developed and run entirely free** on a
local Apple-Silicon MacBook, and the author's leaning toward
**ArliAI-Llama-3-8B-Formax** as suitable largely as-is:

- **Why Mac works:** Apple Silicon **Unified Memory Architecture (UMA)** — CPU
  and GPU share one RAM pool, so system RAM loads the LLM directly (no separate
  VRAM ceiling), giving fast local token generation.
- **Local stack:** **LM Studio** (visual; built-in HF search; one-click GGUF
  download + local server) or **Ollama** (lightweight CLI / background daemon).
- **Quantization:** avoid raw FP16 (needs ~16GB). Use **GGUF** **Q4_K_M** (~5GB
  RAM, fastest, ~99% of quality) or **Q5_K_M** (~6.5GB, slightly more accurate if
  16GB+ RAM).
- **Integration:** both expose an **OpenAI-compatible** local endpoint
  (`http://localhost:1234/v1` for LM Studio, `:11434` for Ollama). Point a
  standard OpenAI client at it (dummy API key) — no special local-inference code.
- **When to move back to AWS:** **distribution** (a laptop can't serve multiple
  concurrent users/streams) and **fine-tuning** on your own screenplay/IP (a Mac
  is slow to compute weights → export to SageMaker Spot, per section 2).

---

## Our stance (NOT part of the research)

Recorded separately so it does not contaminate the research record; this is the
input to the planning that follows.

- **Decision this feeds:** `RES-1` arrived at a revised design preferring a cheap
  **cloud API-proxy to commercial providers** (Anthropic/OpenAI/OpenRouter).
  `RES-2` lays out the **alternative**: run a **self-hosted open-source model**,
  free on a local Mac for development, scaling to AWS only for multi-user
  distribution and fine-tuning. These two paths are **in tension** and the model
  strategy is a genuine decision we must make explicitly — not settled by this
  research.
- The author has leaned toward **ArliAI-Llama-3-8B-Formax run locally** as a
  free development (and possibly dialogue-generation) path. We will treat that as
  a **candidate**, to be confirmed as a SMART decision under `PLAN-1` rather than
  adopted by default.
- Things likely to become tasks/decisions: which model(s) and provider strategy;
  whether/when fine-tuning is worth it vs. prompting a strong base; the local-dev
  vs. cloud-serving split; and how the OpenAI-compatible local endpoint fits the
  dual-mode (desktop/cloud) architecture from `RES-1`.
- *(Observation, not a research claim: the development of Magpie Weaver itself —
  our spec-driven workflow — currently uses a different model/tooling than the
  product's own character-dialogue model discussed here. The two are separate
  concerns.)*
