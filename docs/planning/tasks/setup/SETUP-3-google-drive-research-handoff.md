# SETUP-3 — Google Drive research handoff

| Field        | Value                    |
|--------------|--------------------------|
| Reference    | `SETUP-3`                |
| Type         | setup                    |
| Story / Epic | —                        |
| Output(s)    | —                        |
| Depends on   | —                        |
| Branch       | `setup/SETUP-3`          |
| Status       | Done                     |
| PRs          | #6                       |

## Purpose

Update the research workflow to use a Google Drive directory as the handoff
point between the agent (on the Mac) and the author's Gemini research sessions
(on the tablet). Replaces the prior approach of pasting source URLs or raw
content into the conversation.

## Scope / deliverables

- `docs/ways-of-working.md` — Research workflow section updated to describe
  the Google Drive handoff: the agent creates a `context_and_question.md` in
  the Drive directory; the author conducts research in Gemini and drops findings
  back into the same directory; the agent reads the findings and writes the
  summary.

## Measure of done

`docs/ways-of-working.md` reflects the new research workflow and the PR is
merged.
