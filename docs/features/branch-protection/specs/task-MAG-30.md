# Task MAG-30 — 

**State:** Specified
**Phase:** specification → test → build → deploy → done
**Component:** GitHub Workflow Actions and branch protection 
**Depends on:** none
**Related design docs:**
- Architecture Definition Document

---

## 1. Summary

Protect the stability of the platform's production code by blocking unreviewed pushes and enforcing linear history through squash merges using GitHub workflow actions and branch protection rules.


## 2. Why this task, why now

The architecting/designing and development environments are available and the architecture document is sufficiently complete to allow development to start. Branch protection needs to be in place from the start of development in a 100% agent authored code base.

## 3. In Scope

- BuildGate
- TestGate
- DeployTestAction
- MainGate
- DeployProdAction
-

## 4. Explicitly out of scope

- Deploying the test environment (it's not yet defined)
- Deploying the production environment (it's not yet defined)
- Gates for the `magpieweaver-docs` repository 

## 5. Acceptance criteria

- Pushing changes to `origin/build*` fails
- PRs to `origin/build*` enforce the `BuildGate` checks
- Failing checks on `origin/build/*` can be overridden by the architect 
- Pushing changes to `origin/uat*` fails
- PRs to `origin/uat` enforce the the `TestGate` checks
- Failing checks on `origin/uat` can be overridden by the architect
- Pushing to `origin/main*` fails
- PRs to `origin/main*` enforce the `MainGate` checks 
- Failing checks on `origin/` can be overridden by the architect
- Pull requests in the repository default to Squash and Merge only.

## 6. Notes for the agent

- None