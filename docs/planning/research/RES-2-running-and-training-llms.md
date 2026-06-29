# RES-2 — Summarise research on running and training LLMs cheaply

| Field        | Value                          |
|--------------|--------------------------------|
| Reference    | `RES-2`                        |
| Type         | research                       |
| Story / Epic | —                              |
| Component(s) | —                              |
| Branch       | `research/RES-2`               |
| Status       | Done                           |
| PRs          | _(this PR)_                    |

## Purpose

Review the research the author provided on running and training an LLM as cheaply
as possible for the agent (with a focus on character dialogue / scene generation,
free local development on a Mac, and AWS for scale/fine-tuning), and capture a
**faithful summary** as agreed fact the project can plan against.

## Source

A Google AI Mode share link, consent-walled; content supplied by the author as
pasted text across five sections.

## Deliverable

- [`docs/research/running-and-training-llms.md`](../../research/running-and-training-llms.md)
  — the faithful summary, with our stance kept separate from the research.

## Measure of done

The summary is written, faithfully reflects the source, flags inferences, keeps
our stance separate, and is merged with the author's approval (confirming we
agree it is correct).

## Notes

Docs-only research task: single review gate (this PR). On merge the research is a
statement of fact. It directly feeds the **LLM model/hosting decision** raised in
`RES-1` (self-hosted open-source vs. commercial-API proxy), which will be
resolved as an explicit decision under `PLAN-1`.
