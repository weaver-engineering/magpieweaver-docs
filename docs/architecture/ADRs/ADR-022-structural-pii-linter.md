# ADR-022 — Structured PII Linter: Hard Block with Audited Override (Approved)

**Decision:** Lint author-entered content and generated prose for four
structured PII patterns — email addresses, phone numbers, dates of birth,
and URLs — and **hard block** on a match, rather than warn-and-allow. The
block can be overridden by the author, but only via an explicit,
individually-logged confirmation, not a silent bypass. The override
confirmation text states: *"By overriding, you are confirming that the
flagged content is narrative detail and does not reflect a real person."*

**Key rationale:**
- In ordinary prose and dialogue, concrete information transfer (an email
  address, a phone number, a URL) can almost always be conveyed narratively
  without ever exposing the literal string on the page — a character can be
  told to "send it to my email" without the email itself ever appearing —
  which is why these four categories default to blocked rather than merely
  flagged, unlike the general chronology "warn, don't block" philosophy
  (§9) that governs elsewhere in the system.
- Genuine exceptions exist (epistolary fiction presenting a document
  verbatim, a thriller where the exact string is the clue, an identity-
  reveal scene stating an exact birthdate) — a hard block without any
  override would incorrectly foreclose legitimate craft in these cases.
- The override is deliberately not silent: a pattern match cannot
  distinguish a real leaked identifier from an invented fictional one (the
  same regex matches both), so the audited confirmation exists to place a
  clear, attributable acknowledgment on the record at the moment of
  override, rather than to technically verify the content is safe — the
  linter cannot verify that regardless of how it's configured.
- Consistent with wanting to be seen doing the right thing proactively
  (also reflected in the environmental framing of scale-to-zero, §12.5) —
  a hard default with a real, effortful override is a stronger public
  stance than a dismissible warning, while still not blocking legitimate
  narrative use outright.

**Consequence to note:** this catches only the four structured, pattern-
matchable categories — it does not and cannot catch descriptive
identification of a real person (sufficient contextual detail without any
matching pattern appearing at all). This is a real, valuable first line of
defense, not a complete solution to the broader PII/third-party-privacy
question raised in HLD §12.11, which remains a compliance item requiring
legal input. Override events should be retained (what was flagged, when,
by whom) in case they're needed later — exact retention duration/location
not yet specified.