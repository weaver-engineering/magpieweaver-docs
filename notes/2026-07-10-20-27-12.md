---
created: 2026-07-10T20:27:12+01:00
modified: 2026-07-10T20:27:20+01:00
---

# Magpie Weaver — Workflow Design Summary

This is a narrative walkthrough of how authoring, collaboration, and
background generation actually work end to end, as designed so far. The
underlying mechanics here are considered settled — the open work is in
defining the specific author-facing vocabulary, UI, and edge-case handling
around them (tracked separately as the Simplified Git Workflow UX task).

---

## 1. The basic mental model: everyone works on their own branch

Every author has their own private cloud workspace, with its own Git host
and its own in-memory cache. There's no shared live editing session and no
real-time multi-user document — collaboration happens at the level of Git
branches, pull requests, and merges, not live cursors.

If an author uses multiple devices, they're all working on the *same*
branch — the app treats "the author's current work" as one continuous
thing regardless of which device they're on, coordinated via checksum-
validated writes so two devices can't silently clobber each other's edits.

**This is settled.** What's still open is exactly what an author sees this
as — do they know they have a "branch" at all, or is it invisible?

---

## 2. Two ways of editing, matched to two ways of persisting

There are two distinct modes of work, and they persist differently on
purpose:

- **Data Entry Mode** — plain editing: open a character, edit a field, save.
  Every edit is immediately durable (written to a per-entity write-ahead
  log, then flushed to disk and the cache in the background), but it is
  *not* a Git commit yet. Commits only happen when the author hits
  `[Publish]`, which bundles up the current state of their workspace as a
  commit and pushes it (or raises a PR, if they're a contributor rather than
  the project owner).
- **Scene Director Mode** — interactive scene direction: the author gives
  actors direction, says `[Action]`, watches (or walks away from) a take
  playing out, and edits the resulting prose. Only one commit happens here,
  at `[Wrap]`, when the author confirms the state changes that occurred
  during the scene.

The reasoning: if every field edit or every line of dialogue became its own
Git commit, the commit history would be meaningless noise. Commits are kept
to the unit of work an author actually thinks in — "I finished editing this
character" or "I finished this scene" — not every keystroke.

**This is settled.** The write-ahead/durability mechanics behind Data Entry
Mode are also settled. Nothing further to define here.

---

## 3. How authors merge work back together

