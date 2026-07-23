# Low Level Design - Task Phasing System

## Context

- [Glossary](../../../glossary.md) - Glossary of terms.
- [About Magpie Weaver](../../../magpie-weaver.md) - Background reading about Magpie Weaver.
- [High Level Design](../../../architecture/high-level-design.md) - Magpie Weaver high level design.
- [Architecture Definition](../../../architecture/architecture-definition-document.md) - Magpie Weaver Architecture.
- [Gate Checks Design](../gate-checks/gate-checks-lld.md) - Low level design for the phase gate checks.

## 1. System Details

### 1.1 Overview


### 1.2 Component Layout

* `packages/task-phases`
    * `cli.ts`                  # argument parsing and dispatch only
    * `types.ts`                # shared types
    * `tools`
        * `state`              # registry mapping name -> check function
        * `list` # individual function components
        * ``              # each function may receive params from command line


## 2. Interfaces
```typescript
```

## 3. Design Notes


## 4. Component Details

### 4.1 cli.ts
* The CLI entry point

### 4.2 types.ts
* Defines all the common types used by `task-phases`

### 4.3 state.ts


### 4.4 list.ts


