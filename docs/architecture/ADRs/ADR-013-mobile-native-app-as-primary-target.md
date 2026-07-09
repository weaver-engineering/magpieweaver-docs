# ADR-013 — Native Mobile App as Primary Target, Not PWA (Approved)

**Decision:** Build mobile as a native iOS/Android app — a thin client of the
same per-user cloud workspace/API used by Enterprise Cloud Mode — rather
than a mobile web app or PWA.

**Key rationale:**
- Mobile is the primary target audience; the core requirement is that an
  author can start scene generation, walk away, and be notified when it's
  ready — this requires reliable background execution and push
  notifications, which iOS in particular does not provide to PWAs (Safari
  suspends background JS almost immediately once not foregrounded).
- Because scene generation is already server-side (LLM calls run in the
  cloud workspace regardless of client connection state), the native app
  itself can remain thin — it does not need its own persistence model beyond
  a lightweight cache.
- A native app supports proper OS-level background task APIs and push
  notification delivery (APNs/FCM), matching the async job model (ADR-014).

**Consequence to note:** requires app store distribution and review process
for both iOS and Android (see HLD §12.10, open), and duplicated native app
shells (even if thin) rather than a single cross-platform web deployment.