When an author (or the project owner reviewing a contributor's PR) merges
changes, conflicts are resolved at the *data* level, not the text level.
Both versions of a changed entity are parsed against their JSON schema, and
resolved by attribute:

- Non-overlapping changes merge automatically.
- Same-attribute conflicts that can't be auto-resolved get kicked back to
  the contributor as a rejected PR, with the app guiding them through
  fixing it — the same shape as a normal code-review cycle, just scoped to
  JSON attributes instead of source files, and without requiring the author
  to know Git internals.
- For fields that are just descriptive prose (a lore description, a
  character's write-up), the app can offer an LLM-assisted merge — "combine
  these two versions." For fields tagged as canonical fact, this is never
  done automatically; the author has to explicitly pick a version, because
  blending two contradictory facts into fluent prose would hide the
  contradiction rather than resolve it.

**This is settled** as a resolution strategy. What's still open: the exact
UI an author sees when this happens (how a conflict is presented, what
buttons/choices they get), and which specific entity attributes get tagged
descriptive vs. canonical-fact (a schema-design task, not a mechanics task).

---

## 4. Why performance stays cheap: a small, mostly-cold cache

Project data (characters, scenes, lore) is small in volume, so there's no
need for a database — a lightweight in-memory cache/index sits over the raw
files for each author's branch, giving fast querying (e.g. "all scenes
where character X knows fact Y") without hitting Git directly.

That cache only needs to be "always on" while someone's actually using it.
The moment of truth for the whole cost model is this: **Git itself never
needs to run as an always-on service** — only the cache does, and only
while recently active. When an author (or a background job) stops touching
their branch, the cache can go cold; when they come back, it warms back up
fast because only a small, pre-maintained index file needs to be reloaded,
not the whole project re-scanned.

A few precise rules govern when the cache goes stale and needs refreshing:
- Ordinary saves (commits made through the app itself) keep the cache
  correct automatically — there's nothing to invalidate.
- Git operations that change data from *outside* the app's normal write
  path — specifically merging and rebasing — do invalidate the cache, but
  only for the one branch that operation touched. Other branches are
  unaffected, even if they're now "behind."
- When a merge involves resolving conflicts, the resolved data, the
  refreshed index, and the rebase onto the target branch all have to
  succeed together as one unit — never partially, since a half-finished
  version of this could leave the destination branch looking consistent
  when it isn't.

**This is settled.** What's open: the actual idle-timeout numbers (tuned
during development), and validating rebuild-time assumptions hold at
realistic (not just small test) project sizes.

---

## 5. Two kinds of "work happening," both durable without you watching

There are two different execution models, and the walk-away requirement
(mobile is the primary audience) shapes both of them:

- **Interactive direction** — the author is actively chatting with actors
  in a scene. Once `[Action]` is given, though, the actors run the take on
  their own. If the author's phone drops connection or they just close the
  app, the outcome is identical to if they'd stayed watching — the scene
  keeps generating server-side, writing to the branch as it goes.
- **Background jobs** — things explicitly kicked off to run without anyone
  watching: regenerating a scene's prose from scratch after an upstream
  change, or making a smaller direct correction to existing prose. These
  are properly queued (not just fire-and-forget), so a job has a real
  status (running, failed, waiting for input) that survives independent of
  whether anyone's connected.

Both of these are really the same underlying mechanism — a job that writes
only to its own isolated branch until it's ready to become a PR. That
isolation is what makes failure handling simple: no matter why or when a
job dies, all that's needed is to tell the author what state it ended up
in. There's no cleanup or rollback across other people's work, because
nothing outside that one branch was ever touched.

If a job gets stuck — most likely failing the same continuity check
repeatedly — it doesn't loop forever. It gives up after a bounded number of
retries or a time limit, saves what progress it made, and asks the author
for direction instead of burning cost indefinitely.

**This is settled.** What's open: the precise retry-count/timeout defaults,
and — separately — a general rule for when the *system itself* (rather than
the author) decides an edit is big enough to require the background-job
path instead of happening interactively.

---

## 6. Keeping the story's timeline honest

The chronology (the actual order events happened in, independent of the
order scenes are told in the final story) allows branching and merging —
flashbacks, concurrent storylines, etc. The one hard rule: a character (or
any entity) can only be on one branch of the timeline at a time, and
changes on one concurrent branch aren't visible to another until the
branches are explicitly merged.

The app checks this rule the moment an author edits the chronology — so
most mistakes get caught immediately, before they happen. The harder case
is when a *merge* — bringing two chronology branches together — creates an
inconsistency that neither branch had on its own (e.g. a scene now requires
a character to have already lost a hand, but the merge means that hasn't
happened yet on this path). The app can't catch that at the moment of edit,
so instead it runs a validation pass after merges, flags anything broken,
and walks the author through fixing it — the same "allow, then reconcile"
pattern Git itself uses for code conflicts.

The app also tries to head problems off before they happen: if an edit
looks likely to break downstream scenes, it warns the author and offers to
fix things via a background job, rather than blocking the edit outright —
because authors legitimately explore contradictory ideas while drafting,
and a hard block would get in the way of that.

**This is settled.**

---

## What's actually left to define

The mechanics above aren't expected to change. What needs to be worked out
next is almost entirely about **the vocabulary and interface an author
actually sees**, since none of them are expected to understand Git:

- What a "branch," a "PR," and a "conflict" are called and look like in the
  app (if they're surfaced at all).
- Exactly which Git operations an author can trigger, and which are
  entirely hidden behind app-level actions like `[Publish]` and `[Wrap]`.
- How background-job branches are shown differently from an author's own
  working branch.
- The specific numeric knobs (idle timeout, retry counts, coverage
  thresholds) that get tuned once real usage data exists.

That's tracked as its own task (Simplified Git Workflow UX) precisely
because it's a real design effort in its own right, not a footnote to the
mechanics above.
