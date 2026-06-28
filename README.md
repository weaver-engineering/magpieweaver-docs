# Magpie Weaver

**Magpie Weaver is an AI agent that helps authors write and develop intricate, engaging stories and narratives.**

This package holds the documentation for the Magpie Weaver project — the place we capture what we're building and why, so we don't lose sight of the goal as the work evolves.

## What it is

Magpie Weaver is a collaborative storytelling agent. Rather than generating prose in one shot, it models a story as structured **metadata** — the lore, characters, story arcs, scenes, timelines, and revealed truths — and uses that model as the living source of truth for the narrative.

It then **empowers the characters through LLMs**, letting them engage with one another and with the author. The author directs scenes; the characters perform within them, grounded in everything the metadata knows about who they are and what has happened so far.

## How it works (in concept)

1. **Model the world as metadata.** Lore, characters, story arcs, and scenes are represented as structured data, not just freeform text.
2. **Bring characters to life.** Each character is driven by an LLM, informed by their metadata, so they can act and converse consistently and in-character.
3. **Author directs scenes.** The author sets up and steers scenes; characters engage with each other and respond to the author's direction.
4. **The agent maintains the model.** As scenes complete, Magpie Weaver updates and maintains the metadata — so characters, revealed truths, timelines, and relationships evolve accurately as the story is directed.

The result is a narrative that stays internally consistent and continues to grow correctly, with the metadata always reflecting the current state of the story.

## Core concepts

- **Lore** — the world's background facts, rules, and history.
- **Characters** — entities driven by LLMs, grounded in their own metadata.
- **Story arcs** — the larger narrative threads the story develops along.
- **Scenes** — the units of action where characters engage and the author directs.
- **Revealed truths** — facts that become known (to characters, the author, or the reader) as the story unfolds.
- **Timelines** — the ordering and evolution of events over the course of the story.

## Goal

To give authors a tool that handles the bookkeeping of a complex narrative — keeping the world model accurate and up to date — so they can focus on directing an engaging, evolving story while the characters and world stay consistent.

---

*This README is the high-level overview. As the project firms up, detailed topics (architecture, the metadata model, character engine, scene flow, roadmap) will move into their own documents within this package.*
