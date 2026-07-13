# ADR-023: Account PII Storage — Self-Service Onboarding with Static-Key Encryption

**Status:** Approved

**Related:** ADR-022 (Structured PII Linter — narrative content, not account
data); `docs/specs/tech-stack.md` §4.1/§6/§7; `docs/specs/mvp-scope-summary.md`
§4/§6.

---

## Context

Magpie Weaver requires the author to authenticate before the app is usable
at all (Google Sign-In, per `docs/specs/tech-stack.md` §4.1). Authentication
alone establishes *who* the caller is; it doesn't by itself account for two
things this ADR needs to settle:

1. Where any real, personal data about that account holder is stored, and
   how it's protected.
2. What happens the first time a validly-authenticated caller has no
   existing workspace — since MVP onboarding was decided to be
   self-service (correcting an earlier, wrong assumption in this project's
   own design conversation that it would be hand-provisioned).

This is a genuinely different category of PII from ADR-022's scope. ADR-022
governs **narrative-content** PII — a fictional character's email address
appearing in generated prose, hard-blocked by default with an audited
override. This ADR governs **account PII** — the real, authenticated
person's own name and email, deliberately and necessarily stored. Different
data, different threat model, different handling rules; this ADR exists so
the two aren't conflated in the documentation or in future implementation.

## Decision

**Storage location and contents.** On first login with no existing
workspace, the user is walked through a self-service flow: Terms &
Conditions acceptance, then workspace creation. The backend writes a
`user.json` file into that workspace containing:

```
{
  firstName: "<encrypted>",
  lastName: "<encrypted>",
  emailAddress: "<encrypted>",
  llmEnabled: false,
  termsAndConditions: {
    accepted: true,
    auth: "<the OAuth token active in the session which accepted the terms>",
    acceptedAt: "<ISO-8601 timestamp>",
    version: "<major>.<minor>.<point>"
  }
}
```

This is **the only place Magpie Weaver stores PII.**

**Encryption.** `firstName`, `lastName`, and `emailAddress` are encrypted at
rest using a static key. The key is sourced from **AWS SSM Parameter Store
as a `SecureString`**, fetched by the instance's IAM role at boot
(`get-parameter --with-decryption` in user-data) — never baked into an AMI
or user-data script in plaintext, and never held anywhere except the
running process's memory. `SecureString` parameters are themselves
KMS-encrypted at rest and free at standard-parameter tier.

**Consent record.** The `termsAndConditions` block records acceptance
explicitly, including the raw OAuth token active at the moment of
acceptance. An `acceptedAt` timestamp is stored alongside it deliberately:
Google ID tokens are short-lived and signed against a JWKS that rotates
over time, so the token's cryptographic *verifiability* degrades long after
the fact even though the string itself persists. The timestamp is the
durable, format-independent record of *when* consent was given, independent
of whether the token can still be checked years later.

**Storage location relative to Git.** `user.json` is **not Git-tracked** —
it is held outside the Git working tree, on EFS, alongside but separate
from the user's Git-backed narrative workspace. This is deliberate, not a
default: Git history persists even after squashing unless explicitly
purged, which would otherwise make real account PII subject to the same
right-to-erasure gap already flagged for narrative content (HLD §11.11).
Keeping `user.json` outside Git means deleting or overwriting the file is a
real, complete erasure, with no historical copy retained anywhere.

**Bounding unrestricted self-service creation.** Since onboarding has no
identity allowlist, any authenticated Google account holder who reaches the
running instance directly can trigger workspace creation. Two independent
controls bound the two different things this exposes, rather than one
mechanism trying to do both:
- **Storage:** a per-user EFS usage quota (flat for MVP; tiered quotas are
  a natural later extension once there's a reason to differentiate users).
- **LLM spend (the genuinely expensive risk):** the `llmEnabled` boolean
  above, defaulted to `false` on self-service creation. A newly
  self-onboarded workspace exists but cannot trigger LLM calls until the
  operator manually sets this flag for that specific user — a deliberate,
  manual, per-user switch, appropriate given MVP's actual expected user
  count.

The wake-path's shared-secret gate (`docs/specs/tech-stack.md` §4.1) is a
third, separate control — it protects the stopped→running transition
against blind/automated discovery, and is explicitly not a data-access or
cost boundary. All three controls do different jobs at different layers and
are not redundant with each other.

## Consequences

**Positive:**
- Minimal backend surface — no Cognito, no DynamoDB, no user-management
  service. Reuses the existing per-user EFS workspace model as the
  authorization source rather than inventing a second one.
- Clean separation between account PII and narrative-content PII, each with
  handling rules matched to its actual risk profile.
- No right-to-erasure exposure for account PII specifically, by construction
  (non-Git-tracked storage).
- The two most expensive failure modes (unbounded storage growth, unbounded
  LLM spend) each have an explicit, independent control rather than relying
  on a single mechanism to catch both.

**Negative / accepted risk:**
- **Key rotation is not yet defined.** This ADR specifies where the static
  encryption key is sourced from, not how or whether it's ever rotated. Not
  a blocker for MVP given the current scale, but a real gap — flagged here
  explicitly so it isn't silently assumed solved.
- **Boot-time dependency on SSM availability.** If the instance cannot reach
  SSM Parameter Store at boot, it cannot decrypt (or newly encrypt) account
  PII fields — a single dependency the instance's startup path now relies
  on. Acceptable at MVP scale; worth revisiting if boot reliability becomes
  a concern.
- **`llmEnabled` is a manual, non-scaling control.** Appropriate for MVP's
  handful of users; explicitly not a mechanism intended to survive a larger
  user base unchanged — a real constraint on how far MVP's current shape
  can stretch before needing revisiting.
- **No allowlist on workspace creation itself.** Any Google account holder
  can create a workspace (bounded by storage quota, not prevented outright).
  Accepted as reasonable given `llmEnabled` closes off the expensive part of
  that exposure; revisit if storage-quota abuse becomes a real cost in
  practice.

## Alternatives Considered

- **Amazon Cognito User Pool.** Full identity-provider capability (signup,
  password reset, MFA). Rejected for MVP as more setup than the actual
  requirement needs — Google Sign-In already supplies verified identity;
  Cognito would be solving a problem (user management) MVP doesn't have.
  May be worth reconsidering once real user-management needs exist beyond
  simple authentication.
- **Hand-provisioned workspace creation (no self-service).** This was the
  original assumption earlier in this project's design process. Corrected
  once it became clear it doesn't match the simplest realistic onboarding
  path for even a small number of users; self-service with the bounding
  controls above was judged a better fit than operator-provisioned access.
- **Storing `user.json` inside the Git-tracked workspace.** Rejected
  specifically because of the right-to-erasure implication for real PII —
  see Decision above.
